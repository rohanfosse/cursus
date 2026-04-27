/**
 * Routes publiques Booking (page de reservation tuteur, sans auth Cursus).
 *   GET  /public/:token                   - infos event + student
 *   GET  /public/:token/slots             - creneaux dispos pour une semaine
 *   POST /public/:token/book              - reserve 1 creneau
 *   POST /public/:token/book-recurring    - reserve N semaines identiques
 */
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../../db/index')
const { validate } = require('../../middleware/validate')
const wrap    = require('../../utils/wrap')
const log     = require('../../utils/logger')
const graph   = require('../../services/microsoftGraph')
const email   = require('../../services/email')
const { getValidMsToken } = require('../../utils/msToken')
const { generateSlots }   = require('../../utils/slots')
const { secureToken }     = require('../../utils/secureToken')
const { escHtml, sanitizePlainText } = require('../../utils/escHtml')
const { generateJitsiUrl } = require('../../utils/jitsi')
const { getDb }           = require('../../db/connection')
const {
  SERVER_URL, GRAPH_TIMEOUT_MS,
  publicBookingLimiter, publicBookingPerTokenLimiter, requireBookingToken,
  withTimeout,
} = require('./_shared')

const bookSchema = z.object({
  tutorName: z.string().min(1).max(200),
  tutorEmail: z.string().email(),
  startDatetime: z.string().datetime(),
})

// Reservation publique (lien Calendly ouvert) : pas de student pre-rempli,
// donc le visiteur doit nous donner son nom + email lui-meme.
// `captchaToken` est emis par le widget Cloudflare Turnstile cote client.
// Optionnel cote schema (pour les envs sans Turnstile configure : dev / tests),
// mais devient obligatoire des que TURNSTILE_SECRET_KEY est positionne.
const publicBookSchema = z.object({
  attendeeName: z.string().min(1).max(200),
  attendeeEmail: z.string().email(),
  startDatetime: z.string().datetime(),
  captchaToken: z.string().min(1).max(2048).optional(),
})

// student_id sentinelle pour les reservations sur lien public ouvert.
const PUBLIC_STUDENT_ID = 0

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

// Defense-in-depth : en prod, l'absence de TURNSTILE_SECRET_KEY est tres
// probablement une erreur de config (var perdue dans un redeploy). On log
// une fois au demarrage pour qu'un humain s'en apercoive plutot que le
// captcha disparaisse silencieusement.
if (process.env.NODE_ENV === 'production' && !process.env.TURNSTILE_SECRET_KEY) {
  log.warn('TURNSTILE_SECRET_KEY missing in production — captcha public booking is OFF')
}

/**
 * Verifie un token Cloudflare Turnstile contre l'API officielle.
 * - Si TURNSTILE_SECRET_KEY n'est pas configure : on skip (mode dev / tests).
 * - Si configure : token obligatoire, on appelle l'API avec timeout 5s.
 * Retourne true si le token est valide, false sinon.
 */
async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // pas configure -> on n'impose pas le captcha
  if (!token) return false
  const params = new URLSearchParams()
  params.set('secret', secret)
  params.set('response', token)
  if (ip) params.set('remoteip', ip)
  try {
    const r = await withTimeout(
      fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body: params }),
      5_000,
      'turnstile_verify',
    )
    const json = await r.json()
    if (json.success !== true) {
      log.warn('turnstile_failed', { codes: json['error-codes'] })
    }
    return json.success === true
  } catch (err) {
    log.warn('turnstile_error', { error: err.message })
    // En cas d'erreur reseau on refuse plutot que de "fail open" — sinon
    // un attaquant peut bypass en sabotant l'appel API.
    return false
  }
}

// Slug = chaine de minuscules, chiffres et tirets, longueur 1..100. Doit
// matcher la regex utilisee dans teacherAdmin pour la creation d'event-type.
const SLUG_RE = /^[a-z0-9-]{1,100}$/

// Limiter par slug (parallele a publicBookingPerTokenLimiter, qui filtre par
// token nominatif). Empeche le bruteforce d'un slug.
const publicEventPerSlugLimiter = require('express-rate-limit')({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `slug:${req.params.slug || 'none'}`,
  message: { ok: false, error: 'Trop de tentatives sur ce lien.' },
})

