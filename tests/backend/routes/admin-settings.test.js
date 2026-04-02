// ─── Tests admin settings routes ─────────────────────────────────────────────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app, studentToken, teacherToken, adminToken

beforeAll(() => {
  const db = setupTestDb()

  try {
    db.prepare('INSERT OR IGNORE INTO teacher_promos (teacher_id, promo_id) VALUES (1, 1)').run()
  } catch { /* already seeded */ }

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
//  GET /api/admin/config (settings-read)
// ═══════════════════════════════════════════
describe('GET /api/admin/config', () => {
  it('refuse les etudiants (403)', async () => {
    const res = await request(app)
      .get('/api/admin/config')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
    expect(res.body.ok).toBe(false)
  })

  it('teacher CAN lire la config (promo route)', async () => {
    const res = await request(app)
      .get('/api/admin/config')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })

  it('admin peut lire la config', async () => {
    const res = await request(app)
      .get('/api/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('read_only')
  })
})

// ═══════════════════════════════════════════
//  POST /api/admin/config (settings write - admin only)
// ═══════════════════════════════════════════
describe('POST /api/admin/config', () => {
  it('refuse les etudiants (403)', async () => {
    const res = await request(app)
      .post('/api/admin/config')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ key: 'read_only', value: '1' })
    expect(res.status).toBe(403)
  })

  it('teacher non-admin bloque (403)', async () => {
    const res = await request(app)
      .post('/api/admin/config')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ key: 'read_only', value: '1' })
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/administrateur/i)
  })

  it('admin peut modifier read_only', async () => {
    const res = await request(app)
      .post('/api/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'read_only', value: '1' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    // Verify the value persisted
    const check = await request(app)
      .get('/api/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(check.body.data.read_only).toBe(true)
  })

  it('refuse une cle non autorisee (400)', async () => {
    const res = await request(app)
      .post('/api/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'secret_key', value: 'evil' })
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/non autoris/i)
  })

  it('remet read_only a 0', async () => {
    const res = await request(app)
      .post('/api/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'read_only', value: '0' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const check = await request(app)
      .get('/api/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(check.body.data.read_only).toBe(false)
  })
})

// ═══════════════════════════════════════════
//  POST /api/admin/promos/:id/archive (admin only)
// ═══════════════════════════════════════════
describe('POST /api/admin/promos/:id/archive', () => {
  it('refuse les etudiants (403)', async () => {
    const res = await request(app)
      .post('/api/admin/promos/1/archive')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ archived: true })
    expect(res.status).toBe(403)
  })

  it('teacher non-admin bloque (403)', async () => {
    const res = await request(app)
      .post('/api/admin/promos/1/archive')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ archived: true })
    expect(res.status).toBe(403)
  })

  it('admin peut archiver une promo', async () => {
    const res = await request(app)
      .post('/api/admin/promos/1/archive')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ archived: true })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    // Verify archived
    const db = getTestDb()
    const promo = db.prepare('SELECT archived FROM promotions WHERE id = 1').get()
    expect(promo.archived).toBe(1)
  })

  it('admin peut desarchiver une promo', async () => {
    const res = await request(app)
      .post('/api/admin/promos/1/archive')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ archived: false })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const db = getTestDb()
    const promo = db.prepare('SELECT archived FROM promotions WHERE id = 1').get()
    expect(promo.archived).toBe(0)
  })
})
