/**
 * Groupes de devoirs côté étudiant : en retard, urgents, à venir, événements, rendus.
 * Used by DevoirsView.vue
 */
import { computed, ref, type Ref } from 'vue'
import { useAppStore }     from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { needsSubmission, isExpired, isEventType } from '@/utils/devoir'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import { nextUpcoming } from '@/utils/devoirFilters'
import { groupByCategory } from '@/utils/projectGrouping'
import type { Devoir } from '@/types'

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
    const catMap = groupByCategory(travauxStore.devoirs)
    // Also collect devoirs without category
    const noCat = travauxStore.devoirs.filter(t => !t.category?.trim())
    const results: { key: string; label: string; total: number; submitted: number; pending: number }[] = []
    for (const [key, devs] of catMap) {
      const label = parseCategoryIcon(key).label || key
      let submitted = 0, pending = 0
      for (const t of devs) {
        if (t.depot_id != null) submitted++
        else if (!isEventType(t.type)) pending++
      }
      results.push({ key, label, total: devs.length, submitted, pending })
    }
    if (noCat.length) {
      let submitted = 0, pending = 0
      for (const t of noCat) {
        if (t.depot_id != null) submitted++
        else if (!isEventType(t.type)) pending++
      }
      results.push({ key: '__none__', label: 'Sans projet', total: noCat.length, submitted, pending })
    }
    return results
      .filter(g => g.total > 0 && g.key !== '__none__')
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  })

  // ── Accueil étudiant : prochains événements par type ─────────────────────────
  const nextExams = computed(() =>
    nextUpcoming(travauxStore.devoirs, ['cctl', 'etude_de_cas'], now.value, 3),
  )

  const nextLivrables = computed(() =>
    nextUpcoming(travauxStore.devoirs, ['livrable'], now.value, 3),
  )

  const nextSoutenances = computed(() =>
    nextUpcoming(travauxStore.devoirs, ['soutenance'], now.value, 3),
  )

  // ── Accueil étudiant : catégories (pour la grille de projets) ──────────────
  const studentCategories = computed(() => {
    const cats = new Set<string>()
    for (const t of travauxStore.devoirs) {
      const cat = t.category?.trim()
      if (cat) cats.add(cat)
    }
    return [...cats].sort((a, b) => a.localeCompare(b, 'fr'))
  })

  /** Type counts per project category */
  function studentProjectTypeCounts(cat: string): { type: string; count: number }[] {
    const map = new Map<string, number>()
    for (const t of travauxStore.devoirs) {
      if (t.category?.trim() !== cat) continue
      map.set(t.type, (map.get(t.type) ?? 0) + 1)
    }
    return [...map.entries()].map(([type, count]) => ({ type, count }))
  }

  /** Stats per project category */
  function studentProjectStats(cat: string): { submitted: number; total: number; pct: number; devoirCount: number; nextDeadline: string | null } {
    const devs = travauxStore.devoirs.filter(t => t.category?.trim() === cat)
    const submittable = devs.filter(t => needsSubmission(t))
    const submitted = submittable.filter(t => t.depot_id != null).length
    const total = submittable.length
    const pct = total > 0 ? Math.round(submitted / total * 100) : 0

    const upcoming = devs
      .filter(t => new Date(t.deadline).getTime() > now.value)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    const nextDeadline = upcoming.length > 0 ? upcoming[0].deadline : null

    return { submitted, total, pct, devoirCount: devs.length, nextDeadline }
  }

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
    // Accueil
    nextExams,
    nextLivrables,
    nextSoutenances,
    studentCategories,
    studentProjectTypeCounts,
    studentProjectStats,
    error,

    // Functions
    loadView,
  }
}
