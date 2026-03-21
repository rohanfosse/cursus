// ─── Routes rubriques ────────────────────────────────────────────────────────
const router  = require('express').Router()
const queries = require('../db/index')

function wrap(fn) {
  return (req, res) => {
    try { res.json({ ok: true, data: fn(req) }) }
    catch (err) { res.status(400).json({ ok: false, error: err.message }) }
  }
}

router.get('/scores/:depotId', wrap((req) => queries.getDepotScores(Number(req.params.depotId))))
router.post('/scores',         wrap((req) => queries.setDepotScores(req.body)))
router.get('/:travailId',      wrap((req) => queries.getRubric(Number(req.params.travailId))))
router.post('/', (req, res) => {
  try {
    const { criteria } = req.body
    if (Array.isArray(criteria)) {
      for (const c of criteria) {
        if (c.weight != null && c.weight <= 0) return res.status(400).json({ ok: false, error: 'Le poids de chaque critère doit être supérieur à 0.' })
        if (c.max_pts != null && c.max_pts <= 0) return res.status(400).json({ ok: false, error: 'Le nombre de points max doit être supérieur à 0.' })
      }
    }
    res.json({ ok: true, data: queries.upsertRubric(req.body) })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})
router.delete('/:travailId',   wrap((req) => queries.deleteRubric(Number(req.params.travailId))))

module.exports = router
