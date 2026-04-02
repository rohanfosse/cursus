// ─── Routes messages ─────────────────────────────────────────────────────────
const router    = require('express').Router()
const { z }     = require('zod')
const rateLimit = require('express-rate-limit')
const queries   = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap         = require('../utils/wrap')
const { ForbiddenError, NotFoundError } = require('../utils/errors')
const { requireRole, requirePromo, promoFromChannel, requireMessageOwner, requireDmParticipant } = require('../middleware/authorize')

// ── Rate limiter spécifique messages : 30 msg/min par utilisateur ───────────
const messageLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: (req) => `msg:${req.user?.id ?? 'anon'}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Trop de messages envoyés. Réessayez dans une minute.' },
  validate: { xForwardedForHeader: false },
})

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

// ── Helper audit log ─────────────────────────────────────────────────────────
function audit(req, action, target, details) {
  try {
    const { logAudit } = require('../db/models/admin')
    logAudit({
      actorId: req.user?.id, actorName: req.user?.name, actorType: req.user?.type,
      action, target, details: details ? JSON.stringify(details) : null, ip: req.ip,
    })
  } catch { /* non bloquant */ }
}

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

router.get('/dm-files', requireRole('teacher'), wrap(() => queries.getDmFiles()))

// ── Ecriture ──────────────────────────────────────────────────────────────────
const MessageService = require('../services/messages')

router.post('/', messageLimiter, validate(sendMessageSchema), (req, res) => {
  try {
    const { message, pushPayload } = MessageService.create(req.body, req.user)

    // Audit log
    audit(req, 'message:create', `message:${message.id}`, {
      channelId: req.body.channelId, dmStudentId: req.body.dmStudentId,
    })

    // Envoi cible via Socket.io (transport, pas logique metier)
    const io = req.app.get('io')
    if (io) {
      if (req.body.dmStudentId) {
        io.to(`user:${req.body.dmStudentId}`).emit('msg:new', pushPayload)
        const peerId = req.body.dmPeerId ?? req.user.id
        if (peerId !== req.body.dmStudentId) {
          io.to(`user:${peerId}`).emit('msg:new', pushPayload)
        }
      } else if (req.body.channelId) {
        let targetPromo = req.body.promoId
        if (!targetPromo) {
          try {
            const { getDb } = require('../db/connection')
            const ch = getDb().prepare('SELECT promo_id FROM channels WHERE id = ?').get(req.body.channelId)
            targetPromo = ch?.promo_id
          } catch { /* pas de promo → pas de broadcast */ }
        }
        if (targetPromo) {
          io.to(`promo:${targetPromo}`).emit('msg:new', pushPayload)
        }
      }
    }

    res.json({ ok: true, data: message })
  } catch (err) {
    const status = err.statusCode || 400
    res.status(status).json({ ok: false, error: err.message })
  }
})

router.post('/pin',       requireRole('teacher'), wrap((req) => queries.togglePinMessage(req.body.messageId, req.body.pinned)))
router.post('/reactions', (req, res, next) => {
  // Étudiants : vérifier que le message est dans leur promo
  if (req.user?.type !== 'student') return next()
  const { getDb } = require('../db/connection')
  const msg = getDb().prepare('SELECT channel_id, dm_student_id FROM messages WHERE id = ? AND deleted_at IS NULL').get(req.body.msgId)
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

router.delete('/:id', requireMessageOwner, (req, res) => {
  try {
    const changes = queries.deleteMessage(Number(req.params.id))
    audit(req, 'message:delete', `message:${req.params.id}`)
    res.json({ ok: true, data: changes })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

router.patch('/:id', requireMessageOwner, validate(editMessageSchema), (req, res) => {
  try {
    const changes = queries.editMessage(Number(req.params.id), req.body.content)
    audit(req, 'message:edit', `message:${req.params.id}`, { newContentLength: req.body.content.length })
    res.json({ ok: true, data: changes })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

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
  audit(req, 'message:report', `message:${messageId}`, { reason })
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
