/**
 * Helpers métier liés aux devoirs : labels, deadlines, types, filtres de soumission.
 * Used by DevoirsView.vue, useDevoirsStudent.ts, useDevoirsTeacher.ts
 */

export const TYPE_LABELS: Record<string, string> = {
  livrable:     'Livrable',
  soutenance:   'Soutenance',
  cctl:         'CCTL',
  etude_de_cas: 'Étude de cas',
  memoire:      'Mémoire',
  autre:        'Autre',
  devoir:       'Devoir',
  projet:       'Projet',
  jalon:        'Jalon',
}

export function typeLabel(t: string): string {
  return TYPE_LABELS[t] ?? t
}

export function extractDuration(desc: string | null): string | null {
  if (!desc) return null
  const m = desc.match(/Durée\s*:\s*(\d+)\s*min/i)
  return m ? m[1] + ' min' : null
}

export function isRattrapage(t: { title: string; description?: string | null }): boolean {
  return !!(t.title?.includes('Rattrapage') || t.description?.includes('Rattrapage'))
}

export function isEventType(type: string): boolean {
  return type === 'soutenance' || type === 'cctl'
}

export function needsSubmission(devoir: { requires_submission?: number | 0 | 1 }): boolean {
  return devoir.requires_submission !== 0
}

export function isExpired(deadline: string | null | undefined, now: number): boolean {
  if (!deadline) return false
  return now >= new Date(deadline).getTime()
}
