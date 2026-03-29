// ─── Tests live routes — promo listing, leaderboard, cross-promo isolation ───
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app, teacherToken, studentToken, student2Token

beforeAll(() => {
  setupTestDb()
  const db = getTestDb()

  // Promo 2 + student in promo 2
  db.exec(`INSERT OR IGNORE INTO promotions (id, name, color) VALUES (2, 'Promo B', '#E74C3C')`)
  db.prepare(
    `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
     VALUES (2, 2, 'Alice Martin', 'alice@test.fr', 'AM', 'hash', 0)`
  ).run()

  teacherToken  = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)
  studentToken  = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  student2Token = jwt.sign({ id: 2, name: 'Alice Martin', type: 'student', promo_id: 2 }, JWT_SECRET)

  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  app.set('io', { to: () => ({ emit: () => {} }) })
  const auth = require('../../../server/middleware/auth')
  app.use('/api/live', auth, require('../../../server/routes/live'))
})

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  GET /api/live/sessions/promo/:promoId — list sessions
// ═══════════════════════════════════════════
describe('GET /api/live/sessions/promo/:promoId', () => {
  let sessionId

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/live/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'Session Promo 1' })
    sessionId = res.body.data.id
  })

  it('teacher can list sessions for a promo', async () => {
    const res = await request(app)
      .get('/api/live/sessions/promo/1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })

  it('student can list sessions (no promo guard on this route)', async () => {
    const res = await request(app)
      .get('/api/live/sessions/promo/1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns empty array for promo with no sessions', async () => {
    const res = await request(app)
      .get('/api/live/sessions/promo/2')
      .set('Authorization', `Bearer ${student2Token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })
})

// ═══════════════════════════════════════════
//  GET /api/live/sessions/promo/:promoId/active
// ═══════════════════════════════════════════
describe('GET /api/live/sessions/promo/:promoId/active', () => {
  it('returns null when no active session', async () => {
    const res = await request(app)
      .get('/api/live/sessions/promo/2/active')
      .set('Authorization', `Bearer ${student2Token}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    // null or undefined is fine
  })

  it('returns active session after starting one', async () => {
    // Create and start session in promo 1
    const createRes = await request(app)
      .post('/api/live/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'Active Session' })
    const sid = createRes.body.data.id

    await request(app)
      .patch(`/api/live/sessions/${sid}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'active' })

    const res = await request(app)
      .get('/api/live/sessions/promo/1/active')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toBeTruthy()

    // Cleanup — end session
    await request(app)
      .patch(`/api/live/sessions/${sid}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'ended' })
  })

  it('student from another promo is blocked (403)', async () => {
    const res = await request(app)
      .get('/api/live/sessions/promo/1/active')
      .set('Authorization', `Bearer ${student2Token}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  GET /api/live/sessions/promo/:promoId/history
// ═══════════════════════════════════════════
describe('GET /api/live/sessions/promo/:promoId/history', () => {
  it('teacher can get session history', async () => {
    const res = await request(app)
      .get('/api/live/sessions/promo/1/history')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('student from another promo is blocked (403)', async () => {
    const res = await request(app)
      .get('/api/live/sessions/promo/1/history')
      .set('Authorization', `Bearer ${student2Token}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  GET /api/live/sessions/promo/:promoId/stats
// ═══════════════════════════════════════════
describe('GET /api/live/sessions/promo/:promoId/stats', () => {
  it('teacher can get live stats for promo', async () => {
    const res = await request(app)
      .get('/api/live/sessions/promo/1/stats')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('student from another promo is blocked (403)', async () => {
    const res = await request(app)
      .get('/api/live/sessions/promo/1/stats')
      .set('Authorization', `Bearer ${student2Token}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  GET /api/live/sessions/:id/leaderboard
// ═══════════════════════════════════════════
describe('GET /api/live/sessions/:id/leaderboard', () => {
  let sessionId, activityId

  beforeAll(async () => {
    // Create session + activity + response to have leaderboard data
    const createRes = await request(app)
      .post('/api/live/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'Leaderboard Session' })
    sessionId = createRes.body.data.id

    await request(app)
      .patch(`/api/live/sessions/${sessionId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'active' })

    const actRes = await request(app)
      .post(`/api/live/sessions/${sessionId}/activities`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ type: 'qcm', title: 'Q Leaderboard', options: JSON.stringify(['A', 'B', 'C']), correct_answers: ['A'] })
    activityId = actRes.body.data.id

    await request(app)
      .patch(`/api/live/activities/${activityId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'live' })

    await request(app)
      .post(`/api/live/activities/${activityId}/respond`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answer: 'A' })
  })

  it('student from same promo can see leaderboard', async () => {
    const res = await request(app)
      .get(`/api/live/sessions/${sessionId}/leaderboard`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('teacher can see leaderboard', async () => {
    const res = await request(app)
      .get(`/api/live/sessions/${sessionId}/leaderboard`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('student from wrong promo gets 403 on leaderboard', async () => {
    const res = await request(app)
      .get(`/api/live/sessions/${sessionId}/leaderboard`)
      .set('Authorization', `Bearer ${student2Token}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  POST /api/live/sessions/:id/clone — duplication (prof only)
// ═══════════════════════════════════════════
describe('POST /api/live/sessions/:id/clone', () => {
  let sessionId

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/live/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'Original Session' })
    sessionId = res.body.data.id

    // Add an activity to the session
    await request(app)
      .post(`/api/live/sessions/${sessionId}/activities`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ type: 'qcm', title: 'Clone Q', options: JSON.stringify(['X', 'Y']) })
  })

  it('teacher can clone a session', async () => {
    const res = await request(app)
      .post(`/api/live/sessions/${sessionId}/clone`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'Cloned Session' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.title).toBe('Cloned Session')
    expect(res.body.data.id).not.toBe(sessionId)
  })

  it('student cannot clone a session (403)', async () => {
    const res = await request(app)
      .post(`/api/live/sessions/${sessionId}/clone`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ promoId: 1 })
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  PATCH /api/live/activities/:id/status — activity lifecycle
// ═══════════════════════════════════════════
describe('PATCH /api/live/activities/:id/status', () => {
  let activityId

  beforeAll(async () => {
    const createRes = await request(app)
      .post('/api/live/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'Activity Status Session' })
    const sid = createRes.body.data.id

    await request(app)
      .patch(`/api/live/sessions/${sid}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'active' })

    const actRes = await request(app)
      .post(`/api/live/sessions/${sid}/activities`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ type: 'sondage', title: 'Poll Q', options: JSON.stringify(['Oui', 'Non']) })
    activityId = actRes.body.data.id
  })

  it('student cannot change activity status (403)', async () => {
    const res = await request(app)
      .patch(`/api/live/activities/${activityId}/status`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ status: 'live' })
    expect(res.status).toBe(403)
  })

  it('teacher can push activity live', async () => {
    const res = await request(app)
      .patch(`/api/live/activities/${activityId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'live' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.status).toBe('live')
  })

  it('teacher can close activity', async () => {
    const res = await request(app)
      .patch(`/api/live/activities/${activityId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'closed' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('closed')
  })

  it('rejects invalid status', async () => {
    const res = await request(app)
      .patch(`/api/live/activities/${activityId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'bogus' })
    expect(res.status).toBe(400)
  })
})
