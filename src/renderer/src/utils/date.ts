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
