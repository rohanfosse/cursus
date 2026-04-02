/** Routes API carnet de suivi etudiant. */
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap    = require('../utils/wrap')
const { requireRole } = require('../middleware/authorize')

// ── Schémas ─────────────────────────────────────────────────────────────────
const createNoteSchema = z.object({
  studentId: z.number().int().positive(),
  promoId:   z.number().int().positive(),
  content:   z.string().min(1, 'Le contenu est requis').max(5000),
  tag:       z.enum(['progression', 'objectif', 'observation', 'alerte', 'autre']).optional().default('observation'),
  category:  z.string().max(100).optional().default('generale'),
})

const updateNoteSchema = z.object({
  content:  z.string().min(1, 'Le contenu est requis').max(5000),
  tag:      z.enum(['progression', 'objectif', 'observation', 'alerte', 'autre']).optional(),
  category: z.string().max(100).optional(),
})

// ── Helper : vérifier que la note appartient au prof courant ─────────────────
function requireNoteOwner(req, res, next) {
  const { getDb } = require('../db/connection')
  const note = getDb().prepare('SELECT teacher_id FROM teacher_notes WHERE id = ?').get(Number(req.params.id))
  if (!note) return res.status(404).json({ ok: false, error: 'Note introuvable.' })
  if (note.teacher_id !== req.user?.id) {
    return res.status(403).json({ ok: false, error: 'Vous ne pouvez modifier que vos propres notes.' })
  }
  next()
}

// GET /student/:studentId
router.get('/student/:studentId', requireRole('teacher'), wrap((req) => {
  return queries.getNotesByStudent(Number(req.params.studentId), req.user.id)
}))

// GET /promo/:promoId
router.get('/promo/:promoId', requireRole('teacher'), wrap((req) => {
  return queries.getNotesByPromo(Number(req.params.promoId), req.user.id)
}))

// GET /promo/:promoId/summary
router.get('/promo/:promoId/summary', requireRole('teacher'), wrap((req) => {
  return queries.getNotesCountByStudent(Number(req.params.promoId), req.user.id)
}))

// POST /
router.post('/', requireRole('teacher'), validate(createNoteSchema), wrap((req) => {
  return queries.createNote({ teacherId: req.user.id, ...req.body, content: req.body.content.trim() })
}))

// PATCH /:id
router.patch('/:id', requireRole('teacher'), requireNoteOwner, validate(updateNoteSchema), wrap((req) => {
  return queries.updateNote(Number(req.params.id), { ...req.body, content: req.body.content.trim() })
}))

// DELETE /:id
router.delete('/:id', requireRole('teacher'), requireNoteOwner, wrap((req) => {
  queries.deleteNote(Number(req.params.id))
  return null
}))

module.exports = router
