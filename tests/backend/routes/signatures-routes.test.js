// ─── Tests route signatures — list, pending-count, reject, by-message ────────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app, teacherToken, studentToken, student2Token

beforeAll(() => {
  setupTestDb()
  const db = getTestDb()

  // Promo 2 + student 2
  db.exec(`INSERT OR IGNORE INTO promotions (id, name, color) VALUES (2, 'Promo B', '#E74C3C')`)
  db.prepare(
    `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
     VALUES (2, 2, 'Alice Martin', 'alice@test.fr', 'AM', 'hash', 0)`
  ).run()

  // Create a DM message for student 1 (needed for signature creation)
  db.prepare(
    `INSERT OR IGNORE INTO messages (id, channel_id, dm_student_id, author_id, author_name, content)
     VALUES (100, 1, 1, 1, 'Jean Dupont', 'Mon document')`
  ).run()

  // Seed a signature request directly for list/reject tests
  db.prepare(
    `INSERT OR IGNORE INTO signature_requests (id, message_id, dm_student_id, file_url, file_name, status)
     VALUES (1, 100, 1, '/uploads/test.pdf', 'test.pdf', 'pending')`
  ).run()

  teacherToken  = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)
  studentToken  = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  student2Token = jwt.sign({ id: 2, name: 'Alice Martin', type: 'student', promo_id: 2 }, JWT_SECRET)

  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/signatures', auth, require('../../../server/routes/signatures'))
}, 30_000)

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  GET /api/signatures — teacher list
// ═══════════════════════════════════════════
describe('GET /api/signatures', () => {
  it('teacher CAN list signature requests (200)', async () => {
    const res = await request(app)
      .get('/api/signatures')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })

  it('student CANNOT list signature requests (403)', async () => {
    const res = await request(app)
      .get('/api/signatures')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher CAN filter by status', async () => {
    const res = await request(app)
      .get('/api/signatures?status=pending')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    for (const sig of res.body.data) {
      expect(sig.status).toBe('pending')
    }
  })

  it('teacher CAN filter by student_id', async () => {
    const res = await request(app)
      .get('/api/signatures?student_id=1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    for (const sig of res.body.data) {
      expect(sig.dm_student_id).toBe(1)
    }
  })
})

// ═══════════════════════════════════════════
//  GET /api/signatures/pending-count — teacher only
// ═══════════════════════════════════════════
describe('GET /api/signatures/pending-count', () => {
  it('teacher CAN get pending count (200)', async () => {
    const res = await request(app)
      .get('/api/signatures/pending-count')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('count')
    expect(typeof res.body.data.count).toBe('number')
  })

  it('student CANNOT get pending count (403)', async () => {
    const res = await request(app)
      .get('/api/signatures/pending-count')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════
//  GET /api/signatures/by-message/:messageId
// ═══════════════════════════════════════════
describe('GET /api/signatures/by-message/:messageId', () => {
  it('CAN get signature by message ID', async () => {
    const res = await request(app)
      .get('/api/signatures/by-message/100')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('message_id', 100)
  })

  it('returns null/undefined for non-existent message', async () => {
    const res = await request(app)
      .get('/api/signatures/by-message/999')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data == null).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  POST /api/signatures/:id/reject — teacher only
// ═══════════════════════════════════════════
describe('POST /api/signatures/:id/reject', () => {
  let rejectSigId

  beforeAll(() => {
    // Seed another pending signature for rejection test
    const db = getTestDb()
    db.prepare(
      `INSERT OR IGNORE INTO messages (id, channel_id, dm_student_id, author_id, author_name, content)
       VALUES (101, 1, 1, 1, 'Jean Dupont', 'Doc a rejeter')`
    ).run()
    const result = db.prepare(
      `INSERT INTO signature_requests (message_id, dm_student_id, file_url, file_name, status)
       VALUES (101, 1, '/uploads/reject.pdf', 'reject.pdf', 'pending')`
    ).run()
    rejectSigId = Number(result.lastInsertRowid)
  })

  it('student CANNOT reject a signature (403)', async () => {
    const res = await request(app)
      .post(`/api/signatures/${rejectSigId}/reject`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ reason: 'Bad doc' })
    expect(res.status).toBe(403)
  })

  it('teacher CAN reject a pending signature (200)', async () => {
    const res = await request(app)
      .post(`/api/signatures/${rejectSigId}/reject`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ reason: 'Document incorrect' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('cannot reject an already rejected signature', async () => {
    const res = await request(app)
      .post(`/api/signatures/${rejectSigId}/reject`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ reason: 'Again' })
    // wrap returns 400 for "deja traitee" (string matching)
    expect(res.body.ok).toBe(false)
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('returns error for non-existent signature', async () => {
    const res = await request(app)
      .post('/api/signatures/99999/reject')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ reason: 'test' })
    expect(res.status).toBe(400)
  })
})

// ═══════════════════════════════════════════
//  POST /api/signatures — create (security)
// ═══════════════════════════════════════════
describe('POST /api/signatures — creation security', () => {
  it('student CANNOT create signature for another student DM (403)', async () => {
    const res = await request(app)
      .post('/api/signatures')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ message_id: 100, dm_student_id: 2, file_url: '/uploads/test.pdf', file_name: 'test.pdf' })
    expect(res.status).toBe(403)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/signatures/:id/sign — v2.182 validation PNG + taille PDF
// ═══════════════════════════════════════════════════════════════════════════
describe('POST /api/signatures/:id/sign — validation image', () => {
  it('rejette une signature non-PNG (JPEG data URI)', async () => {
    const res = await request(app)
      .post('/api/signatures/1/sign')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ signature_image: 'data:image/jpeg;base64,' + 'A'.repeat(200) })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejette une signature base64 sans header PNG', async () => {
    // 200 chars base64 random -> passe le min:100 Zod mais pas le magic byte check.
    const res = await request(app)
      .post('/api/signatures/1/sign')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ signature_image: 'data:image/png;base64,' + 'A'.repeat(200) })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejette un payload sans le prefix data:image/png', async () => {
    const res = await request(app)
      .post('/api/signatures/1/sign')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ signature_image: 'X'.repeat(200) })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejette une signature tres courte (< 100 chars Zod)', async () => {
    const res = await request(app)
      .post('/api/signatures/1/sign')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ signature_image: 'data:image/png;base64,ABCD' })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
