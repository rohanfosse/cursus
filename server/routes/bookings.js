/**
 * Routes Booking — API enseignant pour gerer les types d'evenements,
 * regles de disponibilite, tokens de reservation et reservations.
 * + Routes publiques pour la page de reservation tuteur.
 */
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap    = require('../utils/wrap')
const { requireRole } = require('../middleware/authorize')
const { ForbiddenError, NotFoundError, ConflictError, ValidationError } = require('../utils/errors')
const log     = require('../utils/logger')
const graph   = require('../services/microsoftGraph')
const email   = require('../services/email')

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001'

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
  color: z.string().optional(),
  fallbackVisioUrl: z.string().url().optional().nullable(),
})

const availabilitySchema = z.object({
  rules: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })),
})

const bookSchema = z.object({
  tutorName: z.string().min(1).max(200),
  tutorEmail: z.string().email(),
  startDatetime: z.string(),
})

// ── Event Types (prof) ──────────────────────────────────────────────────

router.get('/event-types', requireRole('teacher'), wrap((req) => {
  return queries.getEventTypes(req.user.id)
}))

router.post('/event-types', requireRole('teacher'), validate(createEventTypeSchema), wrap((req) => {
  return queries.createEventType({ teacherId: req.user.id, ...req.body })
}))

router.patch('/event-types/:id', requireRole('teacher'), wrap((req) => {
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

// ── My Bookings (prof) ──────────────────────────────────────────────────

router.get('/my-bookings', requireRole('teacher'), wrap((req) => {
  const { from, to } = req.query
  return queries.getBookingsForTeacher(req.user.id, { from, to })
}))

// ── Microsoft OAuth ─────────────────────────────────────────────────────

router.get('/oauth/start', requireRole('teacher'), async (req, res) => {
  if (!graph.isConfigured()) {
    return res.status(503).json({ ok: false, error: 'Azure AD non configure. Contactez l\'administrateur.' })
  }
  const url = await graph.getAuthUrl(String(req.user.id))
  if (!url) return res.status(500).json({ ok: false, error: 'Impossible de generer l\'URL OAuth' })
  res.json({ ok: true, data: { url } })
})

router.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query
    if (!code) throw new Error('Code manquant')
    const result = await graph.acquireTokenByCode(String(code))
    const teacherId = Number(state)
    if (!teacherId) throw new Error('Teacher ID manquant')
    // Store tokens (in production, encrypt these)
    queries.saveMicrosoftToken(teacherId, {
      accessTokenEnc: result.accessToken,
      refreshTokenEnc: JSON.stringify(result.account || {}),
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
router.get('/public/:token', requireBookingToken, wrap((req) => {
  const data = req.bookingData
  return {
    eventTitle: data.event_title,
    description: data.description,
    durationMinutes: data.duration_minutes,
    teacherName: data.teacher_name,
    studentName: data.student_name,
    color: data.color,
  }
}))

/** Get available slots for a week (public) */
router.get('/public/:token/slots', requireBookingToken, async (req, res) => {
  try {
    const data = req.bookingData

    const weekOffset = Number(req.query.weekOffset || 0)
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7) // Monday
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 5) // Friday end
    endOfWeek.setHours(23, 59, 59, 999)

    const rules = queries.getAvailabilityRules(data.teacher_id)

    const existingBookings = queries.getBookingsForTeacher(
      data.teacher_id,
      { from: startOfWeek.toISOString(), to: endOfWeek.toISOString() },
    )

    let outlookBusy = []
    const msToken = queries.getMicrosoftToken(data.teacher_id)
    if (msToken) {
      try {
        outlookBusy = await graph.getCalendarBusy(
          msToken.access_token_enc,
          startOfWeek.toISOString(),
          endOfWeek.toISOString(),
        )
      } catch (err) {
        log.warn('Outlook busy fetch failed', { error: err.message })
      }
    }

    // Pre-parse busy interval timestamps (avoids re-parsing per slot)
    const bookingIntervals = existingBookings.map(b => ({
      start: new Date(b.start_datetime).getTime(),
      end: new Date(b.end_datetime).getTime(),
    }))
    const outlookIntervals = outlookBusy.map(b => ({
      start: new Date(b.start).getTime(),
      end: new Date(b.end).getTime(),
    }))

    const durationMs = data.duration_minutes * 60000
    const nowMs = now.getTime()
    const slots = []

    for (let day = 0; day < 5; day++) { // Mon-Fri
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + day)
      const dayOfWeek = date.getDay()

      const dayRules = rules.filter(r => r.day_of_week === dayOfWeek)

      for (const rule of dayRules) {
        const [sh, sm] = rule.start_time.split(':').map(Number)
        const [eh, em] = rule.end_time.split(':').map(Number)

        let slotStart = new Date(date)
        slotStart.setHours(sh, sm, 0, 0)
        const ruleEnd = new Date(date)
        ruleEnd.setHours(eh, em, 0, 0)
        let slotStartMs = slotStart.getTime()
        const ruleEndMs = ruleEnd.getTime()

        while (slotStartMs + durationMs <= ruleEndMs) {
          const slotEndMs = slotStartMs + durationMs

          if (slotStartMs <= nowMs) {
            slotStartMs = slotEndMs
            continue
          }

          const hasConflict =
            bookingIntervals.some(b => b.start < slotEndMs && b.end > slotStartMs) ||
            outlookIntervals.some(b => b.start < slotEndMs && b.end > slotStartMs)

          if (!hasConflict) {
            const s = new Date(slotStartMs)
            slots.push({
              start: s.toISOString(),
              end: new Date(slotEndMs).toISOString(),
              date: date.toISOString().slice(0, 10),
              time: `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`,
            })
          }

          slotStartMs = slotEndMs
        }
      }
    }

    res.json({ ok: true, data: { slots, weekStart: startOfWeek.toISOString().slice(0, 10) } })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

/** Book a slot (public) */
router.post('/public/:token/book', requireBookingToken, validate(bookSchema), async (req, res) => {
  try {
    const data = req.bookingData

    const { tutorName, tutorEmail, startDatetime } = req.body
    const endDatetime = new Date(new Date(startDatetime).getTime() + data.duration_minutes * 60000).toISOString()

    const conflicts = queries.getBookingsForSlot(data.teacher_id, startDatetime, endDatetime)
    if (conflicts.length > 0) {
      return res.status(409).json({ ok: false, error: 'Ce creneau vient d\'etre reserve. Veuillez en choisir un autre.' })
    }

    // Create Teams meeting + Outlook event (if connected)
    let teamsJoinUrl = data.fallback_visio_url || null
    let outlookEventId = null
    const msToken = queries.getMicrosoftToken(data.teacher_id)
    if (msToken) {
      try {
        const result = await graph.createEventWithTeams(msToken.access_token_enc, {
          subject: `${data.event_title} - ${data.student_name} / ${tutorName}`,
          startDateTime: startDatetime,
          endDateTime: endDatetime,
          attendees: [
            { email: tutorEmail, name: tutorName },
            { email: data.student_email, name: data.student_name },
          ],
          body: `<p>Rendez-vous ${data.event_title}</p><p>Etudiant : ${data.student_name}</p><p>Tuteur entreprise : ${tutorName}</p>`,
        })
        teamsJoinUrl = result.teamsJoinUrl || teamsJoinUrl
        outlookEventId = result.eventId
      } catch (err) {
        log.warn('Teams/Outlook creation failed', { error: err.message })
      }
    }

    // Create booking in DB
    const booking = queries.createBooking({
      eventTypeId: data.event_type_id,
      studentId: data.student_id,
      teacherId: data.teacher_id,
      tutorName,
      tutorEmail,
      startDatetime,
      endDatetime,
      teamsJoinUrl,
      outlookEventId,
    })

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
    res.status(400).json({ ok: false, error: err.message })
  }
})

/** Cancel a booking (public, via cancel token) */
router.get('/public/cancel/:cancelToken', async (req, res) => {
  try {
    const booking = queries.getBookingByCancelToken(req.params.cancelToken)
    if (!booking || booking.status !== 'confirmed') {
      return res.status(404).json({ ok: false, error: 'Reservation introuvable ou deja annulee' })
    }

    // Cancel in DB
    queries.cancelBooking(booking.id)

    // Delete Outlook event if exists
    if (booking.outlook_event_id) {
      const msToken = queries.getMicrosoftToken(booking.teacher_id)
      if (msToken) {
        try {
          await graph.deleteEvent(msToken.access_token_enc, booking.outlook_event_id)
        } catch (err) {
          log.warn('Outlook event deletion failed', { error: err.message })
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
    res.send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head><meta charset="utf-8"><title>RDV annule</title>
      <style>body{font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f8fafc;margin:0}
      .card{background:#fff;border-radius:16px;padding:40px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:400px}
      h1{color:#ef4444;font-size:24px}p{color:#64748b;line-height:1.6}
      a{display:inline-block;margin-top:16px;padding:12px 24px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600}</style>
      </head>
      <body><div class="card">
        <h1>RDV annule</h1>
        <p>Votre rendez-vous <strong>${booking.event_title}</strong> a ete annule avec succes.</p>
        <a href="${rebookUrl}">Reserver un autre creneau</a>
      </div></body></html>
    `)
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

module.exports = router
