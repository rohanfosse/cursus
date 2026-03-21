// ─── Composable : onglet Analytique enseignant ───────────────────────────────
import { ref, computed, watch } from 'vue'
import { useAppStore }     from '@/stores/app'
import { useApi }          from '@/composables/useApi'
import { MAX_SUBMISSION_RATES } from '@/constants'
import type { Ref }        from 'vue'
import type { GanttRow }   from './useDashboardTeacher'

export const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#27ae60', C: '#f59e0b', D: '#ef4444', NA: '#6b7280',
}

export function useTeacherAnalytics(
  dashTab: Ref<string>,
  ganttFiltered: Ref<GanttRow[]>,
  timeRange?: Ref<string>,
) {
  const appStore = useAppStore()
  const { api }  = useApi()

  const allRendus        = ref<{ note: string | null }[]>([])
  const analyticsLoaded  = ref(false)

  async function loadAnalytics() {
    if (analyticsLoaded.value) return
    const promoId = appStore.activePromoId ?? 0
    const data = await api<{ note: string | null }[]>(
      () => window.api.getAllRendus(promoId) as Promise<{ ok: boolean; data?: { note: string | null }[] }>,
    )
    allRendus.value = data ?? []
    analyticsLoaded.value = true
  }

  watch(dashTab, (tab) => { if (tab === 'analytique') loadAnalytics() })
  watch(() => appStore.activePromoId, () => {
    analyticsLoaded.value = false
    if (dashTab.value === 'analytique') loadAnalytics()
  })

  // ── Distribution des notes ────────────────────────────────────────────────
  const gradeDistribution = computed(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, NA: 0 }
    for (const r of allRendus.value) {
      if (r.note && counts[r.note] !== undefined) counts[r.note]++
    }
    const max = Math.max(1, ...Object.values(counts))
    return Object.entries(counts)
      .filter(([, c]) => c > 0)
      .map(([label, count]) => ({ label, count, pct: Math.round(count / max * 100), color: GRADE_COLORS[label] || '#6b7280' }))
  })

  // ── Taux de soumission par devoir ─────────────────────────────────────────
  const submissionRates = computed(() => {
    const now = Date.now()
    const rangeMs = timeRange?.value === '7d' ? 7 * 86_400_000
      : timeRange?.value === '30d' ? 30 * 86_400_000
      : 0

    return ganttFiltered.value
      .filter(t => {
        if (!t.published || t.students_total <= 0) return false
        if (rangeMs > 0) {
          const dl = new Date(t.deadline).getTime()
          if (dl < now - rangeMs) return false
        }
        return true
      })
      .map(t => ({
        title: t.title,
        rate: Math.round((t.depots_count / t.students_total) * 100),
        depots: t.depots_count,
        total: t.students_total,
      }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, MAX_SUBMISSION_RATES)
  })

  // ── Note fréquente (mode) ─────────────────────────────────────────────────
  const globalModeGrade = computed(() => {
    const counts: Record<string, number> = {}
    for (const r of allRendus.value) {
      if (r.note && r.note !== 'NA') counts[r.note] = (counts[r.note] ?? 0) + 1
    }
    let mode: string | null = null, max = 0
    for (const [g, c] of Object.entries(counts)) { if (c > max) { mode = g; max = c } }
    return mode
  })

  // ── Stats rapides analytique ──────────────────────────────────────────────
  const analyticsStats = computed(() => {
    const total = allRendus.value.length
    const graded = allRendus.value.filter(r => r.note != null).length
    const notGraded = total - graded
    return { total, graded, notGraded }
  })

  return {
    GRADE_COLORS,
    gradeDistribution, submissionRates, globalModeGrade, analyticsStats,
    loadAnalytics,
  }
}
