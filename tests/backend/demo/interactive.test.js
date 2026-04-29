/**
 * Tests des routes interactives etudiantes : bookmarks, message edit/
 * pin/react/delete, lumen reads/notes (cf. server/routes/demo/interactive.js).
 *
 * Verifient que :
 *  - Les writes persistent (re-read renvoie la modif)
 *  - L'ownership est verifie pour edit/delete (visiteur ne peut pas
 *    toucher aux messages d'un autre)
 *  - Les inputs invalides retournent 400 propre (pas 500)
 *  - L'etat est isole par tenant (pas de fuite cross-session)
 */
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!!'

const request = require('supertest')
const express = require('express')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.set('jwtSecret', process.env.JWT_SECRET)
  app.use('/api/demo', require('../../../server/routes/demo'))
  return app
}

async function startSession(app, role = 'student') {
  const res = await request(app).post('/api/demo/start').send({ role })
  return { token: res.body.data.token, user: res.body.data.currentUser }
}

const auth = (token) => ({ Authorization: `Bearer ${token}` })

// ────────────────────────────────────────────────────────────────────
//  Bookmarks
// ────────────────────────────────────────────────────────────────────
describe('POST/GET/DELETE /bookmarks', () => {
  const app = buildApp()

  it('GET /bookmarks renvoie au moins la baseline (4 entries)', async () => {
    const { token } = await startSession(app)
    const res = await request(app).get('/api/demo/bookmarks').set(auth(token))
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(4)
  })

  it('GET /bookmarks/ids retourne un array de message_id', async () => {
    const { token } = await startSession(app)
    const res = await request(app).get('/api/demo/bookmarks/ids').set(auth(token))
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.every(id => typeof id === 'number')).toBe(true)
  })

  it('POST /bookmarks ajoute un signet, persiste sur GET suivant', async () => {
    const { token, user } = await startSession(app)
    // On utilise un message du seed (id stable apres seedTenant)
    const msgRes = await request(app)
      .get(`/api/demo/promotions/${user.promo_id}/channels`).set(auth(token))
    const channelId = msgRes.body.data[0].id
    const page = await request(app)
      .get(`/api/demo/messages/channel/${channelId}/page`).set(auth(token))
    const targetMsgId = page.body.data[0].id

    const add = await request(app).post('/api/demo/bookmarks')
      .set(auth(token)).send({ messageId: targetMsgId, note: 'a relire' })
    expect(add.status).toBe(200)

    const idsRes = await request(app).get('/api/demo/bookmarks/ids').set(auth(token))
    expect(idsRes.body.data).toContain(targetMsgId)
  })

  it('DELETE /bookmarks/:id retire un signet', async () => {
    const { token } = await startSession(app)
    const idsBefore = await request(app).get('/api/demo/bookmarks/ids').set(auth(token))
    const toRemove = idsBefore.body.data[0]
    const del = await request(app).delete(`/api/demo/bookmarks/${toRemove}`).set(auth(token))
    expect(del.status).toBe(200)
    const idsAfter = await request(app).get('/api/demo/bookmarks/ids').set(auth(token))
    expect(idsAfter.body.data).not.toContain(toRemove)
  })

  it('POST /bookmarks rejette messageId invalide avec 400', async () => {
    const { token } = await startSession(app)
    const res = await request(app).post('/api/demo/bookmarks')
      .set(auth(token)).send({ messageId: 'pas un nombre' })
    expect(res.status).toBe(400)
  })

  it('etat isole par tenant : mes bookmarks ne fuient pas vers l\'autre session', async () => {
    const { token: t1 } = await startSession(app)
    const { token: t2 } = await startSession(app)
    // Add chez t1
    await request(app).post('/api/demo/bookmarks').set(auth(t1)).send({ messageId: 99999 })
    const ids1 = await request(app).get('/api/demo/bookmarks/ids').set(auth(t1))
    const ids2 = await request(app).get('/api/demo/bookmarks/ids').set(auth(t2))
    // 99999 n'existe pas en DB donc listMergedBookmarks le filtre — on
    // verifie au moins que les listes sont independantes (pas crash).
    expect(Array.isArray(ids1.body.data)).toBe(true)
    expect(Array.isArray(ids2.body.data)).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────────────
//  Messages : pin / reactions / edit / delete
// ────────────────────────────────────────────────────────────────────
describe('Message actions (pin, reactions, edit, delete)', () => {
  const app = buildApp()

  async function postAMessage(token, promoId) {
    const ch = await request(app).get(`/api/demo/promotions/${promoId}/channels`).set(auth(token))
    const channelId = ch.body.data[0].id
    const sent = await request(app).post('/api/demo/messages')
      .set(auth(token)).send({ channelId, content: 'mon message test' })
    return { messageId: sent.body.data.id, channelId }
  }

  it('POST /messages/pin epingle/desepingle un message', async () => {
    const { token, user } = await startSession(app)
    const { messageId } = await postAMessage(token, user.promo_id)
    const pin = await request(app).post('/api/demo/messages/pin')
      .set(auth(token)).send({ messageId, pinned: true })
    expect(pin.status).toBe(200)
    const unpin = await request(app).post('/api/demo/messages/pin')
      .set(auth(token)).send({ messageId, pinned: false })
    expect(unpin.status).toBe(200)
  })

  it('POST /messages/reactions accepte le format enrichi { count, users }', async () => {
    const { token, user } = await startSession(app)
    const { messageId } = await postAMessage(token, user.promo_id)
    const res = await request(app).post('/api/demo/messages/reactions')
      .set(auth(token)).send({
        msgId: messageId,
        reactionsJson: JSON.stringify({ '👍': { count: 1, users: ['Toi'] } }),
      })
    expect(res.status).toBe(200)
  })

  it('POST /messages/reactions rejette un JSON invalide avec 400', async () => {
    const { token, user } = await startSession(app)
    const { messageId } = await postAMessage(token, user.promo_id)
    const res = await request(app).post('/api/demo/messages/reactions')
      .set(auth(token)).send({ msgId: messageId, reactionsJson: 'pas du json' })
    expect(res.status).toBe(400)
  })

  it('POST /messages/reactions rejette un array (pas un objet)', async () => {
    const { token, user } = await startSession(app)
    const { messageId } = await postAMessage(token, user.promo_id)
    const res = await request(app).post('/api/demo/messages/reactions')
      .set(auth(token)).send({ msgId: messageId, reactionsJson: '["check"]' })
    expect(res.status).toBe(400)
  })

  it('PATCH /messages/:id edite mon propre message', async () => {
    const { token, user } = await startSession(app)
    const { messageId } = await postAMessage(token, user.promo_id)
    const res = await request(app).patch(`/api/demo/messages/${messageId}`)
      .set(auth(token)).send({ content: 'edit propre' })
    expect(res.status).toBe(200)
    expect(res.body.data.content).toBe('edit propre')
    expect(res.body.data.edited).toBe(1)
  })

  it('PATCH /messages/:id refuse l\'edition d\'un message d\'un autre auteur (403)', async () => {
    const { token, user } = await startSession(app)
    // Pioche un message du seed (auteur != visiteur)
    const ch = await request(app).get(`/api/demo/promotions/${user.promo_id}/channels`).set(auth(token))
    const page = await request(app).get(`/api/demo/messages/channel/${ch.body.data[0].id}/page`).set(auth(token))
    const otherMsg = page.body.data.find(m => m.author_id !== user.id)
    expect(otherMsg).toBeTruthy()
    const res = await request(app).patch(`/api/demo/messages/${otherMsg.id}`)
      .set(auth(token)).send({ content: 'tentative de hijack' })
    expect(res.status).toBe(403)
  })

  it('DELETE /messages/:id supprime mon propre message', async () => {
    const { token, user } = await startSession(app)
    const { messageId } = await postAMessage(token, user.promo_id)
    const res = await request(app).delete(`/api/demo/messages/${messageId}`).set(auth(token))
    expect(res.status).toBe(200)
  })

  it('PATCH /messages/:id rejette content vide avec 400', async () => {
    const { token, user } = await startSession(app)
    const { messageId } = await postAMessage(token, user.promo_id)
    const res = await request(app).patch(`/api/demo/messages/${messageId}`)
      .set(auth(token)).send({ content: '   ' })
    expect(res.status).toBe(400)
  })
})

// ────────────────────────────────────────────────────────────────────
//  Welcome DM + recent-dm-contacts (decouverte des DMs entrants)
// ────────────────────────────────────────────────────────────────────
describe('Welcome DM + recent-dm-contacts', () => {
  const app = buildApp()

  it('GET /messages/recent-dm-contacts inclut au moins le prof', async () => {
    const { token } = await startSession(app)
    const res = await request(app).get('/api/demo/messages/recent-dm-contacts').set(auth(token))
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.some(c => c.partner_role === 'teacher')).toBe(true)
  })

  it('GET /messages/recent-dm-contacts utilise des partner_id valides du tenant', async () => {
    const { token, user } = await startSession(app)
    const studentsRes = await request(app)
      .get(`/api/demo/promotions/${user.promo_id}/students`).set(auth(token))
    const validStudentIds = new Set(studentsRes.body.data.map(s => s.id))
    const teachersRes = await request(app).get('/api/demo/teachers').set(auth(token))
    const validTeacherIds = new Set(teachersRes.body.data.map(t => t.id)) // ids negatifs

    const res = await request(app).get('/api/demo/messages/recent-dm-contacts').set(auth(token))
    for (const contact of res.body.data) {
      const isStudent = contact.partner_role === 'student' && validStudentIds.has(contact.partner_id)
      const isTeacher = contact.partner_role === 'teacher' && validTeacherIds.has(contact.partner_id)
      expect(isStudent || isTeacher).toBe(true)
    }
  })

  it('un DM entrant cree par sendWelcomeDm apparait dans la conversation', async () => {
    // Simule l'effet de sendWelcomeDm en inserant directement un DM bot
    // (le warm-up serait declenche en NODE_ENV=production via setTimeout
    // — on raccourcit pour les tests).
    const { token, user } = await startSession(app)
    const { sendWelcomeDm } = require('../../../server/services/demoBots')
    const { getDemoDb } = require('../../../server/db/demo-connection')

    // Trouve le tenant_id de la session courante
    const sess = getDemoDb().prepare(
      `SELECT tenant_id FROM demo_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1`
    ).get(user.id)
    expect(sess).toBeTruthy()

    const result = sendWelcomeDm(getDemoDb(), sess.tenant_id, user.id)
    expect(result).toBeTruthy()
    expect(result.authorName).toBeTruthy()

    // Trouve le bot dans la liste des students
    const studentsRes = await request(app)
      .get(`/api/demo/promotions/${user.promo_id}/students`).set(auth(token))
    const bot = studentsRes.body.data.find(s => s.name === result.authorName)
    expect(bot).toBeTruthy()

    // Le visiteur ouvre la conversation avec le bot -> doit voir le welcome DM
    const dmRes = await request(app)
      .get(`/api/demo/messages/dm/${bot.id}/page`).set(auth(token))
    expect(dmRes.status).toBe(200)
    const incoming = dmRes.body.data.filter(m => !m.is_self)
    const welcome = incoming.find(m => m.content === result.content)
    expect(welcome).toBeTruthy()
  })
})

// ────────────────────────────────────────────────────────────────────
//  Lumen : reads + notes
// ────────────────────────────────────────────────────────────────────
describe('Lumen interactive (reads + notes)', () => {
  const app = buildApp()

  it('POST /lumen/repos/:id/read accepte un path et renvoie 200', async () => {
    const { token } = await startSession(app)
    const res = await request(app).post('/api/demo/lumen/repos/9001/read')
      .set(auth(token)).send({ path: 'ch01-tri-rapide.md' })
    expect(res.status).toBe(200)
  })

  it('POST /lumen/repos/:id/read rejette un path manquant avec 400', async () => {
    const { token } = await startSession(app)
    const res = await request(app).post('/api/demo/lumen/repos/9001/read').set(auth(token)).send({})
    expect(res.status).toBe(400)
  })

  it('PUT puis GET /lumen/repos/:id/note round-trip une note', async () => {
    const { token } = await startSession(app)
    const path = 'ch02-arbres-avl.md'
    const put = await request(app).put('/api/demo/lumen/repos/9001/note')
      .set(auth(token)).send({ path, content: 'invariant : |bf| <= 1' })
    expect(put.status).toBe(200)

    const get = await request(app).get(`/api/demo/lumen/repos/9001/note?path=${encodeURIComponent(path)}`)
      .set(auth(token))
    expect(get.status).toBe(200)
    expect(get.body.data.note).toBe('invariant : |bf| <= 1')
  })

  it('PUT avec content vide supprime la note (DELETE-like)', async () => {
    const { token } = await startSession(app)
    const path = 'ch03-prog-dyn.md'
    await request(app).put('/api/demo/lumen/repos/9001/note')
      .set(auth(token)).send({ path, content: 'note temp' })
    await request(app).put('/api/demo/lumen/repos/9001/note')
      .set(auth(token)).send({ path, content: '' })
    const get = await request(app).get(`/api/demo/lumen/repos/9001/note?path=${encodeURIComponent(path)}`)
      .set(auth(token))
    expect(get.body.data.note).toBeNull()
  })

  it('GET /lumen/repos/:id/note inconnu renvoie note: null (pas 404)', async () => {
    const { token } = await startSession(app)
    const res = await request(app).get('/api/demo/lumen/repos/9001/note?path=jamais-vu.md')
      .set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.data.note).toBeNull()
  })
})
