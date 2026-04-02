// ─── Routes travaux (assignments) ────────────────────────────────────────────
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap         = require('../utils/wrap')
const { requireRole, requirePromo, promoFromParam, promoFromChannel, promoFromTravail, requireTravailOwner } = require('../middleware/authorize')

const createAssignmentSchema = z.object({
  title:       z.string().min(1, 'Titre requis').max(200, 'Titre trop long (max 200 caractères)'),
  description: z.string().max(5000).nullable().optional(),
  channelId:   z.number().int().positive('Canal invalide'),
  type:        z.enum(['livrable', 'soutenance', 'cctl', 'etude_de_cas', 'memoire', 'autre'], { message: 'Type de devoir invalide' }),
  deadline:    z.string().min(1, 'Date limite requise'),
  // Accept both camelCase and snake_case
  startDate:   z.string().nullable().optional(),
  start_date:  z.string().nullable().optional(),
  category:    z.string().max(100).nullable().optional(),
  assigned_to: z.enum(['all', 'group']).optional().default('all'),
  promoId:     z.number().int().nullable().optional(),
  groupId:     z.number().int().nullable().optional(),
  group_id:    z.number().int().nullable().optional(),
  room:        z.string().max(100).nullable().optional(),
  aavs:        z.string().max(2000).nullable().optional(),
  requires_submission: z.number().int().min(0).max(1).optional().default(1),
  published:   z.union([z.boolean(), z.number()]).optional(),
  scheduledPublishAt: z.string().nullable().optional(),
  scheduled_publish_at: z.string().nullable().optional(),
}).passthrough()

router.get('/teacher-schedule',         requireRole('ta'), wrap(() => queries.getTeacherSchedule()))
router.get('/categories',               requirePromo(promoFromParam), wrap((req) => queries.getTravailCategories(Number(req.query.promoId))))
router.get('/gantt',                    requirePromo(promoFromParam), wrap((req) => queries.getGanttData(req.query.promoId ? Number(req.query.promoId) : null, req.query.channelId ? Number(req.query.channelId) : null)))
router.get('/rendus',                   requirePromo(promoFromParam), wrap((req) => queries.getAllRendus(req.query.promoId ? Number(req.query.promoId) : null)))
router.get('/',                         requirePromo(promoFromChannel), wrap((req) => queries.getTravaux(Number(req.query.channelId))))
router.get('/:id',                      requirePromo(promoFromTravail), wrap((req) => queries.getTravailById(Number(req.params.id))))
router.get('/:id/suivi',                requirePromo(promoFromTravail), wrap((req) => queries.getTravauxSuivi(Number(req.params.id))))
router.get('/:id/group-members',        requirePromo(promoFromTravail), wrap((req) => queries.getTravailGroupMembers(Number(req.params.id))))
router.post('/', requireRole('teacher'), validate(createAssignmentSchema), wrap((req) => queries.createTravail(req.body)))
router.post('/publish', requireRole('teacher'), async (req, res) => {
  try {
    const result = queries.updateTravailPublished(req.body)
    // Notifier les etudiants quand un devoir est publie
    if (req.body.published && req.body.id) {
      const io = req.app.get('io')
      if (io) {
        const travail = queries.getTravailById?.(req.body.id)
        if (travail?.promo_id) {
          io.to(`promo:${travail.promo_id}`).emit('assignment:new', {
            title: travail.title,
            category: travail.category || null,
            deadline: travail.deadline || null,
            promoId: travail.promo_id,
          })
        }
      }
    }
    res.json({ ok: true, data: result })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})
router.post('/schedule', requireRole('teacher'), wrap((req) => {
  const { travailId, scheduledAt } = req.body
  if (!travailId) throw new Error('travailId requis')
  return queries.updateTravail(travailId, { scheduledPublishAt: scheduledAt ?? null })
}))
router.post('/group-member',            requireRole('teacher'), wrap((req) => queries.setTravailGroupMember(req.body)))
router.post('/:id/mark-missing',        requireRole('teacher'), requireTravailOwner, wrap((req) => queries.markNonSubmittedAsD(Number(req.params.id))))
router.delete('/:id',                   requireRole('teacher'), wrap((req) => queries.deleteTravail(Number(req.params.id))))
router.patch('/:id',                    requireRole('teacher'), wrap((req) => queries.updateTravail(Number(req.params.id), req.body)))

// ── Rappels enseignant ────────────────────────────────────────────────────────
router.get('/reminders',    requireRole('teacher'), wrap((req) => queries.getReminders(req.query.promoTag || null)))
router.post('/reminders',   requireRole('teacher'), wrap((req) => {
  const { promoTag, date, title, description, bloc } = req.body
  if (!date || !title) throw new Error('date et title requis')
  return queries.createReminder({ promoTag, date, title, description, bloc })
}))
router.patch('/reminders/:id',  requireRole('teacher'), wrap((req) => queries.updateReminder(Number(req.params.id), req.body)))
router.delete('/reminders/:id', requireRole('teacher'), wrap((req) => {
  queries.deleteReminder(Number(req.params.id))
  return null
}))

module.exports = router
