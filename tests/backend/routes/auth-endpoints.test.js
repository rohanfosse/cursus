process.env.NODE_ENV = 'test'

const express = require('express')
const jwt = require('jsonwebtoken')
const request = require('supertest')
const { setupTestDb, teardownTestDb } = require('../helpers/setup')
const { JWT_SECRET, STUDENT, TEACHER } = require('../helpers/fixtures')

let app, studentToken, teacherToken

beforeAll(() => {
  setupTestDb()
  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  app.use('/api/auth', require('../../../server/routes/auth'))

  studentToken = jwt.sign(
    { id: STUDENT.id, name: STUDENT.name, type: 'student', promo_id: 1 },
    JWT_SECRET, { expiresIn: '1h' },
  )
  teacherToken = jwt.sign(
    { id: TEACHER.id, name: TEACHER.name, type: 'teacher', promo_id: null },
    JWT_SECRET, { expiresIn: '1h' },
  )
})
afterAll(() => teardownTestDb())

// ── GET /api/auth/identities ──────────────────────────────────────────────────
describe('GET /api/auth/identities', () => {
  it('returns identities in non-production env (no auth required)', async () => {
    const res = await request(app).get('/api/auth/identities')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

// ── GET /api/auth/student-by-email ────────────────────────────────────────────
describe('GET /api/auth/student-by-email', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .get('/api/auth/student-by-email?email=jean@test.fr')
    expect(res.status).toBe(401)
  })

  it('rejects student access', async () => {
    const res = await request(app)
      .get('/api/auth/student-by-email?email=jean@test.fr')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('allows teacher access and returns student', async () => {
    const res = await request(app)
      .get(`/api/auth/student-by-email?email=${STUDENT.email}`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.name).toBe(STUDENT.name)
  })

  it('returns null for non-existent email', async () => {
    const res = await request(app)
      .get('/api/auth/student-by-email?email=nobody@test.fr')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toBeFalsy()
  })
})

// ── GET /api/auth/teachers ────────────────────────────────────────────────────
describe('GET /api/auth/teachers', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/auth/teachers')
    expect(res.status).toBe(401)
  })

  it('returns list of teachers with negative ids', async () => {
    const res = await request(app)
      .get('/api/auth/teachers')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    if (res.body.data.length > 0) {
      const teacher = res.body.data[0]
      expect(teacher.id).toBeLessThan(0)
      expect(teacher.name).toBeDefined()
      expect(teacher.avatar_initials).toBeDefined()
      expect(teacher.type).toBeDefined()
      // Should not expose password
      expect(teacher.password).toBeUndefined()
    }
  })
})

// ── GET /api/auth/find-user ───────────────────────────────────────────────────
describe('GET /api/auth/find-user', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/auth/find-user?name=Jean')
    expect(res.status).toBe(401)
  })

  it('finds existing student by name', async () => {
    const res = await request(app)
      .get(`/api/auth/find-user?name=${encodeURIComponent(STUDENT.name)}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

// ── POST /api/auth/login (additional edge cases) ──────────────────────────────
describe('POST /api/auth/login (edge cases)', () => {
  it('returns JWT token with correct claims', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: STUDENT.email, password: 'Test1234!' })
    expect(res.body.ok).toBe(true)
    const token = res.body.data.token
    const decoded = jwt.verify(token, JWT_SECRET)
    expect(decoded.id).toBe(STUDENT.id)
    expect(decoded.name).toBe(STUDENT.name)
    expect(decoded.type).toBe('student')
    expect(decoded.promo_id).toBe(1)
    expect(decoded.exp).toBeDefined()
  })

  it('is case-insensitive for email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'JEAN@TEST.FR', password: 'Test1234!' })
    expect(res.body.ok).toBe(true)
    expect(res.body.data.name).toBe(STUDENT.name)
  })

  it('rejects empty email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '', password: 'Test1234!' })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejects empty password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: STUDENT.email, password: '' })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejects missing body fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({})
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('returns must_change_password in response', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: STUDENT.email, password: 'Test1234!' })
    expect(res.body.data.must_change_password).toBeDefined()
    expect(typeof res.body.data.must_change_password).toBe('number')
  })

  it('does not expose password in login response', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: STUDENT.email, password: 'Test1234!' })
    expect(res.body.data.password).toBeUndefined()
  })
})
