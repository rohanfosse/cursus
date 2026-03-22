/**
 * Tests unitaires pour les routes live (sessions interactives).
 */
const express = require('express')
const request = require('supertest')
const { setupTestDb, teardownTestDb } = require('../helpers/setup')

let app
let createdSessionId
let createdActivityId

beforeAll(() => {
  setupTestDb()

  app = express()
  app.use(express.json())

  // Mock io (Socket.IO) to avoid emit errors
  const ioMock = { to: () => ({ emit: () => {} }) }
  app.set('io', ioMock)

  // Auth middleware mock — teacher by default
  app.use((req, _res, next) => {
    req.user = { id: 1, type: 'teacher', name: 'Prof Test' }
    next()
  })

  app.use('/api/live', require('../../../server/routes/live'))
})

afterAll(() => teardownTestDb())

describe('POST /api/live/sessions', () => {
  it('creates a session (teacher auth)', async () => {
    const res = await request(app)
      .post('/api/live/sessions')
      .send({ promoId: 1, title: 'Quiz Route Test' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.title).toBe('Quiz Route Test')
    expect(res.body.data.join_code).toHaveLength(6)
    createdSessionId = res.body.data.id
  })

  it('returns 400 when missing required fields', async () => {
    const res = await request(app)
      .post('/api/live/sessions')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
  })
})

describe('GET /api/live/sessions/:id', () => {
  it('returns session with activities', async () => {
    const res = await request(app)
      .get(`/api/live/sessions/${createdSessionId}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.id).toBe(createdSessionId)
    expect(Array.isArray(res.body.data.activities)).toBe(true)
  })

  it('returns 400 for non-existent session', async () => {
    const res = await request(app)
      .get('/api/live/sessions/99999')
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
  })
})

describe('GET /api/live/sessions/code/:code', () => {
  it('finds session by join code', async () => {
    // First get the session to know its code
    const sessionRes = await request(app).get(`/api/live/sessions/${createdSessionId}`)
    const code = sessionRes.body.data.join_code

    const res = await request(app)
      .get(`/api/live/sessions/code/${code}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.id).toBe(createdSessionId)
  })

  it('returns 400 for non-existent code', async () => {
    const res = await request(app)
      .get('/api/live/sessions/code/ZZZZZZ')
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
  })
})

describe('PATCH /api/live/sessions/:id/status', () => {
  it('updates session status', async () => {
    const res = await request(app)
      .patch(`/api/live/sessions/${createdSessionId}/status`)
      .send({ status: 'active' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.status).toBe('active')
  })

  it('returns 400 for invalid status', async () => {
    const res = await request(app)
      .patch(`/api/live/sessions/${createdSessionId}/status`)
      .send({ status: 'invalid' })
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
  })
})

describe('POST /api/live/sessions/:id/activities', () => {
  it('adds an activity to session', async () => {
    const res = await request(app)
      .post(`/api/live/sessions/${createdSessionId}/activities`)
      .send({ type: 'qcm', title: 'Question 1', options: JSON.stringify(['A', 'B']), position: 0 })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.type).toBe('qcm')
    expect(res.body.data.title).toBe('Question 1')
    createdActivityId = res.body.data.id
  })

  it('returns 400 when missing required fields', async () => {
    const res = await request(app)
      .post(`/api/live/sessions/${createdSessionId}/activities`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
  })
})

describe('POST /api/live/activities/:id/respond', () => {
  it('submits a response', async () => {
    const res = await request(app)
      .post(`/api/live/activities/${createdActivityId}/respond`)
      .send({ studentId: 1, answer: 'A' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.answer).toBe('A')
  })

  it('returns 400 when missing required fields', async () => {
    const res = await request(app)
      .post(`/api/live/activities/${createdActivityId}/respond`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
  })
})

describe('GET /api/live/activities/:id/results', () => {
  it('returns aggregated results', async () => {
    const res = await request(app)
      .get(`/api/live/activities/${createdActivityId}/results`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.type).toBe('qcm')
    expect(res.body.data.total).toBeGreaterThanOrEqual(1)
  })
})
