/**
 * Tests unitaires pour les utilitaires de filtrage et tri des devoirs.
 */
import { describe, it, expect } from 'vitest'
import { filterUpcoming, sortByDeadline, nextUpcoming } from '@/utils/devoirFilters'

const NOW = new Date('2026-03-22T12:00:00Z').getTime()

const items = [
  { type: 'livrable', deadline: '2026-04-01T10:00:00Z' },
  { type: 'cctl', deadline: '2026-03-25T09:00:00Z' },
  { type: 'soutenance', deadline: '2026-05-01T14:00:00Z' },
  { type: 'livrable', deadline: '2026-03-20T10:00:00Z' }, // past
  { type: 'livrable', deadline: '2026-03-30T08:00:00Z' },
]

describe('filterUpcoming', () => {
  it('filters by types and excludes past deadlines', () => {
    const result = filterUpcoming(items, ['livrable'], NOW)
    expect(result).toHaveLength(2)
    expect(result.every(i => i.type === 'livrable')).toBe(true)
    expect(result.every(i => new Date(i.deadline!).getTime() > NOW)).toBe(true)
  })

  it('filters by multiple types', () => {
    const result = filterUpcoming(items, ['livrable', 'cctl'], NOW)
    expect(result).toHaveLength(3)
  })

  it('excludes past deadlines', () => {
    const result = filterUpcoming(items, ['livrable', 'cctl', 'soutenance'], NOW)
    // The past item (2026-03-20) should be excluded
    expect(result).toHaveLength(4)
    expect(result.find(i => i.deadline === '2026-03-20T10:00:00Z')).toBeUndefined()
  })

  it('handles empty arrays', () => {
    expect(filterUpcoming([], ['livrable'], NOW)).toHaveLength(0)
  })

  it('returns empty when no types match', () => {
    expect(filterUpcoming(items, ['memoire'], NOW)).toHaveLength(0)
  })

  it('handles items with missing type', () => {
    const withMissing = [{ deadline: '2026-04-01T10:00:00Z' }]
    const result = filterUpcoming(withMissing, [''], NOW)
    // type is undefined, '' includes '' check: undefined ?? '' = ''
    expect(result).toHaveLength(1)
  })
})

describe('sortByDeadline', () => {
  it('sorts ascending by deadline', () => {
    const result = sortByDeadline(items)
    for (let i = 1; i < result.length; i++) {
      expect(new Date(result[i].deadline!).getTime())
        .toBeGreaterThanOrEqual(new Date(result[i - 1].deadline!).getTime())
    }
  })

  it('handles equal dates', () => {
    const sameDate = [
      { type: 'a', deadline: '2026-04-01T10:00:00Z' },
      { type: 'b', deadline: '2026-04-01T10:00:00Z' },
    ]
    const result = sortByDeadline(sameDate)
    expect(result).toHaveLength(2)
  })

  it('does not mutate original array', () => {
    const original = [...items]
    sortByDeadline(items)
    expect(items).toEqual(original)
  })

  it('handles single item', () => {
    const single = [{ type: 'livrable', deadline: '2026-04-01T10:00:00Z' }]
    expect(sortByDeadline(single)).toHaveLength(1)
  })
})

describe('nextUpcoming', () => {
  it('combines filter, sort, and limit', () => {
    const result = nextUpcoming(items, ['livrable', 'cctl', 'soutenance'], NOW, 2)
    expect(result).toHaveLength(2)
    // Should be sorted ascending — closest first
    expect(new Date(result[0].deadline!).getTime())
      .toBeLessThanOrEqual(new Date(result[1].deadline!).getTime())
  })

  it('returns correct count when limit exceeds matches', () => {
    const result = nextUpcoming(items, ['livrable'], NOW, 100)
    expect(result).toHaveLength(2)
  })

  it('returns empty for no matches', () => {
    const result = nextUpcoming(items, ['memoire'], NOW, 5)
    expect(result).toHaveLength(0)
  })

  it('returns first upcoming item with limit 1', () => {
    const result = nextUpcoming(items, ['livrable', 'cctl'], NOW, 1)
    expect(result).toHaveLength(1)
    // Should be the closest deadline: cctl on 2026-03-25
    expect(result[0].deadline).toBe('2026-03-25T09:00:00Z')
  })
})
