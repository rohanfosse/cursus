// ─── Routes ressources ────────────────────────────────────────────────────────
const router  = require('express').Router()
const queries = require('../db/index')

function wrap(fn) {
  return (req, res) => {
    try { res.json({ ok: true, data: fn(req) }) }
    catch (err) { res.status(400).json({ ok: false, error: err.message }) }
  }
}

router.get('/',      wrap((req) => queries.getRessources(Number(req.query.travailId))))
router.post('/',     wrap((req) => queries.addRessource(req.body)))
router.delete('/:id',wrap((req) => queries.deleteRessource(Number(req.params.id))))

module.exports = router
