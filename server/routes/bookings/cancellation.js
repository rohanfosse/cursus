/**
 * Routes d'annulation / report / export ICS (publiques).
 * GET  /public/cancel/:cancelToken            - redirige vers frontend (CSRF-safe)
 * GET  /public/cancel/:cancelToken/info       - snapshot booking pour la page
 * POST /public/cancel/:cancelToken            - annulation effective
 * POST /public/reschedule/:cancelToken        - report
 * GET  /public/:token/booking/:bookingId/ics  - telecharge fichier .ics
 */
const router  = require('express').Router()
const queries = require('../../db/index')
const wrap    = require('../../utils/wrap')
const log     = require('../../utils/logger')
const email   = require('../../services/email')
const { generateIcs } = require('../../utils/icsGenerator')
const {
  SERVER_URL,
  publicBookingLimiter, publicBookingPerTokenLimiter, requireBookingToken,
  tryDeleteOutlookEvent,
} = require('./_shared')

// ── GET /public/cancel/:cancelToken (redirect) ────────────────────────

router.get('/public/cancel/:cancelToken', publicBookingLimiter, (req, res) => {
  res.redirect(302, `${SERVER_URL}/#/book/cancel/${req.params.cancelToken}`)
})

// ── GET /public/cancel/:cancelToken/info ──────────────────────────────

router.get('/public/cancel/:cancelToken/info', publicBookingLimiter, wrap((req) => {
  const booking = queries.getBookingByCancelToken(req.params.cancelToken)
  if (!booking) throw Object.assign(new Error('Reservation introuvable'), { statusCode: 404 })
  return {
    alreadyCancelled: booking.status !== 'confirmed',
    eventTitle: booking.event_title,
    startDatetime: booking.start_datetime,
    endDatetime: booking.end_datetime,
    tutorName: booking.tutor_name,
  }
}))

// ── POST /public/cancel/:cancelToken ──────────────────────────────────

router.post('/public/cancel/:cancelToken', publicBookingLimiter, async (req, res) => {
  try {
    const booking = queries.getBookingByCancelToken(req.params.cancelToken)
    if (!booking) return res.status(404).json({ ok: false, error: 'Reservation introuvable' })
    if (booking.status !== 'confirmed') {
      return res.status(200).json({ ok: true, data: { alreadyCancelled: true } })
    }

    queries.cancelBooking(booking.id)

    const io = req.app.get('io')
    if (io) {
      io.to(`user:${booking.teacher_id}`).emit('booking:cancelled', {
        bookingId: booking.id,
        tutorName: booking.tutor_name,
        eventTitle: booking.event_title,
      })
    }

    await tryDeleteOutlookEvent(booking.teacher_id, booking.outlook_event_id)

    // Reservation issue d'un lien public ouvert (student_id = 0) -> rebook
    // via le slug public. Sinon (RDV nominatif), on regenere le token etudiant.
    const isPublicBooking = !booking.student_id || booking.student_id === 0
    let rebookUrl
    if (isPublicBooking && booking.is_public && booking.event_slug) {
      rebookUrl = `${SERVER_URL}/#/book/e/${booking.event_slug}`
    } else if (booking.student_id) {
      const tokenRow = queries.getOrCreateToken(booking.event_type_id, booking.student_id)
      rebookUrl = `${SERVER_URL}/#/book/${tokenRow.token}`
    } else {
      rebookUrl = null
    }
    try {
      await email.sendBookingCancellation({
        to: booking.tutor_email,
        tutorName: booking.tutor_name,
        eventTitle: booking.event_title,
        startDatetime: booking.start_datetime,
        rebookUrl,
      })
    } catch (err) {
      log.warn('booking_cancel_email_failed', { bookingId: booking.id, error: err.message })
    }

    log.info('booking_cancelled', { bookingId: booking.id, teacherId: booking.teacher_id })
    res.json({ ok: true, data: { alreadyCancelled: false, rebookUrl } })
  } catch (err) {
    log.warn('cancel_error', { error: err.message })
    res.status(500).json({ ok: false, error: 'Erreur lors de l\'annulation.' })
  }
})

