// ─── Tests admin routes — role change + teacher_promos management ───────────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app, studentToken, teacherToken, adminToken

beforeAll(() => {
  const db = setupTestDb()

  // Ajoute une promo supplementaire pour les tests d'assignation
  db.prepare(`INSERT OR IGNORE INTO promotions (id, name, color) VALUES (2, 'Promo Secondaire', '#10B981')`).run()

  // Ajoute un TA et un admin pour que les tests aient des cibles
  const hash = require('bcryptjs').hashSync('Test1234!', 10)
  db.prepare(
    `INSERT OR IGNORE INTO teachers (id, name, email, password, must_change_password, role)
     VALUES (3, 'TA Test', 'ta@test.fr', ?, 0, 'ta')`
  ).run(hash)
  db.prepare(
    `INSERT OR IGNORE INTO teachers (id, name, email, password, must_change_password, role)
     VALUES (4, 'Admin Test', 'admin@test.fr', ?, 0, 'admin')`
  ).run(hash)
  db.prepare(
    `INSERT OR IGNORE INTO teachers (id, name, email, password, must_change_password, role)
     VALUES (5, 'Admin Secondaire', 'admin2@test.fr', ?, 0, 'teacher')`
  ).run(hash)

  studentToken = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  teacherToken = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)
  adminToken   = jwt.sign({ id: -4, name: 'Admin Test', type: 'admin', promo_id: null }, JWT_SECRET)

  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/admin', auth, require('../../../server/routes/admin/index'))
})

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════════════════
//  PATCH /api/admin/users/:id/role — changer le rôle
// ═══════════════════════════════════════════════════════
describe('PATCH /api/admin/users/:id/role', () => {
  it('student is blocked (403)', async () => {
    const res = await request(app)
      .patch('/api/admin/users/-3/role')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ role: 'teacher' })
    expect(res.status).toBe(403)
  })

  it('teacher (non-admin) is blocked (403)', async () => {
    const res = await request(app)
      .patch('/api/admin/users/-3/role')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ role: 'teacher' })
    expect(res.status).toBe(403)
  })

  it('admin CAN promote a TA to teacher', async () => {
    const res = await request(app)
      .patch('/api/admin/users/-3/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'teacher' })
    expect(res.status).toBe(200)
    expect(res.body.data.role).toBe('teacher')
    const db = getTestDb()
    expect(db.prepare('SELECT role FROM teachers WHERE id = 3').get().role).toBe('teacher')
  })

  it('admin CAN demote a teacher back to TA', async () => {
    const res = await request(app)
      .patch('/api/admin/users/-3/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'ta' })
    expect(res.status).toBe(200)
    expect(res.body.data.role).toBe('ta')
  })

  it('rejects an invalid role', async () => {
    const res = await request(app)
      .patch('/api/admin/users/-3/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'superadmin' })
    expect(res.status).toBe(400)
  })

  it('rejects role change for a student (positive id)', async () => {
    const res = await request(app)
      .patch('/api/admin/users/1/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'teacher' })
    expect(res.status).toBe(400)
  })

  it('returns 404 for a non-existent teacher id', async () => {
    const res = await request(app)
      .patch('/api/admin/users/-999/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'teacher' })
    expect(res.status).toBe(404)
  })

  it('blocks self-role-change (admin cannot modify own role)', async () => {
    const res = await request(app)
      .patch('/api/admin/users/-4/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'teacher' })
    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/propre/i)
  })

  it('blocks demoting the last admin (safeguard)', async () => {
    // Pre-setup : seul -5 est admin en DB (pas le caller -4 qui a un token admin).
    // Ainsi la demande portant sur -5 declenche la safeguard sans entrer en conflit
    // avec la garde "self" ou le middleware (qui lit req.user.type depuis le JWT).
    const db = getTestDb()
    db.prepare('UPDATE teachers SET role = ? WHERE id = ?').run('admin', 5)
    db.prepare('UPDATE teachers SET role = ? WHERE id = ?').run('teacher', 4)

    const res = await request(app)
      .patch('/api/admin/users/-5/role')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'teacher' })
    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/dernier/i)

    // Cleanup pour les tests suivants
    db.prepare('UPDATE teachers SET role = ? WHERE id = ?').run('admin', 4)
  })
})

// ═══════════════════════════════════════════════════════
//  GET /api/admin/users/:id/promos — list
// ═══════════════════════════════════════════════════════
describe('GET /api/admin/users/:id/promos', () => {
  it('returns assigned promos for a teacher', async () => {
    const res = await request(app)
      .get('/api/admin/users/-1/promos')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.some(p => p.id === 1)).toBe(true)
  })

  it('returns empty array for a student (positive id)', async () => {
    const res = await request(app)
      .get('/api/admin/users/1/promos')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════
//  POST /api/admin/users/:id/promos — assign
// ═══════════════════════════════════════════════════════
describe('POST /api/admin/users/:id/promos', () => {
  it('teacher (non-admin) is blocked (403) — admin-only action', async () => {
    const res = await request(app)
      .post('/api/admin/users/-3/promos')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 2 })
    expect(res.status).toBe(403)
  })

  it('admin can assign a promo to a teacher', async () => {
    const res = await request(app)
      .post('/api/admin/users/-3/promos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ promoId: 1 })
    expect(res.status).toBe(200)
    const db = getTestDb()
    expect(
      db.prepare('SELECT 1 FROM teacher_promos WHERE teacher_id = 3 AND promo_id = 1').get()
    ).toBeTruthy()
  })

  it('rejects a student target (positive id)', async () => {
    const res = await request(app)
      .post('/api/admin/users/1/promos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ promoId: 1 })
    expect(res.status).toBe(400)
  })

  it('rejects missing promoId', async () => {
    const res = await request(app)
      .post('/api/admin/users/-3/promos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
    expect(res.status).toBe(400)
  })
})

// ═══════════════════════════════════════════════════════
//  DELETE /api/admin/users/:id/promos/:promoId — unassign
// ═══════════════════════════════════════════════════════
describe('DELETE /api/admin/users/:id/promos/:promoId', () => {
  it('teacher (non-admin) is blocked (403)', async () => {
    const res = await request(app)
      .delete('/api/admin/users/-3/promos/1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(403)
  })

  it('admin can unassign a promo', async () => {
    const db = getTestDb()
    db.prepare('INSERT OR IGNORE INTO teacher_promos (teacher_id, promo_id) VALUES (?, ?)').run(3, 2)
    const res = await request(app)
      .delete('/api/admin/users/-3/promos/2')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(
      db.prepare('SELECT 1 FROM teacher_promos WHERE teacher_id = 3 AND promo_id = 2').get()
    ).toBeFalsy()
  })

  it('is idempotent (second delete returns ok)', async () => {
    const res = await request(app)
      .delete('/api/admin/users/-3/promos/9999')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
  })

  it('rejects student target (positive id)', async () => {
    const res = await request(app)
      .delete('/api/admin/users/1/promos/1')
      .set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(400)
  })
})
