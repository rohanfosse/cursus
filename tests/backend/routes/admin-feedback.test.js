// ─── Tests admin feedback routes — CRUD + access control ─────────────────────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app, studentToken, teacherToken, adminToken

beforeAll(() => {
  const db = setupTestDb()

  // Seed teacher_promos for teacher id=1, promo_id=1
  try {
    db.prepare('INSERT OR IGNORE INTO teacher_promos (teacher_id, promo_id) VALUES (1, 1)').run()
  } catch { /* already seeded */ }

  studentToken = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  teacherToken = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)
  adminToken   = jwt.sign({ id: -1, name: 'Prof Test', type: 'admin', promo_id: null }, JWT_SECRET)

  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/admin', auth, require('../../../server/routes/admin/index'))
})

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  POST /api/admin/feedback — submit feedback
// ═══════════════════════════════════════════
describe('POST /api/admin/feedback', () => {
  it('student can submit feedback', async () => {
    const res = await request(app)
      .post('/api/admin/feedback')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ type: 'bug', title: 'Bouton casse', description: 'Le bouton ne fonctionne pas' })
    // Students are blocked by requireAdmin
    expect(res.status).toBe(403)
  })

  it('teacher CAN submit feedback (200)', async () => {
    const res = await request(app)
      .post('/api/admin/feedback')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ type: 'bug', title: 'Bug rendu', description: 'Erreur lors du depot' })
    expect(res.status).toBe(200)
  })

  it('admin can submit feedback', async () => {
    const res = await request(app)
      .post('/api/admin/feedback')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'improvement', title: 'Amelioration UI', description: 'Meilleur contraste' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('teacher CAN access feedback route — validation rejects empty title (400)', async () => {
    const res = await request(app)
      .post('/api/admin/feedback')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ type: 'bug', title: '', description: 'test' })
    expect(res.status).not.toBe(403)
  })

  it('teacher CAN access feedback route — validation rejects invalid type (400)', async () => {
    const res = await request(app)
      .post('/api/admin/feedback')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ type: 'invalid', title: 'Test', description: 'test' })
    expect(res.status).not.toBe(403)
  })
})

// ═══════════════════════════════════════════
//  GET /api/admin/feedback — list feedback
// ═══════════════════════════════════════════
describe('GET /api/admin/feedback', () => {
  it('student is blocked (403)', async () => {
    const res = await request(app)
      .get('/api/admin/feedback')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher CAN list feedback (200)', async () => {
    const res = await request(app)
      .get('/api/admin/feedback')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })

  it('teacher CAN access feedback with type filter (200)', async () => {
    const res = await request(app)
      .get('/api/admin/feedback?type=bug')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })

  it('teacher CAN access feedback with pagination (200)', async () => {
    const res = await request(app)
      .get('/api/admin/feedback?limit=1&offset=0')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════
//  GET /api/admin/feedback/mine — my feedback
// ═══════════════════════════════════════════
describe('GET /api/admin/feedback/mine', () => {
  it('student is blocked (403)', async () => {
    const res = await request(app)
      .get('/api/admin/feedback/mine')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher CAN see own feedback (200)', async () => {
    const res = await request(app)
      .get('/api/admin/feedback/mine')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════
//  GET /api/admin/feedback/stats — feedback stats
// ═══════════════════════════════════════════
describe('GET /api/admin/feedback/stats', () => {
  it('student is blocked (403)', async () => {
    const res = await request(app)
      .get('/api/admin/feedback/stats')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher CAN get feedback stats (200)', async () => {
    const res = await request(app)
      .get('/api/admin/feedback/stats')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════
//  POST /api/admin/feedback/:id/status — update status
// ═══════════════════════════════════════════
describe('POST /api/admin/feedback/:id/status', () => {
  let feedbackId

  beforeAll(async () => {
    // Create a feedback to update (admin only now)
    const res = await request(app)
      .post('/api/admin/feedback')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'question', title: 'Comment faire X ?', description: '' })
    feedbackId = res.body.data.id
  })

  it('student is blocked (403)', async () => {
    const res = await request(app)
      .post(`/api/admin/feedback/${feedbackId}/status`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ status: 'resolved' })
    expect(res.status).toBe(403)
  })

  it('teacher CAN update feedback status (200)', async () => {
    const res = await request(app)
      .post(`/api/admin/feedback/${feedbackId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'in_progress', adminReply: 'On regarde.' })
    expect(res.status).toBe(200)
  })

  it('teacher CAN access feedback status route — validation rejects invalid status', async () => {
    const res = await request(app)
      .post(`/api/admin/feedback/${feedbackId}/status`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ status: 'bogus' })
    expect(res.status).not.toBe(403)
  })

  it('admin can resolve feedback', async () => {
    const res = await request(app)
      .post(`/api/admin/feedback/${feedbackId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved', adminReply: 'Corrige dans la v2.' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
