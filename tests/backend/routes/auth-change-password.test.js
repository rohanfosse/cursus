process.env.NODE_ENV = 'test'

const express = require('express')
const jwt = require('jsonwebtoken')
const request = require('supertest')
const { setupTestDb, teardownTestDb } = require('../helpers/setup')
const {
  TEST_PASSWORD, WEAK_PASSWORD, NO_UPPER_PASSWORD, NO_SPECIAL_PASSWORD,
  JWT_SECRET, STUDENT, TEACHER,
} = require('../helpers/fixtures')

let app
let studentToken
let teacherToken

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

describe('POST /api/auth/change-password', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ userId: 1, isTeacher: false, currentPwd: TEST_PASSWORD, newPwd: 'NewPass1!' })
    expect(res.status).toBe(401)
  })

  it('rejects wrong current password', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ userId: STUDENT.id, isTeacher: false, currentPwd: 'WrongPass1!', newPwd: 'NewPass1!' })
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/incorrect/)
  })

  it('rejects weak new password (too short)', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ userId: STUDENT.id, isTeacher: false, currentPwd: TEST_PASSWORD, newPwd: WEAK_PASSWORD })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejects new password without uppercase', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ userId: STUDENT.id, isTeacher: false, currentPwd: TEST_PASSWORD, newPwd: NO_UPPER_PASSWORD })
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/majuscule/)
  })

  it('rejects new password without special char', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ userId: STUDENT.id, isTeacher: false, currentPwd: TEST_PASSWORD, newPwd: NO_SPECIAL_PASSWORD })
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/spécial/)
  })

  it('prevents student from changing another student password', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ userId: 999, isTeacher: false, currentPwd: TEST_PASSWORD, newPwd: 'NewPass1!' })
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/propre mot de passe/)
  })

  it('succeeds with valid current password (student)', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ userId: STUDENT.id, isTeacher: false, currentPwd: TEST_PASSWORD, newPwd: 'Changed1!' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('can login with new password after change', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: STUDENT.email, password: 'Changed1!' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.must_change_password).toBe(0)
  })

  it('succeeds for teacher', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ userId: TEACHER.id, isTeacher: true, currentPwd: TEST_PASSWORD, newPwd: 'TeacherNew1!' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