const bookRecurringSchema = z.object({
  tutorName: z.string().min(1).max(200),
  tutorEmail: z.string().email(),
  startDatetime: z.string().datetime(),
  recurrenceWeeks: z.number().int().min(2).max(12),
})

// Horizon max d'une reservation (empeche les creneaux trop loin)
const MAX_BOOKING_HORIZON_DAYS = 365

// ── GET /public/:token ────────────────────────────────────────────────

router.get('/public/:token', publicBookingLimiter, publicBookingPerTokenLimiter, requireBookingToken, wrap((req) => {
  const data = req.bookingData
  return {
    eventTitle: data.event_title,
    description: data.description,
    durationMinutes: data.duration_minutes,
    teacherName: data.teacher_name,
    studentName: data.student_name,
    color: data.color,
    timezone: data.timezone || 'Europe/Paris',
  }
}))

// ── GET /public/:token/slots ──────────────────────────────────────────

router.get('/public/:token/slots', publicBookingLimiter, publicBookingPerTokenLimiter, requireBookingToken, async (req, res) => {
  try {
    const data = req.bookingData

    const rawOffset = Number(req.query.weekOffset || 0)
    const weekOffset = isNaN(rawOffset) ? 0 : Math.max(0, Math.min(52, Math.round(rawOffset)))
    const now = new Date()
    const dow = now.getDay()
    const daysSinceMonday = dow === 0 ? 6 : dow - 1
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - daysSinceMonday + weekOffset * 7)
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    const rules = queries.getAvailabilityRules(data.teacher_id)
    const existingBookings = queries.getBookingsForTeacher(
      data.teacher_id,
      { from: startOfWeek.toISOString(), to: endOfWeek.toISOString() },
    )

    let outlookBusy = []
    const msAccessToken = await getValidMsToken(data.teacher_id)
    if (msAccessToken) {
      try {
        outlookBusy = await withTimeout(
          graph.getCalendarBusy(msAccessToken, startOfWeek.toISOString(), endOfWeek.toISOString()),
          GRAPH_TIMEOUT_MS,
          'getCalendarBusy',
        )
      } catch (err) {
        log.warn('Outlook busy fetch failed', { error: err.message })
      }
    }

    const overrides = queries.getAvailabilityOverrides(
      data.event_type_id,
      startOfWeek.toISOString().slice(0, 10),
      endOfWeek.toISOString().slice(0, 10),
    )

    const slots = generateSlots({
      rules,
      bookings: existingBookings,
      outlookBusy,
      overrides,
      durationMinutes: data.duration_minutes,
      bufferMinutes: data.buffer_minutes || 0,
      weekStart: startOfWeek,
    })

    res.json({ ok: true, data: { slots, weekStart: startOfWeek.toISOString().slice(0, 10) } })
  } catch (err) {
    log.warn('slots_error', { error: err.message })
    res.status(400).json({ ok: false, error: 'Erreur lors du chargement des creneaux.' })
  }
})

// ── POST /public/:token/book ──────────────────────────────────────────

