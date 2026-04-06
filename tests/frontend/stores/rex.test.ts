import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ── Mocks composables ────────────────────────────────────────────────────────

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({
  useApi: () => ({ api: apiMock }),
}))

// ── Mock window.api ──────────────────────────────────────────────────────────

const emitRexJoinMock = vi.fn()
const emitRexLeaveMock = vi.fn()
const onRexActivityPushedMock = vi.fn(() => vi.fn())
const onRexActivityClosedMock = vi.fn(() => vi.fn())
const onRexResultsUpdateMock = vi.fn(() => vi.fn())
const onRexSessionStartedMock = vi.fn(() => vi.fn())
const onRexSessionEndedMock = vi.fn(() => vi.fn())

;(window as unknown as { api: Record<string, unknown> }).api = {
  createRexSession: vi.fn(),
  getRexSessionByCode: vi.fn(),
  getRexSession: vi.fn(),
  getActiveRexSession: vi.fn(),
  addRexActivity: vi.fn(),
  setRexActivityStatus: vi.fn(),
  deleteRexActivity: vi.fn(),
  submitRexResponse: vi.fn(),
  getRexActivityResults: vi.fn(),
  updateRexSessionStatus: vi.fn(),
  getRexSessionsForPromo: vi.fn(),
  updateRexActivity: vi.fn(),
  reorderRexActivities: vi.fn(),
  cloneRexSession: vi.fn(),
  deleteRexSession: vi.fn(),
  getRexHistoryForPromo: vi.fn(),
  getRexStatsForPromo: vi.fn(),
  toggleRexPin: vi.fn(),
  exportRexSession: vi.fn(),
  emitRexJoin: emitRexJoinMock,
  emitRexLeave: emitRexLeaveMock,
  onRexActivityPushed: onRexActivityPushedMock,
  onRexActivityClosed: onRexActivityClosedMock,
  onRexResultsUpdate: onRexResultsUpdateMock,
  onRexSessionStarted: onRexSessionStartedMock,
  onRexSessionEnded: onRexSessionEndedMock,
}

import { useRexStore } from '@/stores/rex'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'REX Test',
    code: 'ABC123',
    promo_id: 7,
    status: 'draft' as const,
    is_async: 0,
    open_until: null,
    activities: [],
    created_at: '2026-04-01',
    ...overrides,
  }
}

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    session_id: 1,
    type: 'sondage_libre' as const,
    title: 'Question 1',
    status: 'pending' as const,
    position: 0,
    ...overrides,
  }
}

