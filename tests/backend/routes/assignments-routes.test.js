// ─── Tests assignments routes — CRUD, gantt, rendus, schedule, access control ─
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app, studentToken, student2Token, teacherToken

beforeAll(() => {
  const db = setupTestDb()

  // Promo 2 + channel + student in promo 2
  db.exec(`INSERT OR IGNORE INTO promotions (id, name, color) VALUES (2, 'Promo B', '#E74C3C')`)
  db.exec(`INSERT OR IGNORE INTO channels (id, promo_id, name, type) VALUES (3, 2, 'general-b', 'chat')`)
  db.prepare(
    `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
     VALUES (2, 2, 'Alice Martin', 'alice@test.fr', 'AM', 'hash', 0)`
  ).run()

  // Seed an assignment in promo 1 for GET tests
  db.prepare(
    `INSERT OR IGNORE INTO travaux (id, title, description, channel_id, type, deadline, published, promo_id)
     VALUES (1, 'Devoir Test', 'Description test', 1, 'livrable', '2026-12-01', 1, 1)`
  ).run()

  studentToken  = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  student2Token = jwt.sign({ id: 2, name: 'Alice Martin', type: 'student', promo_id: 2 }, JWT_SECRET)
  teacherToken  = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)

  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  app.set('io', { to: () => ({ emit: () => {} }) })
  const auth = require('../../../server/middleware/auth')
  app.use('/api/assignments', auth, require('../../../server/routes/assignments'))
})

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  GET /api/assignments/gantt — gantt data
// ═══════════════════════════════════════════
describe('GET /api/assignments/gantt', () => {
  it('teacher can get gantt data for a promo', async () => {
    const res = await request(app)
      .get('/api/assignments/gantt?promoId=1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('student can get gantt data for own promo', async () => {
    const res = await request(app)
      .get('/api/assignments/gantt?promoId=1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('student from wrong promo gets 403', async () => {
    const res = await request(app)
      .get('/api/assignments/gantt?promoId=1')
      .set('Authorization', `Bearer ${student2Token}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  GET /api/assignments/rendus — all rendus
// ═══════════════════════════════════════════
describe('GET /api/assignments/rendus', () => {
  it('teacher can get rendus for a promo', async () => {
    const res = await request(app)
      .get('/api/assignments/rendus?promoId=1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('student can get rendus for own promo', async () => {
    const res = await request(app)
      .get('/api/assignments/rendus?promoId=1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('student cross-promo blocked (403)', async () => {
    const res = await request(app)
      .get('/api/assignments/rendus?promoId=1')
      .set('Authorization', `Bearer ${student2Token}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  GET /api/assignments/teacher-schedule — teacher only
// ═══════════════════════════════════════════
describe('GET /api/assignments/teacher-schedule', () => {
  it('teacher can get schedule', async () => {
    const res = await request(app)
      .get('/api/assignments/teacher-schedule')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('aNoter')
    expect(res.body.data).toHaveProperty('brouillons')
    expect(res.body.data).toHaveProperty('jalons')
  })

  it('student gets 403', async () => {
    const res = await request(app)
      .get('/api/assignments/teacher-schedule')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  GET /api/assignments/categories
// ═══════════════════════════════════════════
describe('GET /api/assignments/categories', () => {
  it('teacher can get categories', async () => {
    const res = await request(app)
      .get('/api/assignments/categories?promoId=1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('student from own promo can get categories', async () => {
    const res = await request(app)
      .get('/api/assignments/categories?promoId=1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('student from wrong promo gets 403', async () => {
    const res = await request(app)
      .get('/api/assignments/categories?promoId=1')
      .set('Authorization', `Bearer ${student2Token}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  POST /api/assignments — create assignment (teacher only)
// ═══════════════════════════════════════════
describe('POST /api/assignments', () => {
  it('teacher can create an assignment', async () => {
    const res = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Nouveau devoir',
        channelId: 1,
        promoId: 1,
        type: 'livrable',
        deadline: '2026-12-31',
      })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('student cannot create an assignment (403)', async () => {
    const res = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        title: 'Devoir etudiant',
        channelId: 1,
        promoId: 1,
        type: 'livrable',
        deadline: '2026-12-31',
      })
    expect(res.status).toBe(403)
  })

  it('rejects invalid type', async () => {
    const res = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Bad type',
        channelId: 1,
        type: 'nonexistent',
        deadline: '2026-12-31',
      })
    expect(res.status).toBe(400)
  })

  it('rejects missing title', async () => {
    const res = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: '',
        channelId: 1,
        type: 'livrable',
        deadline: '2026-12-31',
      })
    expect(res.status).toBe(400)
  })
})

// ═══════════════════════════════════════════
//  POST /api/assignments/publish — publish assignment
// ═══════════════════════════════════════════
describe('POST /api/assignments/publish', () => {
  let assignmentId

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: 'Devoir a publier',
        channelId: 1,
        promoId: 1,
        type: 'livrable',
        deadline: '2026-12-31',
        published: 0,
      })
    assignmentId = res.body.data?.lastInsertRowid ?? res.body.data?.id
  })

  it('student cannot publish (403)', async () => {
    const res = await request(app)
      .post('/api/assignments/publish')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ id: assignmentId, published: true })
    expect(res.status).toBe(403)
  })

  it('teacher can publish an assignment', async () => {
    const res = await request(app)
      .post('/api/assignments/publish')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ id: assignmentId, published: true })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  GET /api/assignments/:id — get by id
// ═══════════════════════════════════════════
describe('GET /api/assignments/:id', () => {
  it('student from same promo can read assignment', async () => {
    const res = await request(app)
      .get('/api/assignments/1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.title).toBe('Devoir Test')
  })

  it('student from wrong promo gets 403', async () => {
    const res = await request(app)
      .get('/api/assignments/1')
      .set('Authorization', `Bearer ${student2Token}`)
    expect(res.status).toBe(403)
  })

  it('teacher can read any assignment', async () => {
    const res = await request(app)
      .get('/api/assignments/1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  DELETE /api/assignments/:id — teacher only
// ═══════════════════════════════════════════
describe('DELETE /api/assignments/:id', () => {
  let toDeleteId

  beforeAll(async () => {
    const db = getTestDb()
    const info = db.prepare(
      `INSERT INTO travaux (title, description, channel_id, type, deadline, published, promo_id)
       VALUES ('A supprimer', '', 1, 'livrable', '2026-12-31', 0, 1)`
    ).run()
    toDeleteId = info.lastInsertRowid
  })

  it('student cannot delete (403)', async () => {
    const res = await request(app)
      .delete(`/api/assignments/${toDeleteId}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher can delete an assignment', async () => {
    const res = await request(app)
      .delete(`/api/assignments/${toDeleteId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
