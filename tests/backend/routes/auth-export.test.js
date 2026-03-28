process.env.NODE_ENV = 'test'

const express = require('express')
const jwt = require('jsonwebtoken')
const request = require('supertest')
const { setupTestDb, teardownTestDb } = require('../helpers/setup')
const { JWT_SECRET, STUDENT, TEACHER } = require('../helpers/fixtures')

let app, studentToken, teacherToken, otherStudentToken

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
  otherStudentToken = jwt.sign(
    { id: 999, name: 'Other', type: 'student', promo_id: 1 },
    JWT_SECRET, { expiresIn: '1h' },
  )
})
afterAll(() => teardownTestDb())

describe('GET /api/auth/export/:studentId', () => {
  it('requires authentication', async () => {
    const res = await request(app).get(`/api/auth/export/${STUDENT.id}`)
    expect(res.status).toBe(401)
  })

  it('allows student to export own data', async () => {
    const res = await request(app)
      .get(`/api/auth/export/${STUDENT.id}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toBeDefined()
    expect(res.body.data.profile).toBeDefined()
    expect(res.body.data.profile.name).toBe(STUDENT.name)
  })

  it('prevents student from exporting another student data', async () => {
    const res = await request(app)
      .get(`/api/auth/export/${STUDENT.id}`)
      .set('Authorization', `Bearer ${otherStudentToken}`)
    expect(res.status).toBe(403)
    expect(res.body.ok).toBe(false)
  })

  it('allows teacher to export any student data', async () => {
    const res = await request(app)
      .get(`/api/auth/export/${STUDENT.id}`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('export includes profile, messages and submissions', async () => {
    const res = await request(app)
      .get(`/api/auth/export/${STUDENT.id}`)
      .set('Authorization', `Bearer ${studentToken}`)
    const data = res.body.data
    expect(data.exportedAt).toBeDefined()
    expect(data.profile).toBeDefined()
    expect(data.messages).toBeDefined()
    expect(data.submissions).toBeDefined()
  })

  it('export does not include password', async () => {
    const res = await request(app)
      .get(`/api/auth/export/${STUDENT.id}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.body.data.profile.password).toBeUndefined()
  })
})
