// ─── Routes intervenants (TA / enseignants) ───────────────────────────────────
const router  = require('express').Router()
const queries = require('../db/index')
const wrap    = require('../utils/wrap')
const { requireTeacher } = require('../middleware/authorize')

router.get('/',                  wrap(() => queries.getIntervenants()))
router.post('/',                 requireTeacher, wrap((req) => queries.createIntervenant(req.body)))
router.delete('/:id',            requireTeacher, wrap((req) => queries.deleteIntervenant(Number(req.params.id))))
router.get('/:id/channels',      wrap((req) => queries.getTeacherChannels(Number(req.params.id))))
router.post('/:id/channels',     requireTeacher, wrap((req) => queries.setTeacherChannels(req.body)))
router.post('/photo',            requireTeacher, wrap((req) => queries.updateTeacherPhoto(req.body.teacherId, req.body.photoData)))

module.exports = router
