/**
 * Tests unitaires du model bookings : atomicite, buffer conflicts,
 * tokens crypto, OAuth state lifecycle.
 */
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

let queries

beforeAll(() => {
  setupTestDb()
  queries = require('../../../server/db/models/bookings')

  // Seed : event type pour la prof id=1
  const db = getTestDb()
  db.prepare(`
    INSERT OR IGNORE INTO booking_event_types
      (id, teacher_id, title, slug, duration_minutes, buffer_minutes, timezone)
    VALUES (1, 1, 'Suivi memoire', 'suivi', 30, 15, 'Europe/Paris')
  `).run()
})

afterAll(() => teardownTestDb())

describe('secureToken tokens', () => {
  it('getOrCreateToken is idempotent per (eventType, student)', () => {
    const t1 = queries.getOrCreateToken(1, 1)
    const t2 = queries.getOrCreateToken(1, 1)
    expect(t1.token).toBe(t2.token)
    expect(t1.token.length).toBeGreaterThanOrEqual(40) // base64url(32 bytes) ~= 43
  })

  it('tokens differ across (eventType, student) pairs', () => {
    // seed a second student
    const db = getTestDb()
    db.prepare(
      `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
       VALUES (2, 1, 'Alice', 'alice@test.fr', 'AL', 'xxxxx', 0)`
    ).run()
    const t1 = queries.getOrCreateToken(1, 1)
    const t2 = queries.getOrCreateToken(1, 2)
    expect(t1.token).not.toBe(t2.token)
  })
})

describe('createBookingAtomic', () => {
  const baseArgs = () => ({
    eventTypeId: 1,
    studentId: 1,
    teacherId: 1,
    tutorName: 'Tutor A',
    tutorEmail: 'tutor@corp.fr',
    startDatetime: '2099-06-10T10:00:00.000Z',
    endDatetime:   '2099-06-10T10:30:00.000Z',
    bufferMinutes: 0,
  })

  beforeEach(() => {
    getTestDb().prepare('DELETE FROM bookings').run()
  })

  it('inserts a new booking and returns it with a cancel_token', () => {
    const b = queries.createBookingAtomic(baseArgs())
    expect(b).toBeTruthy()
    expect(b.cancel_token.length).toBeGreaterThanOrEqual(40)
    expect(b.status).toBe('confirmed')
  })

  it('returns null on direct overlap (TOCTOU-safe)', () => {
    const a = queries.createBookingAtomic(baseArgs())
    expect(a).toBeTruthy()
    const b = queries.createBookingAtomic(baseArgs()) // exact same slot
    expect(b).toBeNull()
  })

  it('allows back-to-back when bufferMinutes = 0', () => {
    queries.createBookingAtomic(baseArgs()) // 10:00-10:30
    const next = queries.createBookingAtomic({
      ...baseArgs(),
      startDatetime: '2099-06-10T10:30:00.000Z',
      endDatetime:   '2099-06-10T11:00:00.000Z',
    })
    expect(next).toBeTruthy()
  })

  it('rejects back-to-back when buffer >= gap', () => {
    queries.createBookingAtomic({ ...baseArgs(), bufferMinutes: 15 }) // 10:00-10:30 + 15min buffer
    const next = queries.createBookingAtomic({
      ...baseArgs(),
      startDatetime: '2099-06-10T10:30:00.000Z',
      endDatetime:   '2099-06-10T11:00:00.000Z',
      bufferMinutes: 15,
    })
    expect(next).toBeNull()
  })

  it('allows back-to-back with buffer when gap exceeds buffer', () => {
    queries.createBookingAtomic({ ...baseArgs(), bufferMinutes: 10 })
    const next = queries.createBookingAtomic({
      ...baseArgs(),
      startDatetime: '2099-06-10T10:45:00.000Z', // 15 min apres end -> > buffer 10
      endDatetime:   '2099-06-10T11:15:00.000Z',
      bufferMinutes: 10,
    })
    expect(next).toBeTruthy()
  })

  it('does not count cancelled bookings as conflicts', () => {
    const a = queries.createBookingAtomic(baseArgs())
    queries.cancelBooking(a.id)
    const b = queries.createBookingAtomic(baseArgs())
    expect(b).toBeTruthy()
  })
})

describe('getBookingForToken (token-scoped lookup)', () => {
  beforeEach(() => {
    getTestDb().prepare('DELETE FROM bookings').run()
  })

  it('returns booking when token belongs to (event_type, student)', () => {
    const tok = queries.getOrCreateToken(1, 1)
    const b = queries.createBookingAtomic({
      eventTypeId: 1, studentId: 1, teacherId: 1,
      tutorName: 'T', tutorEmail: 't@corp.fr',
      startDatetime: '2099-07-01T10:00:00.000Z',
      endDatetime:   '2099-07-01T10:30:00.000Z',
    })
    const result = queries.getBookingForToken(b.id, tok.token)
    expect(result).toBeTruthy()
    expect(result.id).toBe(b.id)
  })

  it('returns null when token does not match the booking scope', () => {
    // Student 2 booking, but we pass student 1's token -> mismatch
    const b = queries.createBookingAtomic({
      eventTypeId: 1, studentId: 2, teacherId: 1,
      tutorName: 'T', tutorEmail: 't@corp.fr',
      startDatetime: '2099-08-01T10:00:00.000Z',
      endDatetime:   '2099-08-01T10:30:00.000Z',
    })
    const tok1 = queries.getOrCreateToken(1, 1)
    const result = queries.getBookingForToken(b.id, tok1.token)
    expect(result).toBeNull()
  })
})

describe('OAuth state lifecycle', () => {
  beforeEach(() => {
    getTestDb().prepare('DELETE FROM oauth_states').run()
  })

  it('consumeOAuthState returns teacherId once then null', () => {
    queries.saveOAuthState('nonce-abc', 42)
    expect(queries.consumeOAuthState('nonce-abc')).toBe(42)
    expect(queries.consumeOAuthState('nonce-abc')).toBeNull() // deja consume
  })

  it('pruneExpiredOAuthStates removes expired rows only', () => {
    const db = getTestDb()
    db.prepare("INSERT INTO oauth_states (nonce, teacher_id, expires_at) VALUES ('old', 1, datetime('now','-1 hour'))").run()
    db.prepare("INSERT INTO oauth_states (nonce, teacher_id, expires_at) VALUES ('fresh', 1, datetime('now','+1 hour'))").run()
    queries.pruneExpiredOAuthStates()
    expect(db.prepare('SELECT nonce FROM oauth_states ORDER BY nonce').all().map(r => r.nonce)).toEqual(['fresh'])
  })

  it('consumeOAuthState rejects expired state', () => {
    const db = getTestDb()
    db.prepare("INSERT INTO oauth_states (nonce, teacher_id, expires_at) VALUES ('stale', 7, datetime('now','-1 minute'))").run()
    expect(queries.consumeOAuthState('stale')).toBeNull()
  })
})