router.post('/public/:token/book', publicBookingLimiter, publicBookingPerTokenLimiter, requireBookingToken, validate(bookSchema), async (req, res) => {
  try {
    const data = req.bookingData
    const tutorName  = sanitizePlainText(req.body.tutorName, 200)
    const tutorEmail = req.body.tutorEmail
    const { startDatetime } = req.body
    if (!tutorName) return res.status(400).json({ ok: false, error: 'Nom invalide.' })

    const startMs = new Date(startDatetime).getTime()
    const now = Date.now()
    if (startMs < now) return res.status(400).json({ ok: false, error: 'Le creneau est dans le passe.' })
    if (startMs > now + MAX_BOOKING_HORIZON_DAYS * 24 * 3600000) {
      return res.status(400).json({ ok: false, error: 'Le creneau est trop eloigne.' })
    }

    const endDatetime = new Date(startMs + data.duration_minutes * 60000).toISOString()

    const booking = queries.createBookingAtomic({
      eventTypeId: data.event_type_id,
      studentId:   data.student_id,
      teacherId:   data.teacher_id,
      tutorName, tutorEmail,
      startDatetime, endDatetime,
      bufferMinutes: data.buffer_minutes || 0,
    })
    if (!booking) {
      return res.status(409).json({ ok: false, error: 'Ce creneau vient d\'etre reserve. Veuillez en choisir un autre.' })
    }

    // Visio : 3 modes par ordre de priorite
    //   1. use_jitsi=1 -> on genere un lien Jitsi unique (libre, no signup)
    //   2. Microsoft connecte -> Teams + Outlook event
    //   3. fallback_visio_url -> URL statique de l'event-type
    let teamsJoinUrl = null
    let outlookEventId = null
    if (data.use_jitsi) {
      teamsJoinUrl = generateJitsiUrl()
      queries.updateBookingTeamsInfo(booking.id, { teamsJoinUrl, outlookEventId: null })
    } else {
      teamsJoinUrl = data.fallback_visio_url || null
      const msAccessToken = await getValidMsToken(data.teacher_id)
      if (msAccessToken) {
        try {
          const result = await withTimeout(graph.createEventWithTeams(msAccessToken, {
            // Subject = plain text -> sanitizePlainText (escHtml introduirait &amp; et n'eliminerait pas CR/LF)
            subject: `${sanitizePlainText(data.event_title)} - ${sanitizePlainText(data.student_name)} / ${tutorName}`,
            startDateTime: startDatetime,
            endDateTime: endDatetime,
            attendees: [
              { email: tutorEmail, name: tutorName },
              { email: data.student_email, name: data.student_name },
            ],
            body: `<p>Rendez-vous ${escHtml(data.event_title)}</p><p>Etudiant : ${escHtml(data.student_name)}</p><p>Tuteur entreprise : ${escHtml(tutorName)}</p>`,
          }), GRAPH_TIMEOUT_MS, 'createEventWithTeams')
          teamsJoinUrl = result.teamsJoinUrl || teamsJoinUrl
          outlookEventId = result.eventId
          if (teamsJoinUrl || outlookEventId) {
            queries.updateBookingTeamsInfo(booking.id, { teamsJoinUrl, outlookEventId })
          }
        } catch (err) {
          log.warn('Teams/Outlook creation failed', { error: err.message })
        }
      }
    }

    const io = req.app.get('io')
    if (io) {
      io.to(`user:${data.teacher_id}`).emit('booking:new', {
        bookingId: booking.id,
        tutorName, studentName: data.student_name,
        eventTitle: data.event_title, startDatetime,
      })
    }

    // Reminders 24h avant (atomique : 2 inserts en tx)
    const reminderAt = new Date(new Date(startDatetime).getTime() - 24 * 3600000).toISOString()
    if (new Date(reminderAt) > new Date()) {
      try {
        getDb().transaction(() => {
          queries.createBookingReminder(booking.id, 'email_tutor_24h', reminderAt)
          queries.createBookingReminder(booking.id, 'email_teacher_24h', reminderAt)
        })()
      } catch (err) {
        log.warn('booking_reminder_insert_failed', { bookingId: booking.id, error: err.message })
      }
    }

    const cancelUrl = `${SERVER_URL}/#/book/cancel/${booking.cancel_token}`
    let emailSent = true
    try {
      await email.sendBookingConfirmation({
        to: tutorEmail, tutorName,
        teacherName: data.teacher_name, studentName: data.student_name,
        eventTitle: data.event_title,
        startDatetime, endDatetime, teamsJoinUrl, cancelUrl,
      })
    } catch (err) {
      emailSent = false
      log.warn('booking_email_failed', { bookingId: booking.id, error: err.message })
    }

    log.info('booking_created', { bookingId: booking.id, teacherId: data.teacher_id, hasTeams: !!teamsJoinUrl })
    res.json({
      ok: true,
      data: { bookingId: booking.id, teamsJoinUrl, startDatetime, endDatetime, emailSent },
    })
  } catch (err) {
    log.warn('booking_error', { error: err.message })
    res.status(400).json({ ok: false, error: 'Erreur lors de la reservation.' })
  }
})

// ── POST /public/:token/book-recurring ────────────────────────────────

