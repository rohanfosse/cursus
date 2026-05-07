/**
 * Routes : abonnements ICS externes par promo.
 *
 * Cas d'usage : un prof publie un calendrier dans Outlook ("Publier un
 * calendrier" — donne une URL .ics publique), colle l'URL ici, et tous
 * les events sont visibles dans le calendrier des etudiants de la promo.
 *
 * Endpoints :
 *   POST   /api/calendar-subscriptions              creer (teacher only)
 *   GET    /api/calendar-subscriptions              lister les siens (teacher only)
 *   PATCH  /api/calendar-subscriptions/:id          renommer / activer / desactiver (teacher only)
 *   DELETE /api/calendar-subscriptions/:id          supprimer (teacher only)
 *   POST   /api/calendar-subscriptions/:id/refresh  forcer un refresh maintenant
 *   GET    /api/calendar-subscriptions/promo/:promoId/events  events caches (etudiants + profs)
 */
const router = require('express').Router()
const { z } = require('zod')
const queries = require('../db/index')
const wrap = require('../utils/wrap')
const { validate } = require('../middleware/validate')
const { requireRole } = require('../middleware/authorize')
const { ForbiddenError, NotFoundError, ValidationError } = require('../utils/errors')
const { fetchAndParseIcs } = require('../services/icsParser')
const log = require('../utils/logger')

const subs = queries.promoCalendarSubscriptions

const createSchema = z.object({
  promo_id: z.number().int().positive(),
  label: z.string().min(1).max(120),
  ics_url: z.string().url().max(2000),
  color: z.string().max(20).optional().nullable(),
})

const updateSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  color: z.string().max(20).nullable().optional(),
  is_active: z.boolean().optional(),
})

/**
 * Refresh : fetch + parse + replace events. Met a jour markFetched.
 * Centralise pour reuse entre POST create, POST refresh, et le cron.
 */
async function refreshSubscription(id) {
  const raw = subs.getRawById(id)
  if (!raw) return { ok: false, error: 'Abonnement introuvable' }
  if (!raw.ics_url) return { ok: false, error: 'URL ICS manquante' }
  const result = await fetchAndParseIcs(raw.ics_url)
  if (!result.ok) {
    subs.markFetched(id, { eventCount: 0, error: result.error })
    log.warn('calendar_subscription_fetch_failed', { id, error: result.error })
    return { ok: false, error: result.error }
  }
  subs.replaceEvents(id, result.events)
  subs.markFetched(id, { eventCount: result.events.length, error: null })
  log.info('calendar_subscription_refreshed', { id, count: result.events.length })
  return { ok: true, eventCount: result.events.length }
}

// ── Listing / CRUD (teacher only) ─────────────────────────────────────────

router.get('/', requireRole('teacher'), wrap((req) => {
  return subs.listForTeacher(req.user.id)
}))

router.post('/', requireRole('teacher'), validate(createSchema), wrap(async (req) => {
  const { promo_id, label, ics_url, color } = req.body
  const created = subs.createSubscription({
    promoId: promo_id,
    teacherId: req.user.id,
    label,
    icsUrl: ics_url,
    color: color || null,
  })
  // Premier fetch immediatement pour valider l'URL et populer le cache.
  // Si le fetch echoue, on garde l'abonnement (l'erreur est exposee dans
  // last_error et le prof peut retenter via /refresh).
  await refreshSubscription(created.id)
  return subs.getById(created.id)
}))

router.patch('/:id', requireRole('teacher'), validate(updateSchema), wrap((req) => {
  const id = Number(req.params.id)
  const sub = subs.getById(id)
  if (!sub) throw new NotFoundError('Abonnement introuvable')
  if (sub.teacher_id !== req.user.id) throw new ForbiddenError("Vous n'etes pas proprietaire de cet abonnement")
  return subs.updateSubscription(id, {
    label: req.body.label,
    color: req.body.color,
    isActive: req.body.is_active,
  })
}))

router.delete('/:id', requireRole('teacher'), wrap((req) => {
  const id = Number(req.params.id)
  const sub = subs.getById(id)
  if (!sub) throw new NotFoundError('Abonnement introuvable')
  if (sub.teacher_id !== req.user.id) throw new ForbiddenError("Vous n'etes pas proprietaire de cet abonnement")
  subs.deleteSubscription(id)
  return { id }
}))

router.post('/:id/refresh', requireRole('teacher'), wrap(async (req) => {
  const id = Number(req.params.id)
  const sub = subs.getById(id)
  if (!sub) throw new NotFoundError('Abonnement introuvable')
  if (sub.teacher_id !== req.user.id) throw new ForbiddenError("Vous n'etes pas proprietaire de cet abonnement")
  const result = await refreshSubscription(id)
  if (!result.ok) throw new ValidationError(`Refresh invalide : ${result.error}`)
  return subs.getById(id)
}))

// ── Events (lecture pour profs ET etudiants de la promo) ─────────────────

router.get('/promo/:promoId/events', wrap((req) => {
  const promoId = Number(req.params.promoId)
  if (!Number.isFinite(promoId)) throw new ValidationError('promoId invalide')

  // Etudiants : seulement leur propre promo
  if (req.user.type === 'student' && req.user.promo_id !== promoId) {
    throw new ForbiddenError('Acces interdit a cette promo')
  }

  const from = typeof req.query.from === 'string' ? req.query.from : undefined
  const to   = typeof req.query.to   === 'string' ? req.query.to   : undefined
  return subs.getEventsForPromo(promoId, { from, to })
}))

/**
 * GET /events — events agreges pour l'agenda du user connecte.
 *   - teacher : tous les events des abonnements qu'il a crees (toutes ses promos)
 *   - student : events des abonnements actifs sur sa propre promo
 *
 * Format : `{ id, subscription_id, label, color, start_at, end_at, is_all_day,
 *             summary, location, promo_id, promo_name }`
 */
router.get('/events', wrap((req) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined
  const to   = typeof req.query.to   === 'string' ? req.query.to   : undefined
  const isTeacher = req.user.type === 'teacher' || req.user.type === 'admin' || req.user.type === 'ta'

  // Recupere les promo_ids cibles selon le role
  let promoIds = []
  if (isTeacher) {
    const mine = subs.listForTeacher(req.user.id)
    promoIds = [...new Set(mine.filter(s => s.is_active).map(s => s.promo_id))]
  } else if (req.user.promo_id) {
    promoIds = [req.user.promo_id]
  }

  const out = []
  for (const promoId of promoIds) {
    const events = subs.getEventsForPromo(promoId, { from, to })
    for (const ev of events) out.push({ ...ev, promo_id: promoId })
  }
  return out
}))

module.exports = router
module.exports.refreshSubscription = refreshSubscription
