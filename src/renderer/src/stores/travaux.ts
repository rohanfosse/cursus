import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from './app'
import type { Devoir, Depot, Ressource } from '@/types'
import { deadlineClass } from '@/utils/date'

export const useTravauxStore = defineStore('travaux', () => {
  const appStore = useAppStore()

  // ── État ──────────────────────────────────────────────────────────────────
  const devoirs        = ref<Devoir[]>([])
  const currentDevoir  = ref<Devoir | null>(null)
  const depots         = ref<Depot[]>([])
  const ressources     = ref<Ressource[]>([])
  const ganttData      = ref<object[]>([])
  const allRendus      = ref<Depot[]>([])
  const loading        = ref(false)
  const view           = ref<'gantt' | 'rendus' | 'student'>('gantt')

  // ── Calculs ───────────────────────────────────────────────────────────────
  const pendingDevoirs = computed(() =>
    devoirs.value.filter((t) => t.depot_id == null && t.type !== 'soutenance' && t.type !== 'cctl'),
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
      const res = await window.api.getStudentTravaux(appStore.currentUser.id)
      devoirs.value = res?.ok ? res.data : []
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
      const res = await window.api.getGanttData(promoId)
      ganttData.value = res?.ok ? res.data : []
    } finally {
      loading.value = false
    }
  }

  async function fetchRendus(promoId: number) {
    loading.value = true
    try {
      const res = await window.api.getAllRendus(promoId)
      allRendus.value = res?.ok ? res.data : []
    } finally {
      loading.value = false
    }
  }

  async function fetchDepots(travailId: number) {
    const res = await window.api.getDepots(travailId)
    depots.value = res?.ok ? res.data : []
  }

  async function fetchRessources(travailId: number) {
    const res = await window.api.getRessources(travailId)
    ressources.value = res?.ok ? res.data : []
  }

  async function openTravail(travailId: number) {
    const res = await window.api.getTravailById(travailId)
    if (res?.ok) {
      currentDevoir.value = res.data
      appStore.currentTravailId = travailId
      await fetchDepots(travailId)
      await fetchRessources(travailId)
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async function createTravail(payload: object) {
    const res = await window.api.createTravail(payload)
    return res?.ok ? res.data : null
  }

  async function addDepot(payload: object) {
    const res = await window.api.addDepot(payload)
    if (res?.ok && appStore.currentTravailId) await fetchDepots(appStore.currentTravailId)
    return res?.ok ?? false
  }

  async function setNote(payload: object) {
    await window.api.setNote(payload)
    if (appStore.currentTravailId) await fetchDepots(appStore.currentTravailId)
  }

  async function setFeedback(payload: object) {
    await window.api.setFeedback(payload)
    if (appStore.currentTravailId) await fetchDepots(appStore.currentTravailId)
  }

  async function markNonSubmittedAsD(travailId: number) {
    await window.api.markNonSubmittedAsD(travailId)
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
