/**
 * Groupes de devoirs côté étudiant : en retard, urgents, à venir, événements, rendus.
 * Used by DevoirsView.vue
 */
import { computed, ref, watch, type Ref } from 'vue'
import { useAppStore }     from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { needsSubmission, isExpired, isEventType } from '@/utils/devoir'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import { nextUpcoming } from '@/utils/devoirFilters'
import { groupByCategory } from '@/utils/projectGrouping'
import { safeGetJSON, safeSetJSON } from '@/utils/safeStorage'
import type { Devoir } from '@/types'

type StudentSort = 'deadline' | 'title' | 'type'
const SEARCH_KEY = 'cc_student_devoirs_search'
const SORT_KEY   = 'cc_student_devoirs_sort'

export function useDevoirsStudent(now: Ref<number>) {
  const appStore     = useAppStore()
  const travauxStore = useTravauxStore()
  const studentSearch = ref<string>(safeGetJSON<string>(SEARCH_KEY, ''))
  const studentSort = ref<StudentSort>(safeGetJSON<StudentSort>(SORT_KEY, 'deadline'))

  watch(studentSearch, v => safeSetJSON(SEARCH_KEY, v))
  watch(studentSort,   v => safeSetJSON(SORT_KEY, v))

  // ── Groupes urgence étudiant (single-pass) ────────────────────────────────────
  const studentGroups = computed(() => {
    const all = appStore.activeProject
      ? travauxStore.devoirs.filter(t => t.category === appStore.activeProject)
      : travauxStore.devoirs
    const overdue: typeof all = []
    const urgent: typeof all = []
    const pending: typeof all = []
    const event: typeof all = []
    const submitted: typeof all = []
    const n = now.value
    const THREE_DAYS = 3 * 86_400_000

    for (const t of all) {
      const needs = needsSubmission(t)
      const expired = isExpired(t.deadline, n)
      if (t.depot_id != null) { submitted.push(t); continue }
      if (!needs && expired) { submitted.push(t); continue }
      if (!needs) { event.push(t); continue }
      if (expired) { overdue.push(t); continue }
      const timeLeft = new Date(t.deadline).getTime() - n
      if (timeLeft < THREE_DAYS) urgent.push(t)
      else pending.push(t)
    }
    return { overdue, urgent, pending, event, submitted }
  })

  // Simplification : submitted = ceux qui ont depot_id
  const filteredDevoirs = computed(() => {
    let items = appStore.activeProject
      ? travauxStore.devoirs.filter(t => t.category === appStore.activeProject)
      : travauxStore.devoirs
    const q = studentSearch.value.toLowerCase().trim()
    if (q) items = items.filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
    if (studentSort.value === 'title') {
      items = [...items].sort((a, b) => a.title.localeCompare(b.title, 'fr'))
    } else if (studentSort.value === 'type') {
      items = [...items].sort((a, b) => a.type.localeCompare(b.type))
    }
    return items
  })
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
  function studentProjectStats(cat: string): { submitted: number; total: number; pct: number; devoirCount: number; nextDeadline: string | null; gradedCount: number; bestGrade: string | null } {
    const devs = travauxStore.devoirs.filter(t => t.category?.trim() === cat)
    const submittable = devs.filter(t => needsSubmission(t))
    const submitted = submittable.filter(t => t.depot_id != null).length
    const total = submittable.length
    const pct = total > 0 ? Math.round(submitted / total * 100) : 0

    const upcoming = devs
      .filter(t => new Date(t.deadline).getTime() > now.value)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    const nextDeadline = upcoming.length > 0 ? upcoming[0].deadline : null

    // Grade info
    const graded = devs.filter(t => t.note)
    const gradedCount = graded.length
    const GRADE_ORDER = ['a', 'b', 'c', 'd']
    const grades = graded.map(t => t.note!.toString().toLowerCase().charAt(0)).filter(g => GRADE_ORDER.includes(g))
    const bestGrade = grades.length > 0
      ? grades.sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b))[0].toUpperCase()
      : null

    return { submitted, total, pct, devoirCount: devs.length, nextDeadline, gradedCount, bestGrade }
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
    // Refs
    studentSearch,
    studentSort,
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
