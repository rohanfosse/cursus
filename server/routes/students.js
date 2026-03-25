// ─── Routes étudiants ────────────────────────────────────────────────────────
const router  = require('express').Router()
const queries = require('../db/index')
const wrap    = require('../utils/wrap')
const { requireTeacher } = require('../middleware/authorize')

router.get('/',                    wrap(() => queries.getAllStudents()))
router.get('/stats',               requireTeacher, wrap((req) => queries.getClasseStats(Number(req.query.promoId))))
router.get('/:id/profile',         wrap((req) => queries.getStudentProfile(Number(req.params.id))))
router.get('/:id/assignments',     wrap((req) => queries.getStudentTravaux(Number(req.params.id))))
router.post('/photo', (req, res, next) => {
  if (req.user?.type === 'student' && req.user.id !== req.body.studentId) {
    return res.status(403).json({ ok: false, error: 'Vous ne pouvez modifier que votre propre photo.' })
  }
  next()
}, wrap((req) => queries.updateStudentPhoto(req.body.studentId, req.body.photoData)))
router.post('/bulk-import',        requireTeacher, wrap((req) => queries.bulkImportStudents(req.body.promoId, req.body.rows)))

module.exports = router
