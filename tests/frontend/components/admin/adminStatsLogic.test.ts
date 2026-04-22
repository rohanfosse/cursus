/**
 * Tests logique AdminStats : intensité heatmap (bucketing 0-4), ratio DAU,
 * lookup O(1) via heatmapMap (pas de scan linéaire à chaque cell).
 */
import { describe, it, expect } from 'vitest'

function heatmapIntensity(count: number, max: number): string {
  if (count === 0) return '0'
  const ratio = count / max
  if (ratio >= 0.75) return '4'
  if (ratio >= 0.5) return '3'
  if (ratio >= 0.25) return '2'
  return '1'
}

function buildHeatmapMap(cells: { day_of_week: number; hour: number; count: number }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of cells) m.set(`${c.day_of_week}:${c.hour}`, c.count)
  return m
}

function dauRatio(dau: number, total: number): number {
  if (!total) return 0
  return Math.round((dau / total) * 100)
}

describe('AdminStats — heatmapIntensity', () => {
  it('returns 0 when count is zero', () => {
    expect(heatmapIntensity(0, 100)).toBe('0')
  })

  it('maps count to 5 buckets based on ratio to max', () => {
    expect(heatmapIntensity(10, 100)).toBe('1')
    expect(heatmapIntensity(25, 100)).toBe('2')
    expect(heatmapIntensity(50, 100)).toBe('3')
    expect(heatmapIntensity(75, 100)).toBe('4')
    expect(heatmapIntensity(100, 100)).toBe('4')
  })

  it('handles max of 1 without divide-by-zero crash', () => {
    expect(heatmapIntensity(1, 1)).toBe('4')
  })
})

describe('AdminStats — heatmapMap', () => {
  it('indexes cells by day:hour for O(1) lookup', () => {
    const cells = [
      { day_of_week: 1, hour: 9, count: 42 },
      { day_of_week: 3, hour: 14, count: 7 },
    ]
    const map = buildHeatmapMap(cells)
    expect(map.get('1:9')).toBe(42)
    expect(map.get('3:14')).toBe(7)
    expect(map.get('0:0')).toBeUndefined()
  })

  it('returns an empty map for no cells', () => {
    expect(buildHeatmapMap([]).size).toBe(0)
  })
})

describe('AdminStats — dauRatio', () => {
  it('returns 0 when no students exist', () => {
    expect(dauRatio(10, 0)).toBe(0)
  })

  it('rounds to nearest integer percentage', () => {
    expect(dauRatio(33, 100)).toBe(33)
    expect(dauRatio(1, 3)).toBe(33)
    expect(dauRatio(2, 3)).toBe(67)
  })

  it('caps at 100 naturally for full adoption', () => {
    expect(dauRatio(50, 50)).toBe(100)
  })
})
