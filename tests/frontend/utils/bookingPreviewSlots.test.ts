/**
 * Tests pour le generateur de creneaux fictifs utilise par
 * BookingPreviewModal.
 *
 * On fixe la date systeme via vi.useFakeTimers pour des resultats
 * deterministes (lundi 2026-04-27 UTC).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { makePreviewSlots } from '@/utils/bookingPreviewSlots'

describe('makePreviewSlots', () => {
  beforeEach(() => {
    // Lundi 27 avril 2026 a 8h locale
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 27, 8, 0, 0))
  })
  afterEach(() => vi.useRealTimers())

  it('genere 4 creneaux par jour ouvre par defaut (9h, 10h, 14h, 15h)', () => {
    const slots = makePreviewSlots({ durationMinutes: 30, daysAhead: 1 })
    expect(slots).toHaveLength(4)
    expect(slots.map(s => s.time)).toEqual(['09:00', '10:00', '14:00', '15:00'])
  })

  it('respecte la duree pour calculer end (30 min)', () => {
    const slots = makePreviewSlots({ durationMinutes: 30, daysAhead: 1 })
    const first = slots[0]
    const start = new Date(first.start)
    const end = new Date(first.end)
    expect((end.getTime() - start.getTime()) / 60_000).toBe(30)
  })

  it('respecte la duree pour calculer end (90 min)', () => {
    const slots = makePreviewSlots({ durationMinutes: 90, daysAhead: 1 })
    const first = slots[0]
    const start = new Date(first.start)
    const end = new Date(first.end)
    expect((end.getTime() - start.getTime()) / 60_000).toBe(90)
  })

  it('reduit a 2 creneaux/jour (9h, 14h) quand duree >= 90 min', () => {
    const slots = makePreviewSlots({ durationMinutes: 90, daysAhead: 1 })
    expect(slots).toHaveLength(2)
    expect(slots.map(s => s.time)).toEqual(['09:00', '14:00'])
  })

  it('exclut samedis et dimanches', () => {
    // 10 jours ouvres = 2 semaines complètes
    const slots = makePreviewSlots({ durationMinutes: 30, daysAhead: 10 })
    const uniqueDates = [...new Set(slots.map(s => s.date))]
    expect(uniqueDates).toHaveLength(10)
    for (const iso of uniqueDates) {
      const d = new Date(`${iso}T12:00:00`)
      const dow = d.getDay()
      expect(dow).toBeGreaterThanOrEqual(1)
      expect(dow).toBeLessThanOrEqual(5)
    }
  })

  it('demarre par aujourd\'hui si c\'est un jour ouvre (lundi 2026-04-27)', () => {
    const slots = makePreviewSlots({ durationMinutes: 30, daysAhead: 1 })
    expect(slots[0].date).toBe('2026-04-27')
  })

  it('saute au lundi suivant si demarre un samedi', () => {
    vi.setSystemTime(new Date(2026, 4, 2, 10, 0, 0)) // samedi 2 mai 2026
    const slots = makePreviewSlots({ durationMinutes: 30, daysAhead: 1 })
    expect(slots[0].date).toBe('2026-05-04') // lundi suivant
  })

  it('genere bien daysAhead jours consecutifs ouvres', () => {
    const slots = makePreviewSlots({ durationMinutes: 30, daysAhead: 5 })
    const dates = [...new Set(slots.map(s => s.date))].sort()
    // Lundi 27 -> Vendredi 1 mai 2026 = 5 jours ouvres
    expect(dates).toEqual([
      '2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30', '2026-05-01',
    ])
  })

  it('format ISO local sans timezone (date-only stable)', () => {
    const slots = makePreviewSlots({ durationMinutes: 30, daysAhead: 1 })
    const first = slots[0]
    expect(first.start).toMatch(/^2026-04-27T09:00:00$/)
    expect(first.date).toBe('2026-04-27')
    expect(first.time).toBe('09:00')
  })

  it('accepte un from custom (saute jusqu\'au prochain jour ouvre)', () => {
    const slots = makePreviewSlots({
      durationMinutes: 30,
      from: new Date(2026, 5, 1, 0, 0, 0), // lundi 1 juin 2026
      daysAhead: 1,
    })
    expect(slots[0].date).toBe('2026-06-01')
  })

  it('accepte des startHours custom', () => {
    const slots = makePreviewSlots({
      durationMinutes: 30,
      daysAhead: 1,
      startHours: [11, 16],
    })
    expect(slots).toHaveLength(2)
    expect(slots.map(s => s.time)).toEqual(['11:00', '16:00'])
  })
})
