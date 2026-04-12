// ─── Routes calendrier (iCal feed + sync) ────────────────────────────────────
const router  = require('express').Router()
const queries = require('../db/index')
const log     = require('../utils/logger')

/**
 * Genere un fichier iCalendar (.ics) a partir d'une liste d'evenements.
 * Compatible Outlook, Google Calendar, Apple Calendar.
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

  for (const ev of events) {
    const uid = `${ev.type}-${ev.id}@cursus.school`
    const dtstart = formatIcalDate(ev.date)
    const summary = escapeIcal(ev.title)
    const description = escapeIcal(ev.description || '')
    const category = ev.category ? escapeIcal(ev.category) : ''

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${uid}`)
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`)
    lines.push(`DTEND;VALUE=DATE:${dtstart}`)
    lines.push(`SUMMARY:${summary}`)
    if (description) lines.push(`DESCRIPTION:${description}`)
    if (category) lines.push(`CATEGORIES:${category}`)
    lines.push(`DTSTAMP:${formatIcalTimestamp(new Date())}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function escapeIcal(text) {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function formatIcalDate(dateStr) {
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function formatIcalTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function collectEvents(user) {
  const events = []

  if (user.type === 'student') {
    const travaux = queries.getStudentTravaux(user.id)
    for (const t of travaux) {
      if (t.deadline) {
        events.push({ type: 'deadline', id: t.id, date: t.deadline, title: `[Echeance] ${t.title}`, description: t.description || '', category: t.category })
      }
    }
  } else {
    const schedule = queries.getTeacherSchedule()
    for (const t of schedule) {
      if (t.deadline) {
        events.push({ type: 'deadline', id: t.id, date: t.deadline, title: `[Echeance] ${t.title}`, description: '', category: t.category })
      }
    }
  }

  const reminders = queries.getReminders(null)
  for (const r of reminders) {
    events.push({ type: 'reminder', id: r.id, date: r.date, title: `[Rappel] ${r.title}`, description: r.description || '', category: r.bloc })
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

module.exports = router
