/**
 * Tests pour routes calendrier (iCal feed + export).
 * v2.157.2 hardening : dates invalides ignorees, line folding RFC 5545, Outlook validation.
 */
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app
let teacherToken
let studentToken

beforeAll(() => {
  setupTestDb()
  teacherToken = jwt.sign({ id: 1, name: 'Prof Test', type: 'teacher' }, JWT_SECRET)
  studentToken = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)

  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/calendar', auth, require('../../../server/routes/calendar'))
})

afterAll(() => teardownTestDb())

describe('GET /api/calendar/feed.ics', () => {
  it('returns 200 with iCalendar content-type', async () => {
    const res = await request(app)
      .get('/api/calendar/feed.ics')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/calendar/)
    expect(res.text).toMatch(/^BEGIN:VCALENDAR/)
    expect(res.text).toMatch(/END:VCALENDAR\s*$/)
  })

  it('does not emit NaNNaNNaN for invalid dates (skips them)', async () => {
    const db = getTestDb()
    db.prepare(`INSERT INTO teacher_reminders (promo_tag, date, title, description, bloc)
                VALUES ('T1', 'pas-une-date', 'Rappel bogue', '', 'BL1')`).run()
    db.prepare(`INSERT INTO teacher_reminders (promo_tag, date, title, description, bloc)
                VALUES ('T1', '2026-05-12', 'Rappel valide', '', 'BL1')`).run()

    const res = await request(app)
      .get('/api/calendar/feed.ics')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.text).not.toMatch(/NaN/)
    expect(res.text).toMatch(/DTSTART;VALUE=DATE:20260512/)
    // Rappel bogue ne doit pas apparaitre (date invalide skippee)
    expect(res.text).not.toMatch(/Rappel bogue/)
  })

  it('escapes special chars in description (\\n, comma, semicolon)', async () => {
    const db = getTestDb()
    db.prepare(`INSERT INTO teacher_reminders (promo_tag, date, title, description, bloc)
                VALUES ('T1', '2026-06-15', 'Titre avec, virgule; point-virgule', 'Desc\nmulti-ligne\rCR', 'BL1')`).run()

    const res = await request(app)
      .get('/api/calendar/feed.ics')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/Titre avec\\, virgule\\; point-virgule/)
    expect(res.text).toMatch(/Desc\\nmulti-ligne\\nCR/)
  })
})

describe('POST /api/calendar/outlook/events (validation)', () => {
  it('returns 400 for invalid date', async () => {
    const res = await request(app)
      .post('/api/calendar/outlook/events')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'Test', startDateTime: 'pas-iso', endDateTime: '2026-04-20T10:00:00Z' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Dates invalides/)
  })

  it('returns 400 when end <= start', async () => {
    const res = await request(app)
      .post('/api/calendar/outlook/events')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'Test', startDateTime: '2026-04-20T11:00:00Z', endDateTime: '2026-04-20T10:00:00Z' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/apres startDateTime/)
  })

  it('returns 400 for oversize subject', async () => {
    const res = await request(app)
      .post('/api/calendar/outlook/events')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'x'.repeat(501), startDateTime: '2026-04-20T10:00:00Z', endDateTime: '2026-04-20T11:00:00Z' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/subject invalide/)
  })

  it('returns 400 when attendees not array', async () => {
    const res = await request(app)
      .post('/api/calendar/outlook/events')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ subject: 'Test', startDateTime: '2026-04-20T10:00:00Z', endDateTime: '2026-04-20T11:00:00Z', attendees: 'notanarray' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/attendees/)
  })

  it('rejects students (403)', async () => {
    const res = await request(app)
      .post('/api/calendar/outlook/events')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ subject: 'Test', startDateTime: '2026-04-20T10:00:00Z', endDateTime: '2026-04-20T11:00:00Z' })
    expect(res.status).toBe(403)
  })
})
