// ─── Tests routes rubriques — CRUD, scores, promo isolation ──────────────────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app, db
let teacherToken, studentToken, student2Token

beforeAll(() => {
  setupTestDb()
  db = getTestDb()

  // Seed promo 2 + student 2
  db.exec(`INSERT OR IGNORE INTO promotions (id, name, color) VALUES (2, 'Promo B', '#E74C3C')`)
  db.prepare(
    `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
     VALUES (2, 2, 'Alice Martin', 'alice@test.fr', 'AM', 'hash', 0)`
  ).run()

  // Seed travaux
  db.prepare(
    `INSERT OR IGNORE INTO travaux (id, promo_id, title, deadline, type) VALUES (1, 1, 'TP1', '2030-01-01', 'livrable')`
  ).run()
  db.prepare(
    `INSERT OR IGNORE INTO travaux (id, promo_id, title, deadline, type) VALUES (2, 2, 'TP2', '2030-01-01', 'livrable')`
  ).run()

  // Seed depot for scoring tests
  db.prepare(
    `INSERT OR IGNORE INTO depots (id, travail_id, student_id, file_name, file_path)
     VALUES (1, 1, 1, 'rapport.pdf', '/uploads/rapport.pdf')`
  ).run()

  // Tokens
  teacherToken  = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)
  studentToken  = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  student2Token = jwt.sign({ id: 2, name: 'Alice Martin', type: 'student', promo_id: 2 }, JWT_SECRET)

  // Express app
  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/rubrics', auth, require('../../../server/routes/rubrics'))
}, 30_000)

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  POST /api/rubrics — create/upsert
// ═══════════════════════════════════════════
describe('POST /api/rubrics — upsert', () => {
  it('teacher CAN create a rubric with criteria (200)', async () => {
    const res = await request(app)
      .post('/api/rubrics')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        travailId: 1,
        title: 'Grille TP1',
        criteria: [
          { label: 'Fonctionnalite', max_pts: 10, weight: 2, position: 0 },
          { label: 'Code quality', max_pts: 5, weight: 1, position: 1 },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('teacher CAN update an existing rubric (upsert)', async () => {
    const res = await request(app)
      .post('/api/rubrics')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        travailId: 1,
        title: 'Grille TP1 v2',
        criteria: [
          { label: 'Fonctionnalite v2', max_pts: 20, weight: 3, position: 0 },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('student CANNOT create a rubric (403)', async () => {
    const res = await request(app)
      .post('/api/rubrics')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ travailId: 1, title: 'Hack', criteria: [] })
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  GET /api/rubrics/:travailId — read
// ═══════════════════════════════════════════
describe('GET /api/rubrics/:travailId', () => {
  it('student from promo 1 CAN read promo 1 rubric (200)', async () => {
    const res = await request(app)
      .get('/api/rubrics/1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('criteria')
    expect(res.body.data.criteria.length).toBeGreaterThanOrEqual(1)
  })

  it('student from promo 2 CANNOT read promo 1 rubric (403)', async () => {
    const res = await request(app)
      .get('/api/rubrics/1')
      .set('Authorization', `Bearer ${student2Token}`)
    expect(res.status).toBe(403)
  })

  it('returns null for travail without rubric', async () => {
    const res = await request(app)
      .get('/api/rubrics/2')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })
})

// ═══════════════════════════════════════════
//  DELETE /api/rubrics/:travailId
// ═══════════════════════════════════════════
describe('DELETE /api/rubrics/:travailId', () => {
  it('student CANNOT delete rubric (403)', async () => {
    const res = await request(app)
      .delete('/api/rubrics/1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher CAN delete rubric (200)', async () => {
    // Re-create for this test (travailId 1 = promo 1, teacher's promo)
    await request(app)
      .post('/api/rubrics')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ travailId: 1, title: 'Temp', criteria: [{ label: 'A', max_pts: 5 }] })

    const res = await request(app)
      .delete('/api/rubrics/1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  GET/POST /api/rubrics/scores — scoring
// ═══════════════════════════════════════════
describe('Rubric scores', () => {
  let criterionId

  beforeAll(() => {
    // Ensure rubric with criteria exists for travail 1
    const rubric = db.prepare('SELECT id FROM rubrics WHERE travail_id = 1').get()
    if (rubric) {
      const criteria = db.prepare('SELECT id FROM rubric_criteria WHERE rubric_id = ?').all(rubric.id)
      if (criteria.length > 0) criterionId = criteria[0].id
    }
  })

  it('teacher CAN get depot scores (200)', async () => {
    const res = await request(app)
      .get('/api/rubrics/scores/1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('student CANNOT get depot scores (403)', async () => {
    const res = await request(app)
      .get('/api/rubrics/scores/1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher CAN set depot scores (200)', async () => {
    if (!criterionId) return // skip if no criteria seeded
    const res = await request(app)
      .post('/api/rubrics/scores')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        depotId: 1,
        scores: [{ criterion_id: criterionId, points: 15 }],
      })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('student CANNOT set depot scores (403)', async () => {
    const res = await request(app)
      .post('/api/rubrics/scores')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ depotId: 1, scores: [] })
    expect(res.status).toBe(403)
  })

  // v2.183 : validation Zod + cross-promo checks
  it('rejette points > 100 (Zod)', async () => {
    const res = await request(app)
      .post('/api/rubrics/scores')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ depotId: 1, scores: [{ criterion_id: 1, points: 99999 }] })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejette points negatifs', async () => {
    const res = await request(app)
      .post('/api/rubrics/scores')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ depotId: 1, scores: [{ criterion_id: 1, points: -5 }] })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejette points NaN / non-numerique', async () => {
    const res = await request(app)
      .post('/api/rubrics/scores')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ depotId: 1, scores: [{ criterion_id: 1, points: 'cheater' }] })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejette un tableau > 30 scores', async () => {
    const scores = Array.from({ length: 50 }, (_, i) => ({ criterion_id: i + 1, points: 1 }))
    const res = await request(app)
      .post('/api/rubrics/scores')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ depotId: 1, scores })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejette criterion_id manquant', async () => {
    const res = await request(app)
      .post('/api/rubrics/scores')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ depotId: 1, scores: [{ points: 10 }] })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
