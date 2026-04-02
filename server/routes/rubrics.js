// ─── Routes rubriques ────────────────────────────────────────────────────────
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap    = require('../utils/wrap')
const { requireRole, requirePromo, promoFromTravail, requireTravailOwner } = require('../middleware/authorize')

const upsertRubricSchema = z.object({
  travailId: z.number().int().positive('Devoir invalide'),
  title:     z.string().max(200).optional().default('Grille d\'évaluation'),
  criteria:  z.array(z.object({
    id:       z.number().int().optional(),
    label:    z.string().min(1).max(200),
    max_pts:  z.number().int().min(1).max(100).optional().default(4),
    weight:   z.number().min(0.1).max(10).optional().default(1),
    position: z.number().int().min(0).optional().default(0),
  })).optional().default([]),
}).passthrough()

router.get('/scores/:depotId', requireRole('teacher'), wrap((req) => queries.getDepotScores(Number(req.params.depotId))))
router.post('/scores',         requireRole('teacher'), wrap((req) => queries.setDepotScores(req.body)))
router.get('/:travailId',      requirePromo(promoFromTravail), wrap((req) => queries.getRubric(Number(req.params.travailId))))
router.post('/',               requireRole('teacher'), requireTravailOwner, validate(upsertRubricSchema), wrap((req) => queries.upsertRubric(req.body)))
router.delete('/:travailId',   requireRole('teacher'), requireTravailOwner, wrap((req) => queries.deleteRubric(Number(req.params.travailId))))

module.exports = router
