// ─── Routes travaux (assignments) ────────────────────────────────────────────
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap         = require('../utils/wrap')
const {
  requireRole, requirePromo, requirePromoAdmin,
  promoFromParam, promoFromChannel, promoFromTravail, promoFromBodyChannel,
  requireTravailOwner, requireReminderOwner,
} = require('../middleware/authorize')

/** Borne temporelle arbitraire (1er janvier 2020) — deadline anterieure = client casse. */
const MIN_DEADLINE_MS = new Date('2020-01-01T00:00:00Z').getTime()

function parseDateMs(s) {
  if (!s) return null
  const t = new Date(s).getTime()
  return Number.isFinite(t) ? t : null
}

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
  .refine(d => {
    const dl = parseDateMs(d.deadline)
    return dl != null && dl > MIN_DEADLINE_MS
  }, { message: 'Date limite invalide', path: ['deadline'] })
  .refine(d => {
    const start = parseDateMs(d.startDate ?? d.start_date)
    if (start == null) return true
    const dl = parseDateMs(d.deadline)
    return dl == null || start < dl
  }, { message: 'La date de début doit précéder la date limite', path: ['startDate'] })

router.get('/teacher-schedule',         requireRole('ta'), wrap(() => queries.getTeacherSchedule()))
router.get('/categories',               requirePromo(promoFromParam), wrap((req) => queries.getTravailCategories(Number(req.query.promoId))))
router.get('/gantt',                    requirePromo(promoFromParam), wrap((req) => queries.getGanttData(req.query.promoId ? Number(req.query.promoId) : null, req.query.channelId ? Number(req.query.channelId) : null)))
router.get('/rendus',                   requirePromo(promoFromParam), wrap((req) => queries.getAllRendus(req.query.promoId ? Number(req.query.promoId) : null)))
router.get('/',                         requirePromo(promoFromChannel), wrap((req) => queries.getTravaux(Number(req.query.channelId))))
router.get('/:id',                      requirePromo(promoFromTravail), wrap((req) => queries.getTravailById(Number(req.params.id))))
router.get('/:id/suivi',                requirePromo(promoFromTravail), wrap((req) => queries.getTravauxSuivi(Number(req.params.id))))
router.get('/:id/group-members',        requirePromo(promoFromTravail), wrap((req) => queries.getTravailGroupMembers(Number(req.params.id))))
// Creation d'un devoir : le teacher doit gerer la promo du canal cible.
// Avant : req.body.promoId/channelId etaient acceptes sans verifier l'ownership,
// permettant a tout teacher de creer des devoirs/soutenances dans une autre
// promo (perturbation calendrier, emails/notifs aux etudiants Y).
router.post('/',
  requireRole('teacher'),
  validate(createAssignmentSchema),
  requirePromoAdmin(promoFromBodyChannel),
  wrap((req) => queries.createTravail(req.body)),
)
router.post('/publish', requireRole('teacher'), requireTravailOwner, async (req, res) => {
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
// Schedule : ownership check via requireTravailOwner (qui supporte body.travailId).
// Avant : aucun check, tout teacher pouvait schedule la publication d'un devoir
// d'une autre promo.
router.post('/schedule', requireRole('teacher'), requireTravailOwner, wrap((req) => {
  const { travailId, scheduledAt } = req.body
  if (!travailId) throw new Error('travailId requis')
  return queries.updateTravail(travailId, { scheduledPublishAt: scheduledAt ?? null })
}))
// Group-member : verifie que le devoir cible appartient a la promo geree.
// Avant : aucun check, tout teacher pouvait modifier les groupes d'un devoir
// cross-promo.
router.post('/group-member', requireRole('teacher'), requireTravailOwner,
  wrap((req) => queries.setTravailGroupMember(req.body)),
)
router.post('/:id/mark-missing',        requireRole('teacher'), requireTravailOwner, wrap((req) => queries.markNonSubmittedAsD(Number(req.params.id))))
router.delete('/:id',                   requireRole('teacher'), requireTravailOwner, wrap((req) => queries.deleteTravail(Number(req.params.id))))
router.patch('/:id',                    requireRole('teacher'), requireTravailOwner, wrap((req) => queries.updateTravail(Number(req.params.id), req.body)))

// ── Rappels enseignant ────────────────────────────────────────────────────────
router.get('/reminders',    requireRole('teacher'), wrap((req) => queries.getReminders(req.query.promoTag || null)))
router.post('/reminders',   requireRole('teacher'), wrap((req) => {
  const { promoTag, date, title, description, bloc } = req.body
  if (!date || !title) throw new Error('date et title requis')
  return queries.createReminder({ promoTag, date, title, description, bloc })
}))
router.patch('/reminders/:id',  requireRole('teacher'), requireReminderOwner, wrap((req) => queries.updateReminder(Number(req.params.id), req.body)))
router.delete('/reminders/:id', requireRole('teacher'), requireReminderOwner, wrap((req) => {
  queries.deleteReminder(Number(req.params.id))
  return null
}))

module.exports = router
