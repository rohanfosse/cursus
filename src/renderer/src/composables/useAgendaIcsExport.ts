/**
 * useAgendaIcsExport : genere un fichier iCalendar (.ics) a partir de la
 * liste d'evenements filtres. Compatible RFC 5545 (escaping champs texte).
 */
import { useToast } from '@/composables/useToast'
import type { CalendarEvent } from '@/types'

/** Formate ISO -> YYYYMMDDTHHMMSS (format DTSTART/DTEND) */
export function formatIcsDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
}

/** Escape un champ texte selon RFC 5545 */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function statusLabel(s?: string): string {
  if (s === 'submitted') return 'Rendu'
  if (s === 'late') return 'En retard'
  if (s === 'pending') return 'A rendre'
  return ''
}

export interface AgendaEventItem { _meta: CalendarEvent }

export function useAgendaIcsExport() {
  const { showToast } = useToast()

  function exportIcs(events: AgendaEventItem[]) {
    if (events.length === 0) {
      showToast('Aucun evenement a exporter.', 'error')
      return
    }

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Cursus//Agenda//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Cursus - Agenda',
    ]

    for (const ev of events) {
      const meta = ev._meta
      const uid = `cursus-${meta.id}@cursus.school`
      const summary = icsEscape(meta.title)
      const category = meta.category ? meta.category.replace(/[,;\\]/g, ' ') : ''
      const status = meta.submissionStatus === 'submitted' ? 'COMPLETED' : 'NEEDS-ACTION'
      const description = [
        meta.eventType === 'deadline' ? 'Echeance' : meta.eventType === 'start_date' ? 'Demarrage' : 'Rappel',
        category ? `Projet: ${category}` : '',
        meta.promoName ? `Promo: ${meta.promoName}` : '',
        meta.submissionStatus ? `Statut: ${statusLabel(meta.submissionStatus)}` : '',
      ].filter(Boolean).join(' | ')

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART:${formatIcsDate(meta.start)}`,
        `DTEND:${formatIcsDate(meta.end)}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${icsEscape(description)}`,
        `STATUS:${status}`,
      )
      if (category) lines.push(`CATEGORIES:${category}`)
      lines.push('END:VEVENT')
    }
    lines.push('END:VCALENDAR')

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cursus-agenda-${new Date().toISOString().slice(0, 10)}.ics`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`${events.length} evenement${events.length > 1 ? 's' : ''} exporte${events.length > 1 ? 's' : ''} en ICS.`, 'success')
  }

  return { exportIcs }
}
