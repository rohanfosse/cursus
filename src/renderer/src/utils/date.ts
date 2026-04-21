// ─── Formatage des dates ─────────────────────────────────────────────────────

export function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatDateSeparator(isoStr: string): string {
  const d         = new Date(isoStr)
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString())     return "Aujourd'hui"
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'

  // < 7 jours → nom du jour (Lundi, Mardi, ...)
  const diffDays = Math.floor((today.getTime() - d.getTime()) / (24 * 3600 * 1000))
  if (diffDays < 7) {
    return d.toLocaleDateString('fr-FR', { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase())
  }

  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function isoForDatetimeLocal(d: Date = new Date()): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

// ─── Deadlines ───────────────────────────────────────────────────────────────

export type DeadlineClass =
  | 'deadline-passed'
  | 'deadline-critical'
  | 'deadline-soon'
  | 'deadline-warning'
  | 'deadline-ok'

export function deadlineClass(deadlineStr: string): DeadlineClass {
  const diff = new Date(deadlineStr).getTime() - Date.now()
  if (diff < 0)                         return 'deadline-passed'
  if (diff < 24 * 60 * 60 * 1000)      return 'deadline-critical'
  if (diff < 3  * 24 * 60 * 60 * 1000) return 'deadline-soon'
  if (diff < 7  * 24 * 60 * 60 * 1000) return 'deadline-warning'
  return 'deadline-ok'
}

export function deadlineLabel(deadlineStr: string): string {
  const diff = new Date(deadlineStr).getTime() - Date.now()
  if (diff < 0) {
    const d = Math.ceil(-diff / (24 * 3600 * 1000))
    return d === 1 ? "Retard d'1 jour" : `Retard de ${d}j`
  }
  const h = diff / (3600 * 1000)
  if (h < 1)   return "Moins d'1h !"
  if (h < 24)  return `Dans ${Math.ceil(h)}h`
  const d = Math.ceil(h / 24)
  if (d === 1) return 'Demain'
  if (d <= 7)  return `Dans ${d} jours`
  if (d <= 30) return `Dans ${Math.round(d / 7)} sem.`
  return `Dans ${Math.ceil(d / 30)} mois`
}

/** Temps relatif passe ("a l'instant", "il y a 5 min", "il y a 2h", "il y a 3j") */
export function relativeTime(input: number | string | Date): string {
  const ts = typeof input === 'number' ? input : new Date(input).getTime()
  const diff = Math.max(0, Date.now() - ts)
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Hier'
  if (days < 7) return `il y a ${days}j`
  return `il y a ${Math.floor(days / 7)} sem.`
}

/** Lundi de la semaine ISO contenant `d` (hh:mm:ss remis a 0). */
export function startOfISOWeek(d: Date): Date {
  const day = d.getDay() // 0 = dimanche, 1..6 = lundi..samedi
  const diff = day === 0 ? -6 : 1 - day
  const r = new Date(d)
  r.setDate(d.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}

/** Numero de semaine ISO 8601 (lundi = debut de semaine). */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/** Countdown lisible vers une date future ("2j 5h", "3h 20min", "45min"). */
export function countdown(target: string | Date): string {
  const diff = new Date(target).getTime() - Date.now()
  if (diff <= 0) return 'Passe'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}min`
  const days = Math.floor(hours / 24)
  return `${days}j ${hours % 24}h`
}

/** Expiration restante pour un statut utilisateur ("encore 42 min", "jusqu'au 22 avr"). */
export function formatExpiryShort(expiresAt: string | null | undefined): string {
  if (!expiresAt) return 'sans expiration'
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'expiré'
  const min = Math.round(ms / 60_000)
  if (min < 60) return `encore ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `encore ${h} h`
  const d = new Date(expiresAt)
  return `jusqu'au ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
}
