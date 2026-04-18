// ─── Routes cahiers (notebooks collaboratifs) ───────────────────────────────
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap    = require('../utils/wrap')
const { requireRole } = require('../middleware/authorize')

// Limites de securite Yjs
const MAX_YJS_STATE_BYTES = 5 * 1024 * 1024 // 5 MB binaire
const MAX_YJS_STATE_B64   = Math.ceil(MAX_YJS_STATE_BYTES * 4 / 3) + 16 // tolerance padding
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/

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

// wrap(fn) appelle fn(req) et fait res.json({ ok, data }) automatiquement.
// Pour un 4xx, throw une Error avec .statusCode (voir wrap.js resolveStatus).
function clientError(message, statusCode = 400) {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

function requireCahierExists(id) {
  const cahier = queries.getCahierById(id)
  if (!cahier) throw clientError('Cahier introuvable', 404)
  return cahier
}

// GET /api/cahiers?promoId=X&project=Y
router.get('/', wrap((req) => {
  const promoId = Number(req.query.promoId)
  if (!promoId) throw clientError('promoId requis')
  const project = req.query.project || null
  return queries.getCahiers(promoId, project)
}))

// GET /api/cahiers/:id
router.get('/:id', wrap((req) => {
  return requireCahierExists(Number(req.params.id))
}))

// GET /api/cahiers/:id/state — Yjs document state (binary base64)
router.get('/:id/state', wrap((req) => {
  const id = Number(req.params.id)
  requireCahierExists(id)
  const state = queries.getCahierYjsState(id)
  if (!state) return null
  return Buffer.from(state).toString('base64')
}))

// POST /api/cahiers — create
router.post('/', requireRole('teacher', 'student'), validate(createSchema), wrap((req) => {
  const { promoId, project, title, groupId } = req.body
  return queries.createCahier({
    promoId,
    project,
    title: title || 'Sans titre',
    createdBy: req.user.id,
    groupId,
  })
}))

// PATCH /api/cahiers/:id — rename
router.patch('/:id', requireRole('teacher', 'student'), validate(renameSchema), wrap((req) => {
  const id = Number(req.params.id)
  requireCahierExists(id)
  queries.renameCahier(id, req.body.title)
  return { id, title: req.body.title }
}))

// DELETE /api/cahiers/:id
router.delete('/:id', requireRole('teacher'), wrap((req) => {
  const id = Number(req.params.id)
  requireCahierExists(id)
  queries.deleteCahier(id)
  return { id }
}))

// PATCH /api/cahiers/:id/state — save Yjs state (base64)
router.patch('/:id/state', requireRole('teacher', 'student'), validate(stateSchema), wrap((req) => {
  const id = Number(req.params.id)
  requireCahierExists(id)

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

  queries.saveCahierYjsState(id, state)
  return { id, size: state.length }
}))

module.exports = router
