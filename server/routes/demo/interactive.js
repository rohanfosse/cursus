/**
 * Endpoints "interactifs" cote etudiant : actions qui DOIVENT persister
 * pendant la session demo pour que le visiteur voie le resultat de son
 * clic (bookmark, reaction, edit, pin, marquer lu, prendre une note...).
 *
 * Sans ces endpoints, ces actions tombent dans le wildcard fallback :
 *  - Les writes (POST/PATCH/DELETE) renvoient 403 "ecriture refusee"
 *    qui declenche un toast d'erreur cote front (faux negatif).
 *  - Les lectures fallback en `[]` qui n'a pas le bon shape pour la
 *    plupart des consumers (exemple : getLumenChapterNote attend
 *    `{ note: string | null }`).
 *
 * Strategie : etat en memoire par tenant pour les choses qui n'ont pas
 * de table demo_* dediee (bookmarks, lumen reads/notes). Pour ce qui
 * touche des tables existantes (demo_messages.is_pinned/reactions/
 * content), on ecrit directement en DB.
 *
 * Mount : avant `mocks.js` dans demo/index.js pour que ces routes
 * gagnent sur le wildcard.
 */
const router  = require('express').Router()
const { getDemoDb } = require('../../db/demo-connection')

// ────────────────────────────────────────────────────────────────────
//  Etat en memoire par tenant (purge implicite avec /demo/end)
//
//  Map<tenantId, {
//    bookmarks: Map<msgId, BookmarkExtra>,
//    bookmarkRemovals: Set<msgId>,        // pour cacher les bookmarks seed
//    lumenReads: Map<`${repoId}|${path}`, { readAt }>,
//    lumenNotes: Map<`${repoId}|${path}`, { content, updatedAt }>,
//  }>
// ────────────────────────────────────────────────────────────────────
const _state = new Map()
function getState(tenantId) {
  let s = _state.get(tenantId)
  if (!s) {
    s = {
      bookmarks: new Map(),
      bookmarkRemovals: new Set(),
      lumenReads: new Map(),
      lumenNotes: new Map(),
    }
    _state.set(tenantId, s)
  }
  return s
}
function clearState(tenantId) { _state.delete(tenantId) }

// ────────────────────────────────────────────────────────────────────
//  Bookmarks
// ────────────────────────────────────────────────────────────────────

// Baseline statique (pre-seedee, partagee entre tenants pour que la liste
// affiche du contenu des l'arrivee). Le visiteur peut en ajouter, en
// retirer ; ses modifs sont stockees per-tenant et fusionnees au read.
const DEMO_BOOKMARKS_BASELINE = [
  { id: 9001, message_id: 142, channel_id: 1, channel_name: 'general',    author_name: 'Prof. Lemaire',  content: 'Reunion de mi-semestre mardi 14h en B204. Ordre du jour pousse dans Documents.',                created_at: new Date(Date.now() -  1 * 86400_000).toISOString(), bookmarked_at: new Date(Date.now() -  1 * 86400_000).toISOString() },
  { id: 9002, message_id: 165, channel_id: 2, channel_name: 'algo',       author_name: 'Mehdi Chaouki',  content: 'Mon schema rotations AVL : github.com/mehdi-c/avl-cheatsheet',                                  created_at: new Date(Date.now() -  4 * 86400_000).toISOString(), bookmarked_at: new Date(Date.now() -  4 * 86400_000).toISOString() },
  { id: 9003, message_id: 178, channel_id: 3, channel_name: 'projet-web', author_name: 'Emma Lefevre',   content: "J'ai push l'archi initiale sur feat/auth-module. Quelqu'un peut review ?",                       created_at: new Date(Date.now() -  3 * 86400_000).toISOString(), bookmarked_at: new Date(Date.now() -  3 * 86400_000).toISOString() },
  { id: 9004, message_id: 195, channel_id: 2, channel_name: 'algo',       author_name: 'Jean Dupont',    content: 'Visualiseur AVL interactif : https://www.cs.usfca.edu/~galles/visualization/AVLtree.html',          created_at: new Date(Date.now() -  1 * 86400_000).toISOString(), bookmarked_at: new Date(Date.now() -  1 * 86400_000).toISOString() },
]

