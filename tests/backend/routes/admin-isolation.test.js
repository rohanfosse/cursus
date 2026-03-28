// ─── Tests isolation Admin — acces reserve aux pilotes (teacher) ─────────────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app
let studentToken, teacherToken

beforeAll(() => {
  setupTestDb()

  // Tokens
  studentToken = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  teacherToken = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)

  // Express app
  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/admin', auth, require('../../../server/routes/admin/index'))
})

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  GET /api/admin/stats — statistiques (pilote uniquement)
// ═══════════════════════════════════════════
describe('GET /api/admin/stats', () => {
  it('refuse un etudiant (403)', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
    expect(res.body.ok).toBe(false)
  })

  it('autorise un prof', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  GET /api/admin/users — gestion utilisateurs (pilote uniquement)
// ═══════════════════════════════════════════
describe('GET /api/admin/users', () => {
  it('refuse un etudiant (403)', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
    expect(res.body.ok).toBe(false)
  })

  it('autorise un prof', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  GET /api/admin/messages — moderation (pilote uniquement)
// ═══════════════════════════════════════════
describe('GET /api/admin/messages (moderation)', () => {
  it('refuse un etudiant (403)', async () => {
    const res = await request(app)
      .get('/api/admin/messages')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
    expect(res.body.ok).toBe(false)
  })

  it('prof passe le middleware admin (pas 403)', async () => {
    const res = await request(app)
      .get('/api/admin/messages')
      .set('Authorization', `Bearer ${teacherToken}`)
    // Le prof franchit requireAdmin -- le status n'est pas 403
    expect(res.status).not.toBe(403)
  })
})

// ═══════════════════════════════════════════
//  GET /api/admin/config — settings lecture (pilote uniquement)
// ═══════════════════════════════════════════
describe('GET /api/admin/config (settings)', () => {
  it('refuse un etudiant (403)', async () => {
    const res = await request(app)
      .get('/api/admin/config')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
    expect(res.body.ok).toBe(false)
  })

  it('autorise un prof', async () => {
    const res = await request(app)
      .get('/api/admin/config')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════
//  Couverture globale — requireAdmin bloque tout etudiant
// ═══════════════════════════════════════════
describe('requireAdmin middleware global', () => {
  const protectedRoutes = [
    { method: 'get', path: '/api/admin/stats' },
    { method: 'get', path: '/api/admin/users' },
    { method: 'get', path: '/api/admin/messages' },
    { method: 'get', path: '/api/admin/config' },
  ]

  it.each(protectedRoutes)(
    'etudiant bloque sur $method $path (403)',
    async ({ method, path }) => {
      const res = await request(app)[method](path)
        .set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/pilotes/i)
    }
  )
})
