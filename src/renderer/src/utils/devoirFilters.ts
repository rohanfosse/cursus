/** Shared devoir filtering and sorting — eliminates duplication across 6+ files */

interface WithDeadline { deadline?: string; type?: string }

/** Filter items whose type matches one of `types` and whose deadline is in the future */
export function filterUpcoming<T extends WithDeadline>(items: T[], types: string[], now: number): T[] {
  return items.filter(
    a => types.includes(a.type ?? '') && a.deadline && new Date(a.deadline).getTime() > now,
  )
}

/** Sort items by deadline ascending (closest first) */
export function sortByDeadline<T extends WithDeadline>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime(),
  )
}

/** Return the next `limit` upcoming items matching given types, sorted by deadline */
export function nextUpcoming<T extends WithDeadline>(items: T[], types: string[], now: number, limit: number): T[] {
  return sortByDeadline(filterUpcoming(items, types, now)).slice(0, limit)
}
