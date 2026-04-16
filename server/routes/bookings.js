/**
 * Routes Booking — API enseignant pour gerer les types d'evenements,
 * regles de disponibilite, tokens de reservation et reservations.
 * + Routes publiques pour la page de reservation tuteur.
 */
const router  = require('express').Router()
const crypto  = require('crypto')
const { z }   = require('zod')
const rateLimit = require('express-rate-limit')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap    = require('../utils/wrap')
const { requireRole } = require('../middleware/authorize')
const { ForbiddenError, ValidationError } = require('../utils/errors')
const log     = require('../utils/logger')
const graph   = require('../services/microsoftGraph')
const email   = require('../services/email')
const { encrypt, decrypt } = require('../utils/crypto')
const { getValidMsToken } = require('../utils/msToken')
const { generateSlots }    = require('../utils/slots')
const { cancelConfirmationPage } = require('../utils/htmlTemplates')
const { generateIcs }      = require('../utils/icsGenerator')

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001'

// ── Rate limiter pour les routes publiques (anti-abus) ────────────────────
const publicBookingLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyGenerator: (req) => req.ip,
  message: { ok: false, error: 'Trop de tentatives. Reessayez dans une minute.' },
})

// ── OAuth state CSRF protection ───────────────────────────────────────────
const oauthStates = new Map() // nonce -> { teacherId, expiresAt }

function generateOAuthState(teacherId) {
  const nonce = crypto.randomBytes(32).toString('hex')
  oauthStates.set(nonce, { teacherId, expiresAt: Date.now() + 10 * 60 * 1000 }) // 10 min
  // Cleanup expired states
  for (const [key, val] of oauthStates) {
    if (val.expiresAt < Date.now()) oauthStates.delete(key)
  }
  return nonce
}

function validateOAuthState(nonce) {
  const entry = oauthStates.get(nonce)
  if (!entry || entry.expiresAt < Date.now()) {
    oauthStates.delete(nonce)
    return null
  }
  oauthStates.delete(nonce)
  return entry.teacherId
}

const { escHtml } = require('../utils/escHtml')


/** Middleware: resolve booking token and attach data to req */
function requireBookingToken(req, res, next) {
  const data = queries.getTokenData(req.params.token)
  if (!data || !data.event_type_active) {
    return res.status(404).json({ ok: false, error: 'Lien de reservation invalide ou desactive' })
  }
  req.bookingData = data
  next()
}

// ── Schemas ────────────────────────────────────────────────────────────

const createEventTypeSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  color: z.string().max(20).regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  fallbackVisioUrl: z.string().url().optional().nullable(),
  bufferMinutes: z.number().int().min(0).max(60).optional(),
  timezone: z.string().max(50).optional(),
})

const updateEventTypeSchema = createEventTypeSchema.partial()

const availabilitySchema = z.object({
  rules: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })).refine(
    rules => rules.every(r => r.startTime < r.endTime),
    { message: 'startTime doit etre avant endTime' },
  ),
})

const bookSchema = z.object({
  tutorName: z.string().min(1).max(200),
  tutorEmail: z.string().email(),
  startDatetime: z.string().datetime(),
})

// ── Event Types (prof) ──────────────────────────────────────────────────

router.get('/event-types', requireRole('teacher'), wrap((req) => {
  return queries.getEventTypes(req.user.id)
}))

router.post('/event-types', requireRole('teacher'), validate(createEventTypeSchema), wrap((req) => {
  return queries.createEventType({ teacherId: req.user.id, ...req.body })
}))

router.patch('/event-types/:id', requireRole('teacher'), validate(updateEventTypeSchema), wrap((req) => {
  const et = queries.getEventTypeById(Number(req.params.id))
  if (!et || et.teacher_id !== req.user.id) throw new ForbiddenError()
  return queries.updateEventType(Number(req.params.id), req.body)
}))

router.delete('/event-types/:id', requireRole('teacher'), wrap((req) => {
  const et = queries.getEventTypeById(Number(req.params.id))
  if (!et || et.teacher_id !== req.user.id) throw new ForbiddenError()
  queries.deleteEventType(Number(req.params.id))
  return null
}))

// ── Availability Rules (prof) ───────────────────────────────────────────

router.get('/availability', requireRole('teacher'), wrap((req) => {
  return queries.getAvailabilityRules(req.user.id)
}))

