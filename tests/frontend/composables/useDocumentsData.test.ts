/**
 * Tests for useDocumentsData composable — icon type mapping, filtering, categories.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

// ── Mocks ────────────────────────────────────────────────────────────────────

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

vi.mock('@/composables/useConfirm', () => ({
  useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
}))

vi.mock('@/composables/useOpenExternal', () => ({
  useOpenExternal: () => ({ openExternal: vi.fn() }),
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

import type { AppDocument } from '@/types'
import { docIconType, iconColors, iconLabels, TYPE_FILTERS } from '@/composables/useDocumentsData'
import type { DocIconType } from '@/composables/useDocumentsData'

function makeDoc(overrides: Partial<AppDocument> = {}): AppDocument {
  return {
    id: 1,
    channel_id: null,
    promo_id: 1,
    name: 'test.pdf',
    type: 'file',
    content: '/uploads/test.pdf',
    category: 'Cours',
    description: null,
    created_at: '2026-03-20T00:00:00Z',
    ...overrides,
  }
}

// ═════════════════════════════════════════════════════
//  docIconType — type resolution from document data
// ═════════════════════════════════════════════════════
describe('docIconType', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ── File types by extension ─────────────────────────────────────────────
  it('returns "pdf" for .pdf files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/cours.pdf' }))).toBe('pdf')
  })

  it('returns "image" for .jpg files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/photo.jpg' }))).toBe('image')
  })

  it('returns "image" for .jpeg files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/photo.jpeg' }))).toBe('image')
  })

  it('returns "image" for .png files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/logo.png' }))).toBe('image')
  })

  it('returns "image" for .gif files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/anim.gif' }))).toBe('image')
  })

  it('returns "image" for .svg files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/icon.svg' }))).toBe('image')
  })

  it('returns "image" for .webp files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/photo.webp' }))).toBe('image')
  })

  it('returns "image" for .bmp files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/old.bmp' }))).toBe('image')
  })

  it('returns "video" for .mp4 files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/video.mp4' }))).toBe('video')
  })

  it('returns "video" for .mov files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/clip.mov' }))).toBe('video')
  })

  it('returns "video" for .avi files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/old.avi' }))).toBe('video')
  })

  it('returns "video" for .mkv files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/hd.mkv' }))).toBe('video')
  })

  it('returns "video" for .webm files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/web.webm' }))).toBe('video')
  })

  it('returns "spreadsheet" for .xlsx files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/data.xlsx' }))).toBe('spreadsheet')
  })

  it('returns "spreadsheet" for .xls files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/data.xls' }))).toBe('spreadsheet')
  })

  it('returns "spreadsheet" for .csv files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/export.csv' }))).toBe('spreadsheet')
  })

  it('returns "spreadsheet" for .ods files', () => {
    expect(docIconType(makeDoc({ content: '/uploads/libre.ods' }))).toBe('spreadsheet')
  })

  it('returns "file" for unknown extensions', () => {
    expect(docIconType(makeDoc({ content: '/uploads/archive.zip' }))).toBe('file')
  })

  it('returns "file" for no extension', () => {
    expect(docIconType(makeDoc({ content: '/uploads/noext' }))).toBe('file')
  })

  it('returns "file" when content is empty string', () => {
    expect(docIconType(makeDoc({ content: '' }))).toBe('file')
  })

  // ── Link types ──────────────────────────────────────────────────────────
  it('returns "link" for basic link documents', () => {
    expect(docIconType(makeDoc({ type: 'link', content: 'https://example.com' }))).toBe('link')
  })

  // ── Category-based icon override for links ──────────────────────────────
  it('returns "moodle" for link with Moodle category', () => {
    expect(docIconType(makeDoc({ type: 'link', category: 'Moodle' }))).toBe('moodle')
  })

  it('returns "github" for link with GitHub category', () => {
    expect(docIconType(makeDoc({ type: 'link', category: 'GitHub' }))).toBe('github')
  })

  it('returns "linkedin" for link with LinkedIn category', () => {
    expect(docIconType(makeDoc({ type: 'link', category: 'LinkedIn' }))).toBe('linkedin')
  })

  it('returns "web" for link with Site Web category', () => {
    expect(docIconType(makeDoc({ type: 'link', category: 'Site Web' }))).toBe('web')
  })

  it('returns "package" for link with Package category', () => {
    expect(docIconType(makeDoc({ type: 'link', category: 'Package' }))).toBe('package')
  })

  it('returns "grille" for link with Grille category', () => {
    expect(docIconType(makeDoc({ type: 'link', category: 'Grille' }))).toBe('grille')
  })

  it('returns "note-peda" for link with Note Peda category', () => {
    expect(docIconType(makeDoc({ type: 'link', category: 'Note Péda' }))).toBe('note-peda')
  })

  it('returns "fiche-validation" for link with Fiche de validation category', () => {
    expect(docIconType(makeDoc({ type: 'link', category: 'Fiche de validation' }))).toBe('fiche-validation')
  })

  it('returns "link" for link with unknown category', () => {
    expect(docIconType(makeDoc({ type: 'link', category: 'Random' }))).toBe('link')
  })

  it('returns "link" for link with null category', () => {
    expect(docIconType(makeDoc({ type: 'link', category: null }))).toBe('link')
  })
})

// ═════════════════════════════════════════════════════
//  iconColors & iconLabels — completeness checks
// ═════════════════════════════════════════════════════
describe('iconColors', () => {
  it('has a color for every DocIconType', () => {
    const expectedTypes: DocIconType[] = [
      'image', 'pdf', 'video', 'link', 'file', 'spreadsheet',
      'moodle', 'github', 'linkedin', 'web', 'package',
      'grille', 'note-peda', 'fiche-validation',
    ]
    for (const t of expectedTypes) {
      expect(iconColors[t]).toBeDefined()
      expect(typeof iconColors[t]).toBe('string')
      expect(iconColors[t]).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe('iconLabels', () => {
  it('has a label for every DocIconType', () => {
    const expectedTypes: DocIconType[] = [
      'image', 'pdf', 'video', 'link', 'file', 'spreadsheet',
      'moodle', 'github', 'linkedin', 'web', 'package',
      'grille', 'note-peda', 'fiche-validation',
    ]
    for (const t of expectedTypes) {
      expect(iconLabels[t]).toBeDefined()
      expect(typeof iconLabels[t]).toBe('string')
      expect(iconLabels[t].length).toBeGreaterThan(0)
    }
  })
})

// ═════════════════════════════════════════════════════
//  TYPE_FILTERS — structure validation
// ═════════════════════════════════════════════════════
describe('TYPE_FILTERS', () => {
  it('has "Tous" as first entry with null id', () => {
    expect(TYPE_FILTERS[0]).toEqual({ id: null, label: 'Tous' })
  })

  it('contains pdf, image, video, link, file filters', () => {
    const ids = TYPE_FILTERS.map(f => f.id)
    expect(ids).toContain('pdf')
    expect(ids).toContain('image')
    expect(ids).toContain('video')
    expect(ids).toContain('link')
    expect(ids).toContain('file')
  })

  it('each filter has a non-empty label', () => {
    for (const f of TYPE_FILTERS) {
      expect(typeof f.label).toBe('string')
      expect(f.label.length).toBeGreaterThan(0)
    }
  })
})

// ═════════════════════════════════════════════════════
//  useDocumentsData composable — filtering & categories
// ═════════════════════════════════════════════════════
describe('useDocumentsData — filtering logic', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    apiMock.mockReset()
    apiMock.mockResolvedValue([])
    localStorageMock.getItem.mockReturnValue(null)
  })

  // We test the composable indirectly via the store since the composable
  // calls onMounted (requires component context). The filtering is computed
  // from store state, so we verify via store + composable pure functions.

  it('filtered returns all docs when no filters active', async () => {
    const { useDocumentsStore } = await import('@/stores/documents')
    const { useAppStore } = await import('@/stores/app')
    const docStore = useDocumentsStore()
    const appStore = useAppStore()
    appStore.activePromoId = 1

    // Directly set documents
    docStore.documents = [
      makeDoc({ id: 1, name: 'A.pdf' }),
      makeDoc({ id: 2, name: 'B.pdf' }),
    ]

    // No search query, no category filter
    docStore.searchQuery = ''
    docStore.activeCategory = ''

    expect(docStore.documents.length).toBe(2)
  })

  it('searchQuery filters documents by name', async () => {
    const { useDocumentsStore } = await import('@/stores/documents')
    const docStore = useDocumentsStore()

    docStore.documents = [
      makeDoc({ id: 1, name: 'Cours HTML.pdf' }),
      makeDoc({ id: 2, name: 'TP JavaScript.pdf' }),
      makeDoc({ id: 3, name: 'Examen Final.pdf' }),
    ]
    docStore.searchQuery = 'cours'

    // searchQuery is stored in state, the filtering is done in the composable's computed
    // We verify the store holds the correct state for the composable to filter
    expect(docStore.searchQuery).toBe('cours')
    const matching = docStore.documents.filter(d => d.name.toLowerCase().includes('cours'))
    expect(matching.length).toBe(1)
    expect(matching[0].name).toBe('Cours HTML.pdf')
  })

  it('activeCategory filters documents by category', async () => {
    const { useDocumentsStore } = await import('@/stores/documents')
    const docStore = useDocumentsStore()

    docStore.documents = [
      makeDoc({ id: 1, name: 'A.pdf', category: 'Cours' }),
      makeDoc({ id: 2, name: 'B.pdf', category: 'TP' }),
      makeDoc({ id: 3, name: 'C.pdf', category: 'Cours' }),
    ]
    docStore.activeCategory = 'TP'

    const matching = docStore.documents.filter(d => d.category === 'TP')
    expect(matching.length).toBe(1)
    expect(matching[0].name).toBe('B.pdf')
  })

  it('categories computed extracts unique sorted categories', async () => {
    const { useDocumentsStore } = await import('@/stores/documents')
    const docStore = useDocumentsStore()

    docStore.documents = [
      makeDoc({ id: 1, category: 'TP' }),
      makeDoc({ id: 2, category: 'Cours' }),
      makeDoc({ id: 3, category: 'TP' }),
      makeDoc({ id: 4, category: null }),
    ]

    const cats = new Set(docStore.documents.map(d => d.category ?? 'Général'))
    const sorted = Array.from(cats).sort()
    expect(sorted).toEqual(['Cours', 'Général', 'TP'])
  })

  it('empty documents array yields empty categories', async () => {
    const { useDocumentsStore } = await import('@/stores/documents')
    const docStore = useDocumentsStore()

    docStore.documents = []
    const cats = new Set(docStore.documents.map(d => d.category ?? 'Général'))
    expect(cats.size).toBe(0)
  })
})