// ── POST /public/reschedule/:cancelToken ──────────────────────────────

router.post('/public/reschedule/:cancelToken', publicBookingLimiter, async (req, res) => {
  try {
    const booking = queries.getBookingByCancelToken(req.params.cancelToken)
    if (!booking || booking.status !== 'confirmed') {
      return res.status(404).json({ ok: false, error: 'Reservation introuvable ou deja annulee' })
    }

    queries.rescheduleBooking(booking.id)
    await tryDeleteOutlookEvent(booking.teacher_id, booking.outlook_event_id)

    const isPublicBooking = !booking.student_id || booking.student_id === 0
    let rebookUrl
    if (isPublicBooking && booking.is_public && booking.event_slug) {
      rebookUrl = `${SERVER_URL}/#/book/e/${booking.event_slug}`
    } else if (booking.student_id) {
      const tokenRow = queries.getOrCreateToken(booking.event_type_id, booking.student_id)
      rebookUrl = `${SERVER_URL}/#/book/${tokenRow.token}`
    } else {
      rebookUrl = null
    }

    try {
      await email.sendBookingReschedule({
        to: booking.tutor_email,
        tutorName: booking.tutor_name,
        eventTitle: booking.event_title,
        oldDatetime: booking.start_datetime,
        rebookUrl,
      })
    } catch (err) {
      log.warn('booking_reschedule_email_failed', { bookingId: booking.id, error: err.message })
    }

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

// ── POST /public/confirm/:cancelToken (presence confirmee) ────────────
//
// v88 (deep interview Q4) : permet a l'attendee de confirmer sa presence
// depuis le mail tripartite. On reuse `cancel_token` comme token opaque
// (deja unique par booking, deja distribue dans le mail). Idempotent.

router.post('/public/confirm/:cancelToken', publicBookingLimiter, async (req, res) => {
  try {
    const booking = queries.getBookingByCancelToken(req.params.cancelToken)
    if (!booking) return res.status(404).json({ ok: false, error: 'Reservation introuvable' })
    if (booking.status === 'cancelled') {
      return res.status(409).json({ ok: false, error: 'Ce rendez-vous a deja ete annule.', code: 'cancelled' })
    }
    const updated = queries.confirmBookingPresence(booking.id)

    // Notif au prof : un attendee vient de confirmer (in-app uniquement,
    // pas de mail — eviterait de spammer le prof a chaque confirmation).
    const io = req.app.get('io')
    if (io) {
      io.to(`user:${booking.teacher_id}`).emit('booking:confirmed', {
        bookingId: booking.id,
        tutorName: booking.tutor_name,
        studentName: booking.student_name,
        eventTitle: booking.event_title,
        confirmedAt: updated?.confirmed_at,
      })
    }

    log.info('booking_presence_confirmed', { bookingId: booking.id, alreadyConfirmed: !!booking.confirmed_at })
    res.json({ ok: true, data: {
      bookingId: booking.id,
      eventTitle: booking.event_title,
      startDatetime: booking.start_datetime,
      endDatetime: booking.end_datetime,
      teacherName: booking.teacher_name,
      confirmedAt: updated?.confirmed_at,
      alreadyConfirmed: !!booking.confirmed_at,
    } })
  } catch (err) {
    log.warn('confirm_error', { error: err.message })
    res.status(500).json({ ok: false, error: 'Erreur lors de la confirmation.' })
  }
})

// ── GET /public/:token/booking/:bookingId/ics ─────────────────────────

router.get('/public/:token/booking/:bookingId/ics', publicBookingLimiter, publicBookingPerTokenLimiter, requireBookingToken, (req, res) => {
  try {
    const bookingId = Number(req.params.bookingId)
    const booking = queries.getBookingForToken(bookingId, req.params.token)
    if (!booking) return res.status(404).json({ ok: false, error: 'Reservation introuvable' })
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
    log.warn('ics_error', { error: err.message })
    res.status(400).json({ ok: false, error: 'Erreur lors de la generation du fichier calendrier.' })
  }
})

module.exports = router
