/**
 * Routes API Statuts utilisateurs (user-scope).
 *
 * - GET  /api/me/status         : mon statut actuel
 * - PUT  /api/me/status         : definir / mettre a jour (emoji, text, expiresAt)
 * - DELETE /api/me/status       : effacer
 * - GET  /api/statuses          : liste des statuts actifs (pour l'affichage sur avatars)
 */
const router    = require('express').Router()
const { z }     = require('zod')
const queries   = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap      = require('../utils/wrap')

const MAX_TEXT_LEN  = 100
const MAX_EMOJI_LEN = 16
const MAX_EXPIRY_MS = 30 * 24 * 3600 * 1000 // 30 jours

const setSchema = z.object({
  emoji: z.string().max(MAX_EMOJI_LEN).nullable().optional(),
  text:  z.string().max(MAX_TEXT_LEN).nullable().optional(),
  expiresAt: z.string().nullable().optional().refine((v) => {
    if (!v) return true
    const t = new Date(v).getTime()
    if (Number.isNaN(t)) return false
    const now = Date.now()
    return t > now && t - now <= MAX_EXPIRY_MS
  }, { message: 'expiresAt doit etre dans le futur (max 30 jours)' }),
}).refine(d => (d.emoji && d.emoji.trim()) || (d.text && d.text.trim()) || d.emoji === null || d.text === null, {
  message: 'emoji ou text requis (ou null pour effacer)',
})

// GET /api/me/status
router.get('/me/status', wrap((req) => queries.getUserStatus(req.user.id)))

// PUT /api/me/status
router.put('/me/status', validate(setSchema), (req, res, next) => {
  try {
    const status = queries.setUserStatus({
      userId:    req.user.id,
      userType:  req.user.type,
      emoji:     req.body.emoji ?? null,
      text:      req.body.text ?? null,
      expiresAt: req.body.expiresAt ?? null,
    })

    // Emit status:change en temps reel vers tout le monde (room 'all')
    const io = req.app.get('io')
    if (io) {
      io.to('all').emit('status:change', {
        userId: req.user.id,
        status: status && !status.cleared ? status : null,
      })
    }
    res.json({ ok: true, data: status })
  } catch (err) { next(err) }
})

// DELETE /api/me/status
router.delete('/me/status', (req, res, next) => {
  try {
    const result = queries.clearUserStatus(req.user.id)
    const io = req.app.get('io')
    if (io) io.to('all').emit('status:change', { userId: req.user.id, status: null })
    res.json({ ok: true, data: result })
  } catch (err) { next(err) }
})

// GET /api/statuses : statuts actifs (pour afficher sur les avatars)
router.get('/statuses', wrap(() => queries.listActiveStatuses()))

module.exports = router
