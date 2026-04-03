/**
 * Tests pour useDashboardWidgets — DMs non lus, bookmarks, agenda, brouillons, ressources.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const routerPushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
}))

const showToastMock = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: showToastMock }),
}))

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({
  useApi: () => ({ api: apiMock }),
}))

vi.mock('@/stores/modals', () => ({
  useModalsStore: () => ({}),
}))

vi.mock('@/constants', () => ({
  STORAGE_KEYS: {
    BOOKMARKS: 'cesia:bookmarks',
  },
}))

const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { localStorageMock.store[key] = val }),
  removeItem: vi.fn((key: string) => { delete localStorageMock.store[key] }),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

;(globalThis as Record<string, unknown>).window = {
  api: {
    updateTravailPublished: vi.fn(),
    getRessources: vi.fn(),
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}

import { useDashboardWidgets } from '../../../src/renderer/src/composables/useDashboardWidgets'
import { useAppStore } from '../../../src/renderer/src/stores/app'

// ─── Helpers ────────────────────────────────────────────────────────────────

function setup(overrides: {
  allStudents?: { id: number; promo_id: number; name?: string }[]
  gantt?: unknown[]
  reminders?: { id: number; done: number; date: string; title: string }[]
  promos?: { id: number; name: string; color: string }[]
} = {}) {
  const allStudents = ref(overrides.allStudents ?? [])
  const ganttFiltered = ref(overrides.gantt ?? [])
  const allReminders = ref(overrides.reminders ?? [])
  const promos = ref(overrides.promos ?? [])
  const reloadPromos = vi.fn().mockResolvedValue(undefined)

  return {
    result: useDashboardWidgets(allStudents as never, ganttFiltered as never, allReminders as never, promos as never, reloadPromos),
    allStudents,
    ganttFiltered,
    allReminders,
    promos,
    reloadPromos,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useDashboardWidgets', () => {
  let appStore: ReturnType<typeof useAppStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    appStore = useAppStore()
    appStore.currentUser = { id: 1, name: 'Prof', type: 'teacher', promo_id: 1 } as never
    appStore.activePromoId = 1
    vi.clearAllMocks()
    localStorageMock.store = {}
  })

  // ── DMs non lus ────────────────────────────────────────────────────────

  describe('unread DMs', () => {
    it('computes unread DM entries from store', () => {
      appStore.unreadDms = { Alice: 3, Bob: 0, Claire: 1 } as never
      const { result } = setup()
      expect(result.unreadDmEntries.value).toEqual([
        { name: 'Alice', count: 3 },
        { name: 'Claire', count: 1 },
      ])
    })

    it('totalUnreadDms sums all counts', () => {
      appStore.unreadDms = { Alice: 3, Claire: 1 } as never
      const { result } = setup()
      expect(result.totalUnreadDms.value).toBe(4)
    })

    it('returns empty when no unread DMs', () => {
      appStore.unreadDms = {} as never
      const { result } = setup()
      expect(result.unreadDmEntries.value).toEqual([])
      expect(result.totalUnreadDms.value).toBe(0)
    })
  })

  // ── openDmFromDashboard ─────────────────────────────────────────────────

  describe('openDmFromDashboard', () => {
    it('opens DM and navigates to messages', () => {
      appStore.openDm = vi.fn() as never
      const students = [{ id: 5, promo_id: 1, name: 'Alice' }]
      const { result } = setup({ allStudents: students })
      result.openDmFromDashboard('Alice')
      expect(appStore.openDm).toHaveBeenCalledWith(5, 1, 'Alice')
      expect(routerPushMock).toHaveBeenCalledWith('/messages')
    })

    it('does nothing if student not found', () => {
      appStore.openDm = vi.fn() as never
      const { result } = setup({ allStudents: [] })
      result.openDmFromDashboard('Unknown')
      expect(appStore.openDm).not.toHaveBeenCalled()
    })
  })

  // ── Saved messages (bookmarks) ────────────────────────────────────────

  describe('saved messages', () => {
    it('loads saved messages from localStorage', () => {
      const msgs = [{ id: 1, authorName: 'A', authorInitials: 'A', content: 'test', createdAt: '', isDm: false, channelName: 'ch', dmStudentId: null }]
      localStorageMock.store['cesia:bookmarks'] = JSON.stringify(msgs)
      const { result } = setup()
      expect(result.savedMessages.value.length).toBe(1)
    })

    it('returns empty on corrupt data', () => {
      localStorageMock.store['cesia:bookmarks'] = '{broken'
      const { result } = setup()
      expect(result.savedMessages.value).toEqual([])
    })

    it('returns empty if data is old format (array of numbers)', () => {
      localStorageMock.store['cesia:bookmarks'] = JSON.stringify([1, 2, 3])
      const { result } = setup()
      expect(result.savedMessages.value).toEqual([])
    })

    it('removeSavedMessage filters out message and shows toast', () => {
      const msgs = [
        { id: 1, authorName: 'A', authorInitials: 'A', content: 'keep', createdAt: '', isDm: false, channelName: 'ch', dmStudentId: null },
        { id: 2, authorName: 'B', authorInitials: 'B', content: 'remove', createdAt: '', isDm: false, channelName: 'ch', dmStudentId: null },
      ]
      localStorageMock.store['cesia:bookmarks'] = JSON.stringify(msgs)
      const { result } = setup()
      result.removeSavedMessage(2)
      expect(result.savedMessages.value.length).toBe(1)
      expect(result.savedMessages.value[0].id).toBe(1)
      expect(showToastMock).toHaveBeenCalledWith('Message retiré des favoris.', 'info')
    })
  })

  // ── goToSavedMessage ──────────────────────────────────────────────────

  describe('goToSavedMessage', () => {
    it('navigates to /messages for channel message', () => {
      const { result } = setup()
      result.goToSavedMessage({ id: 1, authorName: 'A', authorInitials: 'A', content: '', createdAt: '', isDm: false, channelName: 'ch', dmStudentId: null })
      expect(routerPushMock).toHaveBeenCalledWith('/messages')
    })

    it('opens DM for DM message', () => {
      appStore.openDm = vi.fn() as never
      const students = [{ id: 5, promo_id: 1, name: 'Alice' }]
      const { result } = setup({ allStudents: students })
      result.goToSavedMessage({ id: 1, authorName: 'Alice', authorInitials: 'A', content: '', createdAt: '', isDm: true, channelName: null, dmStudentId: 5 })
      expect(appStore.openDm).toHaveBeenCalled()
      expect(routerPushMock).toHaveBeenCalledWith('/messages')
    })
  })

  // ── goToChannel ───────────────────────────────────────────────────────

  describe('goToChannel', () => {
    it('opens channel and navigates', () => {
      appStore.openChannel = vi.fn() as never
      const { result } = setup({ promos: [{ id: 1, name: 'Promo1', color: '#000' }] })
      result.goToChannel(10, 'general')
      expect(appStore.openChannel).toHaveBeenCalledWith(10, 1, 'general')
      expect(routerPushMock).toHaveBeenCalledWith('/messages')
    })
  })

  // ── next48h ───────────────────────────────────────────────────────────

  describe('next48h', () => {
    it('combines deadlines and reminders within 48h', () => {
      const now = Date.now()
      const in24h = new Date(now + 24 * 3600_000).toISOString()
      const { result } = setup({
        gantt: [
          { id: 1, title: 'Devoir 1', deadline: in24h, published: true, type: 'devoir', channel_name: 'ch1' },
        ],
        reminders: [
          { id: 10, done: 0, date: in24h, title: 'Rappel 1' },
        ],
      })
      expect(result.next48h.value.length).toBe(2)
    })

    it('excludes items beyond 48h', () => {
      const far = new Date(Date.now() + 72 * 3600_000).toISOString()
      const { result } = setup({
        gantt: [{ id: 1, title: 'Far', deadline: far, published: true, type: 'devoir', channel_name: null }],
      })
      expect(result.next48h.value.length).toBe(0)
    })

    it('excludes past items', () => {
      const past = new Date(Date.now() - 3600_000).toISOString()
      const { result } = setup({
        gantt: [{ id: 1, title: 'Past', deadline: past, published: true, type: 'devoir', channel_name: null }],
      })
      expect(result.next48h.value.length).toBe(0)
    })

    it('excludes done reminders', () => {
      const in1h = new Date(Date.now() + 3600_000).toISOString()
      const { result } = setup({
        reminders: [{ id: 1, done: 1, date: in1h, title: 'Done' }],
      })
      expect(result.next48h.value.length).toBe(0)
    })
  })

  // ── forgottenDrafts ───────────────────────────────────────────────────

  describe('forgottenDrafts', () => {
    it('returns unpublished devoirs with deadline within 7 days', () => {
      const in3d = new Date(Date.now() + 3 * 86_400_000).toISOString()
      const { result } = setup({
        gantt: [{ id: 1, title: 'Draft', deadline: in3d, published: false, type: 'devoir' }],
      })
      expect(result.forgottenDrafts.value.length).toBe(1)
    })

    it('excludes published devoirs', () => {
      const in3d = new Date(Date.now() + 3 * 86_400_000).toISOString()
      const { result } = setup({
        gantt: [{ id: 1, title: 'Published', deadline: in3d, published: true, type: 'devoir' }],
      })
      expect(result.forgottenDrafts.value.length).toBe(0)
    })
  })

  // ── publishDraft ──────────────────────────────────────────────────────

  describe('publishDraft', () => {
    it('calls api and shows success toast', async () => {
      apiMock.mockResolvedValue({})
      const { result, reloadPromos } = setup()
      await result.publishDraft(42)
      expect(apiMock).toHaveBeenCalled()
      expect(showToastMock).toHaveBeenCalledWith('Devoir publié.', 'success')
      expect(reloadPromos).toHaveBeenCalled()
    })

    it('shows error toast when api returns null', async () => {
      apiMock.mockResolvedValue(null)
      const { result } = setup()
      await result.publishDraft(42)
      expect(showToastMock).toHaveBeenCalledWith('Erreur lors de la publication.', 'error')
    })

    it('shows network error toast on exception', async () => {
      apiMock.mockRejectedValue(new Error('network'))
      const { result } = setup()
      await result.publishDraft(42)
      expect(showToastMock).toHaveBeenCalledWith('Erreur réseau.', 'error')
    })
  })

  // ── checkDevoirsResources ─────────────────────────────────────────────

  describe('checkDevoirsResources', () => {
    it('populates devoirsWithoutResources for devoirs with no resources', async () => {
      apiMock.mockResolvedValue([])
      const d = { id: 1, title: 'D1', published: true, type: 'devoir' }
      const { result } = setup({ gantt: [d] })
      await result.checkDevoirsResources()
      expect(result.devoirsWithoutResources.value.length).toBe(1)
    })

    it('excludes devoirs that have resources', async () => {
      apiMock.mockResolvedValue([{ id: 99 }])
      const d = { id: 1, title: 'D1', published: true, type: 'devoir' }
      const { result } = setup({ gantt: [d] })
      await result.checkDevoirsResources()
      expect(result.devoirsWithoutResources.value.length).toBe(0)
    })
  })

  // ── cleanupStorage ────────────────────────────────────────────────────

  describe('cleanupStorage', () => {
    it('removes storage event listener', () => {
      const { result } = setup()
      result.cleanupStorage()
      expect(window.removeEventListener).toHaveBeenCalledWith('storage', expect.any(Function))
    })
  })
})