describe('rex store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiMock.mockReset()
    vi.clearAllMocks()
  })

  // ── Initial state ──────────────────────────────────────────────────────────

  it('has null/empty initial state', () => {
    const s = useRexStore()
    expect(s.currentSession).toBeNull()
    expect(s.currentActivity).toBeNull()
    expect(s.results).toBeNull()
    expect(s.hasResponded).toBe(false)
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
    expect(s.draftSessions).toEqual([])
  })

  // ── createSession ────────────────────────────────────────────────────────

  describe('createSession', () => {
    it('success — sets currentSession and calls emitRexJoin', async () => {
      const session = makeSession()
      apiMock.mockResolvedValue(session)
      const s = useRexStore()
      const ok = await s.createSession('REX Test', 7)
      expect(ok).toBe(true)
      expect(s.currentSession).toEqual(session)
      expect(emitRexJoinMock).toHaveBeenCalledWith(7)
      expect(s.loading).toBe(false)
    })

    it('failure — returns false and sets error', async () => {
      apiMock.mockResolvedValue(null)
      const s = useRexStore()
      const ok = await s.createSession('REX Test', 7)
      expect(ok).toBe(false)
      expect(s.error).toBe('Impossible de créer la session Pulse')
      expect(s.loading).toBe(false)
    })
  })

  // ── joinByCode ───────────────────────────────────────────────────────────

  describe('joinByCode', () => {
    it('success — sets session and live activity', async () => {
      const liveAct = makeActivity({ id: 20, status: 'live' })
      const session = makeSession({ activities: [liveAct] })
      apiMock.mockResolvedValue(session)
      const s = useRexStore()
      const ok = await s.joinByCode('ABC123')
      expect(ok).toBe(true)
      expect(s.currentSession).toEqual(session)
      expect(s.currentActivity).toEqual(liveAct)
      expect(s.hasResponded).toBe(false)
      expect(emitRexJoinMock).toHaveBeenCalledWith(7)
    })

    it('success — currentActivity is null when no live activity', async () => {
      const session = makeSession({ activities: [makeActivity({ status: 'closed' })] })
      apiMock.mockResolvedValue(session)
      const s = useRexStore()
      await s.joinByCode('ABC123')
      expect(s.currentActivity).toBeNull()
    })

    it('failure — returns false and sets error', async () => {
      apiMock.mockResolvedValue(null)
      const s = useRexStore()
      const ok = await s.joinByCode('INVALID')
      expect(ok).toBe(false)
      expect(s.error).toBe('Code de session invalide ou session introuvable')
      expect(s.loading).toBe(false)
    })
  })

  // ── leaveSession ─────────────────────────────────────────────────────────

  describe('leaveSession', () => {
    it('resets state and calls emitRexLeave', () => {
      const s = useRexStore()
      s.currentSession = makeSession() as never
      s.currentActivity = makeActivity() as never
      s.results = {} as never
      s.hasResponded = true

      s.leaveSession()
      expect(emitRexLeaveMock).toHaveBeenCalledWith(7)
      expect(s.currentSession).toBeNull()
      expect(s.currentActivity).toBeNull()
      expect(s.results).toBeNull()
      expect(s.hasResponded).toBe(false)
    })

    it('does not call emitRexLeave when no session', () => {
      const s = useRexStore()
      s.leaveSession()
      expect(emitRexLeaveMock).not.toHaveBeenCalled()
    })
  })

  // ── pushActivity ─────────────────────────────────────────────────────────

  describe('pushActivity', () => {
    it('adds activity to session.activities', async () => {
      const newAct = makeActivity({ id: 30 })
      apiMock.mockResolvedValue(newAct)
      const s = useRexStore()
      s.currentSession = makeSession({ activities: [] }) as never
      const ok = await s.pushActivity(1, { type: 'sondage_libre', title: 'Q2' })
      expect(ok).toBe(true)
      expect(s.currentSession!.activities).toHaveLength(1)
      expect(s.currentSession!.activities[0]).toEqual(newAct)
    })

    it('returns false when api returns null', async () => {
      apiMock.mockResolvedValue(null)
      const s = useRexStore()
      s.currentSession = makeSession() as never
      const ok = await s.pushActivity(1, { type: 'nuage', title: 'Words' })
      expect(ok).toBe(false)
    })
  })

  // ── launchActivity ───────────────────────────────────────────────────────

  describe('launchActivity', () => {
    it('sets currentActivity and updates session activities', async () => {
      const liveAct = makeActivity({ id: 10, status: 'live' })
      apiMock.mockResolvedValue(liveAct)
      const s = useRexStore()
      s.currentSession = makeSession({
        activities: [makeActivity({ id: 10, status: 'pending' })],
      }) as never

      const ok = await s.launchActivity(10)
      expect(ok).toBe(true)
      expect(s.currentActivity).toEqual(liveAct)
      expect(s.results).toBeNull()
    })

    it('closes previously live activity in session list', async () => {
      const liveAct = makeActivity({ id: 20, status: 'live' })
      apiMock.mockResolvedValue(liveAct)
      const s = useRexStore()
      s.currentSession = makeSession({
        activities: [
          makeActivity({ id: 10, status: 'live' }),
          makeActivity({ id: 20, status: 'pending' }),
        ],
      }) as never

      await s.launchActivity(20)
      const act10 = s.currentSession!.activities.find((a: { id: number }) => a.id === 10)
      expect(act10!.status).toBe('closed')
    })
  })

  // ── closeActivity ────────────────────────────────────────────────────────

  describe('closeActivity', () => {
    it('clears currentActivity and updates session activities', async () => {
      const closedAct = makeActivity({ id: 10, status: 'closed' })
      apiMock.mockResolvedValue(closedAct)
      const s = useRexStore()
      s.currentSession = makeSession({
        activities: [makeActivity({ id: 10, status: 'live' })],
      }) as never
      s.currentActivity = makeActivity({ id: 10, status: 'live' }) as never

      const ok = await s.closeActivity(10)
      expect(ok).toBe(true)
      expect(s.currentActivity).toBeNull()
      expect(s.currentSession!.activities[0].status).toBe('closed')
    })

    it('returns false on failure', async () => {
      apiMock.mockResolvedValue(null)
      const s = useRexStore()
      const ok = await s.closeActivity(10)
      expect(ok).toBe(false)
    })
  })

  // ── deleteActivity ───────────────────────────────────────────────────────

  describe('deleteActivity', () => {
    it('removes activity from activities list', async () => {
      apiMock.mockResolvedValue({})
      const s = useRexStore()
      s.currentSession = makeSession({
        activities: [makeActivity({ id: 10 }), makeActivity({ id: 20 })],
      }) as never

      const ok = await s.deleteActivity(10)
      expect(ok).toBe(true)
      expect(s.currentSession!.activities).toHaveLength(1)
      expect(s.currentSession!.activities[0].id).toBe(20)
    })
  })

  // ── submitResponse ───────────────────────────────────────────────────────

  describe('submitResponse', () => {
    it('sets hasResponded to true on success', async () => {
      apiMock.mockResolvedValue({})
      const s = useRexStore()
      expect(s.hasResponded).toBe(false)
      const ok = await s.submitResponse(10, { text: 'My answer' })
      expect(ok).toBe(true)
      expect(s.hasResponded).toBe(true)
    })

    it('returns false when api returns null', async () => {
      apiMock.mockResolvedValue(null)
      const s = useRexStore()
      const ok = await s.submitResponse(10, { text: 'fail' })
      expect(ok).toBe(false)
      expect(s.hasResponded).toBe(false)
    })
  })

  // ── startSession / endSession ────────────────────────────────────────────

  describe('startSession', () => {
    it('sets session status to active', async () => {
      apiMock.mockResolvedValue(makeSession({ status: 'active' }))
      const s = useRexStore()
      s.currentSession = makeSession() as never
      const ok = await s.startSession(1)
      expect(ok).toBe(true)
      expect(s.currentSession!.status).toBe('active')
    })

    it('returns false on failure', async () => {
      apiMock.mockResolvedValue(null)
      const s = useRexStore()
      s.currentSession = makeSession() as never
      const ok = await s.startSession(1)
      expect(ok).toBe(false)
    })
  })

  describe('endSession', () => {
    it('calls leaveSession on success', async () => {
      apiMock.mockResolvedValue({})
      const s = useRexStore()
      s.currentSession = makeSession({ status: 'active' }) as never
      const ok = await s.endSession(1)
      expect(ok).toBe(true)
      expect(s.currentSession).toBeNull()
    })
  })

  // ── togglePin ────────────────────────────────────────────────────────────

  describe('togglePin', () => {
    it('returns true on success', async () => {
      apiMock.mockResolvedValue({})
      const s = useRexStore()
      const ok = await s.togglePin(5, true)
      expect(ok).toBe(true)
    })

    it('returns false when api returns null', async () => {
      apiMock.mockResolvedValue(null)
      const s = useRexStore()
      const ok = await s.togglePin(5, false)
      expect(ok).toBe(false)
    })
  })

  // ── exportSession ────────────────────────────────────────────────────────

  describe('exportSession', () => {
    it('returns api result', async () => {
      const exportData = { data: 'exported' }
      apiMock.mockResolvedValue(exportData)
      const s = useRexStore()
      const result = await s.exportSession(1, 'json')
      expect(result).toEqual(exportData)
    })
  })

  // ── fetchDraftSessions ───────────────────────────────────────────────────

  describe('fetchDraftSessions', () => {
    it('populates draftSessions', async () => {
      const sessions = [makeSession({ id: 1 }), makeSession({ id: 2 })]
      apiMock.mockResolvedValue(sessions)
      const s = useRexStore()
      await s.fetchDraftSessions(7)
      expect(s.draftSessions).toEqual(sessions)
    })

    it('does not overwrite when api returns null', async () => {
      apiMock.mockResolvedValue(null)
      const s = useRexStore()
      s.draftSessions = [makeSession()] as never
      await s.fetchDraftSessions(7)
      expect(s.draftSessions).toHaveLength(1)
    })
  })

  // ── deleteSession ────────────────────────────────────────────────────────

  describe('deleteSession', () => {
    it('removes session from draftSessions', async () => {
      apiMock.mockResolvedValue({})
      const s = useRexStore()
      s.draftSessions = [makeSession({ id: 1 }), makeSession({ id: 2 })] as never
      const ok = await s.deleteSession(1)
      expect(ok).toBe(true)
      expect(s.draftSessions).toHaveLength(1)
      expect(s.draftSessions[0].id).toBe(2)
    })

    it('calls leaveSession when deleting the current session', async () => {
      apiMock.mockResolvedValue({})
      const s = useRexStore()
      s.currentSession = makeSession({ id: 1 }) as never
      s.draftSessions = [makeSession({ id: 1 })] as never
      const ok = await s.deleteSession(1)
      expect(ok).toBe(true)
      expect(s.currentSession).toBeNull()
      expect(emitRexLeaveMock).toHaveBeenCalledWith(7)
    })
  })

  // ── advanceToNext ────────────────────────────────────────────────────────

  describe('advanceToNext', () => {
    it('closes current activity and launches next', async () => {
      const closedAct = makeActivity({ id: 10, status: 'closed' })
      const nextAct = makeActivity({ id: 20, status: 'live' })
      apiMock
        .mockResolvedValueOnce(closedAct) // closeActivity(10)
        .mockResolvedValueOnce(nextAct)   // launchActivity(20)

      const s = useRexStore()
      s.currentSession = makeSession({
        activities: [
          makeActivity({ id: 10, status: 'live' }),
          makeActivity({ id: 20, status: 'pending' }),
        ],
      }) as never
      s.currentActivity = makeActivity({ id: 10, status: 'live' }) as never

      const ok = await s.advanceToNext(10, 20)
      expect(ok).toBe(true)
      expect(s.currentActivity).toEqual(nextAct)
    })

    it('returns true with no next when nextId is null', async () => {
      const closedAct = makeActivity({ id: 10, status: 'closed' })
      apiMock.mockResolvedValue(closedAct)

      const s = useRexStore()
      s.currentSession = makeSession({
        activities: [makeActivity({ id: 10, status: 'live' })],
      }) as never
      s.currentActivity = makeActivity({ id: 10, status: 'live' }) as never

      const ok = await s.advanceToNext(10, null)
      expect(ok).toBe(true)
      expect(s.currentActivity).toBeNull()
    })
  })

  // ── Computed: sessionActivities / liveActivity ───────────────────────────

  describe('computed', () => {
    it('sessionActivities returns activities from currentSession', () => {
      const s = useRexStore()
      const acts = [makeActivity({ id: 1 }), makeActivity({ id: 2 })]
      s.currentSession = makeSession({ activities: acts }) as never
      expect(s.sessionActivities).toEqual(acts)
    })

    it('sessionActivities returns empty array when no session', () => {
      const s = useRexStore()
      expect(s.sessionActivities).toEqual([])
    })

    it('liveActivity returns the live activity', () => {
      const s = useRexStore()
      const liveAct = makeActivity({ id: 5, status: 'live' })
      s.currentSession = makeSession({
        activities: [makeActivity({ id: 1, status: 'closed' }), liveAct],
      }) as never
      expect(s.liveActivity).toEqual(liveAct)
    })

    it('liveActivity returns null when no live activity', () => {
      const s = useRexStore()
      s.currentSession = makeSession({
        activities: [makeActivity({ id: 1, status: 'closed' })],
      }) as never
      expect(s.liveActivity).toBeNull()
    })

    it('liveActivity returns null when no session', () => {
      const s = useRexStore()
      expect(s.liveActivity).toBeNull()
    })
  })

  // ── initSocketListeners / disposeSocketListeners ─────────────────────────

  describe('initSocketListeners', () => {
    it('registers all 5 socket listeners', () => {
      const s = useRexStore()
      s.initSocketListeners()
      expect(onRexActivityPushedMock).toHaveBeenCalledTimes(1)
      expect(onRexActivityClosedMock).toHaveBeenCalledTimes(1)
      expect(onRexResultsUpdateMock).toHaveBeenCalledTimes(1)
      expect(onRexSessionStartedMock).toHaveBeenCalledTimes(1)
      expect(onRexSessionEndedMock).toHaveBeenCalledTimes(1)
    })

    it('disposes previous listeners before re-registering', () => {
      const cleanup1 = vi.fn()
      const cleanup2 = vi.fn()
      onRexActivityPushedMock.mockReturnValueOnce(cleanup1)
      onRexActivityClosedMock.mockReturnValueOnce(cleanup2)

      const s = useRexStore()
      s.initSocketListeners()
      // Re-init should dispose the first batch
      s.initSocketListeners()
      expect(cleanup1).toHaveBeenCalled()
      expect(cleanup2).toHaveBeenCalled()
    })
  })

  describe('disposeSocketListeners', () => {
    it('calls all cleanup functions', () => {
      const cleanups = Array.from({ length: 5 }, () => vi.fn())
      onRexActivityPushedMock.mockReturnValueOnce(cleanups[0])
      onRexActivityClosedMock.mockReturnValueOnce(cleanups[1])
      onRexResultsUpdateMock.mockReturnValueOnce(cleanups[2])
      onRexSessionStartedMock.mockReturnValueOnce(cleanups[3])
      onRexSessionEndedMock.mockReturnValueOnce(cleanups[4])

      const s = useRexStore()
      s.initSocketListeners()
      s.disposeSocketListeners()
      for (const fn of cleanups) {
        expect(fn).toHaveBeenCalled()
      }
    })

    it('is safe to call when no listeners registered', () => {
      const s = useRexStore()
      expect(() => s.disposeSocketListeners()).not.toThrow()
    })
  })

  // ── Socket listener callbacks ────────────────────────────────────────────

  describe('socket listener callbacks', () => {
    it('onRexActivityPushed adds activity to session and sets live', () => {
      const s = useRexStore()
      s.currentSession = makeSession({ id: 1, activities: [] }) as never

      let callback: (payload: unknown) => void = () => {}
      onRexActivityPushedMock.mockImplementation((cb: (payload: unknown) => void) => {
        callback = cb
        return vi.fn()
      })

      s.initSocketListeners()
      const liveAct = makeActivity({ id: 50, session_id: 1, status: 'live' })
      callback({ activity: liveAct })

      expect(s.currentSession!.activities).toHaveLength(1)
      expect(s.currentActivity).toEqual(liveAct)
      expect(s.hasResponded).toBe(false)
    })

    it('onRexActivityPushed ignores activity from different session', () => {
      const s = useRexStore()
      s.currentSession = makeSession({ id: 1, activities: [] }) as never

      let callback: (payload: unknown) => void = () => {}
      onRexActivityPushedMock.mockImplementation((cb: (payload: unknown) => void) => {
        callback = cb
        return vi.fn()
      })

      s.initSocketListeners()
      const otherAct = makeActivity({ id: 50, session_id: 999, status: 'pending' })
      callback({ activity: otherAct })

      expect(s.currentSession!.activities).toHaveLength(0)
    })

    it('onRexActivityClosed updates activity status and fetches results', () => {
      const s = useRexStore()
      s.currentSession = makeSession({
        id: 1,
        activities: [makeActivity({ id: 10, status: 'live' })],
      }) as never
      s.currentActivity = makeActivity({ id: 10, status: 'live' }) as never

      let callback: (payload: unknown) => void = () => {}
      onRexActivityClosedMock.mockImplementation((cb: (payload: unknown) => void) => {
        callback = cb
        return vi.fn()
      })

      s.initSocketListeners()
      callback({ activityId: 10 })

      expect(s.currentActivity!.status).toBe('closed')
      expect(s.currentSession!.activities[0].status).toBe('closed')
    })

    it('onRexSessionStarted sets status to active', () => {
      const s = useRexStore()
      s.currentSession = makeSession({ id: 1, status: 'draft' }) as never

      let callback: (payload: unknown) => void = () => {}
      onRexSessionStartedMock.mockImplementation((cb: (payload: unknown) => void) => {
        callback = cb
        return vi.fn()
      })

      s.initSocketListeners()
      callback({ sessionId: 1 })

      expect(s.currentSession!.status).toBe('active')
    })

    it('onRexSessionEnded sets status to ended and clears activity', () => {
      const s = useRexStore()
      s.currentSession = makeSession({ id: 1, status: 'active' }) as never
      s.currentActivity = makeActivity() as never

      let callback: (payload: unknown) => void = () => {}
      onRexSessionEndedMock.mockImplementation((cb: (payload: unknown) => void) => {
        callback = cb
        return vi.fn()
      })

      s.initSocketListeners()
      callback({ sessionId: 1 })

      expect(s.currentSession!.status).toBe('ended')
      expect(s.currentActivity).toBeNull()
    })

    it('onRexResultsUpdate sets results when matching activity', () => {
      const s = useRexStore()
      s.currentActivity = makeActivity({ id: 10 }) as never

      let callback: (payload: unknown) => void = () => {}
      onRexResultsUpdateMock.mockImplementation((cb: (payload: unknown) => void) => {
        callback = cb
        return vi.fn()
      })

      s.initSocketListeners()
      const newResults = { type: 'sondage_libre', responses: [] }
      callback({ activityId: 10, data: newResults })

      expect(s.results).toEqual(newResults)
    })
  })
})
