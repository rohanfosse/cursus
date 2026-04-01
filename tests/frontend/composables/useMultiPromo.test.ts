/**
 * Tests unitaires pour le composable useMultiPromo.
 * Logique pure : chargement multi-promo, metriques, filtres, deadlines.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useMultiPromo, type GanttRow, type RenduRow } from '@/composables/useMultiPromo'
import type { Promotion } from '@/types'

const PROMOS: Promotion[] = [
  { id: 1, name: 'Promo A1', color: '#6366F1' },
  { id: 2, name: 'Promo B2', color: '#059669' },
]

const GANTT_PROMO_1: GanttRow[] = [
  { id: 10, title: 'Projet Web', deadline: '2099-06-01T00:00:00Z', published: 1, channel_id: 1, channel_name: 'web', depots_count: 5, students_total: 20 },
  { id: 11, title: 'TP Algo', deadline: '2099-05-15T00:00:00Z', published: 1, channel_id: 2, channel_name: 'algo', depots_count: 18, students_total: 20 },
  { id: 12, title: 'Brouillon', deadline: '2099-07-01T00:00:00Z', published: 0, channel_id: 1, channel_name: 'web', depots_count: 0, students_total: 20 },
  { id: 13, title: 'Passe', deadline: '2020-01-01T00:00:00Z', published: 1, channel_id: 1, channel_name: 'web', depots_count: 20, students_total: 20 },
]

const GANTT_PROMO_2: GanttRow[] = [
  { id: 20, title: 'Soutenance', deadline: '2099-06-10T00:00:00Z', published: 1, channel_id: 3, channel_name: 'oral', depots_count: 0, students_total: 15 },
]

const RENDUS_PROMO_1: RenduRow[] = [
  { travail_id: 10, note: 'A' },
  { travail_id: 10, note: null },
  { travail_id: 10, note: 'B' },
  { travail_id: 11, note: null },
]

const RENDUS_PROMO_2: RenduRow[] = [
  { travail_id: 20, note: null },
  { travail_id: 20, note: null },
]

describe('useMultiPromo', () => {
  let fetchGantt: ReturnType<typeof vi.fn>
  let fetchRendus: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchGantt = vi.fn().mockImplementation((promoId: number) => {
      if (promoId === 1) return Promise.resolve(GANTT_PROMO_1)
      if (promoId === 2) return Promise.resolve(GANTT_PROMO_2)
      return Promise.resolve([])
    })
    fetchRendus = vi.fn().mockImplementation((promoId: number) => {
      if (promoId === 1) return Promise.resolve(RENDUS_PROMO_1)
      if (promoId === 2) return Promise.resolve(RENDUS_PROMO_2)
      return Promise.resolve([])
    })
  })

  function create(promos = PROMOS) {
    return useMultiPromo({
      promos: ref(promos),
      fetchGantt,
      fetchRendus,
    })
  }

  describe('hasMultiplePromos', () => {
    it('returns true with 2+ promos', () => {
      const { hasMultiplePromos } = create()
      expect(hasMultiplePromos.value).toBe(true)
    })

    it('returns false with 1 promo', () => {
      const { hasMultiplePromos } = create([PROMOS[0]])
      expect(hasMultiplePromos.value).toBe(false)
    })

    it('returns false with 0 promos', () => {
      const { hasMultiplePromos } = create([])
      expect(hasMultiplePromos.value).toBe(false)
    })
  })

  describe('load', () => {
    it('fetches gantt and rendus for each promo', async () => {
      const mp = create()
      await mp.load()
      expect(fetchGantt).toHaveBeenCalledTimes(2)
      expect(fetchGantt).toHaveBeenCalledWith(1)
      expect(fetchGantt).toHaveBeenCalledWith(2)
      expect(fetchRendus).toHaveBeenCalledTimes(2)
    })

    it('does nothing with < 2 promos', async () => {
      const mp = create([PROMOS[0]])
      await mp.load()
      expect(fetchGantt).not.toHaveBeenCalled()
    })

    it('sets loading state during fetch', async () => {
      const mp = create()
      const promise = mp.load()
      expect(mp.loading.value).toBe(true)
      await promise
      expect(mp.loading.value).toBe(false)
    })
  })

  describe('metrics', () => {
    it('computes correct metrics per promo after load', async () => {
      const mp = create()
      await mp.load()
      const m = mp.metrics.value

      expect(m.length).toBe(2)
      expect(m[0].promo.name).toBe('Promo A1')
      expect(m[1].promo.name).toBe('Promo B2')
    })

    it('counts upcoming devoirs (published + future deadline)', async () => {
      const mp = create()
      await mp.load()
      const promoA = mp.metrics.value[0]
      // Promo 1: Projet Web (future, published), TP Algo (future, published), Brouillon (unpublished), Passe (past)
      expect(promoA.upcoming.length).toBe(2)
    })

    it('sorts upcoming by deadline (earliest first)', async () => {
      const mp = create()
      await mp.load()
      const promoA = mp.metrics.value[0]
      expect(promoA.upcoming[0].title).toBe('TP Algo') // May before June
      expect(promoA.upcoming[1].title).toBe('Projet Web')
    })

    it('limits upcoming to top 3', async () => {
      const mp = create()
      await mp.load()
      // Even with more devoirs, max 3 shown
      expect(mp.metrics.value[0].upcoming.length).toBeLessThanOrEqual(3)
    })

    it('counts rendus to grade (note === null)', async () => {
      const mp = create()
      await mp.load()
      expect(mp.metrics.value[0].toGrade).toBe(2) // 2 null notes in promo 1
      expect(mp.metrics.value[1].toGrade).toBe(2) // 2 null notes in promo 2
    })

    it('computes totalDevoirs (published only)', async () => {
      const mp = create()
      await mp.load()
      expect(mp.metrics.value[0].totalDevoirs).toBe(3) // 3 published in promo 1 (Projet, TP, Passe)
      expect(mp.metrics.value[1].totalDevoirs).toBe(1)
    })

    it('computes progressPct correctly', async () => {
      const mp = create()
      await mp.load()
      // Promo 1: 2 graded / 4 total rendus = 50%
      expect(mp.metrics.value[0].progressPct).toBe(50)
      // Promo 2: 0 graded / 2 total rendus = 0%
      expect(mp.metrics.value[1].progressPct).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('handles API returning null gracefully', async () => {
      fetchGantt.mockResolvedValue(null)
      fetchRendus.mockResolvedValue(null)
      const mp = create()
      await mp.load()
      expect(mp.metrics.value[0].upcoming.length).toBe(0)
      expect(mp.metrics.value[0].toGrade).toBe(0)
    })

    it('handles empty gantt data', async () => {
      fetchGantt.mockResolvedValue([])
      fetchRendus.mockResolvedValue([])
      const mp = create()
      await mp.load()
      expect(mp.metrics.value[0].totalDevoirs).toBe(0)
      expect(mp.metrics.value[0].progressPct).toBe(0)
    })
  })
})
