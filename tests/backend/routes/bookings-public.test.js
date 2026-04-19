/**
 * Tests routes publiques booking :
 *   - GET cancel/:token doit rediriger (pas muter) : anti link-preview CSRF
 *   - POST cancel/:token annule effectivement
 *   - GET cancel/:token/info renvoie un snapshot sans muter
 *   - ICS scope par token (pas de fuite cross-student)
 */
const express = require('express')
const request = require('supertest')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

let app
let queries

beforeAll(() => {
  setupTestDb()
  queries = require('../../../server/db/models/bookings')

  // Seed event type + bookings
  const db = getTestDb()
  db.prepare(`
    INSERT OR IGNORE INTO booking_event_types
      (id, teacher_id, title, slug, duration_minutes, buffer_minutes, timezone)
    VALUES (1, 1, 'Suivi', 'suivi', 30, 0, 'Europe/Paris')
  `).run()

  app = express()
  app.use(express.json())
  app.use('/api/bookings', require('../../../server/routes/bookings'))
}, 30_000)

afterAll(() => teardownTestDb())

// Helper : cree un booking valide, retourne { booking, tokenRow }
function seedBooking({ start = '2099-06-10T10:00:00.000Z', end = '2099-06-10T10:30:00.000Z' } = {}) {
  const tokenRow = queries.getOrCreateToken(1, 1)
  const booking = queries.createBookingAtomic({
    eventTypeId: 1, studentId: 1, teacherId: 1,
    tutorName: 'Tutor', tutorEmail: 'tutor@corp.fr',
    startDatetime: start, endDatetime: end,
  })
  return { booking, tokenRow }
}

describe('GET /api/bookings/public/cancel/:cancelToken — redirect only (anti-CSRF)', () => {
  it('redirects 302 to frontend without touching DB', async () => {
    const { booking } = seedBooking({ start: '2099-06-11T10:00:00.000Z', end: '2099-06-11T10:30:00.000Z' })
    const res = await request(app).get(`/api/bookings/public/cancel/${booking.cancel_token}`)
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain(`/#/book/cancel/${booking.cancel_token}`)
    // Reservation toujours confirmee : GET n'a rien mute
    const row = getTestDb().prepare('SELECT status FROM bookings WHERE id = ?').get(booking.id)
    expect(row.status).toBe('confirmed')
  })
})

describe('GET /api/bookings/public/cancel/:token/info', () => {
  it('returns booking snapshot without mutating', async () => {
    const { booking } = seedBooking({ start: '2099-06-12T10:00:00.000Z', end: '2099-06-12T10:30:00.000Z' })
    const res = await request(app).get(`/api/bookings/public/cancel/${booking.cancel_token}/info`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.alreadyCancelled).toBe(false)
    expect(res.body.data.eventTitle).toBe('Suivi')
    const row = getTestDb().prepare('SELECT status FROM bookings WHERE id = ?').get(booking.id)
    expect(row.status).toBe('confirmed')
  })

  it('returns 404 on unknown cancelToken', async () => {
    const res = await request(app).get('/api/bookings/public/cancel/nope/info')
    expect(res.status).toBe(404)
  })
})

describe('POST /api/bookings/public/cancel/:cancelToken', () => {
  it('cancels a confirmed booking', async () => {
    const { booking } = seedBooking({ start: '2099-06-13T10:00:00.000Z', end: '2099-06-13T10:30:00.000Z' })
    const res = await request(app).post(`/api/bookings/public/cancel/${booking.cancel_token}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.alreadyCancelled).toBe(false)
    const row = getTestDb().prepare('SELECT status FROM bookings WHERE id = ?').get(booking.id)
    expect(row.status).toBe('cancelled')
  })

  it('returns alreadyCancelled=true on a second call', async () => {
    const { booking } = seedBooking({ start: '2099-06-14T10:00:00.000Z', end: '2099-06-14T10:30:00.000Z' })
    await request(app).post(`/api/bookings/public/cancel/${booking.cancel_token}`)
    const res2 = await request(app).post(`/api/bookings/public/cancel/${booking.cancel_token}`)
    expect(res2.status).toBe(200)
    expect(res2.body.data.alreadyCancelled).toBe(true)
  })

  it('returns 404 on unknown cancelToken', async () => {
    const res = await request(app).post('/api/bookings/public/cancel/invalid')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/bookings/public/:token/booking/:bookingId/ics', () => {
  it('returns 404 when bookingId does not belong to the token scope', async () => {
    // Seed un booking pour student 1 (default)
    const { booking } = seedBooking({ start: '2099-06-15T10:00:00.000Z', end: '2099-06-15T10:30:00.000Z' })
    // Student 2 token
    const db = getTestDb()
    db.prepare(
      `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
       VALUES (2, 1, 'Alice', 'alice@test.fr', 'AL', 'xxxxx', 0)`
    ).run()
    const otherTok = queries.getOrCreateToken(1, 2)
    const res = await request(app).get(`/api/bookings/public/${otherTok.token}/booking/${booking.id}/ics`)
    expect(res.status).toBe(404)
  })

  it('returns ICS content when token scope matches', async () => {
    const { booking, tokenRow } = seedBooking({ start: '2099-06-16T10:00:00.000Z', end: '2099-06-16T10:30:00.000Z' })
    const res = await request(app).get(`/api/bookings/public/${tokenRow.token}/booking/${booking.id}/ics`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/calendar')
    expect(res.text).toContain('BEGIN:VCALENDAR')
  })
})
