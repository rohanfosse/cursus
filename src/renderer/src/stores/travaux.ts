import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from './app'
import { useApi } from '@/composables/useApi'
import type { Devoir, Depot, Ressource, GanttRow } from '@/types'
import { deadlineClass } from '@/utils/date'

export const useTravauxStore = defineStore('travaux', () => {
  const appStore = useAppStore()
  const { api } = useApi()

  // ── État ──────────────────────────────────────────────────────────────────
  const devoirs        = ref<Devoir[]>([])
  const currentDevoir  = ref<Devoir | null>(null)
  const depots         = ref<Depot[]>([])
  const ressources     = ref<Ressource[]>([])
  const ganttData      = ref<GanttRow[]>([])
  const allRendus      = ref<Depot[]>([])
  const loading        = ref(false)
  const view           = ref<'gantt' | 'rendus' | 'student'>('gantt')

  // ── Calculs ───────────────────────────────────────────────────────────────
  const pendingDevoirs = computed(() =>
    devoirs.value.filter((t) => t.depot_id == null && t.requires_submission !== 0),
  )

  const hasPendingUrgent = computed(() =>
    pendingDevoirs.value.some((t) =>
      ['deadline-passed', 'deadline-critical'].includes(deadlineClass(t.deadline)),
    ),
  )

  // ── Fetch ─────────────────────────────────────────────────────────────────
  async function fetchStudentDevoirs() {
    if (!appStore.currentUser) return
    loading.value = true
    try {
      const data = await api<Devoir[]>(
        () => window.api.getStudentTravaux(appStore.currentUser!.id),
      )
      devoirs.value = data ?? []
    } finally {
      loading.value = false
    }
  }

  /** @deprecated use fetchStudentDevoirs */
  async function fetchStudentTravaux() {
    return fetchStudentDevoirs()
  }

  async function fetchGantt(promoId: number) {
    loading.value = true
    try {
      const data = await api<GanttRow[]>(() => window.api.getGanttData(promoId) as Promise<{ ok: boolean; data?: GanttRow[]; error?: string }>)
      ganttData.value = data ?? []
    } finally {
      loading.value = false
    }
  }

  async function fetchRendus(promoId: number) {
    loading.value = true
    try {
      const data = await api<Depot[]>(() => window.api.getAllRendus(promoId))
      allRendus.value = data ?? []
    } finally {
      loading.value = false
    }
  }

  async function fetchDepots(travailId: number) {
    const data = await api<Depot[]>(() => window.api.getDepots(travailId))
    depots.value = data ?? []
  }

  async function fetchRessources(travailId: number) {
    const data = await api<Ressource[]>(() => window.api.getRessources(travailId))
    ressources.value = data ?? []
  }

  async function openTravail(travailId: number) {
    const data = await api<Devoir>(() => window.api.getTravailById(travailId))
    if (data) {
      currentDevoir.value = data
      appStore.currentTravailId = travailId
      await fetchDepots(travailId)
      await fetchRessources(travailId)
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async function createTravail(payload: object) {
    return await api(() => window.api.createTravail(payload))
  }

  async function addDepot(payload: object) {
    const data = await api(() => window.api.addDepot(payload), 'submit')
    if (data !== null && appStore.currentTravailId) await fetchDepots(appStore.currentTravailId)
    return data !== null
  }

  async function setNote(payload: object) {
    await api(() => window.api.setNote(payload), 'grade')
    if (appStore.currentTravailId) await fetchDepots(appStore.currentTravailId)
  }

  async function setFeedback(payload: object) {
    await api(() => window.api.setFeedback(payload), 'feedback')
    if (appStore.currentTravailId) await fetchDepots(appStore.currentTravailId)
  }

  async function markNonSubmittedAsD(travailId: number) {
    await api(() => window.api.markNonSubmittedAsD(travailId))
    await fetchDepots(travailId)
  }

  function setView(v: 'gantt' | 'rendus' | 'student') {
    view.value = v
  }

  return {
    // renamed
    devoirs, currentDevoir, pendingDevoirs,
    fetchStudentDevoirs,
    // unchanged
    depots, ressources,
    ganttData, allRendus, loading, view,
    hasPendingUrgent,
    fetchStudentTravaux, fetchGantt, fetchRendus,
    fetchDepots, fetchRessources, openTravail,
    createTravail, addDepot, setNote, setFeedback,
    markNonSubmittedAsD, setView,
  }
})
