import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({
  useApi: () => ({ api: apiMock }),
}))

vi.mock('@/composables/useOfflineCache', () => ({
  cacheData: vi.fn(),
  loadCached: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/utils/permissions', () => ({
  hasRole: () => false,
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

const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

;(window as unknown as { api: Record<string, unknown> }).api = {
  getProjectDocuments: vi.fn(),
  addProjectDocument: vi.fn(),
  updateProjectDocument: vi.fn(),
  deleteChannelDocument: vi.fn(),
  setToken: vi.fn(),
  onSocketStateChange: vi.fn(() => () => {}),
  onNewMessage: vi.fn(() => () => {}),
  onPresenceUpdate: vi.fn(() => () => {}),
  getTeacherChannels: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}

import { useDocumentsStore } from '@/stores/documents'
import { useAppStore } from '@/stores/app'
import type { AppDocument } from '@/types'

function makeDoc(overrides: Partial<AppDocument> = {}): AppDocument {
  return {
    id: 1,
    title: 'Doc 1',
    file_name: 'doc1.pdf',
    file_type: 'application/pdf',
    file_size: 1024,
    category: 'cours',
    uploaded_by: 1,
    uploader_name: 'Jean',
    created_at: '2026-03-20T00:00:00Z',
    ...overrides,
  } as AppDocument
}

describe('documents store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiMock.mockReset()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('has empty initial state', () => {
    const s = useDocumentsStore()
    expect(s.documents).toEqual([])
    expect(s.loading).toBe(false)
    expect(s.searchQuery).toBe('')
    expect(s.previewDoc).toBeNull()
  })

  it('fetchDocuments loads documents from api', async () => {
    const docs = [makeDoc({ id: 1 }), makeDoc({ id: 2, title: 'Doc 2' })]
    apiMock.mockResolvedValue(docs)

    const appStore = useAppStore()
    appStore.activePromoId = 7
    appStore.currentUser = { id: 1, name: 'J', avatar_initials: 'J', photo_data: null, type: 'student', promo_id: 7, promo_name: 'P' }

    const s = useDocumentsStore()
    await s.fetchDocuments(7)
    expect(s.documents).toEqual(docs)
    expect(s.loading).toBe(false)
  })

  it('fetchDocuments sets empty array when no promoId', async () => {
    const s = useDocumentsStore()
    await s.fetchDocuments()
    expect(s.documents).toEqual([])
  })

  it('fetchDocuments falls back to all docs when project filter returns empty', async () => {
    const allDocs = [makeDoc({ id: 1 }), makeDoc({ id: 2, title: 'Doc 2' })]
    // First call (with project filter) returns empty, second call (without) returns docs
    let callCount = 0
    apiMock.mockImplementation(() => {
      callCount++
      return callCount === 1 ? [] : allDocs
    })

    const appStore = useAppStore()
    appStore.activePromoId = 7
    appStore.activeProject = 'Projet Fantome'
    appStore.currentUser = { id: 1, name: 'J', avatar_initials: 'J', photo_data: null, type: 'teacher', promo_id: null, promo_name: null }

    const s = useDocumentsStore()
    await s.fetchDocuments(7, 'Projet Fantome')

    // Documents should be loaded from fallback (all docs, no project filter)
    expect(s.documents).toEqual(allDocs)
    // activeProject should be reset since the filter was invalid
    expect(appStore.activeProject).toBeNull()
    // api was called twice: once with filter, once without
    expect(callCount).toBe(2)
  })

  it('fetchDocuments does NOT fallback when project filter returns results', async () => {
    const projectDocs = [makeDoc({ id: 3, title: 'Project Doc' })]
    apiMock.mockResolvedValue(projectDocs)

    const appStore = useAppStore()
    appStore.activePromoId = 7
    appStore.activeProject = 'Web Dev'

    const s = useDocumentsStore()
    await s.fetchDocuments(7, 'Web Dev')

    expect(s.documents).toEqual(projectDocs)
    expect(appStore.activeProject).toBe('Web Dev')
    // api called only once (no fallback needed)
    expect(apiMock).toHaveBeenCalledTimes(1)
  })

  it('fetchDocuments does NOT fallback when no project filter and empty', async () => {
    apiMock.mockResolvedValue([])

    const appStore = useAppStore()
    appStore.activePromoId = 7
    appStore.activeProject = null

    const s = useDocumentsStore()
    await s.fetchDocuments(7, null)

    // No fallback: project was already null, promo simply has no docs
    expect(s.documents).toEqual([])
    expect(apiMock).toHaveBeenCalledTimes(1)
  })

  // ── Favorites ────────────────────────────────────────────────────────────

  it('toggleFavorite adds and removes favorites', () => {
    const s = useDocumentsStore()
    expect(s.isFavorite(1)).toBe(false)
    s.toggleFavorite(1)
    expect(s.isFavorite(1)).toBe(true)
    s.toggleFavorite(1)
    expect(s.isFavorite(1)).toBe(false)
  })

  // ── Preview navigation ─────────────────────────────────────────────────

  it('openPreview / closePreview manage previewDoc', () => {
    const s = useDocumentsStore()
    const doc = makeDoc()
    s.openPreview(doc)
    expect(s.previewDoc).toEqual(doc)
    s.closePreview()
    expect(s.previewDoc).toBeNull()
  })

  it('previewNext / previewPrev navigate through list', () => {
    const s = useDocumentsStore()
    const docs = [makeDoc({ id: 1 }), makeDoc({ id: 2 }), makeDoc({ id: 3 })]
    s.openPreview(docs[0], docs)

    s.previewNext()
    expect(s.previewDoc!.id).toBe(2)

    s.previewNext()
    expect(s.previewDoc!.id).toBe(3)

    // At the end, no change
    s.previewNext()
    expect(s.previewDoc!.id).toBe(3)

    s.previewPrev()
    expect(s.previewDoc!.id).toBe(2)

    s.previewPrev()
    expect(s.previewDoc!.id).toBe(1)

    // At the start, no change
    s.previewPrev()
    expect(s.previewDoc!.id).toBe(1)
  })

  it('previewIndex returns correct position', () => {
    const s = useDocumentsStore()
    const docs = [makeDoc({ id: 1 }), makeDoc({ id: 2 }), makeDoc({ id: 3 })]
    s.openPreview(docs[1], docs)
    expect(s.previewIndex()).toEqual({ current: 2, total: 3 })
  })

  it('previewIndex returns zeros when no preview', () => {
    const s = useDocumentsStore()
    expect(s.previewIndex()).toEqual({ current: 0, total: 0 })
  })

  // ── Fetch error handling ──────────────────────────────────────────────────

  it('fetchDocuments handles api error gracefully', async () => {
    apiMock.mockRejectedValue(new Error('Network error'))

    const appStore = useAppStore()
    appStore.activePromoId = 7
    appStore.currentUser = { id: 1, name: 'J', avatar_initials: 'J', photo_data: null, type: 'student', promo_id: 7, promo_name: 'P' }

    const s = useDocumentsStore()
    await s.fetchDocuments(7)
    // Should not throw, documents stays empty, loading is false
    expect(s.documents).toEqual([])
    expect(s.loading).toBe(false)
  })

  it('fetchDocuments resets activeCategory', async () => {
    const s = useDocumentsStore()
    s.activeCategory = 'TP'
    apiMock.mockResolvedValue([])

    const appStore = useAppStore()
    appStore.activePromoId = 7
    appStore.currentUser = { id: 1, name: 'J', avatar_initials: 'J', photo_data: null, type: 'student', promo_id: 7, promo_name: 'P' }

    await s.fetchDocuments(7)
    expect(s.activeCategory).toBe('')
  })

  // ── Favorites edge cases ──────────────────────────────────────────────────

  it('toggleFavorite with non-existent doc ID works without error', () => {
    const s = useDocumentsStore()
    s.toggleFavorite(999999)
    expect(s.isFavorite(999999)).toBe(true)
    s.toggleFavorite(999999)
    expect(s.isFavorite(999999)).toBe(false)
  })

  it('favorites persist to localStorage', () => {
    const s = useDocumentsStore()
    s.toggleFavorite(42)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'cc_doc_favorites',
      expect.stringContaining('42'),
    )
  })

  it('multiple favorites tracked independently', () => {
    const s = useDocumentsStore()
    s.toggleFavorite(1)
    s.toggleFavorite(2)
    s.toggleFavorite(3)
    expect(s.isFavorite(1)).toBe(true)
    expect(s.isFavorite(2)).toBe(true)
    expect(s.isFavorite(3)).toBe(true)
    s.toggleFavorite(2)
    expect(s.isFavorite(1)).toBe(true)
    expect(s.isFavorite(2)).toBe(false)
    expect(s.isFavorite(3)).toBe(true)
  })

  // ── Preview with empty docs array ─────────────────────────────────────────

  it('previewNext does nothing when previewList is empty', () => {
    const s = useDocumentsStore()
    const doc = makeDoc({ id: 1 })
    s.openPreview(doc, [])
    s.previewNext()
    expect(s.previewDoc!.id).toBe(1)
  })

  it('previewPrev does nothing when previewList is empty', () => {
    const s = useDocumentsStore()
    const doc = makeDoc({ id: 1 })
    s.openPreview(doc, [])
    s.previewPrev()
    expect(s.previewDoc!.id).toBe(1)
  })

  it('previewIndex returns zeros when previewList is empty', () => {
    const s = useDocumentsStore()
    const doc = makeDoc({ id: 1 })
    s.openPreview(doc, [])
    // Doc exists but list is empty, so findIndex returns -1
    expect(s.previewIndex()).toEqual({ current: 0, total: 0 })
  })

  it('previewNext/previewPrev do nothing when previewDoc is null', () => {
    const s = useDocumentsStore()
    s.previewNext()
    s.previewPrev()
    expect(s.previewDoc).toBeNull()
  })

  // ── addDocument / updateDocument / deleteDocument ─────────────────────────

  it('addDocument returns true on success and refetches', async () => {
    apiMock.mockResolvedValue({ changes: 1 })

    const appStore = useAppStore()
    appStore.activePromoId = 7
    appStore.currentUser = { id: 1, name: 'J', avatar_initials: 'J', photo_data: null, type: 'student', promo_id: 7, promo_name: 'P' }

    const s = useDocumentsStore()
    const result = await s.addDocument({ promoId: 7, name: 'new.pdf', type: 'file', pathOrUrl: '/new.pdf' })
    expect(result).toBe(true)
  })

  it('addDocument returns false when api returns null', async () => {
    apiMock.mockResolvedValue(null)

    const s = useDocumentsStore()
    const result = await s.addDocument({ promoId: 7, name: 'fail.pdf', type: 'file', pathOrUrl: '/fail.pdf' })
    expect(result).toBe(false)
  })

  it('deleteDocument returns true on success', async () => {
    apiMock.mockResolvedValue({ changes: 1 })

    const appStore = useAppStore()
    appStore.activePromoId = 7
    appStore.currentUser = { id: 1, name: 'J', avatar_initials: 'J', photo_data: null, type: 'student', promo_id: 7, promo_name: 'P' }

    const s = useDocumentsStore()
    const result = await s.deleteDocument(1)
    expect(result).toBe(true)
  })

  it('updateDocument returns true on success', async () => {
    apiMock.mockResolvedValue({ changes: 1 })

    const appStore = useAppStore()
    appStore.activePromoId = 7
    appStore.currentUser = { id: 1, name: 'J', avatar_initials: 'J', photo_data: null, type: 'student', promo_id: 7, promo_name: 'P' }

    const s = useDocumentsStore()
    const result = await s.updateDocument(1, { name: 'updated.pdf' })
    expect(result).toBe(true)
  })

  // ── searchQuery state ─────────────────────────────────────────────────────

  it('searchQuery can be set and cleared', () => {
    const s = useDocumentsStore()
    s.searchQuery = 'cours'
    expect(s.searchQuery).toBe('cours')
    s.searchQuery = ''
    expect(s.searchQuery).toBe('')
  })
})
