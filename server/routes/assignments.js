// ─── Routes travaux (assignments) ────────────────────────────────────────────
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../../src/db/index')
const { validate } = require('../middleware/validate')

function wrap(fn) {
  return (req, res) => {
    try { res.json({ ok: true, data: fn(req) }) }
    catch (err) { res.status(400).json({ ok: false, error: err.message }) }
  }
}

const createAssignmentSchema = z.object({
  title:       z.string().min(1, 'Titre requis').max(200, 'Titre trop long (max 200 caractères)'),
  description: z.string().max(5000).nullable().optional(),
  channelId:   z.number().int().positive('Canal invalide'),
  type:        z.enum(['livrable', 'soutenance', 'cctl', 'etude_de_cas', 'memoire', 'autre'], { message: 'Type de devoir invalide' }),
  deadline:    z.string().min(1, 'Date limite requise'),
  start_date:  z.string().nullable().optional(),
  category:    z.string().max(100).nullable().optional(),
  assigned_to: z.enum(['all', 'group']).optional().default('all'),
  group_id:    z.number().int().nullable().optional(),
  room:        z.string().max(100).nullable().optional(),
  aavs:        z.string().max(2000).nullable().optional(),
  requires_submission: z.number().int().min(0).max(1).optional().default(1),
}).passthrough() // allow _update, id for update calls

router.get('/teacher-schedule',         wrap(() => queries.getTeacherSchedule()))
router.get('/categories',               wrap((req) => queries.getTravailCategories(Number(req.query.promoId))))
router.get('/gantt',                    wrap((req) => queries.getGanttData(req.query.promoId ? Number(req.query.promoId) : null)))
router.get('/rendus',                   wrap((req) => queries.getAllRendus(req.query.promoId ? Number(req.query.promoId) : null)))
router.get('/',                         wrap((req) => queries.getTravaux(Number(req.query.channelId))))
router.get('/:id',                      wrap((req) => queries.getTravailById(Number(req.params.id))))
router.get('/:id/suivi',                wrap((req) => queries.getTravauxSuivi(Number(req.params.id))))
router.get('/:id/group-members',        wrap((req) => queries.getTravailGroupMembers(Number(req.params.id))))
router.post('/', validate(createAssignmentSchema), wrap((req) => queries.createTravail(req.body)))
router.post('/publish',                 wrap((req) => queries.updateTravailPublished(req.body)))
router.post('/group-member',            wrap((req) => queries.setTravailGroupMember(req.body)))
router.post('/:id/mark-missing',        wrap((req) => queries.markNonSubmittedAsD(Number(req.params.id))))
router.delete('/:id',                   wrap((req) => queries.deleteTravail(Number(req.params.id))))
router.patch('/:id',                    wrap((req) => queries.updateTravail(Number(req.params.id), req.body)))

module.exports = router
