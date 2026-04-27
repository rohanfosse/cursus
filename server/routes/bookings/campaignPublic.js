/**
 * Routes publiques pour les invitations campagne.
 *   GET  /public/campaign/:token            - infos campagne + etudiant identifie
 *   GET  /public/campaign/:token/slots      - creneaux dispo
 *   POST /public/campaign/:token/book       - reservation tripartite (etudiant + tuteur + prof)
 *
 * Le token vaut pour 1 etudiant / 1 campagne. Une fois reserve, l'invite
 * porte le booking_id et la page affiche directement la confirmation.
 */
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../../db/index')
const { validate } = require('../../middleware/validate')
const wrap    = require('../../utils/wrap')
const log     = require('../../utils/logger')
const email   = require('../../services/email')
const rateLimit = require('express-rate-limit')
const { sanitizePlainText } = require('../../utils/escHtml')
const { generateIcs } = require('../../utils/icsGenerator')
const { generateJitsiUrl } = require('../../utils/jitsi')
const { secureToken } = require('../../utils/secureToken')
const { computeCampaignSlots } = require('./campaigns')
const { SERVER_URL, publicBookingLimiter } = require('./_shared')

const perTokenLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `campaignToken:${req.params.token || 'none'}`,
  message: { ok: false, error: 'Trop de tentatives sur ce lien.' },
})

const bookSchema = z.object({
  studentEmail: z.string().email().optional(),
  tutorName: z.string().min(1).max(200).optional(),
  tutorEmail: z.string().email().optional(),
  startDatetime: z.string().datetime(),
})

function loadInviteContext(req, res, next) {
  const data = queries.getCampaignByInviteToken(req.params.token)
  if (!data) return res.status(404).json({ ok: false, error: 'Lien introuvable.', code: 'not_found' })
  if (data.status === 'closed') return res.status(410).json({ ok: false, error: 'Campagne cloturee.', code: 'closed' })
  // Une campagne en draft signifie que les mails ne sont pas encore envoyes ;
  // on accepte quand meme l'acces si quelqu'un a recupere le lien (preview).
  req.inviteData = data
  next()
}

// ── GET /public/campaign/:token ─────────────────────────────────────────

router.get('/public/campaign/:token', publicBookingLimiter, perTokenLimiter, loadInviteContext, wrap((req) => {
  const d = req.inviteData
  // Si une reservation existe deja pour cette invite, on la retourne -> la page
  // affiche directement la confirmation sans laisser reserver une 2e fois.
  let existingBooking = null
  if (d.booking_id) {
    const b = queries.getBookingById(d.booking_id)
    if (b && b.status === 'confirmed') {
      existingBooking = {
        bookingId: b.id,
        startDatetime: b.start_datetime,
        endDatetime: b.end_datetime,
        joinUrl: b.teams_join_url || null,
        cancelToken: b.cancel_token,
      }
    }
  }
  return {
    campaignTitle: d.title,
    description: d.description,
    durationMinutes: d.duration_minutes,
    color: d.color,
    teacherName: d.teacher_name,
    studentName: d.student_name,
    studentEmail: d.student_email,
    withTutor: !!d.with_tutor,
    startDate: d.start_date,
    endDate: d.end_date,
    timezone: d.timezone || 'Europe/Paris',
    status: d.status,
    existingBooking,
  }
}))

// ── GET /public/campaign/:token/slots ───────────────────────────────────

router.get('/public/campaign/:token/slots', publicBookingLimiter, perTokenLimiter, loadInviteContext, async (req, res) => {
  try {
    const c = req.inviteData
    // Reconstruit le shape attendu par computeCampaignSlots (json -> array)
    const parsed = {
      ...c,
      id: c.campaign_id || c.id, // selon route campagne ou invite
      hebdo_rules: safeJsonParse(c.hebdo_rules, []),
      excluded_dates: safeJsonParse(c.excluded_dates, []),
    }
    // Recuperer l'id de la campagne (le SELECT renvoie c.* donc id = celui de la campagne)
    parsed.id = c.id || parsed.id
    const slots = await computeCampaignSlots(parsed)
    res.json({ ok: true, data: { slots } })
  } catch (err) {
    log.warn('campaign_slots_error', { error: err.message })
    res.status(400).json({ ok: false, error: 'Erreur lors du chargement des creneaux.' })
  }
})

// ── POST /public/campaign/:token/book ───────────────────────────────────

