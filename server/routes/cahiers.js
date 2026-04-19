// ─── Routes cahiers (notebooks collaboratifs) ───────────────────────────────
const router    = require('express').Router()
const { z }     = require('zod')
const Y         = require('yjs')
const rateLimit = require('express-rate-limit')
const queries   = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap      = require('../utils/wrap')
const { requireRole, requireCahierAccess, requirePromo, promoFromParam } = require('../middleware/authorize')
const { getDb } = require('../db/connection')

// Limites de securite Yjs
const MAX_YJS_STATE_BYTES = 5 * 1024 * 1024 // 5 MB binaire
const MAX_YJS_STATE_B64   = Math.ceil(MAX_YJS_STATE_BYTES * 4 / 3) + 16 // tolerance padding
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/

// Rate-limit dedie sur les saves Yjs (30/min/IP — largement au-dessus du debounce 5s)
const yjsSaveLimiter = rateLimit({
  windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'Trop de sauvegardes. Ralentissez.' },
})

const createSchema = z.object({
  promoId:   z.number().int().positive(),
  project:   z.string().max(200).nullable().optional(),
  title:     z.string().min(1).max(200).optional(),
  groupId:   z.number().int().positive().nullable().optional(),
})

const renameSchema = z.object({
  title: z.string().min(1).max(200),
})

const stateSchema = z.object({
  state: z.string().min(1).max(MAX_YJS_STATE_B64),
})

function clientError(message, statusCode = 400) {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

// Verifie que l'etudiant ciblant un groupId y appartient bien
function studentOwnsGroup(userId, groupId) {
  return !!getDb().prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND student_id = ? LIMIT 1'
  ).get(groupId, userId)
}

// GET /api/cahiers?promoId=X&project=Y — scope par promo (isolation etudiant)
router.get('/', requirePromo(promoFromParam), wrap((req) => {
  const promoId = Number(req.query.promoId)
  if (!promoId) throw clientError('promoId requis')
  const project = req.query.project || null
  return queries.getCahiers(promoId, project)
}))

// GET /api/cahiers/:id
router.get('/:id', requireCahierAccess, wrap((req) => {
  return queries.getCahierById(Number(req.params.id))
}))

// GET /api/cahiers/:id/state — Yjs document state (binary base64)
router.get('/:id/state', requireCahierAccess, wrap((req) => {
  const state = queries.getCahierYjsState(Number(req.params.id))
  if (!state) return null
  return Buffer.from(state).toString('base64')
}))

// POST /api/cahiers — create
router.post('/', requireRole('student'), validate(createSchema), wrap((req) => {
  const { promoId, project, title, groupId } = req.body

  // Etudiant : doit creer dans sa propre promo (et son propre groupe si groupId fourni)
  if (req.user?.type === 'student') {
    if (req.user.promo_id !== promoId) throw clientError('Promo non autorisee', 403)
    if (groupId != null && !studentOwnsGroup(req.user.id, groupId)) {
      throw clientError('Vous n\'etes pas membre de ce groupe', 403)
    }
  }

  return queries.createCahier({
    promoId,
    project,
    title: title || 'Sans titre',
    createdBy: req.user.id,
    groupId,
  })
}))

// PATCH /api/cahiers/:id — rename
router.patch('/:id', requireRole('student'), requireCahierAccess, validate(renameSchema), wrap((req) => {
  const id = Number(req.params.id)
  queries.renameCahier(id, req.body.title)
  return { id, title: req.body.title }
}))

// DELETE /api/cahiers/:id
router.delete('/:id', requireRole('teacher'), requireCahierAccess, wrap((req) => {
  const id = Number(req.params.id)
  queries.deleteCahier(id)
  return { id }
}))

// PATCH /api/cahiers/:id/state — save Yjs state (base64)
router.patch('/:id/state', requireRole('student'), requireCahierAccess, yjsSaveLimiter, validate(stateSchema), wrap((req) => {
  const id = Number(req.params.id)

  const b64 = req.body.state
  if (!BASE64_RE.test(b64)) throw clientError('state doit etre base64 valide')
  const state = Buffer.from(b64, 'base64')
  // Re-encoder pour detecter un base64 malforme (Buffer.from ignore silencieusement les caracteres invalides)
  if (state.toString('base64').replace(/=+$/, '') !== b64.replace(/=+$/, '')) {
    throw clientError('state doit etre base64 valide')
  }
  if (state.length === 0) throw clientError('state vide non autorise')
  if (state.length > MAX_YJS_STATE_BYTES) {
    throw clientError(`state trop volumineux (max ${MAX_YJS_STATE_BYTES} octets)`, 413)
  }

  // Valide que c'est un update Yjs bien forme (evite le stockage de junk)
  try {
    Y.decodeUpdate(state)
  } catch {
    throw clientError('state n\'est pas un update Yjs valide')
  }

  queries.saveCahierYjsState(id, state)
  return { id, size: state.length }
}))

module.exports = router
