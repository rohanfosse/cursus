/**
 * useAgendaIcsExport : génère un fichier iCalendar (.ics) conforme à la
 * RFC 5545 à partir de la liste d'évènements filtrés.
 *
 * Améliorations de robustesse :
 *  - DTSTAMP obligatoire (RFC 5545 3.8.7.2)
 *  - Line folding à 75 octets (RFC 5545 3.1)
 *  - All-day en `VALUE=DATE:YYYYMMDD` (RFC 5545 3.8.2.4)
 *  - Timed en UTC (`Z` suffix) — plus d'ambiguïté de fuseau
 *  - Download : ancre appendée au DOM (Firefox safety) + revoke différé
 */
import { useToast } from '@/composables/useToast'
import type { CalendarEvent } from '@/types'

// ─── Format RFC 5545 ─────────────────────────────────────────────────────────

function pad2(n: number): string { return String(n).padStart(2, '0') }

/** `YYYYMMDD` — utilisé avec `VALUE=DATE` pour les évènements all-day. */
export function formatIcsDateOnly(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
}

/** `YYYYMMDDTHHMMSSZ` — timed events en UTC (suffixe Z). */
export function formatIcsDateTimeUtc(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`
}

/** Legacy export (rétro-compat) — timed local sans TZ. */
export function formatIcsDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`
}

/** Échappe un champ texte (RFC 5545 3.3.11). */
export function icsEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Line folding RFC 5545 3.1 : les lignes > 75 octets doivent être pliées
 * avec CRLF + espace (ou tab). On compte en octets UTF-8 pour respecter
 * strictement la spec (un caractère accentué = 2 octets).
 */
export function foldLine(line: string): string {
  const MAX = 75
  const encoder = new TextEncoder()
  const bytes = encoder.encode(line)
  if (bytes.length <= MAX) return line

  // On itère par codepoint (évite de couper un caractère unicode) et on coupe
  // dès que la somme d'octets dépasse MAX.
  const chunks: string[] = []
  let cur = ''
  let curBytes = 0
  for (const cp of [...line]) {
    const b = encoder.encode(cp).length
    if (curBytes + b > MAX) {
      chunks.push(cur)
      cur = cp
      curBytes = b
    } else {
      cur += cp
      curBytes += b
    }
  }
  if (cur) chunks.push(cur)
  return chunks.join('\r\n ')
}

// ─── Helpers sémantique ──────────────────────────────────────────────────────

function statusLabel(s?: string): string {
  if (s === 'submitted') return 'Rendu'
  if (s === 'late') return 'En retard'
  if (s === 'pending') return 'A rendre'
  return ''
}

function eventTypeLabel(t: string): string {
  if (t === 'deadline') return 'Echeance'
  if (t === 'start_date') return 'Demarrage'
  if (t === 'outlook') return 'Outlook'
  if (t === 'booking') return 'Rendez-vous'
  if (t === 'external') return 'Cours'
  return 'Rappel'
}

function sanitizeCategory(c: string | null | undefined): string {
  if (!c) return ''
  return c.replace(/[,;\\]/g, ' ').trim()
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  // Append au DOM : Firefox exige que l'ancre soit dans le document pour que .click() déclenche.
  document.body.appendChild(a)
  try {
    a.click()
  } finally {
    document.body.removeChild(a)
    // Revoke différé : certains navigateurs annulent le download si revoke sync.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

// ─── Détection all-day ───────────────────────────────────────────────────────

/**
 * Un event est considéré all-day si :
 *  - `meta.allDay === true`, ou
 *  - `start`/`end` est au format YYYY-MM-DD (sans heure).
 */
function isAllDay(meta: CalendarEvent): boolean {
  if (meta.allDay === true) return true
  // Format `YYYY-MM-DD` pur → pas d'heure → all-day
  return /^\d{4}-\d{2}-\d{2}$/.test(meta.start)
}

// ─── Construction évènement ──────────────────────────────────────────────────

export interface AgendaEventItem { _meta: CalendarEvent }

function buildEventLines(meta: CalendarEvent, dtstamp: string): string[] {
  const uid = `cursus-${meta.id}@cursus.school`
  const summary = icsEscape(meta.title ?? '')
  const category = sanitizeCategory(meta.category ?? null)
  const status = meta.submissionStatus === 'submitted' ? 'COMPLETED' : 'NEEDS-ACTION'

  const descParts = [
    eventTypeLabel(meta.eventType),
    category ? `Projet: ${category}` : '',
    meta.promoName ? `Promo: ${meta.promoName}` : '',
    meta.submissionStatus ? `Statut: ${statusLabel(meta.submissionStatus)}` : '',
    meta.location ? `Lieu: ${meta.location}` : '',
    meta.organizer ? `Organisateur: ${meta.organizer}` : '',
  ].filter(Boolean).join(' | ')

  const allDay = isAllDay(meta)

  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
  ]

  if (allDay) {
    // All-day : DATE-VALUE, end exclusive → on ajoute +1 jour (RFC 5545 3.8.2.2)
    const sd = formatIcsDateOnly(meta.start)
    let endSource = meta.end || meta.start
    // meta.end est inclusif côté grille agenda ; RFC attend exclusif → +1j
    const endDate = new Date(endSource)
    if (!isNaN(endDate.getTime())) {
      endDate.setDate(endDate.getDate() + 1)
      endSource = fmtIsoDate(endDate)
    }
    const ed = formatIcsDateOnly(endSource)
    if (sd) lines.push(`DTSTART;VALUE=DATE:${sd}`)
    if (ed) lines.push(`DTEND;VALUE=DATE:${ed}`)
  } else {
    // Timed : UTC avec Z
    const sd = formatIcsDateTimeUtc(meta.start)
    const ed = formatIcsDateTimeUtc(meta.end || meta.start)
    if (sd) lines.push(`DTSTART:${sd}`)
    if (ed) lines.push(`DTEND:${ed}`)
  }

  lines.push(`SUMMARY:${summary}`)
  if (descParts) lines.push(`DESCRIPTION:${icsEscape(descParts)}`)
  lines.push(`STATUS:${status}`)
  if (category) lines.push(`CATEGORIES:${category}`)
  if (meta.teamsJoinUrl) lines.push(`URL:${icsEscape(meta.teamsJoinUrl)}`)
  lines.push('END:VEVENT')

  return lines
}

function fmtIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// ─── Public ──────────────────────────────────────────────────────────────────

export function useAgendaIcsExport() {
  const { showToast } = useToast()

  function buildIcs(events: AgendaEventItem[]): string {
    const dtstamp = formatIcsDateTimeUtc(new Date().toISOString())
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Cursus//Agenda//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Cursus - Agenda',
    ]
    for (const ev of events) {
      lines.push(...buildEventLines(ev._meta, dtstamp))
    }
    lines.push('END:VCALENDAR')
    // Fold chaque ligne à 75 octets
    return lines.map(foldLine).join('\r\n')
  }

  function exportIcs(events: AgendaEventItem[]): void {
    if (events.length === 0) {
      showToast('Aucun evenement a exporter.', 'error')
      return
    }

    try {
      const content = buildIcs(events)
      const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
      triggerDownload(blob, `cursus-agenda-${new Date().toISOString().slice(0, 10)}.ics`)
      showToast(
        `${events.length} evenement${events.length > 1 ? 's' : ''} exporte${events.length > 1 ? 's' : ''} en ICS.`,
        'success',
      )
    } catch {
      showToast('Impossible de generer le fichier ICS.', 'error')
    }
  }

  return { exportIcs, buildIcs }
}
