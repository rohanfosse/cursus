/**
 * Tests pour le composable useStreak — logique pure computeStreak.
 */
import { describe, it, expect } from 'vitest'
import { computeStreak } from '@/composables/useStreak'

function daysAgo(n: number): string {
  // UTC pour eviter les sauts DST (la transition heure d'ete/hiver en
  // France faisait que setDate traversant le changement d'heure generait
  // 2 dates sur le meme calendrier, cassant le computeStreak autour du
  // 29 mars et 25 octobre).
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - n))
  return d.toISOString()
}

describe('computeStreak', () => {
  it('returns 0 for empty dates', () => {
    const result = computeStreak([])
    expect(result.current).toBe(0)
    expect(result.longest).toBe(0)
  })

  it('returns 1 for a single date today', () => {
    const result = computeStreak([new Date().toISOString()])
    expect(result.current).toBe(1)
    expect(result.longest).toBe(1)
  })

  it('counts consecutive days from today', () => {
    const dates = [daysAgo(0), daysAgo(1), daysAgo(2)]
    const result = computeStreak(dates)
    expect(result.current).toBe(3)
  })

  it('counts consecutive days from yesterday when not active today', () => {
    const dates = [daysAgo(1), daysAgo(2), daysAgo(3)]
    const result = computeStreak(dates)
    expect(result.current).toBe(3)
  })

  it('breaks streak when there is a gap', () => {
    const dates = [daysAgo(0), daysAgo(1), daysAgo(4), daysAgo(5)]
    const result = computeStreak(dates)
    expect(result.current).toBe(2) // today + yesterday
    expect(result.longest).toBe(2)
  })

  it('computes longest streak correctly', () => {
    // 5-day streak in the past, 2-day current
    const dates = [
      daysAgo(0), daysAgo(1),
      daysAgo(10), daysAgo(11), daysAgo(12), daysAgo(13), daysAgo(14),
    ]
    const result = computeStreak(dates)
    expect(result.current).toBe(2)
    expect(result.longest).toBe(5)
  })

  it('returns current 0 when last activity was 2+ days ago', () => {
    const dates = [daysAgo(5), daysAgo(6)]
    const result = computeStreak(dates)
    expect(result.current).toBe(0)
  })

  it('deduplicates same-day dates', () => {
    const today = new Date().toISOString()
    const dates = [today, today, today]
    const result = computeStreak(dates)
    expect(result.current).toBe(1)
    expect(result.activeDays.size).toBe(1)
  })

  it('handles unordered dates', () => {
    const dates = [daysAgo(2), daysAgo(0), daysAgo(1)]
    const result = computeStreak(dates)
    expect(result.current).toBe(3)
  })

  it('tracks active days as a set', () => {
    const dates = [daysAgo(0), daysAgo(3)]
    const result = computeStreak(dates)
    expect(result.activeDays.size).toBe(2)
  })
})
