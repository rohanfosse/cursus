// ─── Tests regression — hierarchie des roles et isolation a travers le systeme ─
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app
let adminToken, teacherToken, taToken, taAssignedToken, studentToken, student2Token

beforeAll(() => {
  setupTestDb()
  const db = getTestDb()

  // Promo 2
  db.exec(`INSERT OR IGNORE INTO promotions (id, name, color) VALUES (2, 'Promo B', '#E74C3C')`)
  db.exec(`INSERT OR IGNORE INTO channels (id, promo_id, name, type) VALUES (10, 2, 'promo2-general', 'chat')`)

  // Student in promo 2
  db.prepare(
    `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
     VALUES (2, 2, 'Alice Martin', 'alice@test.fr', 'AM', 'hash', 0)`
  ).run()

  // TA without assignment (id=2)
  db.prepare(
    `INSERT OR IGNORE INTO teachers (id, name, email, password, must_change_password, role)
     VALUES (2, 'TA Sans Projet', 'ta-none@test.fr', 'hash', 0, 'ta')`
  ).run()

  // TA with assignment (id=4)
  db.prepare(
    `INSERT OR IGNORE INTO teachers (id, name, email, password, must_change_password, role)
     VALUES (4, 'TA Assigne', 'ta-ok@test.fr', 'hash', 0, 'ta')`
  ).run()

  // Admin (id=3)
  db.prepare(
    `INSERT OR IGNORE INTO teachers (id, name, email, password, must_change_password, role)
     VALUES (3, 'Admin Test', 'admin@test.fr', 'hash', 0, 'admin')`
  ).run()

  // Travail for promo 1
  db.prepare(
    `INSERT OR IGNORE INTO travaux (id, promo_id, title, deadline, type) VALUES (1, 1, 'TP1', '2030-01-01', 'livrable')`
  ).run()

  // Project in promo 1
  db.prepare(
    `INSERT OR IGNORE INTO projects (id, promo_id, name, created_by) VALUES (1, 1, 'Projet Promo1', 1)`
  ).run()

  // Assign TA id=4 to project 1 (promo 1)
  db.prepare(
    `INSERT OR IGNORE INTO teacher_projects (teacher_id, project_id) VALUES (4, 1)`
  ).run()

  // Assign teacher id=1 to promo 1
  db.prepare(
    `INSERT OR IGNORE INTO teacher_promos (teacher_id, promo_id) VALUES (1, 1)`
  ).run()

  // Tokens
  adminToken       = jwt.sign({ id: -3, name: 'Admin Test', type: 'admin', promo_id: null }, JWT_SECRET)
  teacherToken     = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)
  taToken          = jwt.sign({ id: -2, name: 'TA Sans Projet', type: 'ta', promo_id: null }, JWT_SECRET)
  taAssignedToken  = jwt.sign({ id: -4, name: 'TA Assigne', type: 'ta', promo_id: null }, JWT_SECRET)
  studentToken     = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  student2Token    = jwt.sign({ id: 2, name: 'Alice Martin', type: 'student', promo_id: 2 }, JWT_SECRET)

  // Express app with all relevant routers
  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/projects',    auth, require('../../../server/routes/projects'))
  app.use('/api/teachers',    auth, require('../../../server/routes/teachers'))
  app.use('/api/admin',       auth, require('../../../server/routes/admin/index'))
  app.use('/api/promotions',  auth, require('../../../server/routes/promotions'))
  app.use('/api/assignments', auth, require('../../../server/routes/assignments'))
  app.use('/api/messages',    auth, require('../../../server/routes/messages'))
})

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  Admin role
// ═══════════════════════════════════════════
describe('Admin role hierarchy', () => {
  it('admin CAN access admin stats (200)', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('admin CAN access admin security (200)', async () => {
    const res = await request(app)
      .get('/api/admin/security')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('admin CAN create teachers', async () => {
    const res = await request(app)
      .post('/api/teachers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Teacher', email: 'new-teach@test.fr', password: 'Pass1234!' })
    // Should not be 403 (admin has teacher-level access)
    expect(res.status).not.toBe(403)
  })

  it('admin CAN create a project (inherits teacher permissions)', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ promoId: 1, name: 'Admin Projet' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  Teacher role
// ═══════════════════════════════════════════
describe('Teacher role hierarchy', () => {
  it('teacher CAN access admin stats (200)', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('teacher CANNOT access admin security (403)', async () => {
    const res = await request(app)
      .get('/api/admin/security')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher CAN create projects', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, name: 'Teacher Projet' })
    expect(res.status).toBe(200)
  })

  it('teacher CAN create channels', async () => {
    const res = await request(app)
      .post('/api/promotions/channels')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, name: 'new-channel', type: 'chat' })
    // Should not be 403 (teacher has write access to promo resources)
    expect(res.status).not.toBe(403)
  })
})

// ═══════════════════════════════════════════
//  TA role (without assignment)
// ═══════════════════════════════════════════
describe('TA role (without project assignment)', () => {
  it('TA without assignment CANNOT access DMs for a student (403)', async () => {
    const res = await request(app)
      .get('/api/messages/dm/1')
      .set('Authorization', `Bearer ${taToken}`)
    expect(res.status).toBe(403)
  })

  it('TA without assignment CANNOT access admin stats (403)', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${taToken}`)
    expect(res.status).toBe(403)
  })

  it('TA without assignment CANNOT access admin security (403)', async () => {
    const res = await request(app)
      .get('/api/admin/security')
      .set('Authorization', `Bearer ${taToken}`)
    expect(res.status).toBe(403)
  })

  it('TA without assignment has zero admin access', async () => {
    const res = await request(app)
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${taToken}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  TA role (with project assignment)
// ═══════════════════════════════════════════
describe('TA role (with project assignment)', () => {
  it('assigned TA CAN access DMs for students in their project promo', async () => {
    // TA id=4 is assigned to project 1 (promo 1), student id=1 is in promo 1
    const res = await request(app)
      .get('/api/messages/dm/1')
      .set('Authorization', `Bearer ${taAssignedToken}`)
    expect(res.status).toBe(200)
  })

  it('assigned TA CANNOT access DMs for students outside their project promo', async () => {
    // TA id=4 is assigned to project 1 (promo 1), student id=2 is in promo 2
    const res = await request(app)
      .get('/api/messages/dm/2')
      .set('Authorization', `Bearer ${taAssignedToken}`)
    expect(res.status).toBe(403)
  })

  it('assigned TA CAN list their projects', async () => {
    const res = await request(app)
      .get('/api/projects/ta/my-projects')
      .set('Authorization', `Bearer ${taAssignedToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 1, name: 'Projet Promo1' })])
    )
  })
})

