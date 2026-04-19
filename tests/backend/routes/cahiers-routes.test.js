/**
 * Regression test for cahiers routes — fix "Cannot read properties of undefined (reading 'json')".
 * Cause: wrap() passe uniquement `req`, mais les handlers declares `(req, res)` avaient
 * un `res` undefined → `res.json(...)` crashait.
 */
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const Y       = require('yjs')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

/** Build a valid Yjs update of arbitrary text for tests */
function buildYjsUpdate(text = 'hello') {
  const doc = new Y.Doc()
  doc.getText('content').insert(0, text)
  return Buffer.from(Y.encodeStateAsUpdate(doc))
}

let app
let teacherToken

beforeAll(() => {
  setupTestDb()
  teacherToken = jwt.sign({ id: 1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)

  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/cahiers', auth, require('../../../server/routes/cahiers'))
})

afterAll(() => teardownTestDb())

describe('GET /api/cahiers', () => {
  it('returns cahiers for a promo (200 ok)', async () => {
    const db = getTestDb()
    db.prepare(
      'INSERT INTO cahiers (promo_id, project, title, created_by) VALUES (1, ?, ?, 1)'
    ).run('projet-test', 'Mon cahier')

    const res = await request(app)
      .get('/api/cahiers?promoId=1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThan(0)
  })

  it('returns 400 with clear error when promoId missing (no crash)', async () => {
    const res = await request(app)
      .get('/api/cahiers')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/promoId/)
  })
})

describe('GET /api/cahiers/:id', () => {
  it('returns a cahier by id', async () => {
    const db = getTestDb()
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO cahiers (promo_id, project, title, created_by) VALUES (1, ?, ?, 1)'
    ).run('projet-detail', 'Cahier detail')

    const res = await request(app)
      .get(`/api/cahiers/${lastInsertRowid}`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.title).toBe('Cahier detail')
    expect(res.body.data.author_name).toBeDefined()
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/api/cahiers/99999')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(404)
    expect(res.body.ok).toBe(false)
  })
})

describe('POST /api/cahiers', () => {
  it('creates a cahier', async () => {
    const res = await request(app)
      .post('/api/cahiers')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, project: 'new-project', title: 'Fresh cahier' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.id).toBeDefined()
  })
})

describe('PATCH /api/cahiers/:id/state (hardening)', () => {
  let cahierId

  beforeAll(() => {
    const db = getTestDb()
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO cahiers (promo_id, project, title, created_by) VALUES (1, ?, ?, 1)'
    ).run('hardening', 'State test cahier')
    cahierId = lastInsertRowid
  })

  it('rejects base64 with invalid characters', async () => {
    const res = await request(app)
      .patch(`/api/cahiers/${cahierId}/state`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ state: '####not-base64####' })
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/base64/i)
  })

  it('rejects empty state', async () => {
    const res = await request(app)
      .patch(`/api/cahiers/${cahierId}/state`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ state: '' })
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
  })

  it('returns 404 when cahier does not exist', async () => {
    const validState = buildYjsUpdate('hello').toString('base64')
    const res = await request(app)
      .patch('/api/cahiers/99999/state')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ state: validState })
    expect(res.status).toBe(404)
    expect(res.body.ok).toBe(false)
  })

  it('accepts valid Yjs update and returns size', async () => {
    const buf = buildYjsUpdate('hello')
    const res = await request(app)
      .patch(`/api/cahiers/${cahierId}/state`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ state: buf.toString('base64') })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.size).toBe(buf.length)
  })

  it('rejects valid base64 that is not a Yjs update (junk)', async () => {
    const junk = Buffer.from('hello yjs').toString('base64')
    const res = await request(app)
      .patch(`/api/cahiers/${cahierId}/state`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ state: junk })
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/yjs/i)
  })
})

describe('GET /api/cahiers/:id/state', () => {
  it('returns 404 when cahier missing', async () => {
    const res = await request(app)
      .get('/api/cahiers/99998/state')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/cahiers/:id', () => {
  it('returns 404 when cahier missing', async () => {
    const res = await request(app)
      .delete('/api/cahiers/99997')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(404)
  })
})
