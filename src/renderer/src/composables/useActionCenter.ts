// ─── Composable : centre d'action + santé classe + tendance soumissions ─────
import { computed } from 'vue'
import { useAppStore }     from '@/stores/app'
import { useModalsStore }  from '@/stores/modals'
import { useTravauxStore } from '@/stores/travaux'
import { MAX_ACTION_ITEMS, URGENCY_ORDER } from '@/constants'
import type { Ref }        from 'vue'
import type { GanttRow }   from './useDashboardTeacher'

// ── Types ────────────────────────────────────────────────────────────────────
interface ActionItem {
  id: string
  type: 'grade' | 'deadline' | 'draft' | 'late'
  title: string
  subtitle: string
  urgency: 'critical' | 'warning' | 'info'
  action: () => void
}

export function useActionCenter(ganttFiltered: Ref<GanttRow[]>) {
  const appStore     = useAppStore()
  const modals       = useModalsStore()
  const travauxStore = useTravauxStore()

  // ── Action items ──────────────────────────────────────────────────────────
  const actionItems = computed((): ActionItem[] => {
    const items: ActionItem[] = []
    const now = Date.now()
    const DAY = 86_400_000

    for (const t of ganttFiltered.value) {
      if (!t.published) continue
      const dl = new Date(t.deadline).getTime()
      const submissionRate = t.students_total > 0 ? t.depots_count / t.students_total : 0

      if (t.depots_count > 0 && dl < now) {
        items.push({
          id: `grade-${t.id}`,
          type: 'grade',
          title: t.title,
          subtitle: `${t.depots_count} rendu${t.depots_count > 1 ? 's' : ''} à évaluer`,
          urgency: dl < now - 7 * DAY ? 'critical' : 'warning',
          action: () => { appStore.currentTravailId = t.id; modals.gestionDevoir = true },
        })
      }

      if (dl > now && dl < now + 2 * DAY && submissionRate < 0.5) {
        items.push({
          id: `deadline-${t.id}`,
          type: 'deadline',
          title: t.title,
          subtitle: `Deadline dans ${Math.ceil((dl - now) / DAY * 24)}h - ${Math.round(submissionRate * 100)}% de rendus`,
          urgency: submissionRate < 0.25 ? 'critical' : 'warning',
          action: () => { appStore.currentTravailId = t.id; modals.gestionDevoir = true },
        })
      }

      if (dl < now && t.students_total > 0 && submissionRate < 0.3) {
        items.push({
          id: `late-${t.id}`,
          type: 'late',
          title: t.title,
          subtitle: `Seulement ${t.depots_count}/${t.students_total} rendus (${Math.round(submissionRate * 100)}%)`,
          urgency: 'critical',
          action: () => { appStore.currentTravailId = t.id; modals.suivi = true },
        })
      }
    }

    for (const t of ganttFiltered.value) {
      if (t.published) continue
      const dl = new Date(t.deadline).getTime()
      if (dl > now && dl < now + 7 * DAY) {
        items.push({
          id: `draft-${t.id}`,
          type: 'draft',
          title: t.title,
          subtitle: `Brouillon - deadline dans ${Math.ceil((dl - now) / DAY)}j`,
          urgency: dl < now + 2 * DAY ? 'warning' : 'info',
          action: () => { appStore.currentTravailId = t.id; modals.gestionDevoir = true },
        })
      }
    }

    return items
      .sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency])
      .slice(0, MAX_ACTION_ITEMS)
  })

  // ── Santé de la classe ────────────────────────────────────────────────────
  const classHealth = computed(() => {
    const rows = ganttFiltered.value.filter(t => t.published && t.students_total > 0)
    if (!rows.length) return null

    const avgSubmission = rows.reduce((s, t) => s + (t.depots_count / t.students_total), 0) / rows.length
    const now = Date.now()
    const onTrack = rows.filter(t => {
      const dl = new Date(t.deadline).getTime()
      return dl > now || (t.depots_count / t.students_total) >= 0.7
    }).length / rows.length

    const score = Math.round((avgSubmission * 0.6 + onTrack * 0.4) * 100)
    let status: 'excellent' | 'good' | 'attention' | 'critical'
    if (score >= 80) status = 'excellent'
    else if (score >= 60) status = 'good'
    else if (score >= 40) status = 'attention'
    else status = 'critical'

    const labels = { excellent: 'Excellent', good: 'Bien', attention: 'Attention requise', critical: 'Situation critique' }
    const colors = { excellent: '#22c55e', good: '#27ae60', attention: '#f59e0b', critical: '#ef4444' }

    return { score, status, label: labels[status], color: colors[status], avgSubmission: Math.round(avgSubmission * 100) }
  })

  // ── Tendance soumissions (7 derniers jours) ───────────────────────────────
  const submissionTrend = computed(() => {
    const now = new Date()
    const countsByDate = new Map<string, number>()
    for (const r of travauxStore.allRendus) {
      if (r.submitted_at) {
        const dayKey = r.submitted_at.slice(0, 10)
        countsByDate.set(dayKey, (countsByDate.get(dayKey) ?? 0) + 1)
      }
    }
    const days: { label: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dayStr = d.toISOString().slice(0, 10)
      days.push({
        label: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
        count: countsByDate.get(dayStr) ?? 0,
      })
    }
    const maxCount = Math.max(1, ...days.map(d => d.count))
    return { days, maxCount }
  })

  return {
    actionItems,
    classHealth,
    submissionTrend,
  }
}
