// ─── Routes intervenants (TA / enseignants) ───────────────────────────────────
const router  = require('express').Router()
const queries = require('../../src/db/index')

function wrap(fn) {
  return (req, res) => {
    try { res.json({ ok: true, data: fn(req) }) }
    catch (err) { res.status(400).json({ ok: false, error: err.message }) }
  }
}

router.get('/',                  wrap(() => queries.getIntervenants()))
router.post('/',                 wrap((req) => queries.createIntervenant(req.body)))
router.delete('/:id',            wrap((req) => queries.deleteIntervenant(Number(req.params.id))))
router.get('/:id/channels',      wrap((req) => queries.getTeacherChannels(Number(req.params.id))))
router.post('/:id/channels',     wrap((req) => queries.setTeacherChannels(req.body)))
router.post('/photo',            wrap((req) => queries.updateTeacherPhoto(req.body.teacherId, req.body.photoData)))

module.exports = router
