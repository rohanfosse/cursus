/**
 * Tests unitaires pour le regroupement par catégorie et le calcul de statistiques projet.
 */
import { describe, it, expect } from 'vitest'
import { groupByCategory, computeProjectStats } from '@/utils/projectGrouping'
import type { Devoir } from '@/types'

function makeDevoir(overrides: Partial<Devoir> = {}): Devoir {
  return {
    id: 1,
    title: 'Test',
    description: null,
    channel_id: 1,
    type: 'livrable',
    category: null,
    deadline: '2026-04-01T10:00:00Z',
    start_date: null,
    is_published: 1,
    assigned_to: 'all',
    group_id: null,
    depot_id: null,
    ...overrides,
  } as Devoir
}

const NOW = new Date('2026-03-22T12:00:00Z').getTime()

describe('groupByCategory', () => {
  it('groups correctly by category', () => {
    const devoirs = [
      makeDevoir({ id: 1, category: 'Web' }),
      makeDevoir({ id: 2, category: 'Web' }),
      makeDevoir({ id: 3, category: 'Maths' }),
    ]
    const map = groupByCategory(devoirs)
    expect(map.size).toBe(2)
    expect(map.get('Web')).toHaveLength(2)
    expect(map.get('Maths')).toHaveLength(1)
  })

  it('handles null categories by skipping them', () => {
    const devoirs = [
      makeDevoir({ id: 1, category: null }),
      makeDevoir({ id: 2, category: 'Web' }),
    ]
    const map = groupByCategory(devoirs)
    expect(map.size).toBe(1)
    expect(map.has('Web')).toBe(true)
  })

  it('handles empty string categories by skipping them', () => {
    const devoirs = [
      makeDevoir({ id: 1, category: '' }),
      makeDevoir({ id: 2, category: '  ' }),
    ]
    const map = groupByCategory(devoirs)
    expect(map.size).toBe(0)
  })

  it('trims category whitespace', () => {
    const devoirs = [
      makeDevoir({ id: 1, category: '  Web  ' }),
      makeDevoir({ id: 2, category: 'Web' }),
    ]
    const map = groupByCategory(devoirs)
    expect(map.size).toBe(1)
    expect(map.get('Web')).toHaveLength(2)
  })

  it('handles duplicates in same category', () => {
    const devoirs = [
      makeDevoir({ id: 1, category: 'Web' }),
      makeDevoir({ id: 1, category: 'Web' }),
    ]
    const map = groupByCategory(devoirs)
    expect(map.get('Web')).toHaveLength(2)
  })

  it('handles empty array', () => {
    const map = groupByCategory([])
    expect(map.size).toBe(0)
  })
})

describe('computeProjectStats', () => {
  it('computes submitted/total/overdue/pct correctly', () => {
    const devoirs = [
      makeDevoir({ id: 1, depot_id: 10, note: '15' }),   // submitted + graded
      makeDevoir({ id: 2, depot_id: 11, note: null }),    // submitted, not graded
      makeDevoir({ id: 3, depot_id: null, deadline: '2026-03-20T10:00:00Z' }), // overdue
      makeDevoir({ id: 4, depot_id: null, deadline: '2026-04-01T10:00:00Z' }), // pending
    ]
    const stats = computeProjectStats(devoirs, NOW)
    expect(stats.total).toBe(4)
    expect(stats.submitted).toBe(2)
    expect(stats.graded).toBe(1)
    expect(stats.overdue).toBe(1)
    expect(stats.pending).toBe(1)
    expect(stats.pct).toBe(50)
  })

  it('handles zero total', () => {
    const stats = computeProjectStats([], NOW)
    expect(stats.total).toBe(0)
    expect(stats.submitted).toBe(0)
    expect(stats.overdue).toBe(0)
    expect(stats.pending).toBe(0)
    expect(stats.graded).toBe(0)
    expect(stats.pct).toBe(0)
  })

  it('handles all submitted', () => {
    const devoirs = [
      makeDevoir({ id: 1, depot_id: 10 }),
      makeDevoir({ id: 2, depot_id: 11 }),
    ]
    const stats = computeProjectStats(devoirs, NOW)
    expect(stats.pct).toBe(100)
    expect(stats.submitted).toBe(2)
    expect(stats.overdue).toBe(0)
    expect(stats.pending).toBe(0)
  })

  it('does not count NA note as graded', () => {
    const devoirs = [
      makeDevoir({ id: 1, depot_id: 10, note: 'NA' }),
    ]
    const stats = computeProjectStats(devoirs, NOW)
    expect(stats.graded).toBe(0)
    expect(stats.submitted).toBe(1)
  })

  it('rounds pct correctly', () => {
    const devoirs = [
      makeDevoir({ id: 1, depot_id: 10 }),
      makeDevoir({ id: 2, depot_id: null, deadline: '2026-04-01T10:00:00Z' }),
      makeDevoir({ id: 3, depot_id: null, deadline: '2026-04-01T10:00:00Z' }),
    ]
    const stats = computeProjectStats(devoirs, NOW)
    // 1/3 = 33.33... → 33
    expect(stats.pct).toBe(33)
  })
})
