/**
 * Routes Booking Campaigns — admin enseignant.
 *   GET    /campaigns                       - liste les campagnes du prof
 *   POST   /campaigns                       - cree (status='draft', genere les invites)
 *   GET    /campaigns/:id                   - detail + invites
 *   PATCH  /campaigns/:id                   - edit (uniquement si draft pour les champs structurants)
 *   DELETE /campaigns/:id                   - supprime (uniquement si draft)
 *   POST   /campaigns/:id/launch            - envoie les mails -> status='active'
 *   POST   /campaigns/:id/remind            - relance les non-reserves
 *   POST   /campaigns/:id/close             - cloture manuellement -> status='closed'
 *   GET    /campaigns/:id/slots             - creneaux dispo (preview prof OU page etudiant)
 */
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../../db/index')
const { validate } = require('../../middleware/validate')
const wrap    = require('../../utils/wrap')
const log     = require('../../utils/logger')
const email   = require('../../services/email')
const { requireRole } = require('../../middleware/authorize')
const { ForbiddenError, NotFoundError, ValidationError } = require('../../utils/errors')
const { generateSlots } = require('../../utils/slots')
const { SERVER_URL } = require('./_shared')

// ── Schemas ────────────────────────────────────────────────────────────

const hebdoRuleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime:   z.string().regex(/^\d{2}:\d{2}$/),
}).refine(r => r.startTime < r.endTime, { message: 'startTime doit etre avant endTime' })

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD attendu')

// Champs de base — utilise par create (avec refine) et update (.partial())
const campaignFields = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  durationMinutes: z.number().int().min(5).max(480),
  bufferMinutes: z.number().int().min(0).max(60).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  startDate: isoDate,
  endDate: isoDate,
  hebdoRules: z.array(hebdoRuleSchema).min(1),
  excludedDates: z.array(isoDate).optional(),
  promoId: z.number().int().positive(),
  withTutor: z.boolean().optional(),
  notifyEmail: z.string().email().optional(),
  useJitsi: z.boolean().optional(),
  fallbackVisioUrl: z.string().url().refine(
    v => /^https?:\/\//i.test(v),
    { message: 'URL doit commencer par http:// ou https://' },
  ).optional().nullable(),
  timezone: z.string().max(50).optional(),
})

const createCampaignSchema = campaignFields.refine(
  c => c.startDate <= c.endDate,
  { message: 'endDate doit etre apres startDate' },
)

// .partial() sur les champs de base (zod refuse .partial sur un schema avec refine).
const updateCampaignSchema = campaignFields.partial()

// ── Helpers ────────────────────────────────────────────────────────────

function ownCampaignOr404(campaignId, teacherId) {
  const c = queries.getCampaignById(Number(campaignId))
  if (!c) throw new NotFoundError('Campagne introuvable')
  if (c.teacher_id !== teacherId) throw new ForbiddenError()
  return c
}

function parseCampaignJson(c) {
  return {
    ...c,
    hebdo_rules: safeJsonParse(c.hebdo_rules, []),
    excluded_dates: safeJsonParse(c.excluded_dates, []),
  }
}
function safeJsonParse(s, fallback) {
  try { return JSON.parse(s) } catch { return fallback }
}

/** Liste les bookings de la campagne pour eviter de regenerer un creneau pris. */
function getCampaignBookings(campaignId) {
  return queries._getDb
    ? queries._getDb().prepare("SELECT start_datetime, end_datetime FROM bookings WHERE campaign_id = ? AND status = 'confirmed'").all(campaignId)
    : require('../../db/connection').getDb().prepare("SELECT start_datetime, end_datetime FROM bookings WHERE campaign_id = ? AND status = 'confirmed'").all(campaignId)
}

// ── Routes admin (prof) ────────────────────────────────────────────────

router.get('/campaigns', requireRole('teacher'), wrap((req) => {
  return queries.getCampaigns(req.user.id).map(parseCampaignJson)
}))

router.post('/campaigns', requireRole('teacher'), validate(createCampaignSchema), wrap((req) => {
  const c = queries.createCampaign({ teacherId: req.user.id, ...req.body })
  // Auto-generer les invites pour la promo cible
  if (c.promo_id) {
    const students = queries.getStudents(c.promo_id) || []
    queries.ensureInvitesForStudents(c.id, students.map(s => s.id))
  }
  const refreshed = queries.getCampaignById(c.id)
  return { ...parseCampaignJson(refreshed), invites: queries.listInvites(c.id) }
}))

