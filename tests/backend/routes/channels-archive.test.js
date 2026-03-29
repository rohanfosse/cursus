// ─── Tests archivage canaux — epic canaux-ameliorations #84 ──────────────────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app
let studentToken, teacherToken
let channelId

beforeAll(() => {
  setupTestDb()
  const db = getTestDb()

  // Canal supplementaire pour archivage (ne pas toucher aux canaux id=1,2 utilises par d'autres tests)
  const result = db.prepare(
    "INSERT INTO channels (promo_id, name, type) VALUES (1, 'canal-archivage-test', 'chat')"
  ).run()
  channelId = result.lastInsertRowid

  // Tokens
  studentToken = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  teacherToken = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)

  // Express app avec les deux routes necessaires
  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/promotions', auth, require('../../../server/routes/promotions'))
  app.use('/api/messages',   auth, require('../../../server/routes/messages'))
})

afterAll(() => teardownTestDb())

// ═══════════════════════════════════════════
//  POST /api/promotions/channels/:id/archive
// ═══════════════════════════════════════════
describe('POST /channels/:id/archive', () => {
  it('le prof peut archiver un canal', async () => {
    const res = await request(app)
      .post(`/api/promotions/channels/${channelId}/archive`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('un etudiant ne peut pas archiver un canal (403)', async () => {
    // Creer un nouveau canal pour ce test
    const db = getTestDb()
    const r = db.prepare("INSERT INTO channels (promo_id, name, type) VALUES (1, 'canal-etudiant-test', 'chat')").run()
    const cId = r.lastInsertRowid

    const res = await request(app)
      .post(`/api/promotions/channels/${cId}/archive`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('le canal archive disparait de GET /:promoId/channels', async () => {
    // Creer et archiver un canal frais
    const db = getTestDb()
    const r = db.prepare("INSERT INTO channels (promo_id, name, type) VALUES (1, 'canal-disparait', 'chat')").run()
    const cId = r.lastInsertRowid

    await request(app)
      .post(`/api/promotions/channels/${cId}/archive`)
      .set('Authorization', `Bearer ${teacherToken}`)

    const res = await request(app)
      .get('/api/promotions/1/channels')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    const names = res.body.data.map((c) => c.name)
    expect(names).not.toContain('canal-disparait')
  })
})

// ═══════════════════════════════════════════
//  POST /api/promotions/channels/:id/restore
// ═══════════════════════════════════════════
describe('POST /channels/:id/restore', () => {
  let archivedChannelId

  beforeAll(async () => {
    // Creer un canal et l'archiver avant les tests de restauration
    const db = getTestDb()
    const r = db.prepare("INSERT INTO channels (promo_id, name, type) VALUES (1, 'canal-a-restaurer', 'chat')").run()
    archivedChannelId = r.lastInsertRowid

    await request(app)
      .post(`/api/promotions/channels/${archivedChannelId}/archive`)
      .set('Authorization', `Bearer ${teacherToken}`)
  })

  it('le prof peut restaurer un canal archive', async () => {
    const res = await request(app)
      .post(`/api/promotions/channels/${archivedChannelId}/restore`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('le canal restaure reapparait dans GET /:promoId/channels', async () => {
    // Re-archiver puis restaurer un canal different
    const db = getTestDb()
    const r = db.prepare("INSERT INTO channels (promo_id, name, type) VALUES (1, 'canal-reapparait', 'chat')").run()
    const cId = r.lastInsertRowid

    await request(app)
      .post(`/api/promotions/channels/${cId}/archive`)
      .set('Authorization', `Bearer ${teacherToken}`)

    // Verifier qu'il est bien absent
    let res = await request(app)
      .get('/api/promotions/1/channels')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.body.data.map((c) => c.name)).not.toContain('canal-reapparait')

    // Restaurer
    await request(app)
      .post(`/api/promotions/channels/${cId}/restore`)
      .set('Authorization', `Bearer ${teacherToken}`)

    // Verifier qu'il reapparait
    res = await request(app)
      .get('/api/promotions/1/channels')
      .set('Authorization', `Bearer ${studentToken}`)
    const names = res.body.data.map((c) => c.name)
    expect(names).toContain('canal-reapparait')
  })
})

// ═══════════════════════════════════════════
//  GET /api/promotions/:promoId/channels/archived
// ═══════════════════════════════════════════
describe('GET /:promoId/channels/archived', () => {
  let archivedId

  beforeAll(async () => {
    const db = getTestDb()
    const r = db.prepare("INSERT INTO channels (promo_id, name, type, archived) VALUES (1, 'canal-liste-archives', 'chat', 1)").run()
    archivedId = r.lastInsertRowid
  })

  it('retourne les canaux archives de la promo', async () => {
    const res = await request(app)
      .get('/api/promotions/1/channels/archived')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    const names = res.body.data.map((c) => c.name)
    expect(names).toContain('canal-liste-archives')
  })

  it('les canaux non-archives n\'apparaissent pas dans la liste archived', async () => {
    const res = await request(app)
      .get('/api/promotions/1/channels/archived')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    const names = res.body.data.map((c) => c.name)
    expect(names).not.toContain('general')
    expect(names).not.toContain('annonces')
  })

  it('un etudiant de sa promo peut voir la liste des archives', async () => {
    const res = await request(app)
      .get('/api/promotions/1/channels/archived')
      .set('Authorization', `Bearer ${studentToken}`)
    // requirePromo(promoFromParam) autorise les etudiants de leur promo
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════
//  Messages dans un canal archive
// ═══════════════════════════════════════════
describe('Messages dans un canal archive', () => {
  let frozenChannelId

  beforeAll(async () => {
    const db = getTestDb()
    const r = db.prepare("INSERT INTO channels (promo_id, name, type, archived) VALUES (1, 'canal-gele', 'chat', 1)").run()
    frozenChannelId = r.lastInsertRowid
  })

  it('envoyer un message dans un canal archive est bloque (403)', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ channelId: frozenChannelId, content: 'Message dans canal archive', promoId: 1 })
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/archiv/i)
  })

  it('meme le prof ne peut pas poster dans un canal archive (service bloque)', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ channelId: frozenChannelId, content: 'Test prof dans canal gele', promoId: 1 })
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/archiv/i)
  })
})
