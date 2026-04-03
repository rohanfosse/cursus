/**
 * Tests pour useBubbleBookmarks — favoris de messages via localStorage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Message } from '@/types'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockAppStore = {
  activeChannelName: 'general',
}
vi.mock('@/stores/app', () => ({
  useAppStore: () => mockAppStore,
}))

vi.mock('@/constants', () => ({
  STORAGE_KEYS: { BOOKMARKS: 'cesia:bookmarks' },
}))

import { useBubbleBookmarks } from '@/composables/useBubbleBookmarks'

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

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockAppStore.activeChannelName = 'general'
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('isBookmarked', () => {
  it('is false when localStorage is empty', () => {
    const { isBookmarked } = useBubbleBookmarks(() => makeMsg({ id: 1 }))
    expect(isBookmarked.value).toBe(false)
  })

  it('is true when message is in bookmarks', () => {
    localStorage.setItem('cesia:bookmarks', JSON.stringify([
      { id: 1, authorName: 'Bob', authorInitials: 'BO', content: 'Hi', createdAt: '', isDm: false, channelName: null, dmStudentId: null },
    ]))
    const { isBookmarked } = useBubbleBookmarks(() => makeMsg({ id: 1 }))
    expect(isBookmarked.value).toBe(true)
  })

  it('is false when different message is bookmarked', () => {
    localStorage.setItem('cesia:bookmarks', JSON.stringify([
      { id: 99, authorName: 'X', authorInitials: 'X', content: '', createdAt: '', isDm: false, channelName: null, dmStudentId: null },
    ]))
    const { isBookmarked } = useBubbleBookmarks(() => makeMsg({ id: 1 }))
    expect(isBookmarked.value).toBe(false)
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('cesia:bookmarks', 'not-json')
    const { isBookmarked } = useBubbleBookmarks(() => makeMsg({ id: 1 }))
    expect(isBookmarked.value).toBe(false)
  })

  it('handles old number[] format gracefully', () => {
    localStorage.setItem('cesia:bookmarks', JSON.stringify([1, 2, 3]))
    const { isBookmarked } = useBubbleBookmarks(() => makeMsg({ id: 1 }))
    expect(isBookmarked.value).toBe(false)
  })

  it('handles non-array JSON gracefully', () => {
    localStorage.setItem('cesia:bookmarks', JSON.stringify({ id: 1 }))
    const { isBookmarked } = useBubbleBookmarks(() => makeMsg({ id: 1 }))
    expect(isBookmarked.value).toBe(false)
  })
})

describe('toggleBookmark', () => {
  it('adds a bookmark when not bookmarked', () => {
    const msg = makeMsg({ id: 5, author_name: 'Alice', author_initials: 'AL', content: 'Test message', created_at: '2026-03-01' })
    const { isBookmarked, toggleBookmark } = useBubbleBookmarks(() => msg)
    expect(isBookmarked.value).toBe(false)

    toggleBookmark()

    expect(isBookmarked.value).toBe(true)
    const saved = JSON.parse(localStorage.getItem('cesia:bookmarks')!)
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({
      id: 5,
      authorName: 'Alice',
      authorInitials: 'AL',
      content: 'Test message',
      createdAt: '2026-03-01',
      isDm: false,
      channelName: 'general',
      dmStudentId: null,
    })
  })

  it('removes a bookmark when already bookmarked', () => {
    localStorage.setItem('cesia:bookmarks', JSON.stringify([
      { id: 5, authorName: 'Alice', authorInitials: 'AL', content: 'Test', createdAt: '', isDm: false, channelName: null, dmStudentId: null },
    ]))
    const { isBookmarked, toggleBookmark } = useBubbleBookmarks(() => makeMsg({ id: 5 }))
    expect(isBookmarked.value).toBe(true)

    toggleBookmark()

    expect(isBookmarked.value).toBe(false)
    const saved = JSON.parse(localStorage.getItem('cesia:bookmarks')!)
    expect(saved).toHaveLength(0)
  })

  it('marks DM messages correctly', () => {
    const msg = makeMsg({ id: 7, dm_student_id: 42 })
    const { toggleBookmark } = useBubbleBookmarks(() => msg)
    toggleBookmark()
    const saved = JSON.parse(localStorage.getItem('cesia:bookmarks')!)
    expect(saved[0].isDm).toBe(true)
    expect(saved[0].dmStudentId).toBe(42)
  })

  it('truncates content to 200 characters', () => {
    const longContent = 'A'.repeat(300)
    const msg = makeMsg({ id: 8, content: longContent })
    const { toggleBookmark } = useBubbleBookmarks(() => msg)
    toggleBookmark()
    const saved = JSON.parse(localStorage.getItem('cesia:bookmarks')!)
    expect(saved[0].content).toHaveLength(200)
  })

  it('uses fallback initials from author_name when author_initials is undefined', () => {
    const msg = makeMsg({ id: 9, author_name: 'Charlie', author_initials: undefined as any })
    const { toggleBookmark } = useBubbleBookmarks(() => msg)
    toggleBookmark()
    const saved = JSON.parse(localStorage.getItem('cesia:bookmarks')!)
    expect(saved[0].authorInitials).toBe('CH')
  })

  it('sets channelName to null when activeChannelName is empty', () => {
    mockAppStore.activeChannelName = ''
    const msg = makeMsg({ id: 10 })
    const { toggleBookmark } = useBubbleBookmarks(() => msg)
    toggleBookmark()
    const saved = JSON.parse(localStorage.getItem('cesia:bookmarks')!)
    expect(saved[0].channelName).toBeNull()
  })

  it('preserves other bookmarks when toggling', () => {
    localStorage.setItem('cesia:bookmarks', JSON.stringify([
      { id: 1, authorName: 'A', authorInitials: 'A', content: '', createdAt: '', isDm: false, channelName: null, dmStudentId: null },
    ]))
    const { toggleBookmark } = useBubbleBookmarks(() => makeMsg({ id: 2 }))
    toggleBookmark()
    const saved = JSON.parse(localStorage.getItem('cesia:bookmarks')!)
    expect(saved).toHaveLength(2)
    expect(saved[0].id).toBe(1)
    expect(saved[1].id).toBe(2)
  })
})
