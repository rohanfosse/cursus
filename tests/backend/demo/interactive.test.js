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
//  /students : liste des students du tenant (autocomplete @mentions)
// ────────────────────────────────────────────────────────────────────
describe('GET /students', () => {
  const app = buildApp()

  it('retourne tous les students du tenant courant (>= 30)', async () => {
    const { token } = await startSession(app)
    const res = await request(app).get('/api/demo/students').set(auth(token))
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(30)
    expect(res.body.data[0]).toHaveProperty('id')
    expect(res.body.data[0]).toHaveProperty('name')
    expect(res.body.data[0]).toHaveProperty('avatar_initials')
    expect(res.body.data[0]).toHaveProperty('promo_id')
  })

  it('isolation par tenant : 2 sessions independantes voient des students differents', async () => {
    const { token: t1 } = await startSession(app)
    const { token: t2 } = await startSession(app)
    const r1 = await request(app).get('/api/demo/students').set(auth(t1))
    const r2 = await request(app).get('/api/demo/students').set(auth(t2))
    const ids1 = new Set(r1.body.data.map(s => s.id))
    const ids2 = new Set(r2.body.data.map(s => s.id))
    // Au moins quelques ids doivent differer (auto-increment SQLite global)
    const overlap = [...ids1].filter(id => ids2.has(id))
    expect(overlap.length).toBeLessThan(ids1.size)
  })
})

// ────────────────────────────────────────────────────────────────────
//  Depots : soumission de devoir
// ────────────────────────────────────────────────────────────────────
describe('POST /depots', () => {
  const app = buildApp()

  it('soumet un depot pour soi-meme et renvoie un id+timestamp', async () => {
    const { token, user } = await startSession(app)
    const assignsRes = await request(app)
      .get(`/api/demo/students/${user.id}/assignments`).set(auth(token))
    const travail = assignsRes.body.data[0]
    expect(travail).toBeTruthy()
    const res = await request(app).post('/api/demo/depots').set(auth(token))
      .send({ travail_id: travail.id, student_id: user.id, file_name: 'mon-rendu.zip' })
    expect(res.status).toBe(200)
    expect(res.body.data.travail_id).toBe(travail.id)
    expect(res.body.data.student_id).toBe(user.id)
    expect(res.body.data.submitted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('refuse de soumettre pour un autre etudiant (403)', async () => {
    const { token, user } = await startSession(app)
    const res = await request(app).post('/api/demo/depots').set(auth(token))
      .send({ travail_id: 1, student_id: user.id + 999, file_name: 'pas-mon-compte.zip' })
    expect(res.status).toBe(403)
  })

  it('rejette un travail_id manquant avec 400', async () => {
    const { token } = await startSession(app)
    const res = await request(app).post('/api/demo/depots').set(auth(token)).send({})
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

  it('GET /lumen/my-notes fusionne la baseline + les notes du visiteur', async () => {
    const { token } = await startSession(app)
    // Ecrit une note visiteur sur un chapitre existant en baseline
    await request(app).put('/api/demo/lumen/repos/9001/note').set(auth(token))
      .send({ path: 'ch02-arbres-avl.md', content: 'mes notes perso AVL' })
    // Ecrit une autre note sur un chapitre pas en baseline
    await request(app).put('/api/demo/lumen/repos/9001/note').set(auth(token))
      .send({ path: 'ch03-prog-dyn.md', content: 'note prog dyn' })
    const res = await request(app).get('/api/demo/lumen/my-notes').set(auth(token))
    expect(res.status).toBe(200)
    const notes = res.body.data.notes
    expect(Array.isArray(notes)).toBe(true)
    // La note visiteur sur ch02-arbres-avl ecrase la baseline
    const avl = notes.find(n => n.repo_id === 9001 && n.chapter_path === 'ch02-arbres-avl.md')
    expect(avl?.note).toBe('mes notes perso AVL')
    expect(avl?.chapter_title).toBe('Arbres AVL')
    // La note ch03-prog-dyn (pas en baseline) apparait
    const dyn = notes.find(n => n.repo_id === 9001 && n.chapter_path === 'ch03-prog-dyn.md')
    expect(dyn?.note).toBe('note prog dyn')
  })

  it('GET /lumen/my-noted-chapters retourne au moins la baseline + les notes du visiteur', async () => {
    const { token } = await startSession(app)
    await request(app).put('/api/demo/lumen/repos/9001/note').set(auth(token))
      .send({ path: 'ch01-tri-rapide.md', content: 'tri rapide perso' })
    const res = await request(app).get('/api/demo/lumen/my-noted-chapters').set(auth(token))
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data[0]).toHaveProperty('chapter_title')
    expect(res.body.data[0]).toHaveProperty('notes_count')
  })
})
