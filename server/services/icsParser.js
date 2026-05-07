/**
 * Parser ICS minimaliste pour les calendriers Outlook publies via "Publier
 * un calendrier" (URL `outlook.office365.com/owa/calendar/.../calendar.ics`).
 *
 * Pourquoi pas node-ical : install bloquee par OneDrive sur la machine pilote,
 * et Outlook publie deja les recurrences pre-expandees sur ~1 an. Un parseur
 * VEVENT simple suffit largement (DTSTART, DTEND, SUMMARY, LOCATION, UID,
 * DESCRIPTION). Si plus tard on doit gerer un fournisseur qui envoie du RRULE
 * brut, on remplacera par node-ical (a installer sur une machine hors OneDrive).
 *
 * Champs ignores volontairement : VTIMEZONE (on traite TZID via Date.parse +
 * conversion best-effort), ORGANIZER, ATTENDEE, ALARM, recurrences
 * incomplètes. Les events all-day (`DTSTART;VALUE=DATE:20260415`) sont
 * detectes et marques `is_all_day = 1`.
 */

/** Unfold les lignes ICS (RFC 5545 §3.1) : une ligne logique peut etre splittee
 *  sur plusieurs lignes physiques par une espace ou un tab en debut. */
function unfoldLines(text) {
  const out = []
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out
}

/** Decode les valeurs ICS escapees (\\n -> newline, \\, -> ,, etc.). */
function unescapeIcs(value) {
  if (!value) return value
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/** Parse une cle ICS qui peut avoir des parametres : `DTSTART;TZID=Europe/Paris:20260101T090000` */
function parseLineKey(line) {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return null
  const left = line.slice(0, colonIdx)
  const value = line.slice(colonIdx + 1)
  const parts = left.split(';')
  const name = parts[0].toUpperCase()
  const params = {}
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=')
    if (eq === -1) continue
    params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1)
  }
  return { name, params, value }
}

/**
 * Convertit une valeur DTSTART/DTEND ICS en ISO datetime ou date pure.
 * Retourne `{ iso, isAllDay }`.
 *
 * Formats geres :
 *   - `20260415`                    → all-day (date pure)
 *   - `20260415T090000Z`            → UTC (Outlook publie souvent en Z)
 *   - `20260415T090000`             → naive : on suppose Europe/Paris si TZID present, sinon local
 *   - TZID parametre est conserve mais on ne convertit pas activement (on garde l'heure naive)
 */
function parseIcsDate(value, params) {
  if (!value) return null
  const v = value.trim()
  // All-day : YYYYMMDD
  if (params?.VALUE === 'DATE' || /^\d{8}$/.test(v)) {
    if (!/^\d{8}$/.test(v)) return null
    const iso = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`
    return { iso, isAllDay: true }
  }
  // Datetime : YYYYMMDDTHHMMSS[Z]
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/)
  if (!m) return null
  const [, y, mo, d, h, mi, s, z] = m
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${z || ''}`
  return { iso, isAllDay: false }
}

/**
 * Parse un texte ICS et retourne la liste des VEVENTs.
 * Chaque event : `{ uid, summary, location, description, start, end, isAllDay }`
 * `start` et `end` sont des strings ISO (datetime ou date pure pour all-day).
 */
function parseIcs(text) {
  if (typeof text !== 'string' || text.length === 0) return []
  const lines = unfoldLines(text)
  const events = []
  let cur = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = { uid: null, summary: '', location: '', description: '', start: null, end: null, isAllDay: false }
      continue
    }
    if (line === 'END:VEVENT') {
      if (cur && cur.start) {
        // Si pas d'end, fallback : start + 1h pour timed, meme jour pour all-day
        if (!cur.end) cur.end = cur.start
        events.push(cur)
      }
      cur = null
      continue
    }
    if (!cur) continue
    const parsed = parseLineKey(line)
    if (!parsed) continue
    const { name, params, value } = parsed
    switch (name) {
      case 'UID':         cur.uid = value.trim(); break
      case 'SUMMARY':     cur.summary = unescapeIcs(value); break
      case 'LOCATION':    cur.location = unescapeIcs(value); break
      case 'DESCRIPTION': cur.description = unescapeIcs(value); break
      case 'DTSTART': {
        const parsedDate = parseIcsDate(value, params)
        if (parsedDate) {
          cur.start = parsedDate.iso
          cur.isAllDay = parsedDate.isAllDay
        }
        break
      }
      case 'DTEND': {
        const parsedDate = parseIcsDate(value, params)
        if (parsedDate) cur.end = parsedDate.iso
        break
      }
      default: break
    }
  }
  return events
}

/**
 * Fetch + parse une URL ICS. Retourne `{ events, ok, error }`.
 * Timeout 15s, suit les redirects.
 */
async function fetchAndParseIcs(url, { timeoutMs = 15000 } = {}) {
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return { ok: false, error: 'URL ICS invalide', events: [] }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'text/calendar, text/plain, */*' },
    })
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, events: [] }
    }
    const text = await res.text()
    const events = parseIcs(text)
    return { ok: true, events }
  } catch (err) {
    const msg = err && err.name === 'AbortError' ? 'Timeout (15s)' : (err?.message || 'Erreur reseau')
    return { ok: false, error: msg, events: [] }
  } finally {
    clearTimeout(timer)
  }
}

module.exports = { parseIcs, fetchAndParseIcs, unfoldLines, parseIcsDate }
