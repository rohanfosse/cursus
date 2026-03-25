// ─── Routes messages ─────────────────────────────────────────────────────────
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap         = require('../utils/wrap')
const { requireTeacher, requirePromo, promoFromChannel, requireMessageOwner, requireDmParticipant } = require('../middleware/authorize')

// ── Schémas de validation ─────────────────────────────────────────────────────
const sendMessageSchema = z.object({
  channelId:   z.number().int().nullable().optional(),
  dmStudentId: z.number().int().nullable().optional(),
  dmPeerId:    z.number().int().nullable().optional(),
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
router.get('/channel/:channelId',       requirePromo(promoFromChannel), wrap((req) => queries.getChannelMessages(Number(req.params.channelId))))
router.get('/dm/:studentId',            requireDmParticipant, wrap((req) => queries.getDmMessages(Number(req.params.studentId))))
router.get('/channel/:channelId/page',  requirePromo(promoFromChannel), wrap((req) => {
  const before = req.query.before ? Number(req.query.before) : null
  return queries.getChannelMessagesPage(Number(req.params.channelId), before)
}))
router.get('/dm/:studentId/page', requireDmParticipant, wrap((req) => {
  const before = req.query.before ? Number(req.query.before) : null
  const peer   = req.query.peer ? Number(req.query.peer) : null
  return queries.getDmMessagesPage(Number(req.params.studentId), before, peer)
}))
router.get('/search', requirePromo(promoFromChannel), wrap((req) => queries.searchMessages(Number(req.query.channelId), req.query.q)))
router.post('/search-all', wrap((req) => {
  const { query, limit } = req.body
  // Étudiants : forcé à leur propre promo + leur propre userId (pas de recherche cross-promo/user)
  const promoId = req.user.type === 'student' ? req.user.promo_id : (req.body.promoId ?? null)
  const userId  = req.user.type === 'student' ? req.user.id : (req.body.userId ?? null)
  return queries.searchAllMessages(promoId, query, limit ?? 8, userId)
}))
router.get('/pinned/:channelId', requirePromo(promoFromChannel), wrap((req) => queries.getPinnedMessages(Number(req.params.channelId))))
router.get('/dm-contacts/:studentId', requireDmParticipant, wrap((req) => queries.getRecentDmContacts(Number(req.params.studentId), Number(req.query.limit) || 15)))
router.get('/dm/:studentId/search', requireDmParticipant, wrap((req) => {
  const peer = req.query.peer ? Number(req.query.peer) : null
  return queries.searchDmMessages(Number(req.params.studentId), req.query.q, peer)
}))

router.get('/dm-files', requireTeacher, wrap(() => queries.getDmFiles()))

// ── Écriture ──────────────────────────────────────────────────────────────────
router.post('/', validate(sendMessageSchema), (req, res) => {
  try {
    const payload = req.body

    // ── Sécurité : forcer l'identité depuis le JWT (anti-usurpation) ────────
    payload.authorName = req.user.name
    payload.authorType = req.user.type === 'ta' ? 'teacher' : req.user.type

    // ── Sécurité : valider le destinataire DM ────────────────────────────────
    if (payload.dmStudentId) {
      // Un étudiant ne peut envoyer un DM que dans sa propre boîte
      if (req.user.type === 'student' && payload.dmStudentId !== req.user.id) {
        return res.status(403).json({ ok: false, error: 'Vous ne pouvez envoyer des messages que dans vos propres conversations.' })
      }
      // Valider dmPeerId : un étudiant ne peut avoir qu'un prof (ID négatif) comme peer
      if (req.user.type === 'student' && payload.dmPeerId != null && payload.dmPeerId >= 0) {
        return res.status(403).json({ ok: false, error: 'Destinataire DM invalide.' })
      }
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
    const message = queries.getMessageById(Number(result.lastInsertRowid))
    if (!message) {
      throw new Error('Le message a été inséré mais n’a pas pu être relu.')
    }

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
      message:         payload.dmStudentId ? message : undefined,
    }
    // Envoi ciblé via Socket.io (pas de broadcast global)
    const io = req.app.get('io')
    if (io) {
      if (payload.dmStudentId) {
        // DM → envoyer aux deux participants (IDs négatifs pour profs, positifs pour étudiants)
        io.to(`user:${payload.dmStudentId}`).emit('msg:new', push)
        const peerId = payload.dmPeerId ?? req.user.id
        if (peerId !== payload.dmStudentId) {
          io.to(`user:${peerId}`).emit('msg:new', push)
        }
      } else if (payload.channelId) {
        // Canal → envoyer à la promo du canal uniquement
        let targetPromo = payload.promoId
        if (!targetPromo) {
          try {
            const ch = queries.getDb?.()?.prepare('SELECT promo_id FROM channels WHERE id = ?').get(payload.channelId)
              ?? require('../db/connection').getDb().prepare('SELECT promo_id FROM channels WHERE id = ?').get(payload.channelId)
            targetPromo = ch?.promo_id
          } catch { /* fallback ci-dessous */ }
        }
        if (targetPromo) {
          io.to(`promo:${targetPromo}`).emit('msg:new', push)
        }
        // Pas de fallback 'all' — un message sans promo n'est jamais broadcasté
      }
    }

    res.json({ ok: true, data: message })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

router.post('/pin',       requireTeacher, wrap((req) => queries.togglePinMessage(req.body.messageId, req.body.pinned)))
router.post('/reactions', (req, res, next) => {
  // Étudiants : vérifier que le message est dans leur promo
  if (req.user?.type !== 'student') return next()
  const { getDb } = require('../db/connection')
  const msg = getDb().prepare('SELECT channel_id, dm_student_id FROM messages WHERE id = ?').get(req.body.msgId)
  if (!msg) return res.status(404).json({ ok: false, error: 'Message introuvable.' })
  if (msg.dm_student_id) {
    // DM : l'étudiant ne peut réagir que dans sa boîte
    if (msg.dm_student_id !== req.user.id) return res.status(403).json({ ok: false, error: 'Accès non autorisé.' })
  } else if (msg.channel_id) {
    const ch = getDb().prepare('SELECT promo_id FROM channels WHERE id = ?').get(msg.channel_id)
    if (ch && ch.promo_id !== req.user.promo_id) return res.status(403).json({ ok: false, error: 'Accès non autorisé.' })
  }
  next()
}, wrap((req) => queries.updateReactions(req.body.msgId, req.body.reactionsJson)))
router.delete('/:id',     requireMessageOwner, wrap((req) => queries.deleteMessage(Number(req.params.id))))
router.patch('/:id', requireMessageOwner, validate(editMessageSchema), wrap((req) => queries.editMessage(Number(req.params.id), req.body.content)))

// ── Signalement de message ──────────────────────────────────────────────────
router.post('/:id/report', validate(reportSchema), (req, res, next) => {
  // Étudiants : vérifier que le message est dans leur promo
  if (req.user?.type !== 'student') return next()
  const { getDb } = require('../db/connection')
  const msg = getDb().prepare('SELECT channel_id, dm_student_id FROM messages WHERE id = ?').get(Number(req.params.id))
  if (!msg) return res.status(404).json({ ok: false, error: 'Message introuvable.' })
  if (msg.channel_id) {
    const ch = getDb().prepare('SELECT promo_id FROM channels WHERE id = ?').get(msg.channel_id)
    if (ch && ch.promo_id !== req.user.promo_id) return res.status(403).json({ ok: false, error: 'Accès non autorisé.' })
  }
  next()
}, wrap((req) => {
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
