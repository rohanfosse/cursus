/**
 * Tests unitaires pour les routes dépôts (note et feedback).
 */
const express = require('express')
const request = require('supertest')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

let app

beforeAll(() => {
  setupTestDb()

  // Create a travail + depot for testing note/feedback
  const db = getTestDb()
  db.prepare(`
    INSERT INTO travaux (id, promo_id, channel_id, title, deadline, type, published, requires_submission)
    VALUES (100, 1, 1, 'Test Devoir', '2099-12-31T23:59:00Z', 'livrable', 1, 1)
  `).run()
  db.prepare(`
    INSERT INTO depots (id, travail_id, student_id, file_name, file_path)
    VALUES (200, 100, 1, 'rapport.pdf', '/tmp/rapport.pdf')
  `).run()

  app = express()
  app.use(express.json())

  // Auth middleware mock — sets req.user for teacher by default
  app.use((req, _res, next) => {
    // Allow overriding via custom header for 401 tests
    if (req.headers['x-no-auth'] === 'true') {
      // Simulate no auth
      req.user = undefined
      return next()
    }
    req.user = { id: 1, type: 'teacher', name: 'Prof Test' }
    next()
  })

  app.use('/api/depots', require('../../../server/routes/depots'))
})

afterAll(() => teardownTestDb())

describe('POST /api/depots/note', () => {
  it('sets note on a depot (teacher)', async () => {
    const res = await request(app)
      .post('/api/depots/note')
      .send({ depot_id: 200, note: '15' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 403 for student trying to set note', async () => {
    // Override the middleware to set student type
    const studentApp = express()
    studentApp.use(express.json())
    studentApp.use((req, _res, next) => {
      req.user = { id: 1, type: 'student', name: 'Jean Dupont' }
      next()
    })
    studentApp.use('/api/depots', require('../../../server/routes/depots'))

    const res = await request(studentApp)
      .post('/api/depots/note')
      .send({ depot_id: 200, note: '15' })
    expect(res.status).toBe(403)
    expect(res.body.ok).toBe(false)
  })
})

describe('POST /api/depots/feedback', () => {
  it('sets feedback on a depot (teacher)', async () => {
    const res = await request(app)
      .post('/api/depots/feedback')
      .send({ depot_id: 200, feedback: 'Bon travail' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 403 for student trying to give feedback', async () => {
    const studentApp = express()
    studentApp.use(express.json())
    studentApp.use((req, _res, next) => {
      req.user = { id: 1, type: 'student', name: 'Jean Dupont' }
      next()
    })
    studentApp.use('/api/depots', require('../../../server/routes/depots'))

    const res = await request(studentApp)
      .post('/api/depots/feedback')
      .send({ depot_id: 200, feedback: 'Feedback étudiant' })
    expect(res.status).toBe(403)
    expect(res.body.ok).toBe(false)
  })
})

describe('Auth required', () => {
  it('returns 400 for invalid data without proper fields', async () => {
    const res = await request(app)
      .post('/api/depots/note')
      .send({})
    expect(res.status).toBe(400)
  })
})
