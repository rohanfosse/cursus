/**
 * Tests pour useAppListeners — listeners globaux de l'application
 * (raccourcis clavier, IPC, sync en ligne, live invite, auto-updater).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

// ── Mocks ───────────────────────────────────────────────────────────────────

const routerPushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
}))

const mockFetchMessages = vi.fn()
const mockFlushDmQueue = vi.fn()
const mockInitTypingListener = vi.fn(() => vi.fn())

vi.mock('@/stores/messages', () => ({
  useMessagesStore: () => ({
    fetchMessages: mockFetchMessages,
    flushDmQueue: mockFlushDmQueue,
    initTypingListener: mockInitTypingListener,
  }),
}))

const mockFetchStudentDevoirs = vi.fn()
vi.mock('@/stores/travaux', () => ({
  useTravauxStore: () => ({
    fetchStudentDevoirs: mockFetchStudentDevoirs,
  }),
}))

const mockFetchDocuments = vi.fn()
vi.mock('@/stores/documents', () => ({
  useDocumentsStore: () => ({
    fetchDocuments: mockFetchDocuments,
  }),
}))

vi.mock('@/stores/modals', () => ({
  useModalsStore: () => ({
    cmdPalette: false,
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@/composables/useApi', () => ({
  useApi: () => ({ api: vi.fn().mockResolvedValue(null) }),
}))

vi.mock('@/utils/permissions', () => ({
  hasRole: (userRole: string | undefined, required: string) => {
    const levels: Record<string, number> = { student: 0, ta: 1, teacher: 2, admin: 3 }
    return (levels[userRole ?? ''] ?? -1) >= (levels[required] ?? Infinity)
  },
}))

vi.mock('@/constants', () => ({
  STORAGE_KEYS: {
    SESSION: 'cc_session',
    NAV_STATE: 'cc_nav_state',
    PREFS: 'cc_prefs',
    MUTED_DMS: 'cc_muted_dms',
  },
  NOTIFICATION_HISTORY_LIMIT: 50,
}))

// ── localStorage mock ───────────────────────────────────────────────────────
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k] }),
  length: 0,
  key: vi.fn(() => null),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

// ── window.api mock ─────────────────────────────────────────────────────────
const onLiveInviteCb: Array<(data: unknown) => void> = []
const onUpdaterAvailableCb: Array<(version: string) => void> = []
const onUpdaterDownloadedCb: Array<(version: string) => void> = []
const onGradeNewCb: Array<(data: unknown) => void> = []

const apiMock = {
  setToken: vi.fn(),
  onSocketStateChange: vi.fn(() => vi.fn()),
  onNewMessage: vi.fn(() => vi.fn()),
  onPresenceUpdate: vi.fn(() => vi.fn()),
  getTeacherChannels: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  onLiveInvite: vi.fn((cb: (data: unknown) => void) => { onLiveInviteCb.push(cb); return vi.fn() }),
  onUpdaterAvailable: vi.fn((cb: (v: string) => void) => { onUpdaterAvailableCb.push(cb); return vi.fn() }),
  onUpdaterDownloaded: vi.fn((cb: (v: string) => void) => { onUpdaterDownloadedCb.push(cb); return vi.fn() }),
  onGradeNew: vi.fn((cb: (data: unknown) => void) => { onGradeNewCb.push(cb); return vi.fn() }),
  onSignatureUpdate: vi.fn(),
  onDocumentNew: vi.fn(),
  onAssignmentNew: vi.fn(),
  setBadge: vi.fn(),
  onUnreadUpdate: vi.fn(() => vi.fn()),
  onOnlineUsers: vi.fn(() => vi.fn()),
  onTypingIndicator: vi.fn(() => vi.fn()),
  onAuthExpired: vi.fn(() => vi.fn()),
}

;(window as unknown as { api: typeof apiMock }).api = apiMock

import { useAppStore } from '@/stores/app'
import { useAppListeners } from '@/composables/useAppListeners'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorageMock.clear()
  vi.clearAllMocks()
  onLiveInviteCb.length = 0
  onUpdaterAvailableCb.length = 0
  onUpdaterDownloadedCb.length = 0
  onGradeNewCb.length = 0
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAppListeners', () => {
  // ── initListeners / cleanupListeners ──────────────────────────────────────

  it('returns initListeners and cleanupListeners functions', () => {
    const listeners = useAppListeners()
    expect(typeof listeners.initListeners).toBe('function')
    expect(typeof listeners.cleanupListeners).toBe('function')
  })

  it('registers keydown listener on initListeners', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const listeners = useAppListeners()
    listeners.initListeners()
    const types = addSpy.mock.calls.map((c) => c[0])
    expect(types).toContain('keydown')
    listeners.cleanupListeners()
    addSpy.mockRestore()
  })

  it('removes keydown listener on cleanupListeners', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const listeners = useAppListeners()
    listeners.initListeners()
    listeners.cleanupListeners()
    const types = removeSpy.mock.calls.map((c) => c[0])
    expect(types).toContain('keydown')
    removeSpy.mockRestore()
  })

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  it('Ctrl+1 navigates to /dashboard', () => {
    const listeners = useAppListeners()
    listeners.initListeners()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true }))
    expect(routerPushMock).toHaveBeenCalledWith('/dashboard')
    listeners.cleanupListeners()
  })

  it('Ctrl+2 navigates to /messages', () => {
    const listeners = useAppListeners()
    listeners.initListeners()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '2', ctrlKey: true, bubbles: true }))
    expect(routerPushMock).toHaveBeenCalledWith('/messages')
    listeners.cleanupListeners()
  })

  it('Ctrl+3 navigates to /devoirs', () => {
    const listeners = useAppListeners()
    listeners.initListeners()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '3', ctrlKey: true, bubbles: true }))
    expect(routerPushMock).toHaveBeenCalledWith('/devoirs')
    listeners.cleanupListeners()
  })

  it('Ctrl+4 navigates to /documents', () => {
    const listeners = useAppListeners()
    listeners.initListeners()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '4', ctrlKey: true, bubbles: true }))
    expect(routerPushMock).toHaveBeenCalledWith('/documents')
    listeners.cleanupListeners()
  })

  it('does not navigate on Ctrl+Shift+1', () => {
    const listeners = useAppListeners()
    listeners.initListeners()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true, shiftKey: true, bubbles: true }))
    expect(routerPushMock).not.toHaveBeenCalled()
    listeners.cleanupListeners()
  })

  it('does not navigate on Ctrl+Alt+1', () => {
    const listeners = useAppListeners()
    listeners.initListeners()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true, altKey: true, bubbles: true }))
    expect(routerPushMock).not.toHaveBeenCalled()
    listeners.cleanupListeners()
  })

  // ── Reactive state ────────────────────────────────────────────────────────

  it('exposes liveInvite as null initially', () => {
    const listeners = useAppListeners()
    expect(listeners.liveInvite.value).toBeNull()
  })

  it('exposes updateState as idle initially', () => {
    const listeners = useAppListeners()
    expect(listeners.updateState.value).toBe('idle')
  })

  it('exposes updateVersion as empty string initially', () => {
    const listeners = useAppListeners()
    expect(listeners.updateVersion.value).toBe('')
  })

  // ── dismissLiveInvite ─────────────────────────────────────────────────────

  it('dismissLiveInvite clears liveInvite', () => {
    const listeners = useAppListeners()
    listeners.liveInvite.value = { sessionId: 1, title: 'Test', joinCode: 'ABC', teacherName: 'Prof' }
    listeners.dismissLiveInvite()
    expect(listeners.liveInvite.value).toBeNull()
  })

  // ── Store listeners are initialized ───────────────────────────────────────

  it('calls store init methods on initListeners', () => {
    const appStore = useAppStore()
    const initUnreadSpy = vi.spyOn(appStore, 'initUnreadListener').mockReturnValue(vi.fn())
    const initOnlineSpy = vi.spyOn(appStore, 'initOnlineListener').mockReturnValue(vi.fn())
    const initSocketSpy = vi.spyOn(appStore, 'initSocketListener').mockReturnValue(vi.fn())
    const initPresenceSpy = vi.spyOn(appStore, 'initPresenceListener').mockReturnValue(vi.fn())
    const initAuthExpiredSpy = vi.spyOn(appStore, 'initAuthExpiredListener').mockReturnValue(vi.fn())

    const listeners = useAppListeners()
    listeners.initListeners()

    expect(initUnreadSpy).toHaveBeenCalled()
    expect(initOnlineSpy).toHaveBeenCalled()
    expect(initSocketSpy).toHaveBeenCalled()
    expect(initPresenceSpy).toHaveBeenCalled()
    expect(initAuthExpiredSpy).toHaveBeenCalled()

    listeners.cleanupListeners()
  })

  it('initializes typing listener via messages store', () => {
    const listeners = useAppListeners()
    listeners.initListeners()
    expect(mockInitTypingListener).toHaveBeenCalled()
    listeners.cleanupListeners()
  })

  // ── IPC: live invite ──────────────────────────────────────────────────────

  it('registers onLiveInvite IPC listener', () => {
    const listeners = useAppListeners()
    listeners.initListeners()
    expect(apiMock.onLiveInvite).toHaveBeenCalled()
    listeners.cleanupListeners()
  })

  // ── IPC: auto-updater ─────────────────────────────────────────────────────

  it('registers auto-updater IPC listeners', () => {
    const listeners = useAppListeners()
    listeners.initListeners()
    expect(apiMock.onUpdaterAvailable).toHaveBeenCalled()
    expect(apiMock.onUpdaterDownloaded).toHaveBeenCalled()
    listeners.cleanupListeners()
  })

  // ── IPC: grade notifications ──────────────────────────────────────────────

  it('registers onGradeNew IPC listener', () => {
    const listeners = useAppListeners()
    listeners.initListeners()
    expect(apiMock.onGradeNew).toHaveBeenCalled()
    listeners.cleanupListeners()
  })
})
