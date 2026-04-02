// ─── Routes intervenants (TA / enseignants) ───────────────────────────────────
const router  = require('express').Router()
const queries = require('../db/index')
const wrap    = require('../utils/wrap')
const { requireRole } = require('../middleware/authorize')

router.get('/',                  requireRole('teacher'), wrap(() => queries.getIntervenants()))
router.post('/',                 requireRole('teacher'), wrap((req) => queries.createIntervenant(req.body)))
router.delete('/:id',            requireRole('teacher'), wrap((req) => queries.deleteIntervenant(Number(req.params.id))))
router.get('/:id/channels',      wrap((req) => queries.getTeacherChannels(Number(req.params.id))))
router.post('/:id/channels',     requireRole('teacher'), wrap((req) => queries.setTeacherChannels(req.body)))
router.post('/photo',            requireRole('teacher'), wrap((req) => queries.updateTeacherPhoto(req.body.teacherId, req.body.photoData)))

module.exports = router
