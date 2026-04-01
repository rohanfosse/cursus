/**
 * Composable multi-promo : charge les donnees de toutes les promos du prof
 * et expose les metriques cles par promo (devoirs a venir, rendus en attente, deadlines).
 */
import { ref, computed, type Ref } from 'vue'
import type { Promotion } from '@/types'

export interface PromoMetrics {
  promo: Promotion
  upcoming: { id: number; title: string; deadline: string; channel_id: number; channel_name: string; depots_count: number; students_total: number }[]
  toGrade: number
  totalDevoirs: number
  progressPct: number
}

export interface UseMultiPromoOptions {
  promos: Ref<Promotion[]>
  fetchGantt: (promoId: number) => Promise<GanttRow[] | null>
  fetchRendus: (promoId: number) => Promise<RenduRow[] | null>
}

export interface GanttRow {
  id: number
  title: string
  deadline: string
  published: number
  channel_id: number
  channel_name: string
  depots_count: number
  students_total: number
}

export interface RenduRow {
  travail_id: number
  note: string | null
}

export function useMultiPromo({ promos, fetchGantt, fetchRendus }: UseMultiPromoOptions) {
  const loading = ref(false)
  const ganttByPromo = ref<Record<number, GanttRow[]>>({})
  const rendusByPromo = ref<Record<number, RenduRow[]>>({})

  const hasMultiplePromos = computed(() => promos.value.length >= 2)

  async function load() {
    if (!hasMultiplePromos.value) return
    loading.value = true
    try {
      const results = await Promise.all(
        promos.value.map(async (p) => {
          const [gantt, rendus] = await Promise.all([
            fetchGantt(p.id),
            fetchRendus(p.id),
          ])
          return { promoId: p.id, gantt: gantt ?? [], rendus: rendus ?? [] }
        }),
      )
      const gMap: Record<number, GanttRow[]> = {}
      const rMap: Record<number, RenduRow[]> = {}
      for (const r of results) {
        gMap[r.promoId] = r.gantt
        rMap[r.promoId] = r.rendus
      }
      ganttByPromo.value = gMap
      rendusByPromo.value = rMap
    } finally {
      loading.value = false
    }
  }

  const metrics = computed<PromoMetrics[]>(() => {
    const now = new Date().toISOString()
    return promos.value.map((p) => {
      const gantt = ganttByPromo.value[p.id] ?? []
      const rendus = rendusByPromo.value[p.id] ?? []

      // Devoirs a venir (published, deadline > now)
      const upcoming = gantt
        .filter(g => g.published === 1 && g.deadline > now)
        .sort((a, b) => a.deadline.localeCompare(b.deadline))
        .slice(0, 3)
        .map(g => ({
          id: g.id,
          title: g.title,
          deadline: g.deadline,
          channel_id: g.channel_id,
          channel_name: g.channel_name,
          depots_count: g.depots_count,
          students_total: g.students_total,
        }))

      // Rendus en attente de note (submitted but not graded)
      const toGrade = rendus.filter(r => r.note == null).length

      // Progression globale
      const totalDevoirs = gantt.filter(g => g.published === 1).length
      const allRendus = rendus.length
      const gradedRendus = rendus.filter(r => r.note != null).length
      const progressPct = allRendus > 0 ? Math.round((gradedRendus / allRendus) * 100) : 0

      return { promo: p, upcoming, toGrade, totalDevoirs, progressPct }
    })
  })

  return {
    loading,
    hasMultiplePromos,
    metrics,
    load,
    ganttByPromo,
    rendusByPromo,
  }
}
