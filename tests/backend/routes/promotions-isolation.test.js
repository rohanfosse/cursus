// ─── Tests isolation promotions — promo isolation + rôle enseignant ───────────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app
let studentToken, student2Token, teacherToken, adminToken

beforeAll(() => {
  setupTestDb()
  const db = getTestDb()

  // Promo 2 + canal + etudiant dans promo 2
  db.exec(`INSERT OR IGNORE INTO promotions (id, name, color) VALUES (2, 'Promo B', '#E74C3C')`)
  db.exec(`INSERT OR IGNORE INTO channels (id, promo_id, name, type) VALUES (10, 2, 'promo2-general', 'chat')`)
  db.prepare(
    `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
     VALUES (2, 2, 'Alice Martin', 'alice@test.fr', 'AM', 'hash', 0)`
  ).run()
  // Teacher 1 doit etre responsable de promo 1 pour le PATCH (cf. v2.331 CR-1
  // qui exige requirePromoAdmin sur PATCH /promotions/:id).
  db.exec(`INSERT OR IGNORE INTO teacher_promos (teacher_id, promo_id) VALUES (1, 1)`)

  // Tokens
  studentToken  = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  student2Token = jwt.sign({ id: 2, name: 'Alice Martin', type: 'student', promo_id: 2 }, JWT_SECRET)
  teacherToken  = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)
  adminToken    = jwt.sign({ id: -99, name: 'Admin Test', type: 'admin', promo_id: null }, JWT_SECRET)

  // Express app
  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/promotions', auth, require('../../../server/routes/promotions'))
})

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  GET /api/promotions — liste toutes les promos
// ═══════════════════════════════════════════
describe('GET /api/promotions', () => {
  it('prof peut lister toutes les promos', async () => {
    const res = await request(app)
      .get('/api/promotions')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })

  it('etudiant peut aussi lister les promos (pas de requireTeacher)', async () => {
    const res = await request(app)
      .get('/api/promotions')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════
//  GET /api/promotions/:promoId/students — isolation promo
// ═══════════════════════════════════════════
describe('GET /api/promotions/:promoId/students', () => {
  it('etudiant promo 1 peut voir les etudiants de sa promo', async () => {
    const res = await request(app)
      .get('/api/promotions/1/students')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
  })

  it('etudiant promo 1 ne peut pas voir les etudiants promo 2 (403)', async () => {
    const res = await request(app)
      .get('/api/promotions/2/students')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('prof peut voir les etudiants de n\'importe quelle promo', async () => {
    const res = await request(app)
      .get('/api/promotions/2/students')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════
//  GET /api/promotions/:promoId/channels — isolation promo
// ═══════════════════════════════════════════
describe('GET /api/promotions/:promoId/channels', () => {
  it('etudiant promo 1 peut voir les canaux de sa promo', async () => {
    const res = await request(app)
      .get('/api/promotions/1/channels')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
  })

  it('etudiant promo 1 ne peut pas voir les canaux promo 2 (403)', async () => {
    const res = await request(app)
      .get('/api/promotions/2/channels')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  POST /api/promotions — admin only depuis v2.331 (audit CR-1)
//  Avant : tout teacher pouvait creer une promo arbitraire.
// ═══════════════════════════════════════════
describe('POST /api/promotions', () => {
  it('etudiant ne peut pas creer une promo (403)', async () => {
    const res = await request(app)
      .post('/api/promotions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ name: 'Promo Hack', color: '#FF0000' })
    expect(res.status).toBe(403)
  })

  it('prof ne peut PLUS creer une promo (403, anti-escalation)', async () => {
    const res = await request(app)
      .post('/api/promotions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Promo Hack', color: '#FF0000' })
    expect(res.status).toBe(403)
  })

  it('admin peut creer une promo', async () => {
    const res = await request(app)
      .post('/api/promotions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Promo C', color: '#27AE60' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  PATCH /api/promotions/:id — requirePromoAdmin depuis v2.331 (audit CR-1)
//  Le prof doit etre responsable de la promo (teacher_promos).
// ═══════════════════════════════════════════
describe('PATCH /api/promotions/:id', () => {
  it('etudiant ne peut pas modifier une promo (403)', async () => {
    const res = await request(app)
      .patch('/api/promotions/1')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ name: 'Renamed by student' })
    expect(res.status).toBe(403)
  })

  it('prof responsable de la promo peut la modifier', async () => {
    // teacher_promos (1, 1) est seede dans le beforeAll
    const res = await request(app)
      .patch('/api/promotions/1')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Promo Renamed' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('prof NON-responsable d\'une autre promo ne peut pas la modifier (403)', async () => {
    // teacher 1 n'est PAS dans teacher_promos pour promo 2
    const res = await request(app)
      .patch('/api/promotions/2')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'CrossPromoHack' })
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  DELETE /api/promotions/:id — requireRole('admin')
// ═══════════════════════════════════════════
describe('DELETE /api/promotions/:id', () => {
  let emptyPromoId

  beforeAll(async () => {
    // Creer une promo vide (sans etudiants) pour pouvoir la supprimer.
    // Depuis v2.331, POST /api/promotions exige admin.
    const res = await request(app)
      .post('/api/promotions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Promo Jetable', color: '#AAAAAA' })
    emptyPromoId = typeof res.body.data === 'number' ? res.body.data : (res.body.data?.lastInsertRowid ?? res.body.data?.id ?? 99)
  })

  it('etudiant ne peut pas supprimer une promo (403)', async () => {
    const res = await request(app)
      .delete(`/api/promotions/${emptyPromoId}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('prof ne peut plus supprimer une promo (403)', async () => {
    const res = await request(app)
      .delete(`/api/promotions/${emptyPromoId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(403)
  })

  it('admin peut supprimer une promo vide', async () => {
    const res = await request(app)
      .delete(`/api/promotions/${emptyPromoId}`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })
})
