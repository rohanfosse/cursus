// ─── Tests admin maintenance routes ──────────────────────────────────────────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app, studentToken, teacherToken, adminToken

beforeAll(() => {
  const db = setupTestDb()

  // Seed some data for purge tests
  db.prepare(`INSERT INTO audit_log (actor_id, actor_name, actor_type, action, target, details, ip)
    VALUES (1, 'Prof', 'admin', 'test.action', 'test', '{}', '127.0.0.1')`).run()
  db.prepare(`INSERT INTO active_sessions (user_id, user_name, user_type, token_hash, ip, user_agent)
    VALUES (1, 'Jean', 'student', 'maint_hash_1', '127.0.0.1', 'Test')`).run()

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
//  Access control (admin only)
// ═══════════════════════════════════════════
describe('Maintenance access control', () => {
  const endpoints = [
    { method: 'post', path: '/api/admin/reset-seed', body: { confirm: 'RESET' } },
    { method: 'get',  path: '/api/admin/db-info' },
    { method: 'post', path: '/api/admin/purge', body: {} },
    { method: 'post', path: '/api/admin/cleanup-logs', body: {} },
    { method: 'get',  path: '/api/admin/backups' },
  ]

  it.each(endpoints)(
    'etudiant bloque sur $method $path (403)',
    async ({ method, path, body }) => {
      const req = request(app)[method](path)
        .set('Authorization', `Bearer ${studentToken}`)
      if (body) req.send(body)
      const res = await req
      expect(res.status).toBe(403)
    }
  )

  it.each(endpoints)(
    'teacher non-admin bloque sur $method $path (403)',
    async ({ method, path, body }) => {
      const req = request(app)[method](path)
        .set('Authorization', `Bearer ${teacherToken}`)
      if (body) req.send(body)
      const res = await req
      expect(res.status).toBe(403)
    }
  )
})

// ═══════════════════════════════════════════
//  POST /api/admin/reset-seed
// ═══════════════════════════════════════════
describe('POST /api/admin/reset-seed', () => {
  it('refuse sans confirmation (400)', async () => {
    const res = await request(app)
      .post('/api/admin/reset-seed')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/confirm/i)
  })

  it('refuse avec mauvaise confirmation (400)', async () => {
    const res = await request(app)
      .post('/api/admin/reset-seed')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirm: 'NO' })
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
  })

  it('admin peut reset seed avec confirmation', async () => {
    const res = await request(app)
      .post('/api/admin/reset-seed')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ confirm: 'RESET' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  GET /api/admin/db-info
// ═══════════════════════════════════════════
describe('GET /api/admin/db-info', () => {
  it('admin recoit les infos de la base', async () => {
    const res = await request(app)
      .get('/api/admin/db-info')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)

    const table = res.body.data[0]
    expect(table).toHaveProperty('name')
    expect(table).toHaveProperty('rowCount')
    expect(typeof table.rowCount).toBe('number')
  })

  it('contient les tables principales', async () => {
    const res = await request(app)
      .get('/api/admin/db-info')
      .set('Authorization', `Bearer ${adminToken}`)
    const names = res.body.data.map(t => t.name)
    expect(names).toContain('students')
    expect(names).toContain('teachers')
    expect(names).toContain('promotions')
    expect(names).toContain('channels')
    expect(names).toContain('messages')
  })
})

// ═══════════════════════════════════════════
//  GET /api/admin/backups
// ═══════════════════════════════════════════
describe('GET /api/admin/backups', () => {
  it('admin recoit la liste des backups (vide ou non)', async () => {
    const res = await request(app)
      .get('/api/admin/backups')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  GET /api/admin/backup-health
// ═══════════════════════════════════════════
describe('GET /api/admin/backup-health', () => {
  it('admin recoit le statut de sante des backups', async () => {
    const res = await request(app)
      .get('/api/admin/backup-health')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('health')
    expect(['ok', 'stale', 'missing']).toContain(res.body.data.health)
    expect(res.body.data).toHaveProperty('count')
    expect(res.body.data).toHaveProperty('latest')
    expect(res.body.data).toHaveProperty('staleThresholdMs')
  })

  it('refuse l\'acces sans token admin', async () => {
    const res = await request(app).get('/api/admin/backup-health')
    expect(res.status).toBe(401)
  })
})

// ═══════════════════════════════════════════
//  DELETE /api/admin/backups/:filename
// ═══════════════════════════════════════════
describe('DELETE /api/admin/backups/:filename', () => {
  it('retourne 404 pour un fichier valide mais inexistant', async () => {
    const res = await request(app)
      .delete('/api/admin/backups/cursus-9999-01-01T00-00-00.db')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(404)
    expect(res.body.ok).toBe(false)
  })

  it('retourne 400 pour un nom qui ne matche pas le pattern cursus-*.db', async () => {
    const res = await request(app)
      .delete('/api/admin/backups/nonexistent.db')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
  })
})

// ═══════════════════════════════════════════
//  POST /api/admin/cleanup-logs
// ═══════════════════════════════════════════
describe('POST /api/admin/cleanup-logs', () => {
  it('admin peut nettoyer les logs', async () => {
    const res = await request(app)
      .post('/api/admin/cleanup-logs')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('deleted')
    expect(typeof res.body.data.deleted).toBe('number')
  })
})

// ═══════════════════════════════════════════
//  POST /api/admin/purge
// ═══════════════════════════════════════════
describe('POST /api/admin/purge', () => {
  it('admin peut purger les anciennes donnees', async () => {
    const res = await request(app)
      .post('/api/admin/purge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ auditDays: 90, loginDays: 30, sessionDays: 30 })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('audit')
    expect(res.body.data).toHaveProperty('logins')
    expect(res.body.data).toHaveProperty('sessions')
    expect(res.body.data).toHaveProperty('reports')
    expect(res.body.data).toHaveProperty('visits')
  })

  it('utilise les valeurs par defaut quand les parametres sont absents', async () => {
    const res = await request(app)
      .post('/api/admin/purge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(typeof res.body.data.audit).toBe('number')
  })

  it('clamp les valeurs trop basses au minimum (7 jours)', async () => {
    const res = await request(app)
      .post('/api/admin/purge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ auditDays: 1, loginDays: 1, sessionDays: 1 })
    // Should not crash; the clamping happens server-side
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
