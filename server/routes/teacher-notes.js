/** Routes API carnet de suivi etudiant. */
const router  = require('express').Router()
const queries = require('../db/index')
const wrap    = require('../utils/wrap')

// GET /student/:studentId — notes pour un etudiant
router.get('/student/:studentId', wrap((req) => {
  const teacherId = req.user?.id
  if (!teacherId) throw new Error('Non authentifie')
  return queries.getNotesByStudent(Number(req.params.studentId), teacherId)
}))

// GET /promo/:promoId — toutes les notes pour une promo
router.get('/promo/:promoId', wrap((req) => {
  const teacherId = req.user?.id
  if (!teacherId) throw new Error('Non authentifie')
  return queries.getNotesByPromo(Number(req.params.promoId), teacherId)
}))

// GET /promo/:promoId/summary — compteurs par etudiant
router.get('/promo/:promoId/summary', wrap((req) => {
  const teacherId = req.user?.id
  if (!teacherId) throw new Error('Non authentifie')
  return queries.getNotesCountByStudent(Number(req.params.promoId), teacherId)
}))

// POST / — creer une note
router.post('/', wrap((req) => {
  const teacherId = req.user?.id
  if (!teacherId) throw new Error('Non authentifie')
  const { studentId, promoId, content, tag } = req.body
  if (!studentId || !promoId || !content?.trim()) throw new Error('studentId, promoId et content requis')
  return queries.createNote({ teacherId, studentId, promoId, content: content.trim(), tag })
}))

// PATCH /:id — modifier une note
router.patch('/:id', wrap((req) => {
  const { content, tag } = req.body
  if (!content?.trim()) throw new Error('content requis')
  return queries.updateNote(Number(req.params.id), { content: content.trim(), tag })
}))

// DELETE /:id — supprimer une note
router.delete('/:id', wrap((req) => {
  queries.deleteNote(Number(req.params.id))
  return null
}))

module.exports = router
