// ─── Routes ressources ────────────────────────────────────────────────────────
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap    = require('../utils/wrap')
const { requireRole, requirePromo, promoFromTravail } = require('../middleware/authorize')

const addResourceSchema = z.object({
  travail_id:  z.number().int().positive().optional(),
  travailId:   z.number().int().positive().optional(),
  type:        z.enum(['file', 'link']),
  name:        z.string().min(1).max(255),
  path_or_url: z.string().min(1).max(1000).optional(),
  pathOrUrl:   z.string().min(1).max(1000).optional(),
  category:    z.string().max(100).optional().default('autre'),
}).passthrough().transform(data => ({
  ...data,
  travailId:  data.travailId ?? data.travail_id,
  pathOrUrl:  data.pathOrUrl ?? data.path_or_url,
}))

router.get('/',      requirePromo(promoFromTravail), wrap((req) => queries.getRessources(Number(req.query.travailId))))
router.post('/',     requireRole('teacher'), validate(addResourceSchema), wrap((req) => queries.addRessource(req.body)))
router.delete('/:id', requireRole('teacher'), wrap((req) => queries.deleteRessource(Number(req.params.id))))

module.exports = router
