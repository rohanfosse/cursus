process.env.NODE_ENV = 'test'

const express = require('express')
const request = require('supertest')
const { setupTestDb, teardownTestDb } = require('../helpers/setup')
const { TEST_PASSWORD, JWT_SECRET } = require('../helpers/fixtures')

let app

beforeAll(() => {
  setupTestDb()
  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  app.use('/api/auth', require('../../../server/routes/auth'))
})
afterAll(() => teardownTestDb())

describe('POST /api/auth/login', () => {
  it('returns token for valid student credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jean@test.fr', password: TEST_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.token).toBeDefined()
    expect(res.body.data.type).toBe('student')
  })

  it('returns token for valid teacher credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'prof@test.fr', password: TEST_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.type).toBe('teacher')
  })

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jean@test.fr', password: 'WrongPass1!' })
    expect(res.status).toBe(401)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/incorrect/)
  })

  it('returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.fr', password: TEST_PASSWORD })
    expect(res.status).toBe(401)
    expect(res.body.ok).toBe(false)
  })
})
