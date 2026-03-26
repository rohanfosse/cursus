// ─── Tests autorisation — vérifie l'isolation promo, les rôles et les IDOR ──
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app
let studentToken, teacherToken, student2Token

beforeAll(() => {
  setupTestDb()
  const db = getTestDb()

  // Promo 2 + canal + étudiant dans promo 2
  db.exec(`INSERT OR IGNORE INTO promotions (id, name, color) VALUES (2, 'Promo B', '#E74C3C')`)
  db.exec(`INSERT OR IGNORE INTO channels (id, promo_id, name, type) VALUES (10, 2, 'promo2-general', 'chat')`)
  db.prepare(
    `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
     VALUES (2, 2, 'Alice Martin', 'alice@test.fr', 'AM', 'hash', 0)`
  ).run()

  // Travail dans promo 1 et promo 2
  db.prepare(`INSERT INTO travaux (id, promo_id, title, deadline, type) VALUES (1, 1, 'TP1', '2030-01-01', 'livrable')`).run()
  db.prepare(`INSERT INTO travaux (id, promo_id, title, deadline, type) VALUES (2, 2, 'TP2', '2030-01-01', 'livrable')`).run()

  // Note prof dans le carnet
  db.prepare(`INSERT INTO teacher_notes (id, teacher_id, student_id, promo_id, content, tag) VALUES (1, 1, 1, 1, 'Note privee', 'observation')`).run()

  // Tokens
  studentToken  = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  student2Token = jwt.sign({ id: 2, name: 'Alice Martin', type: 'student', promo_id: 2 }, JWT_SECRET)
  teacherToken  = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)

  // Express app
  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/students',       auth, require('../../../server/routes/students'))
  app.use('/api/teachers',       auth, require('../../../server/routes/teachers'))
  app.use('/api/rubrics',        auth, require('../../../server/routes/rubrics'))
  app.use('/api/resources',      auth, require('../../../server/routes/resources'))
  app.use('/api/assignments',    auth, require('../../../server/routes/assignments'))
  app.use('/api/kanban',         auth, require('../../../server/routes/kanban'))
  app.use('/api/teacher-notes',  auth, require('../../../server/routes/teacher-notes'))
})

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  TEACHERS — requireTeacher sur GET /
// ═══════════════════════════════════════════
describe('GET /api/teachers', () => {
  it('refuse un étudiant (403)', async () => {
    const res = await request(app).get('/api/teachers').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })
  it('autorise un prof', async () => {
    const res = await request(app).get('/api/teachers').set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════
//  RUBRICS — lecture accessible aux étudiants (grille d'évaluation)
// ═══════════════════════════════════════════
describe('GET /api/rubrics/:travailId', () => {
  it('autorise un étudiant (lecture grille)', async () => {
    const res = await request(app).get('/api/rubrics/1').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════
//  STUDENTS — isolation promo
// ═══════════════════════════════════════════
describe('GET /api/students/:id/profile', () => {
  it('étudiant promo 1 peut voir profil promo 1', async () => {
    const res = await request(app).get('/api/students/1/profile').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
  })
  it('étudiant promo 1 ne peut pas voir profil promo 2 (403)', async () => {
    const res = await request(app).get('/api/students/2/profile').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })
  it('prof peut voir tous les profils', async () => {
    const res = await request(app).get('/api/students/2/profile').set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })
})

describe('GET /api/students/:id/assignments', () => {
  it('étudiant ne peut pas voir les devoirs d\'un autre (403)', async () => {
    const res = await request(app).get('/api/students/2/assignments').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  ASSIGNMENTS — isolation promo
// ═══════════════════════════════════════════
describe('GET /api/assignments/:id', () => {
  it('étudiant promo 1 peut voir TP de sa promo', async () => {
    const res = await request(app).get('/api/assignments/1').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
  })
  it('étudiant promo 1 ne peut pas voir TP promo 2 (403)', async () => {
    const res = await request(app).get('/api/assignments/2').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  TEACHER-NOTES — ownership
// ═══════════════════════════════════════════
describe('Teacher notes ownership', () => {
  it('étudiant ne peut pas accéder aux notes (403)', async () => {
    const res = await request(app).get('/api/teacher-notes/student/1').set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })
  it('prof peut lire ses notes', async () => {
    const res = await request(app).get('/api/teacher-notes/student/1').set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════
//  KANBAN — validation Zod
// ═══════════════════════════════════════════
describe('Kanban validation', () => {
  it('refuse une carte sans titre', async () => {
    const res = await request(app)
      .post('/api/kanban/travaux/1/groups/1')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ description: 'test' })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

// ═══════════════════════════════════════════
//  RESOURCES — promo isolation
// ═══════════════════════════════════════════
describe('GET /api/resources', () => {
  it('étudiant promo 1 ne peut pas voir les ressources promo 2 (403)', async () => {
    const res = await request(app)
      .get('/api/resources?travailId=2')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })
})
