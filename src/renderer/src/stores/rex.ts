/** Store REX — sessions de retour d'experience anonymes. */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi'
import type { RexSession, RexActivity, RexResults } from '@/types'

export const useRexStore = defineStore('rex', () => {
  const { api } = useApi()

  // ── Etat ──────────────────────────────────────────────────────────────────
  const currentSession  = ref<RexSession | null>(null)
  const currentActivity = ref<RexActivity | null>(null)
  const results         = ref<RexResults | null>(null)
  const hasResponded    = ref(false)
  const loading         = ref(false)
  const draftSessions   = ref<RexSession[]>([])

  // ── Computed ─────────────────────────────────────────────────────────────
  const sessionActivities = computed<RexActivity[]>(() =>
    currentSession.value?.activities ?? [],
  )
  const liveActivity = computed<RexActivity | null>(() =>
    sessionActivities.value.find(a => a.status === 'live') ?? null,
  )

  // ── Actions ──────────────────────────────────────────────────────────────

  async function createSession(title: string, promoId: number): Promise<boolean> {
    loading.value = true
    try {
      const data = await api<RexSession>(
        () => window.api.createRexSession({ title, promoId }),
      )
      if (data) {
        currentSession.value = data
        window.api.emitRexJoin(promoId)
        return true
      }
      return false
    } finally {
      loading.value = false
    }
  }

  async function joinByCode(code: string): Promise<boolean> {
    loading.value = true
    try {
      const data = await api<RexSession>(
        () => window.api.getRexSessionByCode(code),
      )
      if (data) {
        currentSession.value = data
        currentActivity.value = data.activities?.find(a => a.status === 'live') ?? null
        hasResponded.value = false
        window.api.emitRexJoin(data.promo_id)
        return true
      }
      return false
    } finally {
      loading.value = false
    }
  }

  function leaveSession() {
    if (currentSession.value) {
      window.api.emitRexLeave(currentSession.value.promo_id)
    }
    currentSession.value = null
    currentActivity.value = null
    results.value = null
    hasResponded.value = false
  }

  async function fetchSession(id: number): Promise<void> {
    loading.value = true
    try {
      const data = await api<RexSession>(
        () => window.api.getRexSession(id),
      )
      if (data) {
        currentSession.value = data
        const live = data.activities?.find(a => a.status === 'live')
        if (live) {
          currentActivity.value = live
          await fetchResults(live.id)
        }
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchActiveForPromo(promoId: number): Promise<boolean> {
    loading.value = true
    try {
      const data = await api<RexSession>(
        () => window.api.getActiveRexSession(promoId),
      )
      if (data && data.id) {
        currentSession.value = data
        currentActivity.value = data.activities?.find(a => a.status === 'live') ?? null
        hasResponded.value = false
        window.api.emitRexJoin(data.promo_id)
        return true
      }
      return false
    } finally {
      loading.value = false
    }
  }

  async function pushActivity(sessionId: number, payload: {
    type: 'sondage_libre' | 'nuage' | 'echelle' | 'question_ouverte'; title: string
    max_words?: number; max_rating?: number
  }): Promise<boolean> {
    const data = await api<RexActivity>(
      () => window.api.addRexActivity(sessionId, payload),
    )
    if (data && currentSession.value) {
      const acts = currentSession.value.activities ?? []
      currentSession.value = { ...currentSession.value, activities: [...acts, data] }
      return true
    }
    return false
  }

  async function launchActivity(activityId: number): Promise<boolean> {
    const data = await api<RexActivity>(
      () => window.api.setRexActivityStatus(activityId, 'live'),
    )
    if (data) {
      currentActivity.value = data
      results.value = null
      if (currentSession.value?.activities) {
        currentSession.value = {
          ...currentSession.value,
          activities: currentSession.value.activities.map(a =>
            a.id === activityId ? data : { ...a, status: a.status === 'live' ? 'closed' as const : a.status },
          ),
        }
      }
      return true
    }
    return false
  }

  async function closeActivity(activityId: number): Promise<boolean> {
    const data = await api<RexActivity>(
      () => window.api.setRexActivityStatus(activityId, 'closed'),
    )
    if (data) {
      currentActivity.value = null
      if (currentSession.value?.activities) {
        currentSession.value = {
          ...currentSession.value,
          activities: currentSession.value.activities.map(a =>
            a.id === activityId ? data : a,
          ),
        }
      }
      return true
    }
    return false
  }

  async function deleteActivity(activityId: number): Promise<boolean> {
    const data = await api(
      () => window.api.deleteRexActivity(activityId),
    )
    if (data !== null && currentSession.value?.activities) {
      currentSession.value = {
        ...currentSession.value,
        activities: currentSession.value.activities.filter(a => a.id !== activityId),
      }
      return true
    }
    return false
  }

  async function submitResponse(activityId: number, payload: { text?: string; words?: string[]; rating?: number }): Promise<boolean> {
    const data = await api(
      () => window.api.submitRexResponse(activityId, payload),
    )
    if (data !== null) {
      hasResponded.value = true
      return true
    }
    return false
  }

  async function fetchResults(activityId: number): Promise<void> {
    const data = await api<RexResults>(
      () => window.api.getRexActivityResults(activityId),
    )
    if (data) results.value = data
  }

  async function startSession(sessionId: number): Promise<boolean> {
    const data = await api<RexSession>(
      () => window.api.updateRexSessionStatus(sessionId, 'active'),
    )
    if (data) {
      currentSession.value = { ...currentSession.value!, status: 'active' }
      return true
    }
    return false
  }

  async function endSession(sessionId: number): Promise<boolean> {
    const data = await api(
      () => window.api.updateRexSessionStatus(sessionId, 'ended'),
    )
    if (data !== null) {
      leaveSession()
      return true
    }
    return false
  }

  async function togglePin(responseId: number, pinned: boolean): Promise<boolean> {
    const data = await api(
      () => window.api.toggleRexPin(responseId, pinned),
    )
    return data !== null
  }

  async function exportSession(sessionId: number, format = 'json'): Promise<unknown> {
    return api(
      () => window.api.exportRexSession(sessionId, format),
    )
  }

  async function fetchDraftSessions(promoId: number): Promise<void> {
    const data = await api<RexSession[]>(
      () => window.api.getRexSessionsForPromo(promoId),
    )
    if (data) draftSessions.value = data
  }

  async function updateActivity(activityId: number, payload: Partial<RexActivity>): Promise<boolean> {
    const data = await api<RexActivity>(
      () => window.api.updateRexActivity(activityId, payload),
    )
    if (data && currentSession.value?.activities) {
      currentSession.value = {
        ...currentSession.value,
        activities: currentSession.value.activities.map(a => a.id === activityId ? data : a),
      }
      return true
    }
    return false
  }

  async function reorderActivities(orderedIds: number[]): Promise<boolean> {
    if (!currentSession.value) return false
    const ordered = orderedIds.map((id, i) => {
      const a = currentSession.value!.activities!.find(x => x.id === id)!
      return { ...a, position: i }
    })
    currentSession.value = { ...currentSession.value, activities: ordered }
    const data = await api<RexSession>(
      () => window.api.reorderRexActivities(currentSession.value!.id, orderedIds),
    )
    if (data) currentSession.value = data
    return !!data
  }

  async function cloneSession(sourceId: number, promoId: number, title?: string): Promise<boolean> {
    loading.value = true
    try {
      const data = await api<RexSession>(
        () => window.api.cloneRexSession(sourceId, { promoId, title }),
      )
      if (data) {
        currentSession.value = data
        draftSessions.value = [data, ...draftSessions.value]
        return true
      }
      return false
    } finally {
      loading.value = false
    }
  }

  async function deleteSession(sessionId: number): Promise<boolean> {
    const data = await api(
      () => window.api.deleteRexSession(sessionId),
    )
    if (data !== undefined) {
      draftSessions.value = draftSessions.value.filter(s => s.id !== sessionId)
      if (currentSession.value?.id === sessionId) leaveSession()
      return true
    }
    return false
  }

  // ── Socket listeners ─────────────────────────────────────────────────────
  const _cleanups: (() => void)[] = []

  function initSocketListeners() {
    disposeSocketListeners()

    _cleanups.push(
      window.api.onRexActivityPushed(({ activity }) => {
        const act = activity as RexActivity
        if (currentSession.value && act.session_id === currentSession.value.id) {
          const acts = currentSession.value.activities ?? []
          currentSession.value = { ...currentSession.value, activities: [...acts, act] }
        }
        if (act.status === 'live') {
          currentActivity.value = act
          hasResponded.value = false
        }
      }),
    )

    _cleanups.push(
      window.api.onRexActivityClosed(({ activityId }) => {
        if (currentActivity.value && currentActivity.value.id === activityId) {
          currentActivity.value = Object.assign({}, currentActivity.value, { status: 'closed' as const })
          fetchResults(activityId)
        }
        if (currentSession.value && currentSession.value.activities) {
          currentSession.value = Object.assign({}, currentSession.value, {
            activities: currentSession.value.activities.map(a =>
              a.id === activityId ? { ...a, status: 'closed' as const } : a,
            ),
          })
        }
      }),
    )

    _cleanups.push(
      window.api.onRexResultsUpdate(({ activityId, data }: { activityId: number; data: unknown }) => {
        if (results.value?.type || currentActivity.value?.id === activityId) {
          results.value = data as RexResults
        }
      }),
    )

    _cleanups.push(
      window.api.onRexSessionStarted(({ sessionId }: { sessionId: number }) => {
        if (currentSession.value && currentSession.value.id === sessionId) {
          currentSession.value = Object.assign({}, currentSession.value, { status: 'active' as const })
        }
      }),
    )

    _cleanups.push(
      window.api.onRexSessionEnded(({ sessionId }: { sessionId: number }) => {
        if (currentSession.value && currentSession.value.id === sessionId) {
          currentSession.value = Object.assign({}, currentSession.value, { status: 'ended' as const })
          currentActivity.value = null
        }
      }),
    )
  }

  function disposeSocketListeners() {
    _cleanups.forEach(fn => fn())
    _cleanups.length = 0
  }

  return {
    // state
    currentSession, currentActivity, results,
    hasResponded, loading, draftSessions,
    // computed
    sessionActivities, liveActivity,
    // actions
    createSession, joinByCode, leaveSession, fetchSession, fetchActiveForPromo,
    fetchDraftSessions, updateActivity, reorderActivities, cloneSession, deleteSession,
    pushActivity, launchActivity, closeActivity, deleteActivity,
    submitResponse, fetchResults, startSession, endSession,
    togglePin, exportSession,
    initSocketListeners, disposeSocketListeners,
  }
})
