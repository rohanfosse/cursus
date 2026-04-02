// ─── Tests admin stats routes ────────────────────────────────────────────────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app, studentToken, teacherToken, adminToken

beforeAll(() => {
  const db = setupTestDb()

  // Seed teacher_promos for teacher id=1, promo_id=1
  try {
    db.prepare('INSERT OR IGNORE INTO teacher_promos (teacher_id, promo_id) VALUES (1, 1)').run()
  } catch { /* already seeded */ }

  // Insert some messages for stats
  db.prepare(`INSERT INTO messages (channel_id, author_id, author_name, author_type, content)
    VALUES (1, 1, 'Jean Dupont', 'student', 'Hello world')`).run()

  // Insert an error report
  db.prepare(`INSERT INTO error_reports (message, page) VALUES ('Test error', '/home')`).run()

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
//  GET /api/admin/stats
// ═══════════════════════════════════════════
describe('GET /api/admin/stats', () => {
  it('refuse les etudiants (403)', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
    expect(res.body.ok).toBe(false)
  })

  it('teacher CAN access stats (200)', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })

  it('admin recoit les stats globales', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.counts).toBeDefined()
    expect(typeof res.body.data.counts.students).toBe('number')
    expect(typeof res.body.data.counts.teachers).toBe('number')
    expect(typeof res.body.data.counts.channels).toBe('number')
    expect(typeof res.body.data.counts.messages).toBe('number')
  })
})

// ═══════════════════════════════════════════
//  GET /api/admin/heatmap
// ═══════════════════════════════════════════
describe('GET /api/admin/heatmap', () => {
  it('refuse les etudiants (403)', async () => {
    const res = await request(app)
      .get('/api/admin/heatmap')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher CAN access heatmap (200)', async () => {
    const res = await request(app)
      .get('/api/admin/heatmap')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })

  it('admin recoit la heatmap', async () => {
    const res = await request(app)
      .get('/api/admin/heatmap')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  GET /api/admin/visits
// ═══════════════════════════════════════════
describe('GET /api/admin/visits', () => {
  it('refuse les etudiants (403)', async () => {
    const res = await request(app)
      .get('/api/admin/visits')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher CAN access visit stats (200)', async () => {
    const res = await request(app)
      .get('/api/admin/visits')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════
//  GET /api/admin/error-reports
// ═══════════════════════════════════════════
describe('GET /api/admin/error-reports', () => {
  it('refuse les etudiants (403)', async () => {
    const res = await request(app)
      .get('/api/admin/error-reports')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher CAN access error reports (200)', async () => {
    const res = await request(app)
      .get('/api/admin/error-reports')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })

  it('teacher CAN access error reports with limit (200)', async () => {
    const res = await request(app)
      .get('/api/admin/error-reports?limit=1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })

  it('teacher CAN access error reports with offset (200)', async () => {
    const res = await request(app)
      .get('/api/admin/error-reports?offset=1000')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════
//  DELETE /api/admin/error-reports
// ═══════════════════════════════════════════
describe('DELETE /api/admin/error-reports', () => {
  it('refuse les etudiants (403)', async () => {
    const res = await request(app)
      .delete('/api/admin/error-reports')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher CANNOT delete error reports (admin only)', async () => {
    const res = await request(app)
      .delete('/api/admin/error-reports')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(403)
  })

  it('admin peut purger les rapports d\'erreur', async () => {
    // Insert a report to clear
    const db = getTestDb()
    db.prepare(`INSERT INTO error_reports (message, page) VALUES ('To clear', '/test')`).run()

    const res = await request(app)
      .delete('/api/admin/error-reports')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    // Verify reports are cleared
    const count = db.prepare('SELECT COUNT(*) AS c FROM error_reports').get().c
    expect(count).toBe(0)
  })
})
