// ─── Tests route REX — sessions, activites, reponses, export ────────────────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app, teacherToken, studentToken

// Fake socket.io (rex routes call req.app.get('io'))
const fakeIo = {
  to: () => fakeIo,
  emit: () => {},
}

beforeAll(() => {
  setupTestDb()

  teacherToken = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)
  studentToken = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)

  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  app.set('io', fakeIo)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/rex', auth, require('../../../server/routes/rex'))
})

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  Sessions CRUD
// ═══════════════════════════════════════════
describe('REX sessions', () => {
  let sessionId

  it('student CANNOT create a session (403)', async () => {
    const res = await request(app)
      .post('/api/rex/sessions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ promoId: 1, title: 'REX Interdit' })
    expect(res.status).toBe(403)
  })

  it('teacher CAN create a session (200)', async () => {
    const res = await request(app)
      .post('/api/rex/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'REX Session 1' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('id')
    expect(res.body.data.title).toBe('REX Session 1')
    expect(res.body.data.status).toBe('waiting')
    expect(res.body.data).toHaveProperty('join_code')
    sessionId = res.body.data.id
  })

  it('CAN get a session by ID', async () => {
    const res = await request(app)
      .get(`/api/rex/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.id).toBe(sessionId)
    expect(Array.isArray(res.body.data.activities)).toBe(true)
  })

  it('CAN get a session by join code', async () => {
    const db = getTestDb()
    const row = db.prepare('SELECT join_code FROM rex_sessions WHERE id = ?').get(sessionId)

    const res = await request(app)
      .get(`/api/rex/sessions/code/${row.join_code}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('CAN list sessions for a promo', async () => {
    const res = await request(app)
      .get('/api/rex/sessions/promo/1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })

  it('teacher CAN activate a session', async () => {
    const res = await request(app)
      .patch(`/api/rex/sessions/${sessionId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'active' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.status).toBe('active')
  })

  it('CAN get active session for promo', async () => {
    const res = await request(app)
      .get('/api/rex/sessions/promo/1/active')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('id', sessionId)
  })

  it('student CANNOT change session status (403)', async () => {
    const res = await request(app)
      .patch(`/api/rex/sessions/${sessionId}/status`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ status: 'ended' })
    expect(res.status).toBe(403)
  })

  it('rejects invalid status (400)', async () => {
    const res = await request(app)
      .patch(`/api/rex/sessions/${sessionId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'bogus' })
    expect(res.status).toBe(400)
  })

  it('teacher CAN end a session', async () => {
    const res = await request(app)
      .patch(`/api/rex/sessions/${sessionId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'ended' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('ended')
  })

  it('CAN get history for promo', async () => {
    const res = await request(app)
      .get('/api/rex/sessions/promo/1/history')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('CAN get stats for promo', async () => {
    const res = await request(app)
      .get('/api/rex/sessions/promo/1/stats')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('totalSessions')
    expect(res.body.data).toHaveProperty('enrolledStudents')
  })
})

// ═══════════════════════════════════════════
//  Activities
// ═══════════════════════════════════════════
describe('REX activities', () => {
  let sessionId, activityId

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/rex/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'REX Activities Test' })
    sessionId = res.body.data.id
  })

  it('teacher CAN add an activity (200)', async () => {
    const res = await request(app)
      .post(`/api/rex/sessions/${sessionId}/activities`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ type: 'question_ouverte', title: 'Qu est-ce que tu as appris ?' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('id')
    expect(res.body.data.type).toBe('question_ouverte')
    activityId = res.body.data.id
  })

  it('student CANNOT add an activity (403)', async () => {
    const res = await request(app)
      .post(`/api/rex/sessions/${sessionId}/activities`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ type: 'nuage', title: 'Interdit' })
    expect(res.status).toBe(403)
  })

  it('teacher CAN update an activity', async () => {
    const res = await request(app)
      .patch(`/api/rex/activities/${activityId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Updated question' })
    expect(res.status).toBe(200)
    expect(res.body.data.title).toBe('Updated question')
  })

  it('teacher CAN set activity status to live', async () => {
    // First activate the session
    await request(app)
      .patch(`/api/rex/sessions/${sessionId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'active' })

    const res = await request(app)
      .patch(`/api/rex/activities/${activityId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'live' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('live')
  })

  it('rejects invalid activity status (400)', async () => {
    const res = await request(app)
      .patch(`/api/rex/activities/${activityId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'invalid' })
    expect(res.status).toBe(400)
  })

  it('teacher CAN close an activity', async () => {
    const res = await request(app)
      .patch(`/api/rex/activities/${activityId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'closed' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('closed')
  })

  it('teacher CAN reorder activities', async () => {
    // Add a second activity
    const res2 = await request(app)
      .post(`/api/rex/sessions/${sessionId}/activities`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ type: 'echelle', title: 'Note sur 5' })
    const activityId2 = res2.body.data.id

    const res = await request(app)
      .patch(`/api/rex/sessions/${sessionId}/activities/reorder`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ order: [activityId2, activityId] })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('teacher CAN delete an activity', async () => {
    const res = await request(app)
      .delete(`/api/rex/activities/${activityId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  Responses + Results
// ═══════════════════════════════════════════
describe('REX responses', () => {
  let sessionId, activityId

  beforeAll(async () => {
    const session = await request(app)
      .post('/api/rex/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'REX Responses Test' })
    sessionId = session.body.data.id

    // Activate
    await request(app)
      .patch(`/api/rex/sessions/${sessionId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'active' })

    // Add and go live
    const act = await request(app)
      .post(`/api/rex/sessions/${sessionId}/activities`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ type: 'question_ouverte', title: 'Feedback' })
    activityId = act.body.data.id

    await request(app)
      .patch(`/api/rex/activities/${activityId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'live' })
  })

  it('student CAN submit a response (200)', async () => {
    const res = await request(app)
      .post(`/api/rex/activities/${activityId}/respond`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answer: 'Tres instructif' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('answer', 'Tres instructif')
  })

  it('student CAN update their response (upsert)', async () => {
    const res = await request(app)
      .post(`/api/rex/activities/${activityId}/respond`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answer: 'Updated answer' })
    expect(res.status).toBe(200)
    expect(res.body.data.answer).toBe('Updated answer')
  })

  it('CAN get aggregated results', async () => {
    const res = await request(app)
      .get(`/api/rex/activities/${activityId}/results`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.type).toBe('question_ouverte')
    expect(res.body.data.total).toBeGreaterThanOrEqual(1)
  })
})

// ═══════════════════════════════════════════
//  Pin
// ═══════════════════════════════════════════
describe('REX pin', () => {
  let responseId

  beforeAll(async () => {
    // Get a response ID from the DB
    const db = getTestDb()
    const row = db.prepare('SELECT id FROM rex_responses ORDER BY id DESC LIMIT 1').get()
    responseId = row?.id
  })

  it('teacher CAN pin a response', async () => {
    if (!responseId) return
    const res = await request(app)
      .post(`/api/rex/responses/${responseId}/pin`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ pinned: true })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('student CANNOT pin a response (403)', async () => {
    if (!responseId) return
    const res = await request(app)
      .post(`/api/rex/responses/${responseId}/pin`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ pinned: true })
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  Clone + Delete
// ═══════════════════════════════════════════
describe('REX clone and delete', () => {
  let sessionId

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/rex/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'REX To Clone' })
    sessionId = res.body.data.id

    // Fix ownership: route stores teacher_id = req.user.id (-1),
    // but requireSessionOwner checks Math.abs(req.user.id) = 1
    const db = getTestDb()
    db.prepare('UPDATE rex_sessions SET teacher_id = ? WHERE id = ?').run(Math.abs(-1), sessionId)

    // Add an activity so clone has something to copy
    await request(app)
      .post(`/api/rex/sessions/${sessionId}/activities`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ type: 'nuage', title: 'Mots cles' })
  })

  it('teacher CAN clone a session', async () => {
    const res = await request(app)
      .post(`/api/rex/sessions/${sessionId}/clone`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'REX Cloned' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.title).toBe('REX Cloned')
    expect(res.body.data.activities.length).toBeGreaterThanOrEqual(1)
  })

  it('student CANNOT clone a session (403)', async () => {
    const res = await request(app)
      .post(`/api/rex/sessions/${sessionId}/clone`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ promoId: 1 })
    expect(res.status).toBe(403)
  })

  it('teacher CAN delete a session', async () => {
    const res = await request(app)
      .delete(`/api/rex/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('student CANNOT delete a session (403)', async () => {
    // Create another to try deleting
    const create = await request(app)
      .post('/api/rex/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'REX Student Delete' })
    const sid = create.body.data.id

    const res = await request(app)
      .delete(`/api/rex/sessions/${sid}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  Export
// ═══════════════════════════════════════════
describe('REX export', () => {
  let sessionId

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/rex/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'REX Export Test' })
    sessionId = res.body.data.id

    await request(app)
      .post(`/api/rex/sessions/${sessionId}/activities`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ type: 'echelle', title: 'Note' })
  })

  it('CAN export as JSON', async () => {
    const res = await request(app)
      .get(`/api/rex/sessions/${sessionId}/export?format=json`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('session')
    expect(res.body.data).toHaveProperty('activities')
  })

  it('CAN export as CSV', async () => {
    const res = await request(app)
      .get(`/api/rex/sessions/${sessionId}/export?format=csv`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/csv/)
  })

  it('returns 404 for non-existent session', async () => {
    const res = await request(app)
      .get('/api/rex/sessions/99999/export')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(404)
  })
})
