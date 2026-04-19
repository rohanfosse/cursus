/**
 * Tests de regression securite : cross-promo ownership sur routes cahiers.
 * Faille corrigee v2.160.0 : n'importe quel etudiant authentifie pouvait
 * lire/ecrire le yjs_state d'un cahier d'une autre promo.
 */
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const Y       = require('yjs')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app
let studentP1Token, studentP2Token, otherPromoCahierId

function buildYjsUpdate(text = 'hello') {
  const doc = new Y.Doc()
  doc.getText('content').insert(0, text)
  return Buffer.from(Y.encodeStateAsUpdate(doc))
}

beforeAll(() => {
  setupTestDb()
  const db = getTestDb()

  // Promo 1 existe deja, student 1 aussi. On ajoute promo 2 + student 2.
  db.exec(`INSERT OR IGNORE INTO promotions (id, name, color) VALUES (2, 'Promo 2', '#888')`)
  db.prepare(
    `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
     VALUES (2, 2, 'Bob', 'bob@test.fr', 'BB', 'xxxxx', 0)`
  ).run()

  // Cahier cree dans la promo 2
  const r = db.prepare(
    'INSERT INTO cahiers (promo_id, project, title, created_by) VALUES (2, NULL, ?, 2)'
  ).run('Cahier Promo2')
  otherPromoCahierId = r.lastInsertRowid

  studentP1Token = jwt.sign({ id: 1, name: 'Jean', type: 'student', promo_id: 1 }, JWT_SECRET)
  studentP2Token = jwt.sign({ id: 2, name: 'Bob',  type: 'student', promo_id: 2 }, JWT_SECRET)

  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/cahiers', auth, require('../../../server/routes/cahiers'))
}, 30_000)

afterAll(() => teardownTestDb())

describe('Cahiers cross-promo isolation', () => {
  it('student from promo 1 CANNOT read a cahier of promo 2 (GET /:id)', async () => {
    const res = await request(app)
      .get(`/api/cahiers/${otherPromoCahierId}`)
      .set('Authorization', `Bearer ${studentP1Token}`)
    expect(res.status).toBe(403)
  })

  it('student from promo 1 CANNOT read yjs_state of promo 2 cahier', async () => {
    const res = await request(app)
      .get(`/api/cahiers/${otherPromoCahierId}/state`)
      .set('Authorization', `Bearer ${studentP1Token}`)
    expect(res.status).toBe(403)
  })

  it('student from promo 1 CANNOT write yjs_state of promo 2 cahier', async () => {
    const b64 = buildYjsUpdate().toString('base64')
    const res = await request(app)
      .patch(`/api/cahiers/${otherPromoCahierId}/state`)
      .set('Authorization', `Bearer ${studentP1Token}`)
      .send({ state: b64 })
    expect(res.status).toBe(403)
  })

  it('student from promo 1 CANNOT rename a cahier of promo 2', async () => {
    const res = await request(app)
      .patch(`/api/cahiers/${otherPromoCahierId}`)
      .set('Authorization', `Bearer ${studentP1Token}`)
      .send({ title: 'Hacked' })
    expect(res.status).toBe(403)
  })

  it('student from promo 2 CAN read their own cahier', async () => {
    const res = await request(app)
      .get(`/api/cahiers/${otherPromoCahierId}`)
      .set('Authorization', `Bearer ${studentP2Token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.title).toBe('Cahier Promo2')
  })
})
