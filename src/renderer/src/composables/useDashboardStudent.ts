// ─── Composable : état et logique étudiant du Dashboard ──────────────────────
import { ref, computed, onUnmounted } from 'vue'
import { useTravauxStore } from '@/stores/travaux'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import type { Component } from 'vue'
import type { Devoir }    from '@/types'

export interface StudentProjectCard {
  key: string; label: string; icon: Component | null
  total: number; submitted: number; pending: number; overdue: number; graded: number
  nextDeadline: string | null; avgGrade: number | null
}

const needsSub = (t: Devoir) => t.requires_submission !== 0

export function useDashboardStudent() {
  const travauxStore = useTravauxStore()

  const loadingStudent = ref(true)

  // Timer pour les countdowns
  const studentNow = ref(Date.now())
  let _studentClock: ReturnType<typeof setInterval> | null = null
  let _studentRefresh: ReturnType<typeof setInterval> | null = null

  // ── Stats ──────────────────────────────────────────────────────────────────
  const studentStats = computed(() => {
    const all       = travauxStore.devoirs
    const submitted = all.filter(t => t.depot_id != null)
    const pending   = all.filter(t => t.depot_id == null && needsSub(t))
    const graded    = all.filter(t => t.note != null)
    const counts: Record<string, number> = {}
    for (const t of graded) { if (t.note && t.note !== 'NA') counts[t.note] = (counts[t.note] ?? 0) + 1 }
    let modeGrade: string | null = null
    let modeCount = 0
    for (const [g, c] of Object.entries(counts)) { if (c > modeCount) { modeGrade = g; modeCount = c } }
    return { total: all.length, submitted: submitted.length, pending: pending.length, graded: graded.length, modeGrade }
  })

  // ── Dernières notes (3 max) ─────────────────────────────────────────────────
  const recentGrades = computed(() => {
    return travauxStore.devoirs
      .filter(t => t.note != null && t.note !== 'NA')
      .sort((a, b) => (b.depot_id ?? 0) - (a.depot_id ?? 0))
      .slice(0, 3)
      .map(t => ({ title: t.title, note: t.note!, category: t.category }))
  })

  // ── Toutes les notes (pour l'onglet Mes notes) ───────────────────────────────
  const allGradedDevoirs = computed(() => {
    return travauxStore.devoirs
      .filter(t => t.note != null && t.note !== 'NA')
      .sort((a, b) => (b.depot_id ?? 0) - (a.depot_id ?? 0))
      .map(t => ({
        id: t.id,
        title: t.title,
        note: t.note!,
        category: t.category,
        feedback: t.feedback ?? null,
        deadline: t.deadline,
      }))
  })

  // ── Derniers feedbacks (3 max) ──────────────────────────────────────────────
  const recentFeedback = computed(() => {
    return travauxStore.devoirs
      .filter(t => t.feedback != null && t.feedback.trim() !== '')
      .sort((a, b) => (b.depot_id ?? 0) - (a.depot_id ?? 0))
      .slice(0, 3)
      .map(t => ({ title: t.title, feedback: t.feedback!, note: t.note ?? null, category: t.category }))
  })

  // ── Top 3 devoirs urgents ──────────────────────────────────────────────────
  const urgentActions = computed(() => {
    const now = studentNow.value
    const pending = travauxStore.devoirs.filter(t => t.depot_id == null && needsSub(t) && t.deadline)
    if (!pending.length) return []
    const sorted = [...pending].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    return sorted.slice(0, 5).map(t => {
      const diffMs = new Date(t.deadline).getTime() - now
      const diffDays = Math.ceil(diffMs / 86_400_000)
      let urgency: string
      if (diffMs < 0) urgency = `En retard de ${Math.abs(diffDays)}j`
      else if (diffDays <= 1) urgency = "Aujourd'hui"
      else if (diffDays <= 3) urgency = `Dans ${diffDays}j`
      else if (diffDays <= 7) urgency = `Cette semaine`
      else urgency = `Dans ${diffDays}j`
      return { ...t, urgency, isOverdue: diffMs < 0 }
    })
  })

  // ── Projets étudiant ──────────────────────────────────────────────────────
  const studentProjectCards = computed((): StudentProjectCard[] => {
    const map = new Map<string, Devoir[]>()
    for (const t of travauxStore.devoirs) {
      const cat = t.category?.trim()
      if (!cat) continue
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(t)
    }
    const now = Date.now()
    const cards: StudentProjectCard[] = []
    for (const [key, rows] of map) {
      const { icon, label } = parseCategoryIcon(key)
      const submitted = rows.filter(r => r.depot_id != null)
      const pending   = rows.filter(r => r.depot_id == null && needsSub(r))
      const overdue   = pending.filter(r => now >= new Date(r.deadline).getTime())
      const upcoming  = pending.filter(r => new Date(r.deadline).getTime() > now)
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      const gradeCounts: Record<string, number> = {}
      for (const r of submitted) { if (r.note && r.note !== 'NA') gradeCounts[r.note] = (gradeCounts[r.note] ?? 0) + 1 }
      let avgGrade: number | null = null
      const _projectMode = Object.entries(gradeCounts).sort((a, b) => b[1] - a[1])[0]
      const projectModeGrade = _projectMode?.[0] ?? null
      void projectModeGrade
      const graded = rows.filter(r => r.note != null && r.note !== 'NA')
      cards.push({ key, label, icon, total: rows.length, submitted: submitted.length, pending: pending.length, overdue: overdue.length, graded: graded.length, nextDeadline: upcoming[0]?.deadline ?? null, avgGrade })
    }
    return cards.sort((a, b) => {
      if (a.overdue !== b.overdue) return b.overdue - a.overdue
      if (!a.nextDeadline && !b.nextDeadline) return a.label.localeCompare(b.label)
      if (!a.nextDeadline) return 1; if (!b.nextDeadline) return -1
      return new Date(a.nextDeadline).getTime() - new Date(b.nextDeadline).getTime()
    })
  })

  // ── Chargement + timers ────────────────────────────────────────────────────
  async function loadStudentData() {
    try {
      if (!travauxStore.devoirs.length) await travauxStore.fetchStudentDevoirs()
    } finally { loadingStudent.value = false }
    _studentClock   = setInterval(() => { studentNow.value = Date.now() }, 30_000)
    _studentRefresh = setInterval(() => { travauxStore.fetchStudentDevoirs() }, 60_000)
  }

  function cleanupTimers() {
    if (_studentClock) clearInterval(_studentClock)
    if (_studentRefresh) clearInterval(_studentRefresh)
  }

  return {
    loadingStudent, studentNow,
    studentStats, recentGrades, allGradedDevoirs, recentFeedback, urgentActions, studentProjectCards,
    loadStudentData, cleanupTimers,
  }
}
