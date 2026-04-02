// ─── Tests routes teachers/intervenants — CRUD, photo, channels ──────────────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app, db
let teacherToken, studentToken

beforeAll(() => {
  setupTestDb()
  db = getTestDb()

  // Seed a project with a channel for channel-assignment tests
  db.prepare(
    `INSERT OR IGNORE INTO projects (id, promo_id, name, created_by) VALUES (1, 1, 'Projet Web', 1)`
  ).run()

  // Tokens
  teacherToken = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)
  studentToken = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)

  // Express app
  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/teachers', auth, require('../../../server/routes/teachers'))
}, 30_000)

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  GET /api/teachers — list intervenants
// ═══════════════════════════════════════════
describe('GET /api/teachers', () => {
  it('teacher CAN list intervenants (200)', async () => {
    const res = await request(app)
      .get('/api/teachers')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('student CANNOT list intervenants (403)', async () => {
    const res = await request(app)
      .get('/api/teachers')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  POST /api/teachers — create intervenant
// ═══════════════════════════════════════════
describe('POST /api/teachers', () => {
  it('teacher CAN create an intervenant (200)', async () => {
    const res = await request(app)
      .post('/api/teachers')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Nouveau TA', email: 'ta@test.fr' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('teacher CAN create with explicit password', async () => {
    const res = await request(app)
      .post('/api/teachers')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'TA Pass', email: 'tapass@test.fr', password: 'SecurePass1!' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('rejects duplicate email', async () => {
    // First creation
    await request(app)
      .post('/api/teachers')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Dup', email: 'dup@test.fr' })
    // Second with same email
    const res = await request(app)
      .post('/api/teachers')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Dup2', email: 'dup@test.fr' })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/email/i)
  })

  it('student CANNOT create an intervenant (403)', async () => {
    const res = await request(app)
      .post('/api/teachers')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ name: 'Hack', email: 'hack@test.fr' })
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  DELETE /api/teachers/:id — delete intervenant (requireRole('admin'))
// ═══════════════════════════════════════════
describe('DELETE /api/teachers/:id', () => {
  let taId
  const adminToken = jwt.sign({ id: -99, name: 'Admin Test', type: 'admin', promo_id: null }, JWT_SECRET)

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/teachers')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'TA to Delete', email: 'tadelete@test.fr' })
    // Get the TA from the list
    const listRes = await request(app)
      .get('/api/teachers')
      .set('Authorization', `Bearer ${teacherToken}`)
    const ta = listRes.body.data.find(t => t.email === 'tadelete@test.fr')
    taId = ta?.id
  })

  it('teacher CANNOT delete a TA (403)', async () => {
    if (!taId) return
    const res = await request(app)
      .delete(`/api/teachers/${taId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(403)
  })

  it('admin CAN delete a TA (200)', async () => {
    if (!taId) return
    const res = await request(app)
      .delete(`/api/teachers/${taId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('CANNOT delete the main teacher (role=teacher)', async () => {
    // Teacher ID 1 has role 'teacher' (from seed) — admin gets the business-rule error
    const res = await request(app)
      .delete('/api/teachers/1')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/responsable/i)
  })

  it('student CANNOT delete (403)', async () => {
    const res = await request(app)
      .delete('/api/teachers/999')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  POST /api/teachers/photo — update photo
// ═══════════════════════════════════════════
describe('POST /api/teachers/photo', () => {
  it('teacher CAN update photo (200)', async () => {
    const res = await request(app)
      .post('/api/teachers/photo')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ teacherId: 1, photoData: 'data:image/png;base64,abc123' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('student CANNOT update photo (403)', async () => {
    const res = await request(app)
      .post('/api/teachers/photo')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ teacherId: 1, photoData: 'data:image/png;base64,hack' })
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  GET /api/teachers/:id/channels — get assigned channels
// ═══════════════════════════════════════════
describe('GET /api/teachers/:id/channels', () => {
  it('returns channels for a teacher (200)', async () => {
    const res = await request(app)
      .get('/api/teachers/1/channels')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('returns empty array for unknown teacher', async () => {
    const res = await request(app)
      .get('/api/teachers/999/channels')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })
})

// ═══════════════════════════════════════════
//  POST /api/teachers/:id/channels — set assigned channels
// ═══════════════════════════════════════════
describe('POST /api/teachers/:id/channels', () => {
  it('teacher CAN set channel assignments (200)', async () => {
    const res = await request(app)
      .post('/api/teachers/1/channels')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ teacherId: 1, channelIds: [1] })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('student CANNOT set channel assignments (403)', async () => {
    const res = await request(app)
      .post('/api/teachers/1/channels')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ teacherId: 1, channelIds: [1] })
    expect(res.status).toBe(403)
  })
})
