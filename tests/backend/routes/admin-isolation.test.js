// ─── Tests isolation Admin — modules systeme vs promo ─────────────────────────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app
let studentToken, teacherToken, adminToken

beforeAll(() => {
  const db = setupTestDb()

  // Seed teacher_promos pour le teacher id=1, promo_id=1
  try {
    db.prepare('INSERT OR IGNORE INTO teacher_promos (teacher_id, promo_id) VALUES (1, 1)').run()
  } catch { /* table may already be seeded by schema */ }

  // Tokens
  studentToken = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  teacherToken = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)
  adminToken   = jwt.sign({ id: -1, name: 'Prof Test', type: 'admin', promo_id: null }, JWT_SECRET)

  // Express app
  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/admin', auth, require('../../../server/routes/admin/index'))
})

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  Routes admin — accessibles aux admins uniquement
// ═══════════════════════════════════════════
const adminRoutes = [
  { method: 'get', path: '/api/admin/stats' },
  { method: 'get', path: '/api/admin/users' },
  { method: 'get', path: '/api/admin/messages' },
  { method: 'get', path: '/api/admin/config' },
]

describe('Routes admin (admin uniquement)', () => {
  it.each(adminRoutes)(
    'etudiant bloque sur $method $path (403)',
    async ({ method, path }) => {
      const res = await request(app)[method](path)
        .set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(403)
      expect(res.body.ok).toBe(false)
    }
  )

  it.each(adminRoutes)(
    'teacher CAN access $method $path (promo route)',
    async ({ method, path }) => {
      const res = await request(app)[method](path)
        .set('Authorization', `Bearer ${teacherToken}`)
      expect(res.status).not.toBe(403)
    }
  )

  it.each(adminRoutes)(
    'admin autorise sur $method $path (pas 403)',
    async ({ method, path }) => {
      const res = await request(app)[method](path)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).not.toBe(403)
    }
  )
})

// ═══════════════════════════════════════════
//  Routes systeme — reservees a l'admin global
// ═══════════════════════════════════════════
const systemRoutes = [
  { method: 'get', path: '/api/admin/security' },
  { method: 'get', path: '/api/admin/sessions' },
  { method: 'get', path: '/api/admin/audit' },
]

describe('Routes systeme (admin uniquement)', () => {
  it.each(systemRoutes)(
    'etudiant bloque sur $method $path (403)',
    async ({ method, path }) => {
      const res = await request(app)[method](path)
        .set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(403)
    }
  )

  it.each(systemRoutes)(
    'teacher bloque sur $method $path (403)',
    async ({ method, path }) => {
      const res = await request(app)[method](path)
        .set('Authorization', `Bearer ${teacherToken}`)
      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/administrateur/i)
    }
  )

  it.each(systemRoutes)(
    'admin autorise sur $method $path (pas 403)',
    async ({ method, path }) => {
      const res = await request(app)[method](path)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).not.toBe(403)
    }
  )
})

// ═══════════════════════════════════════════
//  POST /config (settings write) — admin uniquement
// ═══════════════════════════════════════════
describe('POST /api/admin/config (settings write)', () => {
  it('teacher CANNOT access config write (system route)', async () => {
    const res = await request(app)
      .post('/api/admin/config')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ key: 'read_only', value: '1' })
    expect(res.status).toBe(403)
  })

  it('admin autorise', async () => {
    const res = await request(app)
      .post('/api/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'read_only', value: '0' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  GET /api/admin/me — retourne le role
// ═══════════════════════════════════════════
describe('GET /api/admin/me', () => {
  it('etudiant bloque (403)', async () => {
    const res = await request(app)
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('teacher CAN access /me (promo route)', async () => {
    const res = await request(app)
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })

  it('admin voit son role', async () => {
    const res = await request(app)
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.type).toBe('admin')
  })
})

// ═══════════════════════════════════════════
//  GET /api/admin/stats — acces admin uniquement
// ═══════════════════════════════════════════
describe('GET /api/admin/stats (acces admin uniquement)', () => {
  it('teacher CAN access stats (promo route)', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
  })

  it('admin recoit des stats globales', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('counts')
  })
})
