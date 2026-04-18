// ─── Routes calendrier (iCal feed + sync Outlook) ───────────────────────────
const router  = require('express').Router()
const queries = require('../db/index')
const log     = require('../utils/logger')
const graph   = require('../services/microsoftGraph')
const { getValidMsToken } = require('../utils/msToken')
const { requireRole }     = require('../middleware/authorize')

/**
 * Genere un fichier iCalendar (.ics) a partir d'une liste d'evenements.
 * Compatible Outlook, Google Calendar, Apple Calendar.
 * Les evenements sans date valide sont ignores silencieusement.
 */
function generateIcal(events, calendarName) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cursus//Calendrier//FR',
    `X-WR-CALNAME:${escapeIcal(calendarName)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  const stamp = formatIcalTimestamp(new Date())

  for (const ev of events) {
    const dtstart = formatIcalDate(ev.date)
    if (!dtstart) continue // skip invalid dates plutot que d'emettre NaNNaNNaN
    const uid = `${ev.type}-${ev.id}@cursus.school`
    const summary = escapeIcal(ev.title || 'Sans titre')
    const description = escapeIcal(ev.description || '')
    const category = ev.category ? escapeIcal(ev.category) : ''

    lines.push('BEGIN:VEVENT')
    lines.push(foldLine(`UID:${uid}`))
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`)
    lines.push(`DTEND;VALUE=DATE:${dtstart}`)
    lines.push(foldLine(`SUMMARY:${summary}`))
    if (description) lines.push(foldLine(`DESCRIPTION:${description}`))
    if (category) lines.push(foldLine(`CATEGORIES:${category}`))
    lines.push(`DTSTAMP:${stamp}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function escapeIcal(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

/**
 * RFC 5545 exige que les lignes ne depassent pas 75 octets, avec continuation
 * par CRLF + espace. On se base sur la longueur UTF-8 pour etre sur.
 */
function foldLine(line, max = 75) {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= max) return line
  const chunks = []
  let start = 0
  while (start < bytes.length) {
    const slice = bytes.subarray(start, Math.min(bytes.length, start + max))
    chunks.push(slice.toString('utf8'))
    start += max
  }
  return chunks.join('\r\n ')
}

function formatIcalDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function formatIcalTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function collectEvents(user) {
  const events = []

  try {
    if (user?.type === 'student') {
      const travaux = queries.getStudentTravaux(user.id) || []
      for (const t of travaux) {
        if (t.deadline) {
          events.push({ type: 'deadline', id: t.id, date: t.deadline, title: `[Echeance] ${t.title}`, description: t.description || '', category: t.category })
        }
      }
    } else {
      const schedule = queries.getTeacherSchedule() || []
      for (const t of schedule) {
        if (t.deadline) {
          events.push({ type: 'deadline', id: t.id, date: t.deadline, title: `[Echeance] ${t.title}`, description: '', category: t.category })
        }
      }
    }
  } catch (err) {
    log.warn('calendar_collect_events_error', { error: err.message })
  }

  try {
    const reminders = queries.getReminders(null) || []
    for (const r of reminders) {
      events.push({ type: 'reminder', id: r.id, date: r.date, title: `[Rappel] ${r.title}`, description: r.description || '', category: r.bloc })
    }
  } catch (err) {
    log.warn('calendar_collect_reminders_error', { error: err.message })
  }

  return events
}

// ── Feed iCal (souscription Outlook / Google Calendar) ───────────────────────
router.get('/feed.ics', (req, res) => {
  try {
    const events = collectEvents(req.user)
    const ical = generateIcal(events, `Cursus - ${req.user.name || 'Calendrier'}`)
    res.set('Content-Type', 'text/calendar; charset=utf-8')
    res.send(ical)
  } catch (err) {
    log.error('calendar_feed_error', { error: err.message })
    res.status(500).json({ ok: false, error: 'Erreur generation calendrier' })
  }
})

// ── Export ponctuel .ics (download) ──────────────────────────────────────────
router.get('/export.ics', (req, res) => {
  try {
    const events = collectEvents(req.user)
    const ical = generateIcal(events, 'Cursus - Calendrier')
    res.set('Content-Type', 'text/calendar; charset=utf-8')
    res.set('Content-Disposition', 'attachment; filename="cursus-calendrier.ics"')
    res.send(ical)
  } catch (err) {
    log.error('calendar_export_error', { error: err.message })
    res.status(500).json({ ok: false, error: 'Erreur export calendrier' })
  }
})

// ══════════════════════════════════════════════════════════════════════════
// Outlook live sync (teachers only)
// ══════════════════════════════════════════════════════════════════════════

/** GET /outlook/events?from=ISO&to=ISO — fetch teacher's Outlook events */
router.get('/outlook/events', requireRole('teacher'), async (req, res) => {
  try {
    const from = req.query.from
    const to   = req.query.to
    if (!from || !to || isNaN(Date.parse(from)) || isNaN(Date.parse(to))) {
      return res.status(400).json({ ok: false, error: 'from/to ISO requis' })
    }

    const token = await getValidMsToken(req.user.id)
    if (!token) return res.json({ ok: true, data: { events: [], connected: false } })

    const events = await graph.getCalendarEvents(token, from, to)
    res.json({ ok: true, data: { events, connected: true } })
  } catch (err) {
    log.warn('outlook_events_error', { error: err.message })
    res.status(500).json({ ok: false, error: 'Erreur chargement Outlook' })
  }
})

/** POST /outlook/events — create an event in teacher's Outlook calendar */
router.post('/outlook/events', requireRole('teacher'), async (req, res) => {
  try {
    const { subject, startDateTime, endDateTime, body, attendees, createTeams } = req.body || {}
    if (!subject || !startDateTime || !endDateTime) {
      return res.status(400).json({ ok: false, error: 'subject/startDateTime/endDateTime requis' })
    }
    if (typeof subject !== 'string' || subject.length > 500) {
      return res.status(400).json({ ok: false, error: 'subject invalide (max 500 caracteres)' })
    }
    const startMs = Date.parse(startDateTime)
    const endMs   = Date.parse(endDateTime)
    if (isNaN(startMs) || isNaN(endMs)) {
      return res.status(400).json({ ok: false, error: 'Dates invalides (ISO 8601 attendu)' })
    }
    if (endMs <= startMs) {
      return res.status(400).json({ ok: false, error: 'endDateTime doit etre strictement apres startDateTime' })
    }
    if (attendees && !Array.isArray(attendees)) {
      return res.status(400).json({ ok: false, error: 'attendees doit etre un tableau' })
    }

    const token = await getValidMsToken(req.user.id)
    if (!token) return res.status(503).json({ ok: false, error: 'Microsoft non connecte' })

    const result = await graph.createEventWithTeams(token, {
      subject, startDateTime, endDateTime,
      body: body || '',
      attendees: attendees || [],
    })
    // If caller doesn't want Teams, still Graph creates one — we just return what we got
    res.json({ ok: true, data: { ...result, createTeams: !!createTeams } })
  } catch (err) {
    log.warn('outlook_create_error', { error: err.message })
    res.status(500).json({ ok: false, error: 'Erreur creation Outlook' })
  }
})

/** DELETE /outlook/events/:id — delete an event from teacher's Outlook calendar */
router.delete('/outlook/events/:id', requireRole('teacher'), async (req, res) => {
  try {
    const token = await getValidMsToken(req.user.id)
    if (!token) return res.status(503).json({ ok: false, error: 'Microsoft non connecte' })
    await graph.deleteEvent(token, req.params.id)
    res.json({ ok: true, data: null })
  } catch (err) {
    log.warn('outlook_delete_error', { error: err.message })
    res.status(500).json({ ok: false, error: 'Erreur suppression Outlook' })
  }
})

module.exports = router
