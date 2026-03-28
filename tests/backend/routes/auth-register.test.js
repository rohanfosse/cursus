
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

describe('POST /api/auth/register', () => {
  it('succeeds with valid payload', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Claire Durand',
        email: 'claire.durand@viacesi.fr',
        password: TEST_PASSWORD,
        promoId: 1,
      })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('rejects missing name', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'missing@viacesi.fr',
        password: TEST_PASSWORD,
        promoId: 1,
      })
    // validate middleware returns { ok: false } or express default error
    expect(res.status).toBeGreaterThanOrEqual(400)
    if (res.body?.ok !== undefined) {
      expect(res.body.ok).toBe(false)
    }
  })

  it('rejects missing email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'No Email',
        password: TEST_PASSWORD,
        promoId: 1,
      })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejects password shorter than 8 chars', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Short Pwd',
        email: 'shortpwd@viacesi.fr',
        password: 'Ab1!',
        promoId: 1,
      })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('accepts non-@viacesi.fr email (external school)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'External Student',
        email: 'ext@autreschool.fr',
        password: TEST_PASSWORD,
        promoId: 1,
      })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('rejects duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Claire Clone',
        email: 'claire.durand@viacesi.fr',
        password: TEST_PASSWORD,
        promoId: 1,
      })
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/déjà utilisée/)
  })

  it('can login after registration', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'claire.durand@viacesi.fr', password: TEST_PASSWORD })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.token).toBeDefined()
    expect(res.body.data.type).toBe('student')
    expect(res.body.data.name).toBe('Claire Durand')
  })
})
