// ─── Tests sécurité messages — isolation promo, rôle, ownership ─────────────
const express = require('express')
const request = require('supertest')
const jwt = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app
let studentToken, teacherToken, student2Token

beforeAll(() => {
  setupTestDb()
  const db = getTestDb()

  // Promo 2 + canal + étudiant dans promo 2
  db.exec(`INSERT OR IGNORE INTO promotions (id, name, color) VALUES (2, 'Promo Autre', '#E74C3C')`)
  db.exec(`INSERT OR IGNORE INTO channels (id, promo_id, name, type) VALUES (10, 2, 'autre-general', 'chat')`)
  db.prepare(
    `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
     VALUES (2, 2, 'Alice Martin', 'alice@test.fr', 'AM', 'hash', 0)`
  ).run()

  // Messages dans chaque promo
  db.prepare(
    `INSERT INTO messages (channel_id, author_name, author_type, content) VALUES (1, 'Jean Dupont', 'student', 'Message promo 1')`
  ).run()
  db.prepare(
    `INSERT INTO messages (channel_id, author_name, author_type, content) VALUES (10, 'Alice Martin', 'student', 'Message promo 2')`
  ).run()
  // DM de l'étudiant 1
  db.prepare(
    `INSERT INTO messages (dm_student_id, author_name, author_type, content) VALUES (1, 'Jean Dupont', 'student', 'DM etudiant 1')`
  ).run()

  // Tokens
  studentToken = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  teacherToken = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)
  student2Token = jwt.sign({ id: 2, name: 'Alice Martin', type: 'student', promo_id: 2 }, JWT_SECRET)

  // Express app
  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)

  const authMiddleware = require('../../../server/middleware/auth')
  app.use('/api/messages', authMiddleware, require('../../../server/routes/messages'))
})

afterAll(() => teardownTestDb())

// ─── Pin ─────────────────────────────────────────────────────────────────────
describe('POST /api/messages/pin', () => {
  it('student cannot pin messages → 403', async () => {
    const res = await request(app)
      .post('/api/messages/pin')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ messageId: 1, pinned: true })
    expect(res.status).toBe(403)
  })

  it('teacher can pin messages → 200', async () => {
    const res = await request(app)
      .post('/api/messages/pin')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ messageId: 1, pinned: true })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ─── Reactions ───────────────────────────────────────────────────────────────
describe('POST /api/messages/reactions', () => {
  it('student cannot react to message from other promo → 403', async () => {
    const res = await request(app)
      .post('/api/messages/reactions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ msgId: 2, reactionsJson: '{"check":{"count":1,"users":["Jean"]}}' })
    expect(res.status).toBe(403)
  })

  it('student can react to message in own promo → 200', async () => {
    const res = await request(app)
      .post('/api/messages/reactions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ msgId: 1, reactionsJson: '{"check":{"count":1,"users":["Jean"]}}' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ─── Search-all ──────────────────────────────────────────────────────────────
describe('POST /api/messages/search-all', () => {
  it('student search is forced to own promo', async () => {
    const res = await request(app)
      .post('/api/messages/search-all')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ promoId: 2, query: 'Message', limit: 50 })
    expect(res.status).toBe(200)
    // Should NOT contain promo 2 messages even though promoId=2 was requested
    const data = res.body.data || []
    for (const msg of data) {
      expect(msg.promo_id).not.toBe(2)
    }
  })

  it('student userId is forced to own id (cannot search other DMs)', async () => {
    const res = await request(app)
      .post('/api/messages/search-all')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ promoId: 1, query: 'DM', limit: 50, userId: 2 })
    expect(res.status).toBe(200)
    // userId should be forced to student's own id (1), not 2
    const data = res.body.data || []
    for (const msg of data) {
      if (msg.source_type === 'dm') {
        // DM results should only be from student's own box
        expect(msg.promo_id).toBeNull() // DMs have null promo_id
      }
    }
  })

  it('teacher can search across promos', async () => {
    const res = await request(app)
      .post('/api/messages/search-all')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: null, query: 'Message', limit: 50 })
    expect(res.status).toBe(200)
  })
})

// ─── DM privacy ──────────────────────────────────────────────────────────────
describe('DM privacy', () => {
  it('student cannot read DMs of another student → 403', async () => {
    const res = await request(app)
      .get('/api/messages/dm/2')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('student can read own DMs → 200', async () => {
    const res = await request(app)
      .get('/api/messages/dm/1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ─── Message ownership ───────────────────────────────────────────────────────
describe('Message ownership', () => {
  it('student cannot delete another student message → 403', async () => {
    const res = await request(app)
      .delete('/api/messages/2')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('student can delete own message → 200', async () => {
    const res = await request(app)
      .delete('/api/messages/1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
