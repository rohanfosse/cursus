// ─── Routes cahiers (notebooks collaboratifs) ───────────────────────────────
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap    = require('../utils/wrap')
const { requireRole, requirePromo } = require('../middleware/authorize')

const createSchema = z.object({
  promoId:   z.number().int().positive(),
  project:   z.string().nullable().optional(),
  title:     z.string().min(1).max(200).optional(),
  groupId:   z.number().int().positive().nullable().optional(),
})

const renameSchema = z.object({
  title: z.string().min(1).max(200),
})

// GET /api/cahiers?promoId=X&project=Y
router.get('/', wrap(async (req, res) => {
  const promoId = Number(req.query.promoId)
  const project = req.query.project || null
  if (!promoId) return res.json({ ok: false, error: 'promoId requis' })
  const cahiers = queries.getCahiers(promoId, project)
  res.json({ ok: true, data: cahiers })
}))

// GET /api/cahiers/:id
router.get('/:id', wrap(async (req, res) => {
  const cahier = queries.getCahierById(Number(req.params.id))
  if (!cahier) return res.status(404).json({ ok: false, error: 'Cahier introuvable' })
  res.json({ ok: true, data: cahier })
}))

// GET /api/cahiers/:id/state — Yjs document state (binary)
router.get('/:id/state', wrap(async (req, res) => {
  const state = queries.getCahierYjsState(Number(req.params.id))
  if (!state) return res.json({ ok: true, data: null })
  // Return base64-encoded Yjs state
  res.json({ ok: true, data: Buffer.from(state).toString('base64') })
}))

// POST /api/cahiers — create
router.post('/', requireRole('teacher', 'student'), validate(createSchema), wrap(async (req, res) => {
  const { promoId, project, title, groupId } = req.body
  const result = queries.createCahier({
    promoId,
    project,
    title: title || 'Sans titre',
    createdBy: req.user.id,
    groupId,
  })
  res.json({ ok: true, data: result })
}))

// PATCH /api/cahiers/:id — rename
router.patch('/:id', requireRole('teacher', 'student'), validate(renameSchema), wrap(async (req, res) => {
  queries.renameCahier(Number(req.params.id), req.body.title)
  res.json({ ok: true })
}))

// DELETE /api/cahiers/:id
router.delete('/:id', requireRole('teacher'), wrap(async (req, res) => {
  queries.deleteCahier(Number(req.params.id))
  res.json({ ok: true })
}))

module.exports = router
