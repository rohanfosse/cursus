/**
 * Tests pour useSidebarActions — mute, rename, context menus, archive, drag & drop.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const showToastMock = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: showToastMock }),
}))

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({
  useApi: () => ({ api: apiMock }),
}))

const confirmMock = vi.fn()
vi.mock('@/composables/useConfirm', () => ({
  useConfirm: () => ({ confirm: confirmMock }),
}))

vi.mock('@/stores/modals', () => ({
  useModalsStore: () => ({
    createChannel: false,
  }),
}))

vi.mock('@/utils/categoryIcon', () => ({
  parseCategoryIcon: (s: string) => ({ icon: null, label: s }),
}))

vi.mock('./useSidebarData', () => ({
  NO_CAT: '__no_category__',
}))

vi.mock('@/utils/permissions', () => ({
  hasRole: (userRole: string | undefined | null, requiredRole: string) => {
    const levels: Record<string, number> = { student: 0, ta: 1, teacher: 2, admin: 3 }
    return (levels[userRole ?? ''] ?? -1) >= (levels[requiredRole] ?? Infinity)
  },
}))

vi.mock('lucide-vue-next', () => ({
  PlusCircle: 'PlusCircle',
  Pencil: 'Pencil',
  Trash2: 'Trash2',
  VolumeX: 'VolumeX',
  Volume2: 'Volume2',
  Lock: 'Lock',
  Unlock: 'Unlock',
  CheckCheck: 'CheckCheck',
  Archive: 'Archive',
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
    renameChannel: vi.fn(),
    renameCategory: vi.fn(),
    deleteCategory: vi.fn(),
    deleteChannel: vi.fn(),
    updateChannelPrivacy: vi.fn(),
    archiveChannel: vi.fn(),
    restoreChannel: vi.fn(),
    updateChannelCategory: vi.fn(),
  },
}

import { useSidebarActions } from '../../../src/renderer/src/composables/useSidebarActions'
import { useAppStore } from '../../../src/renderer/src/stores/app'
import type { Channel } from '../../../src/renderer/src/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeChannel(id: number, name: string, extra: Partial<Channel> = {}): Channel {
  return { id, name, promo_id: 1, is_private: false, category: null, ...extra } as Channel
}

function makeMouseEvent(x = 100, y = 200): MouseEvent {
  return { clientX: x, clientY: y, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as MouseEvent
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useSidebarActions', () => {
  let appStore: ReturnType<typeof useAppStore>
  let loadTeacherChannels: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    appStore = useAppStore()
    appStore.currentUser = { id: 1, name: 'Prof', type: 'teacher', promo_id: 1 } as never
    appStore.activePromoId = 1
    loadTeacherChannels = vi.fn().mockResolvedValue(undefined)
    vi.clearAllMocks()
    localStorageMock.store = {}
  })

  // ── Mute ────────────────────────────────────────────────────────────────

  describe('mute', () => {
    it('isMuted returns false for unmuted channel', () => {
      const { isMuted } = useSidebarActions(loadTeacherChannels)
      expect(isMuted(42)).toBe(false)
    })

    it('toggleMute adds channel to muted set', () => {
      const { isMuted, toggleMute } = useSidebarActions(loadTeacherChannels)
      const ch = makeChannel(42, 'general')
      toggleMute(ch)
      expect(isMuted(42)).toBe(true)
      expect(showToastMock).toHaveBeenCalledWith(expect.stringContaining('sourdine'))
    })

    it('toggleMute removes channel from muted set', () => {
      const { isMuted, toggleMute } = useSidebarActions(loadTeacherChannels)
      const ch = makeChannel(42, 'general')
      toggleMute(ch)
      toggleMute(ch)
      expect(isMuted(42)).toBe(false)
      expect(showToastMock).toHaveBeenLastCalledWith(expect.stringContaining('retiré'))
    })

    it('persists muted ids to localStorage', () => {
      const { toggleMute } = useSidebarActions(loadTeacherChannels)
      toggleMute(makeChannel(10, 'test'))
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })

    it('loads muted ids from localStorage', () => {
      localStorageMock.store['cc_muted_1'] = JSON.stringify([7, 8])
      const { isMuted } = useSidebarActions(loadTeacherChannels)
      expect(isMuted(7)).toBe(true)
      expect(isMuted(8)).toBe(true)
      expect(isMuted(9)).toBe(false)
    })
  })

  // ── Rename ──────────────────────────────────────────────────────────────

  describe('rename', () => {
    it('startRenameChannel sets renaming state', async () => {
      const { startRenameChannel, renamingChannelId, renameValue } = useSidebarActions(loadTeacherChannels)
      await startRenameChannel(makeChannel(5, 'old-name'))
      expect(renamingChannelId.value).toBe(5)
      expect(renameValue.value).toBe('old-name')
    })

    it('startRenameCategory sets renaming state', async () => {
      const { startRenameCategory, renamingCategory, renameValue } = useSidebarActions(loadTeacherChannels)
      await startRenameCategory('My Category')
      expect(renamingCategory.value).toBe('My Category')
      expect(renameValue.value).toBe('My Category')
    })

    it('cancelRename clears all renaming state', async () => {
      const { startRenameChannel, cancelRename, renamingChannelId, renameValue } = useSidebarActions(loadTeacherChannels)
      await startRenameChannel(makeChannel(5, 'test'))
      cancelRename()
      expect(renamingChannelId.value).toBeNull()
      expect(renameValue.value).toBe('')
    })

    it('commitRenameChannel calls api and reloads on success', async () => {
      apiMock.mockResolvedValue({})
      const { startRenameChannel, renameValue, commitRenameChannel } = useSidebarActions(loadTeacherChannels)
      await startRenameChannel(makeChannel(5, 'old'))
      renameValue.value = 'new-name'
      await commitRenameChannel()
      expect(apiMock).toHaveBeenCalled()
      expect(loadTeacherChannels).toHaveBeenCalled()
      expect(showToastMock).toHaveBeenCalledWith('Canal renommé.', 'success')
    })

    it('commitRenameChannel does nothing if name is empty', async () => {
      const { startRenameChannel, renameValue, commitRenameChannel } = useSidebarActions(loadTeacherChannels)
      await startRenameChannel(makeChannel(5, 'old'))
      renameValue.value = '   '
      await commitRenameChannel()
      expect(apiMock).not.toHaveBeenCalled()
    })

    it('commitRenameChannel does nothing if api returns null', async () => {
      apiMock.mockResolvedValue(null)
      const { startRenameChannel, renameValue, commitRenameChannel } = useSidebarActions(loadTeacherChannels)
      await startRenameChannel(makeChannel(5, 'old'))
      renameValue.value = 'new-name'
      await commitRenameChannel()
      expect(loadTeacherChannels).not.toHaveBeenCalled()
    })

    it('commitRenameCategory calls api and reloads on success', async () => {
      apiMock.mockResolvedValue({})
      const { startRenameCategory, renameValue, commitRenameCategory } = useSidebarActions(loadTeacherChannels)
      await startRenameCategory('Old Cat')
      renameValue.value = 'New Cat'
      await commitRenameCategory()
      expect(apiMock).toHaveBeenCalled()
      expect(loadTeacherChannels).toHaveBeenCalled()
      expect(showToastMock).toHaveBeenCalledWith('Catégorie renommée.', 'success')
    })

    it('commitRenameCategory does nothing without activePromoId', async () => {
      appStore.activePromoId = null as never
      const { startRenameCategory, renameValue, commitRenameCategory } = useSidebarActions(loadTeacherChannels)
      await startRenameCategory('Cat')
      renameValue.value = 'New'
      await commitRenameCategory()
      expect(apiMock).not.toHaveBeenCalled()
    })
  })

  // ── Context menus ───────────────────────────────────────────────────────

  describe('context menus', () => {
    it('openCtxChannel creates menu items for non-staff (student)', () => {
      appStore.currentUser = { id: 2, name: 'Etu', type: 'student', promo_id: 1 } as never
      const { openCtxChannel, ctx } = useSidebarActions(loadTeacherChannels)
      openCtxChannel(makeMouseEvent(), makeChannel(1, 'test'))
      // Non-staff gets mute + mark-as-read only
      expect(ctx.value).not.toBeNull()
      expect(ctx.value!.items.length).toBe(2)
    })

    it('openCtxChannel creates extra items for staff (teacher)', () => {
      appStore.currentUser = { id: 1, name: 'Prof', type: 'teacher', promo_id: 1 } as never
      const { openCtxChannel, ctx } = useSidebarActions(loadTeacherChannels)
      openCtxChannel(makeMouseEvent(), makeChannel(1, 'test'))
      // Staff gets rename + mute + mark-as-read + privacy + archive + delete
      expect(ctx.value!.items.length).toBeGreaterThanOrEqual(5)
    })

    it('openCtxCategory does nothing for non-staff (student)', () => {
      appStore.currentUser = { id: 2, name: 'Etu', type: 'student', promo_id: 1 } as never
      const { openCtxCategory, ctx } = useSidebarActions(loadTeacherChannels)
      openCtxCategory(makeMouseEvent(), { key: 'cat1', label: 'Cat 1' })
      expect(ctx.value).toBeNull()
    })

    it('openCtxCategory creates items for staff (teacher)', () => {
      appStore.currentUser = { id: 1, name: 'Prof', type: 'teacher', promo_id: 1 } as never
      const { openCtxCategory, ctx } = useSidebarActions(loadTeacherChannels)
      openCtxCategory(makeMouseEvent(), { key: 'cat1', label: 'Cat 1' })
      expect(ctx.value).not.toBeNull()
      expect(ctx.value!.items.length).toBe(3)
    })
  })

  // ── Archive / restore ─────────────────────────────────────────────────

  describe('archive / restore', () => {
    it('archiveChannel calls api, clears active, reloads', async () => {
      apiMock.mockResolvedValue({})
      appStore.activeChannelId = 5 as never
      const { archiveChannel } = useSidebarActions(loadTeacherChannels)
      await archiveChannel(5)
      expect(apiMock).toHaveBeenCalled()
      expect(appStore.activeChannelId).toBeNull()
      expect(loadTeacherChannels).toHaveBeenCalled()
      expect(showToastMock).toHaveBeenCalledWith('Canal archive.', 'success')
    })

    it('archiveChannel does nothing if api returns null', async () => {
      apiMock.mockResolvedValue(null)
      const { archiveChannel } = useSidebarActions(loadTeacherChannels)
      await archiveChannel(5)
      expect(loadTeacherChannels).not.toHaveBeenCalled()
    })

    it('restoreChannel calls api and reloads', async () => {
      apiMock.mockResolvedValue({})
      const { restoreChannel } = useSidebarActions(loadTeacherChannels)
      await restoreChannel(5)
      expect(loadTeacherChannels).toHaveBeenCalled()
      expect(showToastMock).toHaveBeenCalledWith('Canal restaure.', 'success')
    })

    it('restoreChannel does nothing if api returns null', async () => {
      apiMock.mockResolvedValue(null)
      const { restoreChannel } = useSidebarActions(loadTeacherChannels)
      await restoreChannel(5)
      expect(loadTeacherChannels).not.toHaveBeenCalled()
    })
  })

  // ── Drag & drop ─────────────────────────────────────────────────────────

  describe('drag & drop', () => {
    it('onDragStart sets draggingChannel', () => {
      const { onDragStart, draggingChannel } = useSidebarActions(loadTeacherChannels)
      const ch = makeChannel(1, 'test')
      const e = { dataTransfer: { effectAllowed: '', setData: vi.fn() } } as unknown as DragEvent
      onDragStart(e, ch)
      expect(draggingChannel.value).toEqual(ch)
    })

    it('onDragEnd clears state', () => {
      const { onDragStart, onDragEnd, draggingChannel, dragOverCategory } = useSidebarActions(loadTeacherChannels)
      const ch = makeChannel(1, 'test')
      const e = { dataTransfer: { effectAllowed: '', setData: vi.fn() } } as unknown as DragEvent
      onDragStart(e, ch)
      onDragEnd()
      expect(draggingChannel.value).toBeNull()
      expect(dragOverCategory.value).toBeNull()
    })

    it('onDragOver sets dragOverCategory', () => {
      const { onDragOver, dragOverCategory } = useSidebarActions(loadTeacherChannels)
      const e = { preventDefault: vi.fn(), dataTransfer: { dropEffect: '' } } as unknown as DragEvent
      onDragOver(e, 'groupA')
      expect(dragOverCategory.value).toBe('groupA')
    })

    it('onDrop calls api when category changes', async () => {
      apiMock.mockResolvedValue({})
      const { onDragStart, onDrop } = useSidebarActions(loadTeacherChannels)
      const ch = makeChannel(1, 'test', { category: null } as Partial<Channel>)
      const startEvt = { dataTransfer: { effectAllowed: '', setData: vi.fn() } } as unknown as DragEvent
      onDragStart(startEvt, ch)
      const dropEvt = { preventDefault: vi.fn() } as unknown as DragEvent
      await onDrop(dropEvt, 'newCat')
      expect(apiMock).toHaveBeenCalled()
      expect(loadTeacherChannels).toHaveBeenCalled()
    })

    it('onDrop does nothing if same category', async () => {
      const { onDragStart, onDrop } = useSidebarActions(loadTeacherChannels)
      const ch = makeChannel(1, 'test', { category: 'sameCat' } as Partial<Channel>)
      const startEvt = { dataTransfer: { effectAllowed: '', setData: vi.fn() } } as unknown as DragEvent
      onDragStart(startEvt, ch)
      const dropEvt = { preventDefault: vi.fn() } as unknown as DragEvent
      await onDrop(dropEvt, 'sameCat')
      expect(apiMock).not.toHaveBeenCalled()
    })

    it('onDrop does nothing without draggingChannel', async () => {
      const { onDrop } = useSidebarActions(loadTeacherChannels)
      const dropEvt = { preventDefault: vi.fn() } as unknown as DragEvent
      await onDrop(dropEvt, 'cat')
      expect(apiMock).not.toHaveBeenCalled()
    })
  })
})