// ═══════════════════════════════════════════
//  Student role
// ═══════════════════════════════════════════
describe('Student role — isolation and restrictions', () => {
  it('student CAN access their own promo data', async () => {
    const res = await request(app)
      .get('/api/promotions/1/students')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('student CANNOT access another promo data (403)', async () => {
    const res = await request(app)
      .get('/api/promotions/2/students')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('student CANNOT create projects (403)', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ promoId: 1, name: 'Student Projet' })
    expect(res.status).toBe(403)
  })

  it('student CANNOT delete projects (403)', async () => {
    const res = await request(app)
      .delete('/api/projects/1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('student CANNOT create channels (403)', async () => {
    const res = await request(app)
      .post('/api/promotions/channels')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ promoId: 1, name: 'hacked-channel', type: 'chat' })
    expect(res.status).toBe(403)
  })

  it('student CANNOT access admin panel (403)', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('student CAN access their own DMs', async () => {
    const res = await request(app)
      .get('/api/messages/dm/1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
  })

  it('student CANNOT access another student DMs (403)', async () => {
    const res = await request(app)
      .get('/api/messages/dm/2')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('student2 CANNOT access promo 1 channels (403)', async () => {
    const res = await request(app)
      .get('/api/promotions/1/channels')
      .set('Authorization', `Bearer ${student2Token}`)
    expect(res.status).toBe(403)
  })
})
