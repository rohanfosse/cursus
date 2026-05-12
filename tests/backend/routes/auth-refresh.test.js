process.env.NODE_ENV = 'test'

const express = require('express')
const jwt = require('jsonwebtoken')
const request = require('supertest')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET, STUDENT, TEACHER, TEST_PASSWORD } = require('../helpers/fixtures')

let app

beforeAll(() => {
  setupTestDb()
  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  app.use('/api/auth', require('../../../server/routes/auth'))
}, 60000)

afterAll(() => teardownTestDb())

function signFor(payload, opts = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h', ...opts })
}

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
describe('POST /api/auth/refresh', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/auth/refresh')
    expect(res.status).toBe(401)
  })

  it('returns a new token for an active student', async () => {
    const oldToken = signFor({ id: STUDENT.id, name: STUDENT.name, type: 'student', promo_id: 1 })
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${oldToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.token).toBeDefined()
    const decoded = jwt.verify(res.body.data.token, JWT_SECRET)
    expect(decoded.id).toBe(STUDENT.id)
    expect(decoded.type).toBe('student')
    expect(decoded.promo_id).toBe(1)
  })

  it('returns a new token for an active teacher (negative id)', async () => {
    const oldToken = signFor({ id: -TEACHER.id, name: TEACHER.name, type: 'teacher', promo_id: null })
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${oldToken}`)
    expect(res.status).toBe(200)
    const decoded = jwt.verify(res.body.data.token, JWT_SECRET)
    expect(decoded.id).toBe(-TEACHER.id)
    expect(decoded.type).toBe('teacher')
    expect(decoded.promo_id).toBeNull()
  })

  it('rejects refresh when the student account has been anonymised (RGPD)', async () => {
    const db = getTestDb()
    db.prepare(`
      INSERT INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
      VALUES (777, 1, 'Marie Curie', 'marie@test.fr', 'MC', 'x', 0)
    `).run()
    const token = signFor({ id: 777, name: 'Marie Curie', type: 'student', promo_id: 1 })

    // Refresh fonctionne avant suppression
    const before = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${token}`)
    expect(before.status).toBe(200)

    // Suppression de compte (RGPD)
    const queries = require('../../../server/db/index')
    queries.anonymizeStudentAccount(777)

    // Le token DOIT etre rejete des qu'il essaie de refresh
    const after = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${token}`)
    expect(after.status).toBe(401)
    expect(after.body.ok).toBe(false)
    expect(after.body.error).toMatch(/supprime|introuvable/i)
  })

  it('rejects refresh when the student id no longer exists', async () => {
    const token = signFor({ id: 999999, name: 'Ghost', type: 'student', promo_id: 1 })
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(401)
  })

  it('rejects refresh when the teacher id no longer exists', async () => {
    const token = signFor({ id: -999999, name: 'Ghost Teacher', type: 'teacher', promo_id: null })
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(401)
  })

  it('reflects the current DB promo_id, not the stale token value', async () => {
    const db = getTestDb()
    db.prepare(`INSERT OR IGNORE INTO promotions (id, name, color) VALUES (2, 'Promo Bis', '#888')`).run()
    db.prepare(`
      INSERT INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
      VALUES (888, 1, 'Albert Camus', 'albert@test.fr', 'AC', 'x', 0)
    `).run()
    const staleToken = signFor({ id: 888, name: 'Albert Camus', type: 'student', promo_id: 1 })

    // Admin reaffecte l'etudiant a une autre promo
    db.prepare('UPDATE students SET promo_id = 2 WHERE id = 888').run()

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${staleToken}`)
    expect(res.status).toBe(200)
    const decoded = jwt.verify(res.body.data.token, JWT_SECRET)
    expect(decoded.promo_id).toBe(2)
  })

  it('reflects the current teacher role (e.g. demotion admin -> teacher)', async () => {
    const db = getTestDb()
    db.prepare(`
      INSERT INTO teachers (id, name, email, password, role, must_change_password)
      VALUES (50, 'Dr Demoted', 'demoted@test.fr', 'x', 'admin', 0)
    `).run()
    const staleToken = signFor({ id: -50, name: 'Dr Demoted', type: 'admin', promo_id: null })

    // Demotion par un autre admin
    db.prepare(`UPDATE teachers SET role = 'teacher' WHERE id = 50`).run()

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${staleToken}`)
    expect(res.status).toBe(200)
    const decoded = jwt.verify(res.body.data.token, JWT_SECRET)
    expect(decoded.type).toBe('teacher')
  })
})

// ── DELETE /api/auth/account smoke ────────────────────────────────────────────
describe('DELETE /api/auth/account (RGPD)', () => {
  it('rejects refresh after a successful account deletion', { timeout: 30000 }, async () => {
    const db = getTestDb()
    const bcrypt = require('bcryptjs')
    const hash = bcrypt.hashSync(TEST_PASSWORD, 10)
    db.prepare(`
      INSERT INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
      VALUES (321, 1, 'Henri Test', 'henri@test.fr', 'HT', ?, 0)
    `).run(hash)
    const token = signFor({ id: 321, name: 'Henri Test', type: 'student', promo_id: 1 })

    // Delete account via API
    const del = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: TEST_PASSWORD, confirmation: 'SUPPRIMER' })
    expect(del.status).toBe(200)
    expect(del.body.ok).toBe(true)

    // Refresh est maintenant bloque
    const refresh = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${token}`)
    expect(refresh.status).toBe(401)
  })
})
