/**
 * Tests des routes /api/demo/* (server/routes/demo/).
 *
 * Couvre :
 *  - POST /start cree une session valide (token + currentUser)
 *  - Le token demo est requis sur les routes post-/start
 *  - GET /promotions, /channels, /messages/channel/:id retournent
 *    les donnees du tenant uniquement (isolation)
 *  - POST /messages persiste avec le bon author_name
 *  - POST /end purge les donnees du tenant
 *  - Le wildcard fallback retourne []/403 selon la methode
 */
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!!'

const request = require('supertest')
const express = require('express')

// Construit une mini app Express qui mount uniquement les routes demo.
// Pas besoin de spinner tout server/index.js — on isole le SUT.
function buildApp() {
  const app = express()
  app.use(express.json())
  // demo middleware lit `req.app.get('jwtSecret')` — meme convention que prod
  app.set('jwtSecret', process.env.JWT_SECRET)
  app.use('/api/demo', require('../../../server/routes/demo'))
  return app
}

describe('POST /api/demo/start', () => {
  const app = buildApp()

  it('cree une session etudiante avec un token + currentUser', async () => {
    const res = await request(app).post('/api/demo/start').send({ role: 'student' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.token).toMatch(/^demo-/)
    expect(res.body.data.currentUser).toMatchObject({
      type: 'student',
      demo: true,
      promo_name: 'Licence Informatique L3',
    })
    expect(res.body.data.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('cree une session prof avec id negatif', async () => {
    const res = await request(app).post('/api/demo/start').send({ role: 'teacher' })
    expect(res.status).toBe(200)
    expect(res.body.data.currentUser.type).toBe('teacher')
    expect(res.body.data.currentUser.id).toBeLessThan(0)
  })

  it('role invalide tombe sur student par defaut (pas d\'erreur)', async () => {
    const res = await request(app).post('/api/demo/start').send({ role: 'admin' })
    expect(res.status).toBe(200)
    expect(res.body.data.currentUser.type).toBe('student')
  })

  it('role manquant tombe sur student par defaut', async () => {
    const res = await request(app).post('/api/demo/start').send({})
    expect(res.status).toBe(200)
    expect(res.body.data.currentUser.type).toBe('student')
  })
})

describe('Routes authentifiees (post-demoMode)', () => {
  const app = buildApp()
  let token
  let currentUser

  beforeAll(async () => {
    const res = await request(app).post('/api/demo/start').send({ role: 'student' })
    token = res.body.data.token
    currentUser = res.body.data.currentUser
  })

  it('refuse l\'acces sans Authorization Bearer', async () => {
    const res = await request(app).get('/api/demo/promotions')
    expect(res.status).toBe(401)
    expect(res.body.ok).toBe(false)
  })

  it('refuse un token mal forme (sans prefixe demo-)', async () => {
    const res = await request(app)
      .get('/api/demo/promotions')
      .set('Authorization', 'Bearer not-a-demo-token')
    expect(res.status).toBe(401)
  })

  it('GET /promotions retourne les 2 promos seedees', async () => {
    const res = await request(app)
      .get('/api/demo/promotions')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0].name).toBe('Licence Informatique L3')
  })

  it('GET /promotions/:id/channels retourne les 4 canaux', async () => {
    const res = await request(app)
      .get(`/api/demo/promotions/${currentUser.promo_id}/channels`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(4)
    const names = res.body.data.map(c => c.name)
    expect(names).toContain('developpement-web')
    expect(names).toContain('algorithmique')
  })

  it('GET /messages/channel/:id/page retourne les messages avec reactions JSON', async () => {
    // Pioche le 1er channel pour eviter de hardcoder l'id
    const ch = await request(app)
      .get(`/api/demo/promotions/${currentUser.promo_id}/channels`)
      .set('Authorization', `Bearer ${token}`)
    const channelId = ch.body.data[0].id

    const res = await request(app)
      .get(`/api/demo/messages/channel/${channelId}/page`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.messages.length).toBeGreaterThan(0)
    // Au moins un message a des reactions JSON valides
    const withReactions = res.body.data.messages.filter(m => m.reactions)
    expect(withReactions.length).toBeGreaterThan(0)
    expect(() => JSON.parse(withReactions[0].reactions)).not.toThrow()
  })

  it('GET /messages/pinned/:channelId retourne les messages epingles', async () => {
    const ch = await request(app)
      .get(`/api/demo/promotions/${currentUser.promo_id}/channels`)
      .set('Authorization', `Bearer ${token}`)
    // Test sur tous les channels — au moins un doit avoir un message epingle
    let totalPinned = 0
    for (const channel of ch.body.data) {
      const res = await request(app)
        .get(`/api/demo/messages/pinned/${channel.id}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      totalPinned += res.body.data.length
    }
    expect(totalPinned).toBeGreaterThanOrEqual(3)
  })

  it('POST /messages persiste avec author_name = currentUser.name', async () => {
    const ch = await request(app)
      .get(`/api/demo/promotions/${currentUser.promo_id}/channels`)
      .set('Authorization', `Bearer ${token}`)
    const channelId = ch.body.data[0].id

    const post = await request(app)
      .post('/api/demo/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ channelId, content: 'Test message from demo' })
    expect(post.status).toBe(200)
    expect(post.body.data.author_name).toBe(currentUser.name)
    expect(post.body.data.content).toBe('Test message from demo')

    // Le message apparait dans la liste
    const list = await request(app)
      .get(`/api/demo/messages/channel/${channelId}/page`)
      .set('Authorization', `Bearer ${token}`)
    expect(list.body.data.messages.some(m => m.id === post.body.data.id)).toBe(true)
  })

  it('POST /messages refuse content vide ou trop long', async () => {
    const empty = await request(app)
      .post('/api/demo/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ channelId: 1, content: '' })
    expect(empty.status).toBe(400)

    const huge = await request(app)
      .post('/api/demo/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ channelId: 1, content: 'x'.repeat(10_001) })
    expect(huge.status).toBe(400)
  })

  it('GET /presence retourne online[] + typing facultatif', async () => {
    const res = await request(app)
      .get('/api/demo/presence')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.online)).toBe(true)
    expect(res.body.data.online.length).toBeGreaterThan(0)
    // typing peut etre null ou un objet
    if (res.body.data.typing !== null) {
      expect(res.body.data.typing).toMatchObject({
        channelId: expect.any(Number),
        userName: expect.any(String),
      })
    }
  })

  it('GET /status retourne les compteurs du tenant', async () => {
    const res = await request(app)
      .get('/api/demo/status')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.counts.channels).toBe(4)
    expect(res.body.data.counts.messages).toBeGreaterThan(0)
    expect(res.body.data.counts.assignments).toBe(3)
  })

  it('GET /assignments retourne 3 devoirs', async () => {
    const res = await request(app)
      .get('/api/demo/assignments')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(3)
  })
})

describe('Wildcard fallback (mocks.js)', () => {
  const app = buildApp()
  let token

  beforeAll(async () => {
    const res = await request(app).post('/api/demo/start').send({ role: 'student' })
    token = res.body.data.token
  })

  it('GET inconnu retourne ok+[]+_demoFallback', async () => {
    const res = await request(app)
      .get('/api/demo/this-route-does-not-exist-yet')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, data: [], _demoFallback: true })
  })

  it('POST inconnu retourne 403+_demoFallback (pas de write fantome)', async () => {
    const res = await request(app)
      .post('/api/demo/another-fake-write')
      .set('Authorization', `Bearer ${token}`)
      .send({ x: 1 })
    expect(res.status).toBe(403)
    expect(res.body._demoFallback).toBe(true)
  })

  it('GET /booking/event-types retourne []', async () => {
    const res = await request(app)
      .get('/api/demo/booking/event-types')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('GET /documents/channel/:id retourne >= 5 documents fictifs', async () => {
    const res = await request(app)
      .get('/api/demo/documents/channel/1')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(5)
    expect(res.body.data[0]).toHaveProperty('name')
    expect(res.body.data[0]).toHaveProperty('type')
  })

  it('GET /live/sessions/promo/:id/active retourne une session "Quiz Algo"', async () => {
    const res = await request(app)
      .get('/api/demo/live/sessions/promo/1/active')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      title: 'Quiz Algo - Arbres AVL',
      status: 'active',
    })
  })

  it('DEMO_STRICT=1 fait que le wildcard renvoie 501', async () => {
    process.env.DEMO_STRICT = '1'
    try {
      const res = await request(app)
        .get('/api/demo/totally-unknown-route')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(501)
      expect(res.body._demoFallback).toBe(true)
    } finally {
      delete process.env.DEMO_STRICT
    }
  })
})

describe('POST /api/demo/end', () => {
  it('purge les donnees du tenant et invalide les requetes ulterieures', async () => {
    const app = buildApp()
    const start = await request(app).post('/api/demo/start').send({ role: 'student' })
    const token = start.body.data.token

    // Avant : status counts > 0
    const before = await request(app)
      .get('/api/demo/status')
      .set('Authorization', `Bearer ${token}`)
    expect(before.body.data.counts.messages).toBeGreaterThan(0)

    // /end purge
    const end = await request(app)
      .post('/api/demo/end')
      .set('Authorization', `Bearer ${token}`)
    expect(end.status).toBe(200)

    // Apres : la session est purgee, le middleware demoMode renvoie 401
    const after = await request(app)
      .get('/api/demo/status')
      .set('Authorization', `Bearer ${token}`)
    expect(after.status).toBe(401)
  })
})
