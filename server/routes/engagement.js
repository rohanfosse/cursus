/** Routes API analytics d'engagement. */
const router  = require('express').Router()
const queries = require('../db/index')
const wrap    = require('../utils/wrap')

// GET /:promoId — scores d'engagement pour une promo
router.get('/:promoId', wrap((req) => {
  return queries.computeEngagementScores(Number(req.params.promoId))
}))

module.exports = router
