/**
 * Tests pour useBubbleReactions — reactions emoji sur les messages.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Message } from '@/types'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockMessagesStore = {
  toggleReaction: vi.fn(),
  reactions: {} as Record<number, Record<string, number>>,
  userVotes: {} as Record<number, Set<string>>,
}
vi.mock('@/stores/messages', () => ({
  useMessagesStore: () => mockMessagesStore,
}))

import { useBubbleReactions } from '@/composables/useBubbleReactions'

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
    content: 'Hello',
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

function setup(msgOverrides: Partial<Message> = {}) {
  const m = makeMsg(msgOverrides)
  return useBubbleReactions(() => m)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMessagesStore.reactions = {}
  mockMessagesStore.userVotes = {}
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('exports REACT_TYPES with 6 entries', () => {
    const { REACT_TYPES } = setup()
    expect(REACT_TYPES).toHaveLength(6)
    expect(REACT_TYPES[0]).toMatchObject({ type: 'check', emoji: expect.any(String) })
  })

  it('exports QUICK_REACTS with first 4 entries', () => {
    const { QUICK_REACTS, REACT_TYPES } = setup()
    expect(QUICK_REACTS).toHaveLength(4)
    expect(QUICK_REACTS).toEqual(REACT_TYPES.slice(0, 4))
  })
})

describe('showPicker', () => {
  it('initializes to false', () => {
    const { showPicker } = setup()
    expect(showPicker.value).toBe(false)
  })
})

describe('quickReact', () => {
  it('calls toggleReaction with message id and type', () => {
    const { quickReact } = setup({ id: 42 })
    quickReact('thumb')
    expect(mockMessagesStore.toggleReaction).toHaveBeenCalledWith(42, 'thumb')
  })
})

describe('pickReact', () => {
  it('calls toggleReaction and closes picker', () => {
    const result = setup({ id: 10 })
    result.showPicker.value = true
    result.pickReact('fire')
    expect(mockMessagesStore.toggleReaction).toHaveBeenCalledWith(10, 'fire')
    expect(result.showPicker.value).toBe(false)
  })
})

describe('pickEmojiReact', () => {
  it('calls toggleReaction with emoji string and closes picker', () => {
    const result = setup({ id: 10 })
    result.showPicker.value = true
    result.pickEmojiReact('custom-emoji')
    expect(mockMessagesStore.toggleReaction).toHaveBeenCalledWith(10, 'custom-emoji')
    expect(result.showPicker.value).toBe(false)
  })
})

describe('reactionsToShow', () => {
  it('returns empty array when no reactions', () => {
    const { reactionsToShow } = setup({ id: 1 })
    expect(reactionsToShow.value).toEqual([])
  })

  it('returns reactions with count > 0', () => {
    mockMessagesStore.reactions = { 1: { check: 2, thumb: 0, fire: 1, heart: 0, think: 0, eyes: 0 } }
    mockMessagesStore.userVotes = { 1: new Set(['check']) }
    const { reactionsToShow } = setup({ id: 1 })
    expect(reactionsToShow.value).toHaveLength(2)
    expect(reactionsToShow.value[0]).toMatchObject({ type: 'check', count: 2, isMine: true })
    expect(reactionsToShow.value[1]).toMatchObject({ type: 'fire', count: 1, isMine: false })
  })

  it('marks isMine correctly based on userVotes', () => {
    mockMessagesStore.reactions = { 5: { heart: 3 } }
    mockMessagesStore.userVotes = { 5: new Set(['heart']) }
    const { reactionsToShow } = setup({ id: 5 })
    expect(reactionsToShow.value[0].isMine).toBe(true)
  })

  it('handles missing userVotes for message', () => {
    mockMessagesStore.reactions = { 5: { check: 1 } }
    mockMessagesStore.userVotes = {} // no entry for message 5
    const { reactionsToShow } = setup({ id: 5 })
    expect(reactionsToShow.value[0].isMine).toBe(false)
  })

  it('handles missing reactions for message', () => {
    mockMessagesStore.reactions = {} // no entry
    const { reactionsToShow } = setup({ id: 99 })
    expect(reactionsToShow.value).toEqual([])
  })

  it('filters out zero-count reactions', () => {
    mockMessagesStore.reactions = { 1: { check: 0, thumb: 0, fire: 0, heart: 0, think: 0, eyes: 0 } }
    const { reactionsToShow } = setup({ id: 1 })
    expect(reactionsToShow.value).toEqual([])
  })
})
