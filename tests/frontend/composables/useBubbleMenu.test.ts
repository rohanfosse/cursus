/**
 * Tests pour useBubbleMenu — menu contextuel, lightbox, couleur avatar, rendu HTML.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { Message } from '@/types'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockAppStore = {
  currentUser: { name: 'Alice', type: 'teacher' } as Record<string, unknown> | null,
  isTeacher: true,
}
vi.mock('@/stores/app', () => ({
  useAppStore: () => mockAppStore,
}))

vi.mock('@/utils/format', () => ({
  avatarColor: (name: string) => `color-${name}`,
}))

vi.mock('@/utils/html', () => ({
  renderMessageContent: (raw: string, search: string, user: string) => `rendered:${raw}:${search}:${user}`,
}))

import { useBubbleMenu } from '@/composables/useBubbleMenu'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMsg(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    channel_id: 10,
    dm_student_id: null,
    author_id: 2,
    author_name: 'Bob',
    author_type: 'student',
    author_initials: 'BO',
    author_photo: null,
    content: 'Hello world',
    created_at: '2026-01-01T00:00:00Z',
    reactions: null,
    is_pinned: false,
    edited: 0,
    reply_to_id: null,
    reply_to_author: null,
    reply_to_preview: null,
    ...overrides,
  }
}

function makeDeps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    isMine: () => false,
    isPinned: () => false,
    canEdit: () => false,
    canDelete: () => false,
    onReply: vi.fn(),
    copyMessage: vi.fn(),
    startEdit: vi.fn(),
    togglePin: vi.fn(),
    deleteMessage: vi.fn(),
    reportingMsg: ref(false),
    ...overrides,
  }
}

function setup(
  msgOverrides: Partial<Message> = {},
  searchTerm = '',
  depsOverrides: Partial<Record<string, unknown>> = {},
) {
  const m = makeMsg(msgOverrides)
  const deps = makeDeps(depsOverrides)
  return { result: useBubbleMenu(() => m, () => searchTerm, deps as any), deps }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAppStore.currentUser = { name: 'Alice', type: 'teacher' }
  mockAppStore.isTeacher = true
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('lightbox and menu refs', () => {
  it('initializes lightboxUrl to null', () => {
    const { result } = setup()
    expect(result.lightboxUrl.value).toBeNull()
  })

  it('initializes showMenu to false', () => {
    const { result } = setup()
    expect(result.showMenu.value).toBe(false)
  })
})

describe('context menu', () => {
  it('initializes context menu hidden', () => {
    const { result } = setup()
    expect(result.ctxVisible.value).toBe(false)
    expect(result.ctxX.value).toBe(0)
    expect(result.ctxY.value).toBe(0)
  })

  it('onContextMenu sets position and visibility', () => {
    const { result } = setup()
    const e = { clientX: 100, clientY: 200, preventDefault: vi.fn() } as unknown as MouseEvent
    result.onContextMenu(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(result.ctxVisible.value).toBe(true)
    expect(result.ctxX.value).toBe(100)
    expect(result.ctxY.value).toBe(200)
  })
})

describe('ctxItems', () => {
  it('always includes Repondre and Copier', () => {
    const { result } = setup()
    const labels = result.ctxItems.value.map(i => i.label)
    expect(labels).toContain('Répondre')
    expect(labels).toContain('Copier le texte')
  })

  it('includes Modifier when canEdit is true', () => {
    const { result } = setup({}, '', { canEdit: () => true })
    const labels = result.ctxItems.value.map(i => i.label)
    expect(labels).toContain('Modifier')
  })

  it('excludes Modifier when canEdit is false', () => {
    const { result } = setup({}, '', { canEdit: () => false })
    const labels = result.ctxItems.value.map(i => i.label)
    expect(labels).not.toContain('Modifier')
  })

  it('includes pin toggle for teacher', () => {
    mockAppStore.isTeacher = true
    const { result } = setup({}, '', { isPinned: () => false })
    const labels = result.ctxItems.value.map(i => i.label)
    expect(labels.some(l => l === 'Épingler' || l === 'Désépingler')).toBe(true)
  })

  it('excludes pin toggle for non-teacher', () => {
    mockAppStore.isTeacher = false
    const { result } = setup()
    const labels = result.ctxItems.value.map(i => i.label)
    expect(labels.some(l => l === 'Épingler' || l === 'Désépingler')).toBe(false)
  })

  it('includes Signaler for other user messages', () => {
    const { result } = setup({}, '', { isMine: () => false })
    const labels = result.ctxItems.value.map(i => i.label)
    expect(labels).toContain('Signaler')
  })

  it('excludes Signaler for own messages', () => {
    const { result } = setup({}, '', { isMine: () => true })
    const labels = result.ctxItems.value.map(i => i.label)
    expect(labels).not.toContain('Signaler')
  })

  it('includes Supprimer when canDelete is true', () => {
    const { result } = setup({}, '', { canDelete: () => true })
    const labels = result.ctxItems.value.map(i => i.label)
    expect(labels).toContain('Supprimer')
  })

  it('excludes Supprimer when canDelete is false', () => {
    const { result } = setup({}, '', { canDelete: () => false })
    const labels = result.ctxItems.value.map(i => i.label)
    expect(labels).not.toContain('Supprimer')
  })

  it('action calls deps.onReply and hides menu', () => {
    const { result, deps } = setup()
    result.showMenu.value = true
    const replyItem = result.ctxItems.value.find(i => i.label === 'Répondre')!
    replyItem.action()
    expect(deps.onReply).toHaveBeenCalled()
    expect(result.showMenu.value).toBe(false)
  })
})

describe('content', () => {
  it('renders content through renderMessageContent', () => {
    const { result } = setup({ content: 'hello' }, 'search')
    expect(result.content.value).toBe('rendered:hello:search:Alice')
  })

  it('uses empty string when currentUser is null', () => {
    mockAppStore.currentUser = null
    const { result } = setup({ content: 'test' })
    expect(result.content.value).toBe('rendered:test::')
  })
})

describe('color', () => {
  it('returns accent for own teacher messages', () => {
    mockAppStore.currentUser = { name: 'Alice', type: 'teacher' }
    const { result } = setup({}, '', { isMine: () => true })
    expect(result.color.value).toBe('var(--accent)')
  })

  it('returns ta color for own TA messages', () => {
    mockAppStore.currentUser = { name: 'Alice', type: 'ta' }
    const { result } = setup({}, '', { isMine: () => true })
    expect(result.color.value).toBe('var(--color-ta)')
  })

  it('returns avatarColor for other user messages', () => {
    const { result } = setup({ author_name: 'Bob' }, '', { isMine: () => false })
    expect(result.color.value).toBe('color-Bob')
  })

  it('returns avatarColor for own student messages', () => {
    mockAppStore.currentUser = { name: 'Alice', type: 'student' }
    const { result } = setup({ author_name: 'Alice' }, '', { isMine: () => true })
    expect(result.color.value).toBe('color-Alice')
  })
})

describe('imagePreviewUrl', () => {
  it('extracts image URL from content', () => {
    const { result } = setup({ content: 'Look at this https://example.com/img.png ' })
    expect(result.imagePreviewUrl.value).toBe('https://example.com/img.png')
  })

  it('returns null when no image URL in content', () => {
    const { result } = setup({ content: 'No images here' })
    expect(result.imagePreviewUrl.value).toBeNull()
  })

  it('matches various image extensions', () => {
    for (const ext of ['jpg', 'jpeg', 'gif', 'webp', 'svg']) {
      const { result } = setup({ content: `https://x.com/i.${ext} ` })
      expect(result.imagePreviewUrl.value).toBe(`https://x.com/i.${ext}`)
    }
  })
})

describe('closeAll', () => {
  it('resets showMenu, picker, and confirmingDelete', () => {
    const { result } = setup()
    result.showMenu.value = true
    const showPicker = ref(true)
    const confirmingDelete = ref(true)
    result.closeAll(showPicker, confirmingDelete)
    expect(result.showMenu.value).toBe(false)
    expect(showPicker.value).toBe(false)
    expect(confirmingDelete.value).toBe(false)
  })
})
