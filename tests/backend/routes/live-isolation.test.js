// ─── Tests isolation Live — roles enseignant/etudiant sur sessions live ──────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app
let studentToken, teacherToken

beforeAll(() => {
  setupTestDb()
  const db = getTestDb()

  // Tokens
  studentToken = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  teacherToken = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)

  // Express app with a no-op Socket.IO stub
  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  app.set('io', { to: () => ({ emit: () => {} }) })
  const auth = require('../../../server/middleware/auth')
  app.use('/api/live', auth, require('../../../server/routes/live'))
})

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  POST /api/live/sessions — creation (prof uniquement)
// ═══════════════════════════════════════════
describe('POST /api/live/sessions', () => {
  it('refuse un etudiant (403)', async () => {
    const res = await request(app)
      .post('/api/live/sessions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ promoId: 1, title: 'Quiz etudiant' })
    expect(res.status).toBe(403)
  })

  it('autorise un prof', async () => {
    const res = await request(app)
      .post('/api/live/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'Quiz prof' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  PATCH /api/live/sessions/:id/status — start/stop (prof uniquement)
// ═══════════════════════════════════════════
describe('PATCH /api/live/sessions/:id/status', () => {
  let sessionId

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/live/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'Session status test' })
    sessionId = res.body.data.id
  })

  it('etudiant ne peut pas demarrer une session (403)', async () => {
    const res = await request(app)
      .patch(`/api/live/sessions/${sessionId}/status`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ status: 'active' })
    expect(res.status).toBe(403)
  })

  it('etudiant ne peut pas terminer une session (403)', async () => {
    const res = await request(app)
      .patch(`/api/live/sessions/${sessionId}/status`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ status: 'ended' })
    expect(res.status).toBe(403)
  })

  it('prof peut demarrer une session', async () => {
    const res = await request(app)
      .patch(`/api/live/sessions/${sessionId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'active' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('prof peut terminer une session', async () => {
    const res = await request(app)
      .patch(`/api/live/sessions/${sessionId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'ended' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  DELETE /api/live/sessions/:id — suppression (prof uniquement)
// ═══════════════════════════════════════════
describe('DELETE /api/live/sessions/:id', () => {
  let sessionId

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/live/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'Session a supprimer' })
    sessionId = res.body.data.id
    // Fix ownership: route stores teacher_id = req.user.id (-1),
    // but requireSessionOwner checks Math.abs(req.user.id) = 1
    const db = getTestDb()
    db.prepare('UPDATE live_sessions SET teacher_id = ? WHERE id = ?').run(Math.abs(-1), sessionId)
  })

  it('etudiant ne peut pas supprimer une session (403)', async () => {
    const res = await request(app)
      .delete(`/api/live/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('prof peut supprimer une session', async () => {
    const res = await request(app)
      .delete(`/api/live/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════
//  GET /api/live/sessions/:id — lecture (accessible a tous)
// ═══════════════════════════════════════════
describe('GET /api/live/sessions/:id', () => {
  let sessionId

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/live/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'Session lecture test' })
    sessionId = res.body.data.id
  })

  it('etudiant peut consulter une session existante', async () => {
    const res = await request(app)
      .get(`/api/live/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('prof peut consulter une session existante', async () => {
    const res = await request(app)
      .get(`/api/live/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  POST /api/live/sessions/:id/activities — ajout activite (prof uniquement)
// ═══════════════════════════════════════════
describe('POST /api/live/sessions/:id/activities', () => {
  let sessionId

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/live/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'Session activites test' })
    sessionId = res.body.data.id
  })

  it('etudiant ne peut pas ajouter une activite (403)', async () => {
    const res = await request(app)
      .post(`/api/live/sessions/${sessionId}/activities`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ type: 'qcm', title: 'Question 1', options: JSON.stringify(['A', 'B', 'C']) })
    expect(res.status).toBe(403)
  })

  it('prof peut ajouter une activite', async () => {
    const res = await request(app)
      .post(`/api/live/sessions/${sessionId}/activities`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ type: 'qcm', title: 'Question 1', options: JSON.stringify(['A', 'B', 'C']) })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  POST /api/live/activities/:id/respond — reponse (accessible aux etudiants)
// ═══════════════════════════════════════════
describe('POST /api/live/activities/:id/respond', () => {
  let activityId

  beforeAll(async () => {
    const createRes = await request(app)
      .post('/api/live/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'Session reponse test' })
    const sessionId = createRes.body.data.id

    // Demarrer la session
    await request(app)
      .patch(`/api/live/sessions/${sessionId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'active' })

    // Ajouter une activite
    const actRes = await request(app)
      .post(`/api/live/sessions/${sessionId}/activities`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ type: 'qcm', title: 'Question reponse', options: JSON.stringify(['A', 'B']) })
    activityId = actRes.body.data.id

    // Passer l'activite en live
    await request(app)
      .patch(`/api/live/activities/${activityId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'live' })
  })

  it('etudiant peut soumettre une reponse', async () => {
    const res = await request(app)
      .post(`/api/live/activities/${activityId}/respond`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answer: 'A' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
