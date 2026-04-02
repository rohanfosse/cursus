const express = require('express')
const request = require('supertest')
const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../helpers/fixtures')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

let db

beforeAll(() => {
  setupTestDb()
  db = getTestDb()
})

afterAll(() => teardownTestDb())

function token(payload) {
  return jwt.sign(payload, JWT_SECRET)
}

// Lazy getter to ensure authorize is required AFTER DB is patched
function getAuthorize() {
  return require('../../../server/middleware/authorize')
}

function buildApp(middlewares, handler = (req, res) => res.json({ ok: true })) {
  const app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const authMiddleware = require('../../../server/middleware/auth')
  app.get('/test/:channelId?', authMiddleware, ...middlewares, handler)
  app.post('/test', authMiddleware, ...middlewares, handler)
  return app
}

describe('requireRole', () => {
  it('allows admin for teacher-level route', async () => {
    const app = buildApp([getAuthorize().requireRole('teacher')])
    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token({ id: -1, name: 'Admin', type: 'admin' })}`)
    expect(res.status).toBe(200)
  })

  it('allows teacher for teacher-level route', async () => {
    const app = buildApp([getAuthorize().requireRole('teacher')])
    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token({ id: -1, name: 'Prof', type: 'teacher' })}`)
    expect(res.status).toBe(200)
  })

  it('rejects student for teacher-level route', async () => {
    const app = buildApp([getAuthorize().requireRole('teacher')])
    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token({ id: 1, name: 'Student', type: 'student' })}`)
    expect(res.status).toBe(403)
  })

  it('allows ta for ta-level route', async () => {
    const app = buildApp([getAuthorize().requireRole('ta')])
    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token({ id: -2, name: 'TA', type: 'ta' })}`)
    expect(res.status).toBe(200)
  })
})

describe('requirePromo', () => {
  it('allows teachers to access any promo', async () => {
    const app = buildApp([getAuthorize().requirePromo(() => 999)])
    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token({ id: -1, name: 'Prof', type: 'teacher' })}`)
    expect(res.status).toBe(200)
  })

  it('allows student to access their own promo', async () => {
    const app = buildApp([getAuthorize().requirePromo(() => 1)])
    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token({ id: 1, name: 'Student', type: 'student', promo_id: 1 })}`)
    expect(res.status).toBe(200)
  })

  it('rejects student accessing different promo', async () => {
    const app = buildApp([getAuthorize().requirePromo(() => 999)])
    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token({ id: 1, name: 'Student', type: 'student', promo_id: 1 })}`)
    expect(res.status).toBe(403)
  })

  it('allows student when getPromoId returns null', async () => {
    const app = buildApp([getAuthorize().requirePromo(() => null)])
    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token({ id: 1, name: 'Student', type: 'student', promo_id: 1 })}`)
    expect(res.status).toBe(200)
  })
})

describe('requireMessageOwner', () => {
  function buildMsgApp() {
    const app = express()
    app.set('jwtSecret', JWT_SECRET)
    const authMiddleware = require('../../../server/middleware/auth')
    app.delete('/msg/:id', authMiddleware, getAuthorize().requireMessageOwner, (req, res) => res.json({ ok: true }))
    return app
  }

  beforeAll(() => {
    db.prepare(
      "INSERT OR IGNORE INTO messages (id, channel_id, author_name, author_id, author_type, content) VALUES (999, 1, 'Jean', 1, 'student', 'test')"
    ).run()
  })

  it('allows teachers to modify any message', async () => {
    const res = await request(buildMsgApp())
      .delete('/msg/999')
      .set('Authorization', `Bearer ${token({ id: -1, name: 'Prof', type: 'teacher' })}`)
    expect(res.status).toBe(200)
  })

  it('allows student to modify their own message', async () => {
    const res = await request(buildMsgApp())
      .delete('/msg/999')
      .set('Authorization', `Bearer ${token({ id: 1, name: 'Jean', type: 'student' })}`)
    expect(res.status).toBe(200)
  })

  it('rejects student modifying another student message', async () => {
    const res = await request(buildMsgApp())
      .delete('/msg/999')
      .set('Authorization', `Bearer ${token({ id: 2, name: 'Other', type: 'student' })}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 for non-existent message', async () => {
    const res = await request(buildMsgApp())
      .delete('/msg/99999')
      .set('Authorization', `Bearer ${token({ id: 1, name: 'Jean', type: 'student' })}`)
    expect(res.status).toBe(404)
  })
})
