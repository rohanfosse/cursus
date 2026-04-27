/**
 * icsGenerator.js — Generate iCalendar (.ics) files for booking events.
 */

/**
 * @param {Object} opts
 * @param {string} opts.title - Event title
 * @param {string} opts.startDatetime - ISO 8601 datetime
 * @param {string} opts.endDatetime - ISO 8601 datetime
 * @param {string} [opts.description] - Event description
 * @param {string} [opts.location] - Location or URL
 * @param {string} [opts.organizerEmail] - Organizer email (mailto)
 * @param {string} [opts.organizerName] - Organizer display name
 * @param {Array<{email:string,name?:string,role?:'REQ-PARTICIPANT'|'OPT-PARTICIPANT'}>} [opts.attendees]
 * @param {string} [opts.uid] - UID stable (utile pour mises a jour). Genere si absent.
 * @param {'PUBLISH'|'REQUEST'|'CANCEL'} [opts.method] - Auto: REQUEST si attendees, sinon PUBLISH.
 * @returns {string} ICS file content
 */
function generateIcs({ title, startDatetime, endDatetime, description, location, organizerEmail, organizerName, attendees, uid, method }) {
  const finalUid = uid || `booking-${Date.now()}-${Math.random().toString(36).slice(2)}@cursus.school`
  const now = formatIcsDate(new Date())
  const dtStart = formatIcsDate(new Date(startDatetime))
  const dtEnd = formatIcsDate(new Date(endDatetime))
  const finalMethod = method || (attendees && attendees.length ? 'REQUEST' : 'PUBLISH')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cursus//Booking//FR',
    'CALSCALE:GREGORIAN',
    `METHOD:${finalMethod}`,
    'BEGIN:VEVENT',
    `UID:${finalUid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escIcs(title)}`,
  ]

  if (description) lines.push(`DESCRIPTION:${escIcs(description)}`)
  if (location) lines.push(`LOCATION:${escIcs(location)}`)
  if (organizerEmail) {
    const cn = organizerName ? escIcs(organizerName) : 'Cursus'
    lines.push(`ORGANIZER;CN=${cn}:mailto:${organizerEmail}`)
  }
  if (attendees && attendees.length) {
    for (const a of attendees) {
      if (!a || !a.email) continue
      const role = a.role || 'REQ-PARTICIPANT'
      const cn = a.name ? `;CN=${escIcs(a.name)}` : ''
      lines.push(`ATTENDEE;ROLE=${role};PARTSTAT=NEEDS-ACTION;RSVP=TRUE${cn}:mailto:${a.email}`)
    }
  }

  lines.push(
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Rappel RDV',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  )

  return lines.join('\r\n')
}

/** Format Date to ICS format (YYYYMMDDTHHMMSSZ) */
function formatIcsDate(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Escape special characters for ICS text fields */
function escIcs(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

module.exports = { generateIcs }