function listMergedBookmarks(tenantId) {
  const s = getState(tenantId)
  const seen = new Set()
  const out = []
  // Baseline (filtree des suppressions visiteur)
  for (const b of DEMO_BOOKMARKS_BASELINE) {
    if (s.bookmarkRemovals.has(b.message_id)) continue
    seen.add(b.message_id)
    out.push(b)
  }
  // Bookmarks ajoutes par le visiteur — derives des messages reels en DB
  // pour avoir le contenu courant (auteur, channel, content). Si le
  // message a ete supprime entre-temps on skip silencieusement.
  if (s.bookmarks.size > 0) {
    const ids = [...s.bookmarks.keys()]
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',')
      const rows = getDemoDb().prepare(
        `SELECT m.id AS message_id, m.channel_id, c.name AS channel_name,
                m.author_name, m.content, m.created_at
         FROM demo_messages m
         LEFT JOIN demo_channels c ON c.id = m.channel_id AND c.tenant_id = m.tenant_id
         WHERE m.tenant_id = ? AND m.id IN (${placeholders})`
      ).all(tenantId, ...ids)
      for (const r of rows) {
        if (seen.has(r.message_id)) continue
        const extra = s.bookmarks.get(r.message_id)
        out.push({
          id: 90000 + r.message_id,
          message_id: r.message_id,
          channel_id: r.channel_id,
          channel_name: r.channel_name || 'general',
          author_name: r.author_name,
          content: r.content,
          note: extra?.note ?? null,
          created_at: r.created_at,
          bookmarked_at: extra?.addedAt ?? new Date().toISOString(),
        })
      }
    }
  }
  // Tri : plus recents en premier (bookmarked_at desc)
  out.sort((a, b) => new Date(b.bookmarked_at).getTime() - new Date(a.bookmarked_at).getTime())
  return out
}

router.get('/bookmarks', (req, res) => {
  res.json({ ok: true, data: listMergedBookmarks(req.tenantId) })
})

router.get('/bookmarks/ids', (req, res) => {
  res.json({ ok: true, data: listMergedBookmarks(req.tenantId).map(b => b.message_id) })
})

router.post('/bookmarks', (req, res) => {
  const messageId = Number(req.body?.messageId)
  const note = typeof req.body?.note === 'string' ? req.body.note : null
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return res.status(400).json({ ok: false, error: 'messageId invalide.' })
  }
  const s = getState(req.tenantId)
  s.bookmarkRemovals.delete(messageId)
  s.bookmarks.set(messageId, { note, addedAt: new Date().toISOString() })
  res.json({ ok: true, data: { messageId, note } })
})

router.delete('/bookmarks/:messageId', (req, res) => {
  const messageId = Number(req.params.messageId)
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return res.status(400).json({ ok: false, error: 'messageId invalide.' })
  }
  const s = getState(req.tenantId)
  s.bookmarks.delete(messageId)
  // Si le message etait dans la baseline, le marquer comme supprime
  if (DEMO_BOOKMARKS_BASELINE.some(b => b.message_id === messageId)) {
    s.bookmarkRemovals.add(messageId)
  }
  res.json({ ok: true, data: null })
})

router.post('/bookmarks/import', (req, res) => {
  const ids = Array.isArray(req.body?.messageIds) ? req.body.messageIds : []
  const s = getState(req.tenantId)
  const now = new Date().toISOString()
  let added = 0
  for (const raw of ids) {
    const id = Number(raw)
    if (!Number.isFinite(id) || id <= 0) continue
    s.bookmarkRemovals.delete(id)
    if (!s.bookmarks.has(id)) {
      s.bookmarks.set(id, { note: null, addedAt: now })
      added++
    }
  }
  res.json({ ok: true, data: { added } })
})

// ────────────────────────────────────────────────────────────────────
//  Messages : pin, reactions, edit, delete
//
//  Ces actions touchent demo_messages directement. On verifie l'auteur
//  pour edit/delete (le visiteur ne doit pas pouvoir editer un message
//  d'un bot — meme regle qu'en prod via authorize.canEditMessage).
// ────────────────────────────────────────────────────────────────────

function getOwnership(db, tenantId, msgId) {
  return db.prepare(
    `SELECT id, author_id, content FROM demo_messages WHERE id = ? AND tenant_id = ?`
  ).get(msgId, tenantId)
}

router.post('/messages/pin', (req, res) => {
  const messageId = Number(req.body?.messageId)
  const pinned = !!req.body?.pinned
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return res.status(400).json({ ok: false, error: 'messageId invalide.' })
  }
  const db = getDemoDb()
  const exists = db.prepare(
    `SELECT id FROM demo_messages WHERE id = ? AND tenant_id = ?`
  ).get(messageId, req.tenantId)
  if (!exists) return res.status(404).json({ ok: false, error: 'Message introuvable.' })
  db.prepare(
    `UPDATE demo_messages SET is_pinned = ? WHERE id = ? AND tenant_id = ?`
  ).run(pinned ? 1 : 0, messageId, req.tenantId)
  res.json({ ok: true, data: messageId })
})

router.post('/messages/reactions', (req, res) => {
  const messageId = Number(req.body?.msgId ?? req.body?.messageId)
  const reactionsJson = String(req.body?.reactionsJson ?? '{}')
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return res.status(400).json({ ok: false, error: 'msgId invalide.' })
  }
  // Validate JSON shape avant write (eviter de stocker du contenu corrompu)
  try {
    const parsed = JSON.parse(reactionsJson)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return res.status(400).json({ ok: false, error: 'reactionsJson doit etre un objet.' })
    }
  } catch {
    return res.status(400).json({ ok: false, error: 'reactionsJson n\'est pas un JSON valide.' })
  }
  const db = getDemoDb()
  const exists = db.prepare(
    `SELECT id FROM demo_messages WHERE id = ? AND tenant_id = ?`
  ).get(messageId, req.tenantId)
  if (!exists) return res.status(404).json({ ok: false, error: 'Message introuvable.' })
  db.prepare(
    `UPDATE demo_messages SET reactions = ? WHERE id = ? AND tenant_id = ?`
  ).run(reactionsJson, messageId, req.tenantId)
  res.json({ ok: true, data: messageId })
})

