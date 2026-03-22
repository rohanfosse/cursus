/** Shared project grouping and stats computation */
import type { Devoir } from '@/types'

export interface ProjectStats {
  submitted: number
  total: number
  overdue: number
  pending: number
  graded: number
  pct: number
}

/** Group devoirs by trimmed category key */
export function groupByCategory(devoirs: Devoir[]): Map<string, Devoir[]> {
  const map = new Map<string, Devoir[]>()
  for (const t of devoirs) {
    const cat = t.category?.trim()
    if (!cat) continue
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(t)
  }
  return map
}

/** Compute progress stats for a list of devoirs at a given timestamp */
export function computeProjectStats(devoirs: Devoir[], now: number): ProjectStats {
  let submitted = 0
  let total = devoirs.length
  let overdue = 0
  let pending = 0
  let graded = 0

  for (const d of devoirs) {
    if (d.depot_id != null) {
      submitted++
      if (d.note != null && d.note !== 'NA') graded++
    } else if (new Date(d.deadline).getTime() < now) {
      overdue++
    } else {
      pending++
    }
  }

  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0
  return { submitted, total, overdue, pending, graded, pct }
}