router.put('/availability', requireRole('teacher'), validate(availabilitySchema), wrap((req) => {
  return queries.setAvailabilityRules(req.user.id, req.body.rules)
}))

// ── Availability Overrides (prof) ───────────────────────────────────────

router.get('/event-types/:id/overrides', requireRole('teacher'), wrap((req) => {
  const et = queries.getEventTypeById(Number(req.params.id))
  if (!et || et.teacher_id !== req.user.id) throw new ForbiddenError()
  return queries.getAvailabilityOverrides(et.id)
}))

router.put('/event-types/:id/overrides', requireRole('teacher'), wrap((req) => {
  const et = queries.getEventTypeById(Number(req.params.id))
  if (!et || et.teacher_id !== req.user.id) throw new ForbiddenError()
  const overrides = req.body.overrides || []
  return queries.setAvailabilityOverrides(et.id, overrides)
}))

// ── Booking Tokens (prof) ───────────────────────────────────────────────

router.post('/tokens', requireRole('teacher'), wrap((req) => {
  const { eventTypeId, studentId } = req.body
  if (!eventTypeId || !studentId) throw new ValidationError('eventTypeId et studentId requis')
  const et = queries.getEventTypeById(eventTypeId)
  if (!et || et.teacher_id !== req.user.id) throw new ForbiddenError()
  const tokenData = queries.getOrCreateToken(eventTypeId, studentId)
  return {
    ...tokenData,
    bookingUrl: `${SERVER_URL}/api/bookings/public/${tokenData.token}`,
  }
}))

router.post('/tokens/bulk', requireRole('teacher'), wrap((req) => {
  const { eventTypeId, promoId } = req.body
  if (!eventTypeId || !promoId) throw new ValidationError('eventTypeId et promoId requis')
  const et = queries.getEventTypeById(eventTypeId)
  if (!et || et.teacher_id !== req.user.id) throw new ForbiddenError()
  const students = queries.getStudents?.(promoId) ?? []
  const results = students.map(s => {
    const tokenData = queries.getOrCreateToken(eventTypeId, s.id)
    return {
      studentId: s.id,
      studentName: s.name,
      bookingUrl: `${SERVER_URL}/api/bookings/public/${tokenData.token}`,
    }
  })
  return results
}))

// ── My Bookings (prof) ──────────────────────────────────────────────────

router.get('/my-bookings', requireRole('teacher'), wrap((req) => {
  const from = req.query.from && !isNaN(Date.parse(req.query.from)) ? req.query.from : undefined
  const to = req.query.to && !isNaN(Date.parse(req.query.to)) ? req.query.to : undefined
  return queries.getBookingsForTeacher(req.user.id, { from, to })
}))

// ── Microsoft OAuth ─────────────────────────────────────────────────────

router.get('/oauth/start', requireRole('teacher'), async (req, res) => {
  if (!graph.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Azure AD non configure. Contactez l\'administrateur.' })
  }
  const state = generateOAuthState(req.user.id)
  const url = await graph.getAuthUrl(state)
  if (!url) return res.status(500).json({ ok: false, error: 'Impossible de generer l\'URL OAuth' })
  res.json({ ok: true, data: { url } })
})

router.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query
    if (!code) throw new Error('Code manquant')
    const teacherId = validateOAuthState(String(state || ''))
    if (!teacherId) throw new Error('State OAuth invalide ou expire')
    const result = await graph.acquireTokenByCode(String(code))
    // Store tokens encrypted (AES-256-GCM via crypto.js)
    queries.saveMicrosoftToken(teacherId, {
      accessTokenEnc: encrypt(result.accessToken),
      refreshTokenEnc: encrypt(JSON.stringify(result.account || {})),
      expiresAt: result.expiresOn?.toISOString() || new Date(Date.now() + 3600000).toISOString(),
    })
    // Redirect back to Cursus settings
    res.redirect(`${SERVER_URL}/#/settings?oauth=success`)
  } catch (err) {
    log.warn('Booking OAuth callback error', { error: err.message })
    res.redirect(`${SERVER_URL}/#/settings?oauth=error`)
  }
})

router.get('/oauth/status', requireRole('teacher'), wrap((req) => {
  const token = queries.getMicrosoftToken(req.user.id)
  return { connected: !!token, expiresAt: token?.expires_at ?? null }
}))