router.post('/public/:token/book-recurring', publicBookingLimiter, publicBookingPerTokenLimiter, requireBookingToken, validate(bookRecurringSchema), async (req, res) => {
  try {
    const data = req.bookingData
    const tutorName  = sanitizePlainText(req.body.tutorName, 200)
    const tutorEmail = req.body.tutorEmail
    const { startDatetime, recurrenceWeeks } = req.body
    if (!tutorName) return res.status(400).json({ ok: false, error: 'Nom invalide.' })
    const durationMs = data.duration_minutes * 60000
    const recurrenceGroupId = secureToken()
    const db = getDb()
    const bufferMs = Math.max(0, Number(data.buffer_minutes) || 0) * 60000

    const tx = db.transaction(() => {
      const created = []
      for (let w = 0; w < recurrenceWeeks; w++) {
        const start = new Date(new Date(startDatetime).getTime() + w * 7 * 24 * 3600000)
        const end = new Date(start.getTime() + durationMs)
        const winStart = new Date(start.getTime() - bufferMs).toISOString()
        const winEnd   = new Date(end.getTime() + bufferMs).toISOString()

        const conflicts = db.prepare(`
          SELECT id FROM bookings WHERE teacher_id = ? AND status = 'confirmed'
          AND start_datetime < ? AND end_datetime > ?
        `).all(data.teacher_id, winEnd, winStart)

        if (conflicts.length > 0) {
          throw Object.assign(new Error(`Conflit semaine ${w + 1} : creneau deja pris`), { statusCode: 409 })
        }

        const cancelToken = secureToken()
        const result = db.prepare(`
          INSERT INTO bookings (event_type_id, student_id, teacher_id, tutor_name, tutor_email,
            start_datetime, end_datetime, cancel_token, recurrence_group_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(data.event_type_id, data.student_id, data.teacher_id,
          tutorName, tutorEmail, start.toISOString(), end.toISOString(), cancelToken, recurrenceGroupId)
        created.push(db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid))
      }
      return created
    })

    const createdBookings = tx()

    const first = createdBookings[0]
    const cancelUrl = `${SERVER_URL}/#/book/cancel/${first.cancel_token}`
    try {
      await email.sendBookingConfirmation({
        to: tutorEmail, tutorName,
        teacherName: data.teacher_name, studentName: data.student_name,
        eventTitle: `${data.event_title} (x${recurrenceWeeks} semaines)`,
        startDatetime: first.start_datetime, endDatetime: first.end_datetime,
        teamsJoinUrl: null, cancelUrl,
      })
    } catch (err) {
      log.warn('booking_recurring_email_failed', { bookingId: first.id, error: err.message })
    }

    log.info('booking_recurring_created', { count: createdBookings.length, teacherId: data.teacher_id, groupId: recurrenceGroupId })
    res.json({
      ok: true,
      data: {
        count: createdBookings.length,
        recurrenceGroupId,
        firstBooking: { id: first.id, startDatetime: first.start_datetime, endDatetime: first.end_datetime },
      },
    })
  } catch (err) {
    log.warn('recurring_booking_error', { error: err.message })
    const status = err.statusCode || (err.message?.includes('Conflit') ? 409 : 400)
    res.status(status).json({ ok: false, error: err.message || 'Erreur lors de la reservation recurrente.' })
  }
})

// ── Routes "lien public ouvert" (Calendly classique) ──────────────────
// Pas de token nominatif : tout le monde peut reserver via /event/:slug
// si l'enseignant a active is_public sur l'event-type.

function requirePublicEventType(req, res, next) {
  if (!SLUG_RE.test(req.params.slug || '')) {
    return res.status(404).json({ ok: false, error: 'Ce lien est invalide.', code: 'invalid_link' })
  }
  const data = queries.getPublicEventTypeBySlug(req.params.slug)
  if (!data) {
    return res.status(404).json({ ok: false, error: 'Ce lien n\'existe pas.', code: 'not_found' })
  }
  // Distingue "lien jamais active publiquement" et "page momentanement fermee"
  // pour permettre a l'etudiant de comprendre l'etat reel.
  if (!data.is_public) {
    return res.status(410).json({ ok: false, error: 'Ce prof n\'accepte plus de reservations via ce lien pour l\'instant.', code: 'closed' })
  }
  if (!data.event_type_active) {
    return res.status(410).json({ ok: false, error: 'Ce type de rendez-vous est temporairement desactive.', code: 'inactive' })
  }
  req.bookingData = data
  next()
}

// ── GET /public/event/:slug ───────────────────────────────────────────

router.get('/public/event/:slug', publicBookingLimiter, publicEventPerSlugLimiter, requirePublicEventType, wrap((req) => {
  const data = req.bookingData
  return {
    eventTitle: data.event_title,
    description: data.description,
    durationMinutes: data.duration_minutes,
    teacherName: data.teacher_name,
    color: data.color,
    timezone: data.timezone || 'Europe/Paris',
  }
}))

// ── GET /public/event/:slug/slots ─────────────────────────────────────

router.get('/public/event/:slug/slots', publicBookingLimiter, publicEventPerSlugLimiter, requirePublicEventType, async (req, res) => {
  try {
    const data = req.bookingData

    const rawOffset = Number(req.query.weekOffset || 0)
    const weekOffset = isNaN(rawOffset) ? 0 : Math.max(0, Math.min(52, Math.round(rawOffset)))
    const now = new Date()
    const dow = now.getDay()
    const daysSinceMonday = dow === 0 ? 6 : dow - 1
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - daysSinceMonday + weekOffset * 7)
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    const rules = queries.getAvailabilityRules(data.teacher_id)
    const existingBookings = queries.getBookingsForTeacher(
      data.teacher_id,
      { from: startOfWeek.toISOString(), to: endOfWeek.toISOString() },
    )

    let outlookBusy = []
    const msAccessToken = await getValidMsToken(data.teacher_id)
    if (msAccessToken) {
      try {
        outlookBusy = await withTimeout(
          graph.getCalendarBusy(msAccessToken, startOfWeek.toISOString(), endOfWeek.toISOString()),
          GRAPH_TIMEOUT_MS,
          'getCalendarBusy',
        )
      } catch (err) {
        log.warn('Outlook busy fetch failed', { error: err.message })
      }
    }

    const overrides = queries.getAvailabilityOverrides(
      data.event_type_id,
      startOfWeek.toISOString().slice(0, 10),
      endOfWeek.toISOString().slice(0, 10),
    )

    const slots = generateSlots({
      rules,
      bookings: existingBookings,
      outlookBusy,
      overrides,
      durationMinutes: data.duration_minutes,
      bufferMinutes: data.buffer_minutes || 0,
      weekStart: startOfWeek,
    })

    res.json({ ok: true, data: { slots, weekStart: startOfWeek.toISOString().slice(0, 10) } })
  } catch (err) {
    log.warn('public_slots_error', { error: err.message })
    res.status(400).json({ ok: false, error: 'Erreur lors du chargement des creneaux.' })
  }
})

// ── POST /public/event/:slug/book ─────────────────────────────────────

router.post('/public/event/:slug/book', publicBookingLimiter, publicEventPerSlugLimiter, requirePublicEventType, validate(publicBookSchema), async (req, res) => {
  try {
    const data = req.bookingData
    const attendeeName  = sanitizePlainText(req.body.attendeeName, 200)
    const attendeeEmail = req.body.attendeeEmail
    const { startDatetime, captchaToken } = req.body
    if (!attendeeName) return res.status(400).json({ ok: false, error: 'Nom invalide.' })

    // Verification anti-spam Cloudflare Turnstile (si configure cote env).
    const captchaOk = await verifyTurnstile(captchaToken, req.ip)
    if (!captchaOk) {
      return res.status(400).json({
        ok: false,
        error: 'Verification anti-spam echouee. Recharge la page et reessaie.',
        code: 'captcha_failed',
      })
    }

    const startMs = new Date(startDatetime).getTime()
    const now = Date.now()
    if (startMs < now) return res.status(400).json({ ok: false, error: 'Le creneau est dans le passe.' })
    if (startMs > now + MAX_BOOKING_HORIZON_DAYS * 24 * 3600000) {
      return res.status(400).json({ ok: false, error: 'Le creneau est trop eloigne.' })
    }

    const endDatetime = new Date(startMs + data.duration_minutes * 60000).toISOString()

    const booking = queries.createBookingAtomic({
      eventTypeId: data.event_type_id,
      studentId:   PUBLIC_STUDENT_ID,
      teacherId:   data.teacher_id,
      tutorName:   attendeeName,
      tutorEmail:  attendeeEmail,
      startDatetime, endDatetime,
      bufferMinutes: data.buffer_minutes || 0,
    })
    if (!booking) {
      return res.status(409).json({ ok: false, error: 'Ce creneau vient d\'etre reserve. Veuillez en choisir un autre.' })
    }

    // Visio : meme priorite que la route token nominatif (Jitsi > Teams > fallback URL).
    let teamsJoinUrl = null
    let outlookEventId = null
    if (data.use_jitsi) {
      teamsJoinUrl = generateJitsiUrl()
      queries.updateBookingTeamsInfo(booking.id, { teamsJoinUrl, outlookEventId: null })
    } else {
      teamsJoinUrl = data.fallback_visio_url || null
      const msAccessToken = await getValidMsToken(data.teacher_id)
      if (msAccessToken) {
        try {
          const result = await withTimeout(graph.createEventWithTeams(msAccessToken, {
            // Subject = plain text, attendeeName deja sanitize en haut.
            subject: `${sanitizePlainText(data.event_title)} - ${attendeeName}`,
            startDateTime: startDatetime,
            endDateTime: endDatetime,
            attendees: [
              { email: attendeeEmail, name: attendeeName },
            ],
            body: `<p>Rendez-vous ${escHtml(data.event_title)}</p><p>Avec : ${escHtml(attendeeName)} (${escHtml(attendeeEmail)})</p>`,
          }), GRAPH_TIMEOUT_MS, 'createEventWithTeams')
          teamsJoinUrl = result.teamsJoinUrl || teamsJoinUrl
          outlookEventId = result.eventId
          if (teamsJoinUrl || outlookEventId) {
            queries.updateBookingTeamsInfo(booking.id, { teamsJoinUrl, outlookEventId })
          }
        } catch (err) {
          log.warn('Teams/Outlook creation failed (public)', { error: err.message })
        }
      }
    }

    const io = req.app.get('io')
    if (io) {
      io.to(`user:${data.teacher_id}`).emit('booking:new', {
        bookingId: booking.id,
        tutorName: attendeeName,
        studentName: attendeeName,
        eventTitle: data.event_title,
        startDatetime,
      })
    }

    const reminderAt = new Date(new Date(startDatetime).getTime() - 24 * 3600000).toISOString()
    if (new Date(reminderAt) > new Date()) {
      try {
        getDb().transaction(() => {
          queries.createBookingReminder(booking.id, 'email_tutor_24h', reminderAt)
          queries.createBookingReminder(booking.id, 'email_teacher_24h', reminderAt)
        })()
      } catch (err) {
        log.warn('booking_reminder_insert_failed', { bookingId: booking.id, error: err.message })
      }
    }

    const cancelUrl = `${SERVER_URL}/#/book/cancel/${booking.cancel_token}`
    let emailSent = true
    try {
      await email.sendBookingConfirmation({
        to: attendeeEmail,
        tutorName: attendeeName,
        teacherName: data.teacher_name,
        studentName: attendeeName,
        eventTitle: data.event_title,
        startDatetime, endDatetime, teamsJoinUrl, cancelUrl,
      })
    } catch (err) {
      emailSent = false
      log.warn('booking_email_failed', { bookingId: booking.id, error: err.message })
    }

    log.info('public_booking_created', { bookingId: booking.id, teacherId: data.teacher_id, slug: data.slug, hasTeams: !!teamsJoinUrl })
    res.json({
      ok: true,
      data: { bookingId: booking.id, teamsJoinUrl, startDatetime, endDatetime, emailSent, cancelToken: booking.cancel_token },
    })
  } catch (err) {
    log.warn('public_booking_error', { error: err.message })
    res.status(400).json({ ok: false, error: 'Erreur lors de la reservation.' })
  }
})

// ── GET /public/event/:slug/booking/:bookingId/ics ────────────────────
// Telechargement ICS pour reservation faite via lien public.

router.get('/public/event/:slug/booking/:bookingId/ics', publicBookingLimiter, publicEventPerSlugLimiter, requirePublicEventType, (req, res) => {
  try {
    const bookingId = Number(req.params.bookingId)
    const booking = queries.getBookingById(bookingId)
    if (!booking || booking.event_type_id !== req.bookingData.event_type_id) {
      return res.status(404).json({ ok: false, error: 'Reservation introuvable' })
    }
    const { generateIcs } = require('../../utils/icsGenerator')
    const ics = generateIcs({
      title: `${booking.event_title} - ${booking.teacher_name}`,
      startDatetime: booking.start_datetime,
      endDatetime: booking.end_datetime,
      description: `Rendez-vous ${booking.event_title} avec ${booking.teacher_name}`,
      location: booking.teams_join_url || undefined,
    })
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="rdv.ics"')
    res.send(ics)
  } catch (err) {
    log.warn('public_ics_error', { error: err.message })
    res.status(400).json({ ok: false, error: 'Erreur lors de la generation du fichier calendrier.' })
  }
})

module.exports = router
