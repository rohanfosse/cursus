/**
 * Helpers purs pour le flow de booking. Extraits de BookingFlow.vue pour
 * permettre d'autres consommateurs (tests directs, autres SFC) sans
 * dependre du contexte d'execution Vue.
 */

/** Convertit une Date locale en YYYY-MM-DD. */
export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Format date long format FR : "lundi 27 avril 2026".
 * Accepte une chaine ISO complete (`2026-04-27T14:00:00Z`) ou date-only (`2026-04-27`).
 */
export function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

/** Format heure court FR : "14:30". */
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Detecte le fuseau horaire du visiteur via Intl.DateTimeFormat. Fallback
 * 'Europe/Paris' si l'API echoue (vieux runtime, jsdom restrictif, etc.).
 */
export function detectUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'Europe/Paris'
  }
}

/** Initiales des jours de la semaine en FR (semaine commencant le lundi). */
export const DAY_INITIALS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const

/**
 * Indique si un booking a un VRAI tuteur entreprise distinct de l'etudiant.
 *
 * Contexte : pour des raisons historiques (schema bookings.tutor_name
 * NOT NULL sans migration), les RDV non-tripartites stockent le nom de
 * l'etudiant dans tutor_name. C'est faux semantiquement — l'etudiant
 * n'est pas son propre tuteur. Cette fonction filtre ces faux positifs
 * pour que l'UI n'affiche pas le bloc "Tuteur entreprise" alors qu'il
 * n'y en a pas.
 *
 * Heuristique : tutor_name doit etre rempli, non-vide, et different de
 * student_name. On compare aussi tutor_email a student_email pour les
 * cas ou les noms different mais l'email est le meme (alias, etc.).
 */
export interface BookingLike {
  tutor_name?: string | null
  tutor_email?: string | null
  student_name?: string | null
  student_email?: string | null
}

export function bookingHasRealTutor(bk: BookingLike | null | undefined): boolean {
  if (!bk) return false
  const tName = (bk.tutor_name || '').trim()
  if (!tName) return false
  const sName = (bk.student_name || '').trim()
  if (sName && tName.toLowerCase() === sName.toLowerCase()) return false
  const tEmail = (bk.tutor_email || '').trim().toLowerCase()
  const sEmail = (bk.student_email || '').trim().toLowerCase()
  if (tEmail && sEmail && tEmail === sEmail) return false
  return true
}

/**
 * Mappe un code d'erreur backend vers un titre d'erreur lisible.
 * Utilise par BookingFlow pour la step error pleine largeur.
 */
export function bookingErrorTitle(code?: string): string {
  switch (code) {
    case 'closed':         return 'Reservations fermees'
    case 'inactive':       return 'Type de RDV indisponible'
    case 'not_found':      return 'Lien introuvable'
    case 'already_booked': return 'Tu as deja reserve'
    case 'invalid_link':   return 'Lien invalide'
    default:               return 'Lien invalide'
  }
}