router.get('/campaigns/:id', requireRole('teacher'), wrap((req) => {
  const c = ownCampaignOr404(req.params.id, req.user.id)
  return { ...parseCampaignJson(c), invites: queries.listInvites(c.id) }
}))

router.patch('/campaigns/:id', requireRole('teacher'), validate(updateCampaignSchema), wrap((req) => {
  const c = ownCampaignOr404(req.params.id, req.user.id)
  if (c.status !== 'draft') {
    // Une fois lancee, on ne change que des champs cosmetiques pour ne pas
    // casser les liens deja distribues. On filtre en consequence.
    const allowedAfterLaunch = new Set(['title', 'description', 'color', 'notify_email', 'use_jitsi', 'fallback_visio_url'])
    for (const k of Object.keys(req.body)) {
      // Convertir camelCase -> snake_case pour comparer (notifyEmail -> notify_email, etc.)
      const snake = k.replace(/[A-Z]/g, m => '_' + m.toLowerCase())
      if (!allowedAfterLaunch.has(k) && !allowedAfterLaunch.has(snake)) {
        throw new ValidationError(`Champ "${k}" non modifiable apres lancement`)
      }
    }
  }
  // Mapper camelCase -> snake_case pour les champs structurants
  const fields = {}
  const map = {
    title: 'title', description: 'description', durationMinutes: 'duration_minutes',
    bufferMinutes: 'buffer_minutes', color: 'color', startDate: 'start_date', endDate: 'end_date',
    hebdoRules: 'hebdo_rules', excludedDates: 'excluded_dates', promoId: 'promo_id',
    withTutor: 'with_tutor', notifyEmail: 'notify_email', useJitsi: 'use_jitsi',
    fallbackVisioUrl: 'fallback_visio_url', timezone: 'timezone',
  }
  for (const [camel, snake] of Object.entries(map)) {
    if (req.body[camel] !== undefined) {
      let v = req.body[camel]
      if (typeof v === 'boolean') v = v ? 1 : 0
      fields[snake] = v
    }
  }
  const updated = queries.updateCampaign(c.id, fields)
  return parseCampaignJson(updated)
}))

router.delete('/campaigns/:id', requireRole('teacher'), wrap((req) => {
  const c = ownCampaignOr404(req.params.id, req.user.id)
  if (c.status === 'active') throw new ValidationError('Cloturer la campagne avant de la supprimer')
  // Refuser la suppression si la campagne a des reservations confirmees :
  // sinon perte de donnees historiques (planning, presence, etc.)
  const bookingsCount = queries.countCampaignBookings(c.id)
  if (bookingsCount > 0) {
    throw new ValidationError(`Cette campagne a ${bookingsCount} reservation(s). Cloture-la plutot que la supprimer.`)
  }
  queries.deleteCampaign(c.id)
  return null
}))

router.post('/campaigns/:id/launch', requireRole('teacher'), wrap(async (req) => {
  const c = ownCampaignOr404(req.params.id, req.user.id)
  if (c.status === 'closed') throw new ValidationError('Campagne deja cloturee')

  // Transition atomique draft -> active. Si la campagne etait deja active
  // (clic precedent encore en cours), changes() = 0 -> on rejette pour eviter
  // l'envoi double. Pour les campagnes deja active, on autorise le rejeu en
  // se basant sur l'idempotence (filtre `!invited_at`).
  if (c.status === 'draft') {
    const changed = queries.transitionCampaignStatus(c.id, 'draft', 'active', { launched_at: new Date().toISOString() })
    if (changed === 0) {
      // Une autre requete a deja active la campagne -> on stoppe.
      throw new ValidationError('Campagne deja en cours de lancement')
    }
  }

  // (Re)assure les invites pour la promo (au cas ou des etudiants ont ete ajoutes apres creation)
  if (c.promo_id) {
    const students = queries.getStudents(c.promo_id) || []
    queries.ensureInvitesForStudents(c.id, students.map(s => s.id))
  }
  const invites = queries.listInvites(c.id)
  // N'envoyer le mail qu'aux invites pas encore notifiees (idempotent)
  const toSend = invites.filter(i => !i.invited_at)
  const sentIds = []
  for (const inv of toSend) {
    if (!inv.student_email) continue
    const ok = await email.sendCampaignInvite({
      to: inv.student_email,
      studentName: inv.student_name,
      teacherName: req.user.name || 'Cursus',
      campaignTitle: c.title,
      campaignDescription: c.description,
      bookingUrl: `${SERVER_URL}/#/book/c/${inv.token}`,
      notifyEmail: c.notify_email || null,
      deadlineDate: c.end_date,
    })
    if (ok) sentIds.push(inv.id)
  }
  queries.markInviteSent(sentIds, 'invited')
  log.info('campaign_launched', { campaignId: c.id, teacherId: req.user.id, sent: sentIds.length, total: toSend.length })
  return { sent: sentIds.length, skipped: toSend.length - sentIds.length, alreadyInvited: invites.length - toSend.length }
}))