router.post('/public/campaign/:token/book', publicBookingLimiter, perTokenLimiter, loadInviteContext, validate(bookSchema), async (req, res) => {
  try {
    const c = req.inviteData
    if (c.booking_id) {
      const existing = queries.getBookingById(c.booking_id)
      if (existing && existing.status === 'confirmed') {
        return res.status(409).json({ ok: false, error: 'Tu as deja reserve un creneau pour cette campagne.', code: 'already_booked' })
      }
    }

    const tutorName  = c.with_tutor ? sanitizePlainText(req.body.tutorName, 200) : null
    const tutorEmail = c.with_tutor ? req.body.tutorEmail : null
    if (c.with_tutor && (!tutorName || !tutorEmail)) {
      return res.status(400).json({ ok: false, error: 'Nom et email du tuteur entreprise requis.' })
    }
    const studentEmail = req.body.studentEmail || c.student_email
    const { startDatetime } = req.body

    const startMs = new Date(startDatetime).getTime()
    if (startMs <= Date.now()) {
      return res.status(400).json({ ok: false, error: 'Le creneau est dans le passe.' })
    }
    const endDatetime = new Date(startMs + c.duration_minutes * 60000).toISOString()

    // Verifier que le creneau est dans la fenetre + non bloque + pas deja pris
    const startDay = new Date(startDatetime).toISOString().slice(0, 10)
    if (startDay < c.start_date || startDay > c.end_date) {
      return res.status(400).json({ ok: false, error: 'Creneau hors de la periode de la campagne.' })
    }

    // Utilise l'event_type "fantome" cree avec la campagne (createCampaign).
    // Permet de respecter la FK bookings.event_type_id sans polluer la liste
    // publique d'event-types (filtree via slug __campaign_%).
    const booking = queries.createBookingAtomic({
      eventTypeId: c.event_type_id,
      studentId:   c.student_id,
      teacherId:   c.teacher_id,
      tutorName:   tutorName || c.student_name,
      tutorEmail:  tutorEmail || studentEmail,
      startDatetime, endDatetime,
      bufferMinutes: c.buffer_minutes || 0,
    })
    if (!booking) {
      return res.status(409).json({ ok: false, error: 'Ce creneau vient d\'etre pris. Choisis-en un autre.' })
    }

    // Lier explicitement a la campagne pour que getCampaignBookings le trouve
    // (et pour le futur retrieve via dashboard).
    require('../../db/connection').getDb()
      .prepare('UPDATE bookings SET campaign_id = ? WHERE id = ?')
      .run(c.id, booking.id)

    queries.attachBookingToInvite(c.invite_id, booking.id)

    // Visio : Jitsi en priorite, sinon fallback URL configuree sur la campagne
    let joinUrl = null
    if (c.use_jitsi) {
      joinUrl = generateJitsiUrl()
    } else if (c.fallback_visio_url) {
      joinUrl = c.fallback_visio_url
    }
    if (joinUrl) {
      queries.updateBookingTeamsInfo(booking.id, { teamsJoinUrl: joinUrl, outlookEventId: null })
    }

    // Generer l'ICS avec attendees pour vrai invite (METHOD:REQUEST)
    const attendees = []
    if (studentEmail) attendees.push({ email: studentEmail, name: c.student_name })
    if (tutorEmail) attendees.push({ email: tutorEmail, name: tutorName })
    const teacherEmail = c.notify_email || null
    if (teacherEmail) attendees.push({ email: teacherEmail, name: c.teacher_name })

    const cancelUrl = `${SERVER_URL}/#/book/cancel/${booking.cancel_token}`
    const icsContent = generateIcs({
      title: `${c.title} - ${c.student_name}`,
      startDatetime, endDatetime,
      description: c.description ? `${c.description}\n\nVisio : ${joinUrl || ''}\nAnnuler : ${cancelUrl}` : `Visio : ${joinUrl || ''}\nAnnuler : ${cancelUrl}`,
      location: joinUrl || undefined,
      organizerEmail: teacherEmail || 'noreply@cursus.school',
      organizerName: c.teacher_name,
      attendees,
      uid: `campaign-${c.id}-booking-${booking.id}@cursus.school`,
      method: 'REQUEST',
    })

    const sent = await email.sendTripartiteConfirmation({
      studentEmail,
      studentName: c.student_name,
      tutorEmail,
      tutorName,
      teacherEmail,
      teacherName: c.teacher_name,
      eventTitle: c.title,
      startDatetime, endDatetime,
      joinUrl,
      cancelUrl,
      icsContent,
    })

    // Reminder 24h avant
    const reminderAt = new Date(startMs - 24 * 3600000).toISOString()
    if (new Date(reminderAt) > new Date()) {
      try {
        queries.createBookingReminder(booking.id, 'email_tutor_24h', reminderAt)
      } catch { /* ignore */ }
    }

    // Socket push au prof
    const io = req.app.get('io')
    if (io) {
      io.to(`user:${c.teacher_id}`).emit('booking:new', {
        bookingId: booking.id,
        tutorName: tutorName || c.student_name,
        studentName: c.student_name,
        eventTitle: c.title,
        startDatetime,
      })
    }

    log.info('campaign_booking_created', { campaignId: c.id, bookingId: booking.id, inviteId: c.invite_id, emailSent: sent })
    res.json({ ok: true, data: {
      bookingId: booking.id,
      startDatetime, endDatetime,
      joinUrl,
      cancelToken: booking.cancel_token,
      emailSent: sent,
    } })
  } catch (err) {
    log.warn('campaign_booking_error', { error: err.message })
    res.status(400).json({ ok: false, error: 'Erreur lors de la reservation.' })
  }
})

function safeJsonParse(s, fallback) {
  if (Array.isArray(s)) return s
  try { return JSON.parse(s) } catch { return fallback }
}

module.exports = router
