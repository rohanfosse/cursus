const express = require('express')
const request = require('supertest')
const { z } = require('zod')
const { validate, validateQuery } = require('../../../server/middleware/validate')

function buildApp(middleware) {
  const app = express()
  app.use(express.json())
  app.post('/test', middleware, (req, res) => {
    res.json({ ok: true, data: req.body })
  })
  app.get('/test', middleware, (req, res) => {
    res.json({ ok: true, data: req.query })
  })
  return app
}

describe('validate (body)', () => {
  const schema = z.object({
    name: z.string().min(1, 'Nom requis'),
    age: z.number().int().positive().optional(),
  })

  it('passes valid body through', async () => {
    const app = buildApp(validate(schema))
    const res = await request(app).post('/test').send({ name: 'Jean', age: 25 })
    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('Jean')
    expect(res.body.data.age).toBe(25)
  })

  it('strips unknown fields if schema does not passthrough', async () => {
    const app = buildApp(validate(schema))
    const res = await request(app).post('/test').send({ name: 'Jean', extra: 'field' })
    expect(res.status).toBe(200)
    expect(res.body.data.extra).toBeUndefined()
  })

  it('rejects missing required fields', async () => {
    const app = buildApp(validate(schema))
    const res = await request(app).post('/test').send({})
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toContain('Données invalides')
    expect(res.body.error).toContain('name')
  })

  it('rejects invalid types', async () => {
    const app = buildApp(validate(schema))
    const res = await request(app).post('/test').send({ name: 'Jean', age: 'not-a-number' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('age')
  })

  it('shows multiple validation errors', async () => {
    const multiSchema = z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
    })
    const app = buildApp(validate(multiSchema))
    const res = await request(app).post('/test').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Données invalides')
    // Should contain at least two error details separated by ';'
    expect(res.body.error).toContain(';')
  })
})

describe('validateQuery', () => {
  const schema = z.object({
    page: z.coerce.number().int().positive().optional(),
    search: z.string().optional(),
  })

  it('passes valid query through', async () => {
    const app = express()
    app.get('/test', validateQuery(schema), (req, res) => {
      res.json({ ok: true, data: req.query })
    })
    const res = await request(app).get('/test?page=2&search=hello')
    expect(res.status).toBe(200)
    expect(res.body.data.page).toBe(2)
    expect(res.body.data.search).toBe('hello')
  })

  it('rejects invalid query params', async () => {
    const strictSchema = z.object({
      page: z.coerce.number().int().positive(),
    })
    const app = express()
    app.get('/test', validateQuery(strictSchema), (req, res) => {
      res.json({ ok: true })
    })
    const res = await request(app).get('/test?page=-5')
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Paramètres invalides')
  })
})