router.post('/campaigns/:id/remind', requireRole('teacher'), wrap(async (req) => {
  const c = ownCampaignOr404(req.params.id, req.user.id)
  if (c.status !== 'active') throw new ValidationError('La campagne doit etre active pour relancer')
  const pending = queries.listPendingInvites(c.id)
  const sentIds = []
  for (const inv of pending) {
    if (!inv.student_email) continue
    const ok = await email.sendCampaignInvite({
      to: inv.student_email,
      studentName: inv.student_name,
      teacherName: req.user.name || 'Cursus',
      campaignTitle: `Rappel : ${c.title}`,
      campaignDescription: c.description,
      bookingUrl: `${SERVER_URL}/#/book/c/${inv.token}`,
      notifyEmail: c.notify_email || null,
      deadlineDate: c.end_date,
    })
    if (ok) sentIds.push(inv.id)
  }
  queries.markInviteSent(sentIds, 'reminder')
  log.info('campaign_reminded', { campaignId: c.id, teacherId: req.user.id, sent: sentIds.length, pending: pending.length })
  return { sent: sentIds.length, pending: pending.length }
}))

router.post('/campaigns/:id/close', requireRole('teacher'), wrap((req) => {
  const c = ownCampaignOr404(req.params.id, req.user.id)
  queries.updateCampaign(c.id, { status: 'closed' })
  return parseCampaignJson(queries.getCampaignById(c.id))
}))

// Preview slots cote prof (memes regles que l'etudiant). Utilise pour la modal preview.
router.get('/campaigns/:id/slots', requireRole('teacher'), wrap(async (req) => {
  const c = ownCampaignOr404(req.params.id, req.user.id)
  return computeCampaignSlots(parseCampaignJson(c))
}))

// ── Slots computation (partage entre admin preview et route publique) ──

async function computeCampaignSlots(campaignParsed) {
  const c = campaignParsed
  const start = new Date(c.start_date + 'T00:00:00')
  const end = new Date(c.end_date + 'T23:59:59')
  const now = new Date()
  // Demarre au plus tard d'aujourd'hui ou start_date (pas de slot dans le passe)
  const effectiveStart = start < now ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) : start
  const daysCount = Math.max(0, Math.ceil((end - effectiveStart) / (24 * 3600 * 1000)) + 1)

  // Convertit hebdo_rules vers le format generateSlots (day_of_week / start_time / end_time)
  const rules = (c.hebdo_rules || []).map(r => ({
    day_of_week: r.dayOfWeek,
    start_time: r.startTime,
    end_time: r.endTime,
  }))

  // Convertit excluded_dates en overrides bloquantes journee complete
  const overrides = (c.excluded_dates || []).map(d => ({
    override_date: d, start_time: null, end_time: null, is_blocked: 1,
  }))

  const bookings = getCampaignBookings(c.id)

  return generateSlots({
    rules,
    bookings,
    outlookBusy: [],
    durationMinutes: c.duration_minutes,
    bufferMinutes: c.buffer_minutes || 0,
    weekStart: effectiveStart,
    overrides,
    daysCount,
  })
}

module.exports = router
module.exports.computeCampaignSlots = computeCampaignSlots
