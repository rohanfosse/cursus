/** Routes API carnet de suivi etudiant. */
const router  = require('express').Router()
const queries = require('../db/index')
const wrap    = require('../utils/wrap')
const { requireTeacher } = require('../middleware/authorize')

// GET /student/:studentId — notes pour un etudiant
router.get('/student/:studentId', requireTeacher, wrap((req) => {
  const teacherId = req.user?.id
  if (!teacherId) throw new Error('Non authentifie')
  return queries.getNotesByStudent(Number(req.params.studentId), teacherId)
}))

// GET /promo/:promoId — toutes les notes pour une promo
router.get('/promo/:promoId', requireTeacher, wrap((req) => {
  const teacherId = req.user?.id
  if (!teacherId) throw new Error('Non authentifie')
  return queries.getNotesByPromo(Number(req.params.promoId), teacherId)
}))

// GET /promo/:promoId/summary — compteurs par etudiant
router.get('/promo/:promoId/summary', requireTeacher, wrap((req) => {
  const teacherId = req.user?.id
  if (!teacherId) throw new Error('Non authentifie')
  return queries.getNotesCountByStudent(Number(req.params.promoId), teacherId)
}))

// POST / — creer une note
router.post('/', requireTeacher, wrap((req) => {
  const teacherId = req.user?.id
  if (!teacherId) throw new Error('Non authentifie')
  const { studentId, promoId, content, tag, category } = req.body
  if (!studentId || !promoId || !content?.trim()) throw new Error('studentId, promoId et content requis')
  return queries.createNote({ teacherId, studentId, promoId, content: content.trim(), tag, category })
}))

// PATCH /:id — modifier une note
router.patch('/:id', requireTeacher, wrap((req) => {
  const { content, tag, category } = req.body
  if (!content?.trim()) throw new Error('content requis')
  return queries.updateNote(Number(req.params.id), { content: content.trim(), tag, category })
}))

// DELETE /:id — supprimer une note
router.delete('/:id', requireTeacher, wrap((req) => {
  queries.deleteNote(Number(req.params.id))
  return null
}))

module.exports = router
