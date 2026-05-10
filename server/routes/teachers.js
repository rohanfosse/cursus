// ─── Routes intervenants (TA / enseignants) ───────────────────────────────────
const router  = require('express').Router()
const queries = require('../db/index')
const wrap    = require('../utils/wrap')
const { requireRole } = require('../middleware/authorize')

router.get('/',                  requireRole('teacher'), wrap(() => queries.getIntervenants()))
// Creation d'un intervenant (role TA) : reservee aux admins. Avant, n'importe
// quel teacher (intervenant ponctuel inclus) pouvait creer arbitrairement
// des comptes TA et leur affecter des projets/promos via les routes
// correspondantes — privilege escalation.
router.post('/',                 requireRole('admin'),   wrap((req) => queries.createIntervenant(req.body)))
router.delete('/:id',            requireRole('admin'),   wrap((req) => queries.deleteIntervenant(Number(req.params.id))))
router.get('/:id/channels',      requireRole('teacher'), wrap((req) => queries.getTeacherChannels(Number(req.params.id))))
router.post('/:id/channels',     requireRole('teacher'), wrap((req) => queries.setTeacherChannels(req.body)))
// Photo : un teacher ne peut modifier que sa propre photo (sauf admin).
// Avant : aucun check d'identite sur teacherId, n'importe quel teacher
// pouvait ecraser la photo de tout user (XSS-reflechi via SVG dataURI
// possible si la photo est ensuite servie en <img>).
router.post('/photo', requireRole('teacher'), wrap((req) => {
  const target = Math.abs(Number(req.body?.teacherId))
  const me = Math.abs(Number(req.user?.id))
  const isAdmin = req.user?.type === 'admin'
  if (!isAdmin && target !== me) {
    const err = new Error('Vous ne pouvez modifier que votre propre photo.')
    err.statusCode = 403
    throw err
  }
  return queries.updateTeacherPhoto(req.body.teacherId, req.body.photoData)
}))

module.exports = router