router.delete('/oauth/disconnect', requireRole('teacher'), wrap((req) => {
  queries.deleteMicrosoftToken(req.user.id)
  return null
}))

// ══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES (pas d'auth Cursus requise — token de reservation)
// ══════════════════════════════════════════════════════════════════════════

/** Get booking page data (public) */
router.get('/public/:token', publicBookingLimiter, requireBookingToken, wrap((req) => {
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

/** Get available slots for a week (public) */
router.get('/public/:token/slots', publicBookingLimiter, requireBookingToken, async (req, res) => {
  try {
    const data = req.bookingData

    const rawOffset = Number(req.query.weekOffset || 0)
    const weekOffset = isNaN(rawOffset) ? 0 : Math.max(0, Math.min(52, Math.round(rawOffset)))
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7) // Monday
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 7) // Full week (Sun end)
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
        outlookBusy = await graph.getCalendarBusy(
          msAccessToken,
          startOfWeek.toISOString(),
          endOfWeek.toISOString(),
        )
      } catch (err) {
        log.warn('Outlook busy fetch failed', { error: err.message })
      }
    }

    // Fetch overrides for this event type + week
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

/** Book a slot (public) */
router.post('/public/:token/book', publicBookingLimiter, requireBookingToken, validate(bookSchema), async (req, res) => {
  try {
    const data = req.bookingData

    const { tutorName, tutorEmail, startDatetime } = req.body
    // Validate startDatetime is not in the past or more than 1 year out
    const startMs = new Date(startDatetime).getTime()
    const now = Date.now()
    if (startMs < now) return res.status(400).json({ ok: false, error: 'Le creneau est dans le passe.' })
    if (startMs > now + 365 * 24 * 3600000) return res.status(400).json({ ok: false, error: 'Le creneau est trop eloigne.' })

    const endDatetime = new Date(startMs + data.duration_minutes * 60000).toISOString()

    // Atomic check + insert in a transaction (TOCTOU protection)
    const booking = queries.createBookingAtomic({
      eventTypeId: data.event_type_id,
      studentId: data.student_id,
      teacherId: data.teacher_id,
      tutorName,
      tutorEmail,
      startDatetime,
      endDatetime,
    })
    if (!booking) {
      return res.status(409).json({ ok: false, error: 'Ce creneau vient d\'etre reserve. Veuillez en choisir un autre.' })
    }

    // Create Teams meeting + Outlook event AFTER booking confirmed (if connected)
    let teamsJoinUrl = data.fallback_visio_url || null
    let outlookEventId = null
    const msAccessToken = await getValidMsToken(data.teacher_id)
    if (msAccessToken) {
      try {
        const result = await graph.createEventWithTeams(msAccessToken, {
          subject: `${escHtml(data.event_title)} - ${escHtml(data.student_name)} / ${escHtml(tutorName)}`,
          startDateTime: startDatetime,
          endDateTime: endDatetime,
          attendees: [
            { email: tutorEmail, name: tutorName },
            { email: data.student_email, name: data.student_name },
          ],
          body: `<p>Rendez-vous ${escHtml(data.event_title)}</p><p>Etudiant : ${escHtml(data.student_name)}</p><p>Tuteur entreprise : ${escHtml(tutorName)}</p>`,
        })
        teamsJoinUrl = result.teamsJoinUrl || teamsJoinUrl
        outlookEventId = result.eventId
        // Update booking with Teams info
        if (teamsJoinUrl || outlookEventId) {
          queries.updateBookingTeamsInfo(booking.id, { teamsJoinUrl, outlookEventId })
        }
      } catch (err) {
        log.warn('Teams/Outlook creation failed', { error: err.message })
      }
    }

    // Notify teacher in real-time via socket
    const io = req.app.get('io')
    if (io) {
      io.to(`user:${data.teacher_id}`).emit('booking:new', {
        bookingId: booking.id,
        tutorName,
        studentName: data.student_name,
        eventTitle: data.event_title,
        startDatetime,
      })
    }

    // Schedule reminder 24h before
    const reminderAt = new Date(new Date(startDatetime).getTime() - 24 * 3600000).toISOString()
    if (new Date(reminderAt) > new Date()) {
      queries.createBookingReminder(booking.id, 'email_tutor_24h', reminderAt)
      queries.createBookingReminder(booking.id, 'email_teacher_24h', reminderAt)
    }

    // Send confirmation email
    const cancelUrl = `${SERVER_URL}/api/bookings/public/cancel/${booking.cancel_token}`
    await email.sendBookingConfirmation({
      to: tutorEmail,
      tutorName,
      teacherName: data.teacher_name,
      studentName: data.student_name,
      eventTitle: data.event_title,
      startDatetime,
      endDatetime,
      teamsJoinUrl,
      cancelUrl,
    })

    res.json({
      ok: true,
      data: {
        bookingId: booking.id,
        teamsJoinUrl,
        startDatetime,
        endDatetime,
      },
    })
  } catch (err) {
    log.warn('booking_error', { error: err.message })
    res.status(400).json({ ok: false, error: 'Erreur lors de la reservation.' })
  }
})

/** Download .ics file for a booking (public) */
router.get('/public/:token/booking/:bookingId/ics', publicBookingLimiter, requireBookingToken, (req, res) => {
  try {
    const bookingId = Number(req.params.bookingId)
    const data = req.bookingData
    const allBookings = queries.getBookingsForTeacher(data.teacher_id, {})
    const booking = allBookings.find(b => b.id === bookingId)
    if (!booking) return res.status(404).json({ ok: false, error: 'Reservation introuvable' })
    const ics = generateIcs({
      title: `${data.event_title} - ${data.teacher_name}`,
      startDatetime: booking.start_datetime,
      endDatetime: booking.end_datetime,
      description: `Rendez-vous ${data.event_title} avec ${data.teacher_name}`,
      location: booking.teams_join_url || undefined,
    })
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="rdv.ics"')
    res.send(ics)
  } catch (err) {
    log.warn('ics_error', { error: err.message })
    res.status(400).json({ ok: false, error: 'Erreur lors de la generation du fichier calendrier.' })
  }
})

/** Cancel a booking (public, via cancel token) */
router.get('/public/cancel/:cancelToken', publicBookingLimiter, async (req, res) => {
  try {
    const booking = queries.getBookingByCancelToken(req.params.cancelToken)
    if (!booking || booking.status !== 'confirmed') {
      return res.status(404).json({ ok: false, error: 'Reservation introuvable ou deja annulee' })
    }

    // Cancel in DB
    queries.cancelBooking(booking.id)

    // Notify teacher in real-time
    const io = req.app.get('io')
    if (io) {
      io.to(`user:${booking.teacher_id}`).emit('booking:cancelled', {
        bookingId: booking.id,
        tutorName: booking.tutor_name,
        eventTitle: booking.event_title,
      })
    }

    // Delete Outlook event if exists
    if (booking.outlook_event_id) {
      // Validate eventId format before passing to Graph API
      if (/^[A-Za-z0-9_=-]{10,200}$/.test(booking.outlook_event_id)) {
        const msAccessToken = await getValidMsToken(booking.teacher_id)
        if (msAccessToken) {
          try {
            await graph.deleteEvent(msAccessToken, booking.outlook_event_id)
          } catch (err) {
            log.warn('Outlook event deletion failed', { error: err.message })
          }
        }
      }
    }

    // Send cancellation email with rebook link
    const tokenRow = queries.getOrCreateToken(booking.event_type_id, booking.student_id)
    const rebookUrl = `${SERVER_URL}/api/bookings/public/${tokenRow.token}`
    await email.sendBookingCancellation({
      to: booking.tutor_email,
      tutorName: booking.tutor_name,
      eventTitle: booking.event_title,
      startDatetime: booking.start_datetime,
      rebookUrl,
    })

    // Return a simple HTML page (tuteur n'a pas Cursus)
    res.send(cancelConfirmationPage({ eventTitle: booking.event_title, rebookUrl }))
  } catch (err) {
    log.warn('cancel_error', { error: err.message })
    res.status(400).json({ ok: false, error: 'Erreur lors de l\'annulation.' })
  }
})

/** Reschedule a booking (public, via cancel token) — cancels old and returns rebook URL */
router.post('/public/reschedule/:cancelToken', publicBookingLimiter, async (req, res) => {
  try {
    const booking = queries.getBookingByCancelToken(req.params.cancelToken)
    if (!booking || booking.status !== 'confirmed') {
      return res.status(404).json({ ok: false, error: 'Reservation introuvable ou deja annulee' })
    }

    // Cancel old booking (status = rescheduled)
    queries.rescheduleBooking(booking.id)

    // Delete Outlook event if exists
    if (booking.outlook_event_id && /^[A-Za-z0-9_+/=-]{10,200}$/.test(booking.outlook_event_id)) {
      const msAccessToken = await getValidMsToken(booking.teacher_id)
      if (msAccessToken) {
        try { await graph.deleteEvent(msAccessToken, booking.outlook_event_id) } catch { /* ignore */ }
      }
    }

    // Get rebook token
    const tokenRow = queries.getOrCreateToken(booking.event_type_id, booking.student_id)
    const rebookUrl = `${SERVER_URL}/#/book/${tokenRow.token}`

    // Send reschedule email
    await email.sendBookingReschedule({
      to: booking.tutor_email,
      tutorName: booking.tutor_name,
      eventTitle: booking.event_title,
      oldDatetime: booking.start_datetime,
      rebookUrl,
    })

    // Notify teacher
    const io = req.app.get('io')
    if (io) {
      io.to(`user:${booking.teacher_id}`).emit('booking:rescheduled', {
        bookingId: booking.id,
        tutorName: booking.tutor_name,
        eventTitle: booking.event_title,
      })
    }

    res.json({ ok: true, data: { rebookUrl } })
  } catch (err) {
    log.warn('reschedule_error', { error: err.message })
    res.status(400).json({ ok: false, error: 'Erreur lors du report.' })
  }
})

/** Book recurring slots (same time for N weeks) */
const bookRecurringSchema = z.object({
  tutorName: z.string().min(1).max(200),
  tutorEmail: z.string().email(),
  startDatetime: z.string().datetime(),
  recurrenceWeeks: z.number().int().min(2).max(12),
})

router.post('/public/:token/book-recurring', publicBookingLimiter, requireBookingToken, validate(bookRecurringSchema), async (req, res) => {
  try {
    const data = req.bookingData
    const { tutorName, tutorEmail, startDatetime, recurrenceWeeks } = req.body
    const durationMs = data.duration_minutes * 60000
    const recurrenceGroupId = require('uuid').v4()
    const createdBookings = []

    // Atomic: book all weeks in a transaction
    const { getDb } = require('../db/connection')
    const db = getDb()
    const { v4: uuidv4 } = require('uuid')

    const tx = db.transaction(() => {
      for (let w = 0; w < recurrenceWeeks; w++) {
        const start = new Date(new Date(startDatetime).getTime() + w * 7 * 24 * 3600000)
        const end = new Date(start.getTime() + durationMs)

        // Conflict check
        const conflicts = db.prepare(`
          SELECT id FROM bookings WHERE teacher_id = ? AND status = 'confirmed'
          AND start_datetime < ? AND end_datetime > ?
        `).all(data.teacher_id, end.toISOString(), start.toISOString())

        if (conflicts.length > 0) {
          throw new Error(`Conflit semaine ${w + 1} : creneau deja pris`)
        }

        const cancelToken = uuidv4()
        const result = db.prepare(`
          INSERT INTO bookings (event_type_id, student_id, teacher_id, tutor_name, tutor_email,
            start_datetime, end_datetime, cancel_token, recurrence_group_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(data.event_type_id, data.student_id, data.teacher_id,
          tutorName, tutorEmail, start.toISOString(), end.toISOString(), cancelToken, recurrenceGroupId)
        createdBookings.push(db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid))
      }
    })

    tx()

    if (createdBookings.length === 0) {
      return res.status(409).json({ ok: false, error: 'Aucun creneau disponible.' })
    }

    // Send confirmation email for the first booking
    const first = createdBookings[0]
    const cancelUrl = `${SERVER_URL}/api/bookings/public/cancel/${first.cancel_token}`
    await email.sendBookingConfirmation({
      to: tutorEmail, tutorName,
      teacherName: data.teacher_name, studentName: data.student_name,
      eventTitle: `${data.event_title} (x${recurrenceWeeks} semaines)`,
      startDatetime: first.start_datetime, endDatetime: first.end_datetime,
      teamsJoinUrl: null, cancelUrl,
    })

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
    res.status(err.message?.includes('Conflit') ? 409 : 400).json({ ok: false, error: err.message || 'Erreur lors de la reservation recurrente.' })
  }
})

module.exports = router
