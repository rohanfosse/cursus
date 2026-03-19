
const express = require('express')
const request = require('supertest')
const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../helpers/fixtures')

function buildApp() {
  const app = express()
  app.set('jwtSecret', JWT_SECRET)
  const authMiddleware = require('../../../server/middleware/auth')
  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ user: req.user })
  })
  return app
}

describe('auth middleware', () => {
  it('rejects requests without Authorization header', async () => {
    const res = await request(buildApp()).get('/protected')
    expect(res.status).toBe(401)
    expect(res.body.ok).toBe(false)
  })

  it('rejects requests with malformed Authorization header', async () => {
    const res = await request(buildApp())
      .get('/protected')
      .set('Authorization', 'Basic sometoken')
    expect(res.status).toBe(401)
  })

  it('rejects invalid tokens', async () => {
    const res = await request(buildApp())
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token')
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/invalide|expiré/)
  })

  it('passes with valid token and populates req.user', async () => {
    const token = jwt.sign({ id: 1, name: 'Test', type: 'student' }, JWT_SECRET)
    const res = await request(buildApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.user.name).toBe('Test')
    expect(res.body.user.id).toBe(1)
  })

  it('rejects expired tokens', async () => {
    const token = jwt.sign({ id: 1, name: 'Test' }, JWT_SECRET, { expiresIn: '-1s' })
    const res = await request(buildApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(401)
  })
})
