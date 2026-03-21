// ─── Routes travaux (assignments) ────────────────────────────────────────────
const router  = require('express').Router()
const queries = require('../../src/db/index')

function wrap(fn) {
  return (req, res) => {
    try { res.json({ ok: true, data: fn(req) }) }
    catch (err) { res.status(400).json({ ok: false, error: err.message }) }
  }
}

router.get('/teacher-schedule',         wrap(() => queries.getTeacherSchedule()))
router.get('/categories',               wrap((req) => queries.getTravailCategories(Number(req.query.promoId))))
router.get('/gantt',                    wrap((req) => queries.getGanttData(req.query.promoId ? Number(req.query.promoId) : null)))
router.get('/rendus',                   wrap((req) => queries.getAllRendus(req.query.promoId ? Number(req.query.promoId) : null)))
router.get('/',                         wrap((req) => queries.getTravaux(Number(req.query.channelId))))
router.get('/:id',                      wrap((req) => queries.getTravailById(Number(req.params.id))))
router.get('/:id/suivi',                wrap((req) => queries.getTravauxSuivi(Number(req.params.id))))
router.get('/:id/group-members',        wrap((req) => queries.getTravailGroupMembers(Number(req.params.id))))
router.post('/',                        wrap((req) => queries.createTravail(req.body)))
router.post('/publish',                 wrap((req) => queries.updateTravailPublished(req.body)))
router.post('/group-member',            wrap((req) => queries.setTravailGroupMember(req.body)))
router.post('/:id/mark-missing',        wrap((req) => queries.markNonSubmittedAsD(Number(req.params.id))))
router.delete('/:id',                   wrap((req) => queries.deleteTravail(Number(req.params.id))))
router.patch('/:id',                    wrap((req) => queries.updateTravail(Number(req.params.id), req.body)))

module.exports = router
