/**
 * Groupes de devoirs côté étudiant : en retard, urgents, à venir, événements, rendus.
 * Used by DevoirsView.vue
 */
import { computed, ref, type Ref } from 'vue'
import { useAppStore }     from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { needsSubmission, isExpired, isEventType } from '@/utils/devoir'
import { parseCategoryIcon } from '@/utils/categoryIcon'

export function useDevoirsStudent(now: Ref<number>) {
  const appStore     = useAppStore()
  const travauxStore = useTravauxStore()

  // ── Groupes urgence étudiant ──────────────────────────────────────────────────
  const studentGroups = computed(() => {
    const all = appStore.activeProject
      ? travauxStore.devoirs.filter(t => t.category === appStore.activeProject)
      : travauxStore.devoirs
    return {
      overdue:   all.filter(t => t.depot_id == null && needsSubmission(t) && isExpired(t.deadline, now.value)),
      urgent:    all.filter(t => {
        if (t.depot_id != null || isExpired(t.deadline, now.value) || !needsSubmission(t)) return false
        return new Date(t.deadline).getTime() - now.value < 3 * 86_400_000
      }),
      pending:   all.filter(t => {
        if (t.depot_id != null || isExpired(t.deadline, now.value) || !needsSubmission(t)) return false
        return new Date(t.deadline).getTime() - now.value >= 3 * 86_400_000
      }),
      event:     all.filter(t => !needsSubmission(t) && t.depot_id == null),
      submitted: all.filter(t => t.depot_id != null || (!needsSubmission(t) && isExpired(t.deadline, now.value))),
    }
  })

  // Simplification : submitted = ceux qui ont depot_id
  const filteredDevoirs = computed(() =>
    appStore.activeProject
      ? travauxStore.devoirs.filter(t => t.category === appStore.activeProject)
      : travauxStore.devoirs
  )
  const submittedDevoirs = computed(() => filteredDevoirs.value.filter(t => t.depot_id != null))
  const pendingDeposit   = computed(() =>
    filteredDevoirs.value.filter(t => t.depot_id == null && needsSubmission(t)),
  )
  const eventDevoirs     = computed(() => filteredDevoirs.value.filter(t => !needsSubmission(t)))

  const studentStats = computed(() => ({
    total:     filteredDevoirs.value.length,
    pending:   studentGroups.value.overdue.length + studentGroups.value.urgent.length + studentGroups.value.pending.length,
    urgent:    studentGroups.value.overdue.length + studentGroups.value.urgent.length,
    submitted: submittedDevoirs.value.length,
  }))

  // ── Vue étudiant : résumé par projet (sans filtre actif) ──────────────────────
  const studentProjectOverview = computed(() => {
    if (appStore.activeProject) return []
    const map = new Map<string, { key: string; label: string; total: number; submitted: number; pending: number }>()
    for (const t of travauxStore.devoirs) {
      const cat   = t.category?.trim() || null
      const mKey  = cat ?? '__none__'
      if (!map.has(mKey)) {
        map.set(mKey, {
          key:       mKey,
          label:     cat ? parseCategoryIcon(cat).label || cat : 'Sans projet',
          total:     0,
          submitted: 0,
          pending:   0,
        })
      }
      const g = map.get(mKey)!
      g.total++
      if (t.depot_id != null) g.submitted++
      else if (!isEventType(t.type)) g.pending++
    }
    return [...map.values()]
      .filter(g => g.total > 0 && g.key !== '__none__')
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  })

  const error = ref(false)

  // ── Chargement des données (branche étudiant) ────────────────────────────────
  async function loadView() {
    try {
      error.value = false
      await travauxStore.fetchStudentDevoirs()
    } catch (e) {
      console.warn('[Devoirs] Erreur chargement devoirs étudiant:', e)
      error.value = true
    }
  }

  return {
    // Computeds
    studentGroups,
    filteredDevoirs,
    submittedDevoirs,
    pendingDeposit,
    eventDevoirs,
    studentStats,
    studentProjectOverview,
    error,

    // Functions
    loadView,
  }
}
