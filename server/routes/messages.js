// ─── Routes messages ─────────────────────────────────────────────────────────
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')

function wrap(fn) {
  return (req, res) => {
    try { res.json({ ok: true, data: fn(req) }) }
    catch (err) { res.status(400).json({ ok: false, error: err.message }) }
  }
}

// ── Schémas de validation ─────────────────────────────────────────────────────
const sendMessageSchema = z.object({
  channelId:   z.number().int().nullable().optional(),
  dmStudentId: z.number().int().nullable().optional(),
  content:     z.string().min(1, 'Le message ne peut pas être vide').max(10000, 'Message trop long (max 10 000 caractères)'),
  channelName: z.string().nullable().optional(),
  promoId:     z.number().int().nullable().optional(),
  replyToId:      z.number().int().nullable().optional(),
  replyToAuthor:  z.string().nullable().optional(),
  replyToPreview: z.string().nullable().optional(),
}).refine(data => data.channelId || data.dmStudentId, {
  message: 'Un canal ou un destinataire DM est requis.',
})

const editMessageSchema = z.object({
  content: z.string().min(1, 'Le message ne peut pas être vide').max(10000, 'Message trop long (max 10 000 caractères)'),
})

const reportSchema = z.object({
  reason:  z.string().min(1).max(100).optional().default('other'),
  details: z.string().max(1000).nullable().optional(),
})

// ── Lecture ───────────────────────────────────────────────────────────────────
router.get('/channel/:channelId',       wrap((req) => queries.getChannelMessages(Number(req.params.channelId))))
router.get('/dm/:studentId',            wrap((req) => queries.getDmMessages(Number(req.params.studentId))))
router.get('/channel/:channelId/page',  wrap((req) => {
  const before = req.query.before ? Number(req.query.before) : null
  return queries.getChannelMessagesPage(Number(req.params.channelId), before)
}))
router.get('/dm/:studentId/page', wrap((req) => {
  const before = req.query.before ? Number(req.query.before) : null
  const peer   = req.query.peer ? Number(req.query.peer) : null
  return queries.getDmMessagesPage(Number(req.params.studentId), before, peer)
}))
router.get('/search', wrap((req) => queries.searchMessages(Number(req.query.channelId), req.query.q)))
router.post('/search-all', wrap((req) => {
  const { promoId, query, limit } = req.body
  return queries.searchAllMessages(promoId ?? null, query, limit ?? 8)
}))
router.get('/pinned/:channelId', wrap((req) => queries.getPinnedMessages(Number(req.params.channelId))))
router.get('/dm-contacts/:studentId', wrap((req) => queries.getRecentDmContacts(Number(req.params.studentId), Number(req.query.limit) || 15)))
router.get('/dm/:studentId/search', wrap((req) => {
  const peer = req.query.peer ? Number(req.query.peer) : null
  return queries.searchDmMessages(Number(req.params.studentId), req.query.q, peer)
}))

// ── Écriture ──────────────────────────────────────────────────────────────────
router.post('/', validate(sendMessageSchema), (req, res) => {
  try {
    const payload = req.body

    // ── Sécurité : forcer l'identité depuis le JWT (anti-usurpation) ────────
    payload.authorName = req.user.name
    payload.authorType = req.user.type === 'ta' ? 'teacher' : req.user.type

    // ── Sécurité : valider le destinataire DM ────────────────────────────────
    if (payload.dmStudentId) {
      const { getDb } = require('../db/connection')
      const exists = getDb().prepare('SELECT id FROM students WHERE id = ?').get(payload.dmStudentId)
      if (!exists) {
        return res.status(400).json({ ok: false, error: 'Destinataire introuvable.' })
      }
    }

    // ── Sécurité : bloquer les étudiants sur les canaux d'annonce ───────────
    if (payload.channelId && req.user.type === 'student') {
      const { getDb } = require('../db/connection')
      const ch = getDb().prepare('SELECT type FROM channels WHERE id = ?').get(payload.channelId)
      if (ch?.type === 'annonce') {
        return res.status(403).json({ ok: false, error: 'Les étudiants ne peuvent pas poster dans les canaux d\'annonce.' })
      }
    }

    const result  = queries.sendMessage(payload)

    // ── Parsing des mentions ─────────────────────────────────────────────────
    const rawContent      = payload.content ?? ''
    const mentionEveryone = /@everyone\b/i.test(rawContent)
    const mentionNames    = []
    const re = /@([\w][\w.\-]*)/g
    let m
    while ((m = re.exec(rawContent)) !== null) {
      const name = m[1].toLowerCase()
      if (name !== 'everyone') mentionNames.push(m[1])
    }

    const push = {
      channelId:       payload.channelId   ?? null,
      dmStudentId:     payload.dmStudentId ?? null,
      authorName:      req.user.name       ?? null,
      channelName:     payload.channelName ?? null,
      promoId:         payload.promoId     ?? null,
      preview:         rawContent.replace(/[*_`>#[\]!]/g, '').slice(0, 80),
      mentionEveryone,
      mentionNames,
    }
    // Envoi ciblé via Socket.io (pas de broadcast global)
    const io = req.app.get('io')
    if (io) {
      if (payload.dmStudentId) {
        // DM → envoyer uniquement aux deux participants
        io.to(`user:${payload.dmStudentId}`).emit('msg:new', push)
        io.to(`user:${req.user.id}`).emit('msg:new', push)
      } else if (payload.promoId) {
        // Canal → envoyer à la promo
        io.to(`promo:${payload.promoId}`).emit('msg:new', push)
      } else {
        // Fallback
        io.to('all').emit('msg:new', push)
      }
    }

    res.json({ ok: true, data: result })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

router.post('/pin',       wrap((req) => queries.togglePinMessage(req.body.messageId, req.body.pinned)))
router.post('/reactions', wrap((req) => queries.updateReactions(req.body.msgId, req.body.reactionsJson)))
router.delete('/:id',     wrap((req) => queries.deleteMessage(Number(req.params.id))))
router.patch('/:id', validate(editMessageSchema), wrap((req) => queries.editMessage(Number(req.params.id), req.body.content)))

// ── Signalement de message ──────────────────────────────────────────────────
router.post('/:id/report', validate(reportSchema), wrap((req) => {
  const messageId = Number(req.params.id)
  const { reason, details } = req.body
  return queries.createReport({
    messageId,
    reporterId: Math.abs(req.user.id),
    reporterName: req.user.name,
    reporterType: req.user.type,
    reason: reason || 'other',
    details: details || null,
  })
}))

module.exports = router
