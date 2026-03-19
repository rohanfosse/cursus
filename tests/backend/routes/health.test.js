
const express = require('express')
const request = require('supertest')

function buildApp() {
  const app = express()
  app.get('/health', (_req, res) => res.json({ ok: true, version: '2.0.0' }))
  return app
}

describe('GET /health', () => {
  it('returns ok: true', async () => {
    const res = await request(buildApp()).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.version).toBe('2.0.0')
  })
})
