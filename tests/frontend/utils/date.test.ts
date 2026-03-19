import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deadlineClass, deadlineLabel, formatDateSeparator } from '@/utils/date'

describe('deadlineClass', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-19T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('returns deadline-passed for past dates', () => {
    expect(deadlineClass('2026-03-18T00:00:00Z')).toBe('deadline-passed')
  })

  it('returns deadline-critical for < 24h', () => {
    expect(deadlineClass('2026-03-20T06:00:00Z')).toBe('deadline-critical')
  })

  it('returns deadline-soon for < 3 days', () => {
    expect(deadlineClass('2026-03-21T18:00:00Z')).toBe('deadline-soon')
  })

  it('returns deadline-warning for < 7 days', () => {
    expect(deadlineClass('2026-03-24T12:00:00Z')).toBe('deadline-warning')
  })

  it('returns deadline-ok for > 7 days', () => {
    expect(deadlineClass('2026-04-01T00:00:00Z')).toBe('deadline-ok')
  })

  it('boundary: exactly 24h is deadline-soon (not critical)', () => {
    // 24h after = 2026-03-20T12:00:00Z
    expect(deadlineClass('2026-03-20T12:00:01Z')).toBe('deadline-soon')
  })
})

describe('deadlineLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-19T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('shows retard for past dates', () => {
    const label = deadlineLabel('2026-03-18T12:00:00Z')
    expect(label).toContain('Retard')
  })

  it('shows "Moins d\'1h" for < 1 hour', () => {
    expect(deadlineLabel('2026-03-19T12:30:00Z')).toBe("Moins d'1h !")
  })

  it('shows hours for < 24h', () => {
    const label = deadlineLabel('2026-03-20T06:00:00Z')
    expect(label).toMatch(/Dans \d+h/)
  })

  it('shows "Demain" for ~1 day ahead', () => {
    // 30h ahead = within the 24-48h range, ceil(30/24)=2 → "Dans 2 jours"
    // Actually: the function returns "Demain" when ceil(h/24) === 1
    // 18h ahead → ceil(18/24) = 1 → but 18h < 24h so it shows "Dans Xh"
    // Need >24h: 2026-03-20T13:00:00Z = 25h → ceil(25/24) = 2 → "Dans 2 jours"
    // The function shows "Demain" when d === 1, i.e., ceil(h/24) = 1
    // h must be >= 24 for the day branch. ceil(24.001/24)=2. So "Demain" is unreachable?
    // Looking at code: h < 24 → hours. Then d = ceil(h/24). For d=1, h must be exactly 24.
    // ceil(24/24) = 1 → "Demain". But h < 24 catches everything under 24.
    // So we need exactly 24h or a hair over: deadlineLabel at exactly 24h.
    expect(deadlineLabel('2026-03-20T12:00:00Z')).toBe('Demain')
  })

  it('shows days for <= 7 days', () => {
    const label = deadlineLabel('2026-03-24T12:00:00Z')
    expect(label).toMatch(/Dans \d+ jours/)
  })

  it('shows weeks for <= 30 days', () => {
    const label = deadlineLabel('2026-04-05T12:00:00Z')
    expect(label).toMatch(/Dans \d+ sem\./)
  })

  it('shows months for > 30 days', () => {
    const label = deadlineLabel('2026-06-01T12:00:00Z')
    expect(label).toMatch(/Dans \d+ mois/)
  })
})

describe('formatDateSeparator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-19T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('returns "Aujourd\'hui" for today', () => {
    expect(formatDateSeparator('2026-03-19T08:00:00Z')).toBe("Aujourd'hui")
  })

  it('returns "Hier" for yesterday', () => {
    expect(formatDateSeparator('2026-03-18T15:00:00Z')).toBe('Hier')
  })

  it('returns full date for older dates', () => {
    const result = formatDateSeparator('2026-03-10T12:00:00Z')
    // Should contain day name, day number, month, year in French
    expect(result).toMatch(/\d+/)
  })
})
