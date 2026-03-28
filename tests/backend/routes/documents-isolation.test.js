// ─── Tests isolation documents — promo isolation + rôle enseignant ────────────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app
let studentToken, student2Token, teacherToken

beforeAll(() => {
  setupTestDb()
  const db = getTestDb()

  // Promo 2 + canal
  db.exec(`INSERT OR IGNORE INTO promotions (id, name, color) VALUES (2, 'Promo B', '#E74C3C')`)
  db.exec(`INSERT OR IGNORE INTO channels (id, promo_id, name, type) VALUES (10, 2, 'promo2-general', 'chat')`)
  db.prepare(
    `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
     VALUES (2, 2, 'Alice Martin', 'alice@test.fr', 'AM', 'hash', 0)`
  ).run()

  // Travaux dans chaque promo
  db.prepare(`INSERT INTO travaux (id, promo_id, title, deadline, type) VALUES (1, 1, 'TP1', '2030-01-01', 'livrable')`).run()
  db.prepare(`INSERT INTO travaux (id, promo_id, title, deadline, type) VALUES (2, 2, 'TP2', '2030-01-01', 'livrable')`).run()

  // Document dans promo 1 (via channel 1)
  db.prepare(
    `INSERT INTO channel_documents (id, channel_id, promo_id, type, name, path_or_url, category)
     VALUES (1, 1, 1, 'link', 'Doc Promo1', 'https://example.com/doc1', 'General')`
  ).run()

  // Document dans promo 2 (via channel 10)
  db.prepare(
    `INSERT INTO channel_documents (id, channel_id, promo_id, type, name, path_or_url, category)
     VALUES (2, 10, 2, 'link', 'Doc Promo2', 'https://example.com/doc2', 'General')`
  ).run()

  // Tokens
  studentToken  = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  student2Token = jwt.sign({ id: 2, name: 'Alice Martin', type: 'student', promo_id: 2 }, JWT_SECRET)
  teacherToken  = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)

  // Express app
  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/documents', auth, require('../../../server/routes/documents'))
})

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  GET /api/documents/promo/:promoId — isolation promo
// ═══════════════════════════════════════════
describe('GET /api/documents/promo/:promoId', () => {
  it('etudiant promo 1 peut lister les documents de sa promo', async () => {
    const res = await request(app)
      .get('/api/documents/promo/1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
  })

  it('etudiant promo 1 ne peut pas lister les documents promo 2 (403)', async () => {
    const res = await request(app)
      .get('/api/documents/promo/2')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  GET /api/documents/channel/:channelId — isolation promo via canal
// ═══════════════════════════════════════════
describe('GET /api/documents/channel/:channelId', () => {
  it('etudiant promo 1 peut voir les documents du canal promo 1', async () => {
    const res = await request(app)
      .get('/api/documents/channel/1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
  })

  it('etudiant promo 1 ne peut pas voir les documents du canal promo 2 (403)', async () => {
    const res = await request(app)
      .get('/api/documents/channel/10')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  POST /api/documents/channel — requireTeacher
// ═══════════════════════════════════════════
describe('POST /api/documents/channel', () => {
  it('etudiant ne peut pas uploader de document (403)', async () => {
    const res = await request(app)
      .post('/api/documents/channel')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        channelId: 1,
        promoId: 1,
        type: 'link',
        name: 'Tentative etudiant',
        pathOrUrl: 'https://example.com/hack',
      })
    expect(res.status).toBe(403)
  })

  it('prof peut uploader un document', async () => {
    const res = await request(app)
      .post('/api/documents/channel')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        channelId: 1,
        promoId: 1,
        type: 'link',
        name: 'Ressource prof',
        pathOrUrl: 'https://example.com/resource',
        authorName: 'Prof Test',
        authorType: 'teacher',
      })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  DELETE /api/documents/channel/:id — requireTeacher
// ═══════════════════════════════════════════
describe('DELETE /api/documents/channel/:id', () => {
  it('etudiant ne peut pas supprimer un document (403)', async () => {
    const res = await request(app)
      .delete('/api/documents/channel/1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('prof peut supprimer un document', async () => {
    const res = await request(app)
      .delete('/api/documents/channel/1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════
//  POST /api/documents/project — requireTeacher
// ═══════════════════════════════════════════
describe('POST /api/documents/project', () => {
  it('etudiant ne peut pas uploader de document projet (403)', async () => {
    const res = await request(app)
      .post('/api/documents/project')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        promoId: 1,
        type: 'link',
        name: 'Tentative projet',
        pathOrUrl: 'https://example.com/project-hack',
      })
    expect(res.status).toBe(403)
  })
})
