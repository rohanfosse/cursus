// ─── Store Pinia - Live Quiz (sessions interactives en temps réel) ───────────
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from './app'
import { useApi } from '@/composables/useApi'
import type { LiveSession, LiveActivity, LiveResults, LeaderboardEntry, LiveScoreResult, LiveSessionWithStats, LiveStats } from '@/types'

export const useLiveStore = defineStore('live', () => {
  const appStore = useAppStore()
  const { api } = useApi()

  // ── État ──────────────────────────────────────────────────────────────────
  const currentSession   = ref<LiveSession | null>(null)
  const currentActivity  = ref<LiveActivity | null>(null)
  const results          = ref<LiveResults | null>(null)
  const participantCount = ref(0)
  const hasResponded     = ref(false)
  const loading          = ref(false)
  const error            = ref<string | null>(null)
  const draftSessions    = ref<LiveSession[]>([])
  const pastSessions     = ref<LiveSession[]>([])
  const leaderboard      = ref<LeaderboardEntry[]>([])
  const myScore          = ref<LiveScoreResult | null>(null)
  const timerStartedAt   = ref<string | null>(null)

  // ── Computed ─────────────────────────────────────────────────────────────
  const sessionActivities = computed<LiveActivity[]>(() =>
    currentSession.value?.activities ?? [],
  )
  const liveActivity = computed<LiveActivity | null>(() =>
    sessionActivities.value.find(a => a.status === 'live') ?? null,
  )

  // ── Actions ──────────────────────────────────────────────────────────────

  async function createSession(title: string, promoId: number): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const data = await api<LiveSession>(
        () => window.api.createLiveV2Session({ title, promoId }),
      )
      if (data) {
        currentSession.value = data
        window.api.emitLiveJoin(promoId)
        return true
      }
      error.value = 'Impossible de créer la session'
      return false
    } finally {
      loading.value = false
    }
  }

  async function joinByCode(code: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      const data = await api<LiveSession>(
        () => window.api.getLiveV2SessionByCode(code),
      )
      if (data) {
        currentSession.value = data
        currentActivity.value = data.activities?.find(a => a.status === 'live') ?? null
        hasResponded.value = false
        window.api.emitLiveJoin(data.promo_id)
        return true
      }
      error.value = 'Code de session invalide ou session introuvable'
      return false
    } finally {
      loading.value = false
    }
  }

  function leaveSession() {
    if (currentSession.value) {
      window.api.emitLiveLeave(currentSession.value.promo_id)
    }
    currentSession.value = null
    currentActivity.value = null
    results.value = null
    hasResponded.value = false
    participantCount.value = 0
    leaderboard.value = []
    myScore.value = null
    timerStartedAt.value = null
  }

  async function fetchSession(id: number): Promise<void> {
    loading.value = true
    try {
      const data = await api<LiveSession>(
        () => window.api.getLiveV2Session(id),
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
      const data = await api<LiveSession>(
        () => window.api.getActiveLiveV2Session(promoId),
      )
      if (data && data.id) {
        currentSession.value = data
        currentActivity.value = data.activities?.find(a => a.status === 'live') ?? null
        hasResponded.value = false
        window.api.emitLiveJoin(data.promo_id)
        return true
      }
      return false
    } finally {
      loading.value = false
    }
  }

  async function pushActivity(sessionId: number, payload: {
    type: 'qcm' | 'vrai_faux' | 'reponse_courte' | 'association' | 'estimation' | 'live_code' | 'board'; title: string
    options?: string[] | string | null; multi?: number
    timer_seconds?: number; correct_answers?: number[] | string[]
    language?: string
  }): Promise<boolean> {
    const data = await api<LiveActivity>(
      () => window.api.addLiveV2Activity(sessionId, payload),
    )
    if (data && currentSession.value) {
      const acts = currentSession.value.activities ?? []
      currentSession.value = { ...currentSession.value, activities: [...acts, data] }
      return true
    }
    return false
  }

  async function launchActivity(activityId: number): Promise<boolean> {
    const data = await api<LiveActivity>(
      () => window.api.setLiveV2ActivityStatus(activityId, 'live'),
    )
    if (data) {
      currentActivity.value = data
      results.value = null
      myScore.value = null
      timerStartedAt.value = data.started_at ?? null
      // Update in session activities list
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
    const data = await api<LiveActivity>(
      () => window.api.setLiveV2ActivityStatus(activityId, 'closed'),
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
      () => window.api.deleteLiveV2Activity(activityId),
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

  async function submitResponse(activityId: number, payload: { answers?: number[]; text?: string; words?: string[]; answer?: string }): Promise<LiveScoreResult | null> {
    const data = await api(
      () => window.api.submitLiveV2Response(activityId, payload),
    ) as { isCorrect: boolean | null; points: number; rank: number | null } | null
    if (data !== null) {
      hasResponded.value = true
      if (data && typeof data === 'object' && 'isCorrect' in data) {
        myScore.value = data as LiveScoreResult
      }
      return data as LiveScoreResult
    }
    return null
  }

  async function fetchLeaderboard(sessionId: number): Promise<void> {
    const data = await api(
      () => window.api.getLiveV2Leaderboard(sessionId),
    ) as LeaderboardEntry[] | null
    if (data && Array.isArray(data)) {
      leaderboard.value = data
    }
  }

  async function fetchResults(activityId: number): Promise<void> {
    const data = await api<LiveResults>(
      () => window.api.getLiveV2ActivityResults(activityId) as Promise<{ ok: boolean; data: LiveResults; error?: string }>,
    )
    if (data) results.value = data
  }

  async function endSession(sessionId: number): Promise<boolean> {
    const data = await api(
      () => window.api.updateLiveV2SessionStatus(sessionId, 'ended'),
    )
    if (data !== null) {
      leaveSession()
      return true
    }
    return false
  }

  async function startSession(sessionId: number): Promise<boolean> {
    const data = await api<LiveSession>(
      () => window.api.updateLiveV2SessionStatus(sessionId, 'active'),
    )
    if (data) {
      currentSession.value = { ...currentSession.value!, status: 'active' }
      return true
    }
    return false
  }

  async function fetchDraftSessions(promoId: number): Promise<void> {
    const data = await api<LiveSession[]>(
      () => window.api.getLiveV2SessionsForPromo(promoId),
    )
    if (data) draftSessions.value = data
  }

  async function updateActivity(activityId: number, payload: Partial<LiveActivity>): Promise<boolean> {
    const data = await api<LiveActivity>(
      () => window.api.updateLiveV2Activity(activityId, payload),
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
    // Optimistic update
    const ordered = orderedIds.map((id, i) => {
      const a = currentSession.value!.activities!.find(x => x.id === id)!
      return { ...a, position: i }
    })
    currentSession.value = { ...currentSession.value, activities: ordered }
    const data = await api<LiveSession>(
      () => window.api.reorderLiveV2Activities(currentSession.value!.id, orderedIds),
    )
    if (data) currentSession.value = data
    return !!data
  }

  async function cloneSession(sourceId: number, promoId: number, title?: string): Promise<boolean> {
    loading.value = true
    try {
      const data = await api<LiveSession>(
        () => window.api.cloneLiveV2Session(sourceId, { promoId, title }),
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
      () => window.api.deleteLiveV2Session(sessionId),
    )
    if (data !== undefined) {
      draftSessions.value = draftSessions.value.filter(s => s.id !== sessionId)
      if (currentSession.value?.id === sessionId) leaveSession()
      return true
    }
    return false
  }

  // ── Export CSV ──────────────────────────────────────────────────────────
  async function exportCsv(sessionId: number): Promise<string | null> {
    const data = await api<string>(
      () => window.api.exportLiveV2SessionCsv(sessionId),
    )
    return data ?? null
  }

  // ── Historique & Stats ──────────────────────────────────────────────────
  const historySessions = ref<LiveSessionWithStats[]>([])
  const stats           = ref<LiveStats | null>(null)

  async function fetchHistory(promoId: number, filters?: { search?: string; dateFrom?: string; dateTo?: string }): Promise<void> {
    loading.value = true
    try {
      const data = await api<LiveSessionWithStats[]>(
        () => window.api.getLiveV2HistoryForPromo(promoId, filters),
      )
      if (data) historySessions.value = data
    } finally {
      loading.value = false
    }
  }

  async function fetchStats(promoId: number): Promise<void> {
    loading.value = true
    try {
      const data = await api<LiveStats>(
        () => window.api.getLiveV2StatsForPromo(promoId),
      )
      if (data) stats.value = data
    } finally {
      loading.value = false
    }
  }

  // ── Socket listeners ─────────────────────────────────────────────────────
  const _cleanups: (() => void)[] = []

  function initSocketListeners() {
    disposeSocketListeners()

    _cleanups.push(
      window.api.onLiveActivityPushed(({ activity }) => {
        const act = activity as LiveActivity
        if (currentSession.value && act.session_id === currentSession.value.id) {
          const acts = currentSession.value.activities ?? []
          currentSession.value = { ...currentSession.value, activities: [...acts, act] }
        }
        // Set timer info for students
        if (act.status === 'live') {
          currentActivity.value = act
          timerStartedAt.value = act.started_at ?? null
          hasResponded.value = false
          myScore.value = null
        }
      }),
    )

    _cleanups.push(
      window.api.onLiveActivityClosed(({ activityId, leaderboard: lb }: { activityId: number; leaderboard?: unknown[] }) => {
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
        if (lb && Array.isArray(lb)) {
          leaderboard.value = lb as LeaderboardEntry[]
        }
        timerStartedAt.value = null
      }),
    )

    _cleanups.push(
      window.api.onLiveResultsUpdate(({ activityId, data }: { activityId: number; data: unknown }) => {
        if (results.value?.activityId === activityId || currentActivity.value?.id === activityId) {
          results.value = data as LiveResults
        }
      }),
    )

    _cleanups.push(
      window.api.onLiveScoresUpdate(({ leaderboard: lb }: { sessionId: number; activityId: number; leaderboard: unknown[] }) => {
        if (lb && Array.isArray(lb)) {
          leaderboard.value = lb as LeaderboardEntry[]
        }
      }),
    )

    _cleanups.push(
      window.api.onLiveSessionStarted(({ sessionId }: { sessionId: number }) => {
        if (currentSession.value && currentSession.value.id === sessionId) {
          currentSession.value = Object.assign({}, currentSession.value, { status: 'active' as const })
        }
      }),
    )

    _cleanups.push(
      window.api.onLiveSessionEnded(({ sessionId }: { sessionId: number }) => {
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
    currentSession, currentActivity, results, participantCount,
    hasResponded, loading, error, draftSessions, pastSessions,
    leaderboard, myScore, timerStartedAt,
    historySessions, stats,
    // computed
    sessionActivities, liveActivity,
    // actions
    createSession, joinByCode, leaveSession, fetchSession, fetchActiveForPromo,
    fetchDraftSessions, updateActivity, reorderActivities, cloneSession, deleteSession,
    pushActivity, launchActivity, closeActivity, deleteActivity,
    submitResponse, fetchResults, fetchLeaderboard, endSession, startSession,
    fetchHistory, fetchStats, exportCsv,
    initSocketListeners, disposeSocketListeners,
  }
})