router.delete('/messages/:id', (req, res) => {
  const messageId = Number(req.params.id)
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return res.status(400).json({ ok: false, error: 'messageId invalide.' })
  }
  const db = getDemoDb()
  const msg = getOwnership(db, req.tenantId, messageId)
  if (!msg) return res.status(404).json({ ok: false, error: 'Message introuvable.' })
  if (msg.author_id !== req.demoUser.id) {
    return res.status(403).json({ ok: false, error: 'Tu ne peux supprimer que tes propres messages.' })
  }
  db.prepare(
    `DELETE FROM demo_messages WHERE id = ? AND tenant_id = ?`
  ).run(messageId, req.tenantId)
  res.json({ ok: true, data: messageId })
})

router.patch('/messages/:id', (req, res) => {
  const messageId = Number(req.params.id)
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : ''
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return res.status(400).json({ ok: false, error: 'messageId invalide.' })
  }
  if (!content) return res.status(400).json({ ok: false, error: 'content requis.' })
  if (content.length > 10_000) {
    return res.status(400).json({ ok: false, error: 'Message trop long (max 10000 caracteres).' })
  }
  const db = getDemoDb()
  const msg = getOwnership(db, req.tenantId, messageId)
  if (!msg) return res.status(404).json({ ok: false, error: 'Message introuvable.' })
  if (msg.author_id !== req.demoUser.id) {
    return res.status(403).json({ ok: false, error: 'Tu ne peux editer que tes propres messages.' })
  }
  db.prepare(
    `UPDATE demo_messages SET content = ?, edited = 1 WHERE id = ? AND tenant_id = ?`
  ).run(content, messageId, req.tenantId)
  res.json({ ok: true, data: { id: messageId, content, edited: 1 } })
})

// ────────────────────────────────────────────────────────────────────
//  Lumen : marquer chapitre lu, prendre/editer/supprimer une note
//
//  Etat en memoire (pas de tables demo_lumen_*). Le widget WidgetLumenNotes
//  et le panneau de note du LumenChapterViewer peuvent ainsi sauvegarder
//  pendant la session — l'etudiant voit son badge "lu" apparaitre, sa note
//  reapparaitre quand il revient sur le chapitre.
// ────────────────────────────────────────────────────────────────────

function chapterKey(repoId, path) {
  return `${repoId}|${path}`
}

router.post('/lumen/repos/:repoId/read', (req, res) => {
  const repoId = Number(req.params.repoId)
  const path = String(req.body?.path || '').trim()
  if (!Number.isFinite(repoId) || !path) {
    return res.status(400).json({ ok: false, error: 'repoId/path requis.' })
  }
  const s = getState(req.tenantId)
  s.lumenReads.set(chapterKey(repoId, path), { readAt: new Date().toISOString() })
  res.json({ ok: true, data: { repoId, path } })
})

router.get('/lumen/repos/:repoId/note', (req, res) => {
  const repoId = Number(req.params.repoId)
  const path = String(req.query?.path || '').trim()
  if (!Number.isFinite(repoId) || !path) {
    return res.status(400).json({ ok: false, error: 'repoId/path requis.' })
  }
  const s = getState(req.tenantId)
  const entry = s.lumenNotes.get(chapterKey(repoId, path))
  res.json({ ok: true, data: { note: entry?.content ?? null, updated_at: entry?.updatedAt ?? null } })
})

router.put('/lumen/repos/:repoId/note', (req, res) => {
  const repoId = Number(req.params.repoId)
  const path = String(req.body?.path || '').trim()
  const content = String(req.body?.content || '')
  if (!Number.isFinite(repoId) || !path) {
    return res.status(400).json({ ok: false, error: 'repoId/path requis.' })
  }
  const s = getState(req.tenantId)
  const updatedAt = new Date().toISOString()
  if (content.trim()) {
    s.lumenNotes.set(chapterKey(repoId, path), { content, updatedAt })
  } else {
    s.lumenNotes.delete(chapterKey(repoId, path))
  }
  res.json({ ok: true, data: { note: content || null, updated_at: updatedAt } })
})

router.delete('/lumen/repos/:repoId/note', (req, res) => {
  const repoId = Number(req.params.repoId)
  const path = String(req.body?.path || req.query?.path || '').trim()
  if (!Number.isFinite(repoId) || !path) {
    return res.status(400).json({ ok: false, error: 'repoId/path requis.' })
  }
  const s = getState(req.tenantId)
  s.lumenNotes.delete(chapterKey(repoId, path))
  res.json({ ok: true, data: null })
})

module.exports = router
module.exports._clearState = clearState // exporte pour les tests
