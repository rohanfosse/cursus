/**
 * Logique de notation en lot (batch grading).
 * Gère la navigation, le filtre, l'auto-save debounced, et les raccourcis clavier.
 * Testable indépendamment du composant DepotsModal.
 */
import { ref, computed, watch, type Ref } from 'vue'
import type { Depot } from '@/types'

export type BatchFilter = 'all' | 'ungraded' | 'graded'
const GRADES = ['A', 'B', 'C', 'D'] as const
type Grade = typeof GRADES[number]

export interface BatchGradingOptions {
  depots: Ref<Depot[]>
  onSave: (depotId: number, note: string, feedback: string) => Promise<void>
}

export function useBatchGrading({ depots, onSave }: BatchGradingOptions) {
  const active        = ref(false)
  const activeIndex   = ref(0)
  const filter        = ref<BatchFilter>('all')
  const pendingNote   = ref('')
  const pendingFeedback = ref('')
  const saving        = ref(false)
  const savedFlash    = ref(false)

  // ── Filtered list ──────────────────────────────────────────────────
  const filteredList = computed(() => {
    const list = [...depots.value].sort((a, b) =>
      a.student_name.localeCompare(b.student_name),
    )
    if (filter.value === 'ungraded') return list.filter(d => d.note == null)
    if (filter.value === 'graded')   return list.filter(d => d.note != null)
    return list
  })

  const activeDepot = computed(() => filteredList.value[activeIndex.value] ?? null)

  // ── Progress ───────────────────────────────────────────────────────
  const totalCount  = computed(() => depots.value.length)
  const gradedCount = computed(() => depots.value.filter(d => d.note != null).length)
  const progressPct = computed(() =>
    totalCount.value ? Math.round((gradedCount.value / totalCount.value) * 100) : 0,
  )

  // ── Grade distribution ─────────────────────────────────────────────
  const distribution = computed(() => {
    const counts: Record<string, number> = {}
    for (const d of depots.value) {
      if (d.note) counts[d.note] = (counts[d.note] ?? 0) + 1
    }
    return (['A', 'B', 'C', 'D', 'NA'] as const)
      .filter(g => counts[g])
      .map(g => ({ grade: g, count: counts[g] }))
  })

  // ── Navigation ─────────────────────────────────────────────────────
  function selectIndex(i: number) {
    const clamped = Math.max(0, Math.min(i, filteredList.value.length - 1))
    if (clamped === activeIndex.value) return
    activeIndex.value = clamped
  }

  function next() { selectIndex(activeIndex.value + 1) }
  function prev() { selectIndex(activeIndex.value - 1) }

  function selectDepot(depotId: number) {
    const idx = filteredList.value.findIndex(d => d.id === depotId)
    if (idx >= 0) activeIndex.value = idx
  }

  // ── Sync pending values when active depot changes ──────────────────
  watch(activeDepot, (d) => {
    if (!d) return
    pendingNote.value     = d.note ?? ''
    pendingFeedback.value = d.feedback ?? ''
  })

  // ── Set grade ──────────────────────────────────────────────────────
  function setGrade(grade: Grade) {
    pendingNote.value = grade
  }

  // ── Save ───────────────────────────────────────────────────────────
  async function save(): Promise<boolean> {
    const d = activeDepot.value
    if (!d || saving.value) return false
    saving.value = true
    try {
      await onSave(d.id, pendingNote.value, pendingFeedback.value)
      savedFlash.value = true
      setTimeout(() => { savedFlash.value = false }, 600)
      return true
    } finally {
      saving.value = false
    }
  }

  // ── Auto-save on navigation (save current before moving) ───────────
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function debouncedSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => { save() }, 300)
  }

  // Watch index changes to trigger auto-save of *previous* depot
  let prevDepotId: number | null = null
  let skipAutoSave = false
  watch(activeIndex, async () => {
    if (prevDepotId != null && active.value && !skipAutoSave) {
      if (saveTimer) clearTimeout(saveTimer)
      await save()
    }
    skipAutoSave = false
  })
  watch(activeDepot, (d) => {
    prevDepotId = d?.id ?? null
  })

  // ── Save + advance (skips auto-save since we save manually) ────────
  async function saveAndNext() {
    const ok = await save()
    if (ok) {
      skipAutoSave = true
      next()
    }
  }

  // ── Keyboard handler ──────────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    if (!active.value) return

    const target = e.target as HTMLElement
    const inTextarea = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT'

    // Escape exits batch mode
    if (e.key === 'Escape') {
      e.preventDefault()
      active.value = false
      return
    }

    // Arrow keys navigate students
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (e.key === 'ArrowUp') prev()
      else next()
      return
    }

    // Enter in textarea: save + next
    if (e.key === 'Enter' && inTextarea && !e.shiftKey) {
      e.preventDefault()
      saveAndNext()
      return
    }

    // Grade keys (only when not in textarea)
    if (!inTextarea) {
      const upper = e.key.toUpperCase()
      if (GRADES.includes(upper as Grade)) {
        e.preventDefault()
        setGrade(upper as Grade)
        return
      }
    }
  }

  // ── Toggle ────────────────────────────────────────────────────────
  function toggle() {
    active.value = !active.value
    if (active.value) {
      activeIndex.value = 0
      const d = filteredList.value[0]
      if (d) {
        pendingNote.value     = d.note ?? ''
        pendingFeedback.value = d.feedback ?? ''
      }
    }
  }

  function cleanup() {
    if (saveTimer) clearTimeout(saveTimer)
  }

  return {
    // State
    active,
    activeIndex,
    filter,
    pendingNote,
    pendingFeedback,
    saving,
    savedFlash,

    // Computed
    filteredList,
    activeDepot,
    totalCount,
    gradedCount,
    progressPct,
    distribution,

    // Actions
    toggle,
    next,
    prev,
    selectIndex,
    selectDepot,
    setGrade,
    save,
    saveAndNext,
    debouncedSave,
    handleKeydown,
    cleanup,
  }
}
