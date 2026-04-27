/**
 * Generateur de creneaux fictifs pour le mode aperçu du booking (cote prof).
 *
 * Utilise par BookingPreviewModal pour montrer a un prof comment sa page de
 * reservation apparait a un etudiant SANS toucher au backend ni dependre
 * de la disponibilite reelle. Les slots sont synthetiques (heures rondes
 * sur les jours ouvres a venir) mais respectent la duree reelle du type
 * de RDV pour que le rendu visuel soit fidele.
 *
 * On exclut les week-ends pour matcher la pratique courante des profs
 * (la majorite des dispos est lun-ven).
 */
import type { BookingFlowSlot } from '@/components/booking/bookingFlow.types'

export interface PreviewSlotOptions {
  /** Duree de chaque creneau en minutes. */
  durationMinutes: number
  /** Date a partir de laquelle generer (defaut : aujourd'hui). */
  from?: Date
  /** Nombre de jours a remplir, week-ends exclus (defaut : 10 jours ouvres). */
  daysAhead?: number
  /** Heures de demarrage de slots dans la journee (defaut : 9h, 10h, 14h, 15h). */
  startHours?: number[]
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toIsoDatetime(d: Date): string {
  return `${toIsoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

/**
 * Retourne `count` jours ouvres consecutifs a partir de `from` inclus.
 * Skip les samedis (6) et dimanches (0). Utile pour generer des slots
 * dans la fenetre Lun-Ven uniquement.
 */
function getNextBusinessDays(from: Date, count: number): Date[] {
  const out: Date[] = []
  const cursor = new Date(from)
  cursor.setHours(0, 0, 0, 0)
  while (out.length < count) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) {
      out.push(new Date(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

/**
 * Genere une liste de creneaux fictifs pour la preview. Les jours sont
 * ouvres uniquement, les heures par defaut sont matin (9h, 10h) + apres-midi
 * (14h, 15h). Si la duree depasse 60 min, on espace les heures.
 */
export function makePreviewSlots(opts: PreviewSlotOptions): BookingFlowSlot[] {
  const from = opts.from ?? new Date()
  const daysAhead = opts.daysAhead ?? 10
  const startHours = opts.startHours ?? defaultStartHoursForDuration(opts.durationMinutes)
  const days = getNextBusinessDays(from, daysAhead)

  const slots: BookingFlowSlot[] = []
  for (const day of days) {
    for (const hour of startHours) {
      const start = new Date(day)
      start.setHours(hour, 0, 0, 0)
      const end = new Date(start.getTime() + opts.durationMinutes * 60_000)
      slots.push({
        start: toIsoDatetime(start),
        end: toIsoDatetime(end),
        date: toIsoDate(start),
        time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      })
    }
  }
  return slots
}

/**
 * Echelle d'heures par defaut adaptee a la duree :
 *  - 15-30 min : 4 creneaux/jour (9h, 10h, 14h, 15h)
 *  - 45-60 min : 4 creneaux/jour (9h, 10h, 14h, 15h)
 *  - 90 min+   : 2 creneaux/jour (9h, 14h) — espace pour eviter les chevauchements
 */
function defaultStartHoursForDuration(duration: number): number[] {
  if (duration >= 90) return [9, 14]
  return [9, 10, 14, 15]
}
