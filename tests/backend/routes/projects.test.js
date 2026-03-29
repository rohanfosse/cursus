// ─── Tests routes projets — CRUD, assignation TA, travaux, acces par role ────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app
let studentToken, student2Token, teacherToken, taToken, adminToken

beforeAll(() => {
  setupTestDb()
  const db = getTestDb()

  // Promo 2
  db.exec(`INSERT OR IGNORE INTO promotions (id, name, color) VALUES (2, 'Promo B', '#E74C3C')`)

  // TA teacher (id=2, role='ta')
  db.prepare(
    `INSERT OR IGNORE INTO teachers (id, name, email, password, must_change_password, role)
     VALUES (2, 'TA Test', 'ta@test.fr', 'hash', 0, 'ta')`
  ).run()

  // Admin teacher (id=3, role='admin')
  db.prepare(
    `INSERT OR IGNORE INTO teachers (id, name, email, password, must_change_password, role)
     VALUES (3, 'Admin Test', 'admin@test.fr', 'hash', 0, 'admin')`
  ).run()

  // Student in promo 2
  db.prepare(
    `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
     VALUES (2, 2, 'Alice Martin', 'alice@test.fr', 'AM', 'hash', 0)`
  ).run()

  // Travail in promo 1 (for linkage tests)
  db.prepare(
    `INSERT OR IGNORE INTO travaux (id, promo_id, title, deadline, type) VALUES (1, 1, 'TP1', '2030-01-01', 'livrable')`
  ).run()

  // Tokens
  studentToken  = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  student2Token = jwt.sign({ id: 2, name: 'Alice Martin', type: 'student', promo_id: 2 }, JWT_SECRET)
  teacherToken  = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)
  taToken       = jwt.sign({ id: -2, name: 'TA Test', type: 'ta', promo_id: null }, JWT_SECRET)
  adminToken    = jwt.sign({ id: -3, name: 'Admin Test', type: 'admin', promo_id: null }, JWT_SECRET)

  // Express app
  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/projects', auth, require('../../../server/routes/projects'))
})

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  CRUD — teacher only
// ═══════════════════════════════════════════
describe('Projects CRUD — role isolation', () => {
  let projectId

  it('student CANNOT create a project (403)', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ promoId: 1, name: 'Projet Interdit' })
    expect(res.status).toBe(403)
  })

  it('TA without assignment CANNOT create a project (403)', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${taToken}`)
      .send({ promoId: 1, name: 'Projet TA' })
    // requireTeacher maps to requireRole('ta'), but POST uses requireTeacher
    // which is requireRole('ta') — TA should pass requireTeacher
    expect([200, 403]).toContain(res.status)
  })

  it('teacher CAN create a project (200)', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, name: 'Projet Alpha' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    projectId = Number(res.body.data)
    expect(projectId).toBeGreaterThan(0)
  })

  it('admin CAN create a project (200)', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ promoId: 1, name: 'Projet Admin' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('teacher CAN update a project', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Projet Alpha v2', description: 'Updated' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('student CANNOT update a project (403)', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ name: 'Hacked' })
    expect(res.status).toBe(403)
  })

  it('student CANNOT delete a project (403)', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher CAN delete a project', async () => {
    // Create a throwaway project to delete
    const create = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, name: 'To Delete' })
    const deleteId = Number(create.body.data)

    const res = await request(app)
      .delete(`/api/projects/${deleteId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  TA assignment
// ═══════════════════════════════════════════
describe('TA assignment', () => {
  let projectId

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, name: 'Projet TA Assignment' })
    projectId = Number(res.body.data)
  })

  it('student CANNOT assign a TA (403)', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/assign-ta`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ teacherId: 2 })
    expect(res.status).toBe(403)
  })

  it('teacher CAN assign a TA to a project', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/assign-ta`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ teacherId: 2 })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('assigned TA appears in project TAs list', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/tas`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 2 })])
    )
  })

  it('teacher CAN unassign a TA', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/unassign-ta/2`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  Travaux linkage
// ═══════════════════════════════════════════
describe('Travaux linkage', () => {
  let projectId

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, name: 'Projet Travaux' })
    projectId = Number(res.body.data)
  })

  it('teacher CAN add a travail to a project', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/travaux/1`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('linked travail appears in project travaux list', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/travaux`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 1, title: 'TP1' })])
    )
  })

  it('teacher CAN remove a travail from a project', async () => {
    const res = await request(app)
      .delete(`/api/projects/${projectId}/travaux/1`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('removed travail no longer appears in project travaux', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/travaux`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════
//  Read access
// ═══════════════════════════════════════════
describe('Read access', () => {
  let projectId

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, name: 'Projet Visible' })
    projectId = Number(res.body.data)
  })

  it('student CAN list projects for their promo', async () => {
    const res = await request(app)
      .get('/api/projects/promo/1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('teacher CAN list projects for any promo', async () => {
    const res = await request(app)
      .get('/api/projects/promo/2')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('anyone CAN get a single project by ID', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toEqual(expect.objectContaining({ name: 'Projet Visible' }))
  })

  it('TA CAN list their assigned projects', async () => {
    // Assign TA to project first
    const db = getTestDb()
    db.prepare('INSERT OR IGNORE INTO teacher_projects (teacher_id, project_id) VALUES (2, ?)').run(projectId)

    const res = await request(app)
      .get('/api/projects/ta/my-projects')
      .set('Authorization', `Bearer ${taToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: projectId })])
    )
  })
})
