// ─── Tests admin users routes — list, search, update, reset, delete ──────────
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

  // Add a second student for search/filter tests
  db.prepare(
    `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
     VALUES (2, 1, 'Marie Curie', 'marie@test.fr', 'MC', 'hash', 0)`
  ).run()

  // Add a pilote (role=pilote, not teacher) for delete tests
  db.prepare(
    `INSERT OR IGNORE INTO teachers (id, name, email, password, must_change_password, role)
     VALUES (2, 'Pilote Test', 'pilote@test.fr', 'hash', 0, 'pilote')`
  ).run()

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
//  GET /api/admin/users — list users
// ═══════════════════════════════════════════
describe('GET /api/admin/users', () => {
  it('student is blocked (403)', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
    expect(res.body.ok).toBe(false)
  })

  it('teacher can list users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('users')
    expect(res.body.data).toHaveProperty('total')
    expect(res.body.data.total).toBeGreaterThanOrEqual(2)
  })

  it('admin can list users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('supports search filter', async () => {
    const res = await request(app)
      .get('/api/admin/users?search=Marie')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    const names = res.body.data.users.map(u => u.name)
    expect(names.some(n => n.includes('Marie'))).toBe(true)
  })

  it('supports promo_id filter', async () => {
    const res = await request(app)
      .get('/api/admin/users?promo_id=1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('supports pagination', async () => {
    const res = await request(app)
      .get('/api/admin/users?page=1&limit=1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.users.length).toBeLessThanOrEqual(1)
  })
})

// ═══════════════════════════════════════════
//  GET /api/admin/users/:id — user detail
// ═══════════════════════════════════════════
describe('GET /api/admin/users/:id', () => {
  it('student is blocked (403)', async () => {
    const res = await request(app)
      .get('/api/admin/users/1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher can get student detail', async () => {
    const res = await request(app)
      .get('/api/admin/users/1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('name')
  })

  it('returns 404 for non-existent user', async () => {
    const res = await request(app)
      .get('/api/admin/users/99999')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(404)
    expect(res.body.ok).toBe(false)
  })
})

// ═══════════════════════════════════════════
//  PATCH /api/admin/users/:id — update user
// ═══════════════════════════════════════════
describe('PATCH /api/admin/users/:id', () => {
  it('student is blocked (403)', async () => {
    const res = await request(app)
      .patch('/api/admin/users/2')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ name: 'Hacked' })
    expect(res.status).toBe(403)
  })

  it('teacher can update a student name', async () => {
    const res = await request(app)
      .patch('/api/admin/users/2')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Marie Curie-Sklodowska' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('teacher can update a teacher (negative id)', async () => {
    const res = await request(app)
      .patch('/api/admin/users/-2')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Pilote Renomme' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('empty update returns ok', async () => {
    const res = await request(app)
      .patch('/api/admin/users/2')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  POST /api/admin/users/:id/reset-password
// ═══════════════════════════════════════════
describe('POST /api/admin/users/:id/reset-password', () => {
  it('student is blocked (403)', async () => {
    const res = await request(app)
      .post('/api/admin/users/2/reset-password')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher can reset a student password', async () => {
    const res = await request(app)
      .post('/api/admin/users/2/reset-password')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('tempPassword')
    expect(res.body.data.tempPassword.length).toBeGreaterThanOrEqual(8)
  })

  it('teacher can reset a teacher password (negative id)', async () => {
    const res = await request(app)
      .post('/api/admin/users/-2/reset-password')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.tempPassword).toBeDefined()
  })
})

// ═══════════════════════════════════════════
//  DELETE /api/admin/users/:id
// ═══════════════════════════════════════════
describe('DELETE /api/admin/users/:id', () => {
  let deletableStudentId

  beforeAll(() => {
    const db = getTestDb()
    const info = db.prepare(
      `INSERT INTO students (promo_id, name, email, avatar_initials, password, must_change_password)
       VALUES (1, 'A Supprimer', 'suppr@test.fr', 'AS', 'hash', 0)`
    ).run()
    deletableStudentId = info.lastInsertRowid
  })

  it('student is blocked (403)', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${deletableStudentId}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher can delete a student', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${deletableStudentId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('cannot delete a teacher with role=teacher (responsable)', async () => {
    // Teacher id=1 has role='teacher' (responsable pedagogique)
    const res = await request(app)
      .delete('/api/admin/users/-1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(403)
    expect(res.body.ok).toBe(false)
  })

  it('can delete a teacher with role=pilote', async () => {
    const res = await request(app)
      .delete('/api/admin/users/-2')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
