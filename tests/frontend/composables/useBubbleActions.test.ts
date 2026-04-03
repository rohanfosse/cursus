/**
 * Tests pour useBubbleActions — actions sur un message (edit, delete, pin, reply, DM, copy, report, click).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed, nextTick } from 'vue'
import type { Message } from '@/types'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn()
const mockCurrentRoute = ref({ name: 'messages' })
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, currentRoute: mockCurrentRoute }),
}))

const mockAppStore = {
  currentUser: { name: 'Alice', type: 'teacher', promo_id: 1 } as Record<string, unknown> | null,
  isTeacher: true,
  activePromoId: 1,
  activeChannelName: 'general',
  isOnline: true,
  openDm: vi.fn(),
  openChannel: vi.fn(),
}
vi.mock('@/stores/app', () => ({
  useAppStore: () => mockAppStore,
}))

const mockMessagesStore = {
  setQuote: vi.fn(),
  togglePin: vi.fn(),
  editMessage: vi.fn(),
  deleteMessage: vi.fn(),
}
vi.mock('@/stores/messages', () => ({
  useMessagesStore: () => mockMessagesStore,
}))

const mockModals = { documentPreview: false, gestionDevoir: false }
vi.mock('@/stores/modals', () => ({
  useModalsStore: () => mockModals,
}))

const mockDocumentsStore = { openPreview: vi.fn() }
vi.mock('@/stores/documents', () => ({
  useDocumentsStore: () => mockDocumentsStore,
}))

const mockTravauxStore = { openTravail: vi.fn(() => Promise.resolve()) }
vi.mock('@/stores/travaux', () => ({
  useTravauxStore: () => mockTravauxStore,
}))

const mockShowToast = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

const mockOpenExternal = vi.fn()
vi.mock('@/composables/useOpenExternal', () => ({
  useOpenExternal: () => ({ openExternal: mockOpenExternal }),
}))

vi.mock('@/utils/auth', () => ({
  authUrl: (url: string) => url,
}))

// window.api stubs
const windowApi = {
  findUserByName: vi.fn(),
  reportMessage: vi.fn(),
  getProjectDocuments: vi.fn(),
  getChannels: vi.fn(),
}
;(globalThis as any).window = { ...(globalThis as any).window, api: windowApi }

import { useBubbleActions } from '@/composables/useBubbleActions'

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

function setup(msgOverrides: Partial<Message> = {}) {
  const m = makeMsg(msgOverrides)
  return useBubbleActions(() => m)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAppStore.currentUser = { name: 'Alice', type: 'teacher', promo_id: 1 }
  mockAppStore.isTeacher = true
  mockAppStore.activePromoId = 1
  mockModals.documentPreview = false
  mockModals.gestionDevoir = false
  mockCurrentRoute.value = { name: 'messages' }
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('computed properties', () => {
  it('isOwnMessage is true when author matches current user', () => {
    const actions = setup({ author_name: 'Alice' })
    expect(actions.isOwnMessage.value).toBe(true)
  })

  it('isOwnMessage is false for other user', () => {
    const actions = setup({ author_name: 'Bob' })
    expect(actions.isOwnMessage.value).toBe(false)
  })

  it('isPinned reflects msg.is_pinned', () => {
    expect(setup({ is_pinned: true }).isPinned.value).toBe(true)
    expect(setup({ is_pinned: false }).isPinned.value).toBe(false)
  })

  it('isEdited reflects msg.edited', () => {
    expect(setup({ edited: 1 }).isEdited.value).toBe(true)
    expect(setup({ edited: 0 }).isEdited.value).toBe(false)
  })

  it('canEdit is true only for own messages', () => {
    expect(setup({ author_name: 'Alice' }).canEdit.value).toBe(true)
    expect(setup({ author_name: 'Bob' }).canEdit.value).toBe(false)
  })

  it('canDelete is true for teacher or own message', () => {
    // teacher can delete any message
    mockAppStore.isTeacher = true
    expect(setup({ author_name: 'Bob' }).canDelete.value).toBe(true)
    // non-teacher can only delete own
    mockAppStore.isTeacher = false
    expect(setup({ author_name: 'Bob' }).canDelete.value).toBe(false)
    expect(setup({ author_name: 'Alice' }).canDelete.value).toBe(true)
  })

  it('hasQuote is true when reply_to_author is set', () => {
    expect(setup({ reply_to_author: 'Charlie' }).hasQuote.value).toBe(true)
    expect(setup({ reply_to_author: null }).hasQuote.value).toBe(false)
  })
})

describe('openDmWithAuthor', () => {
  it('does nothing for own message', async () => {
    const actions = setup({ author_name: 'Alice' })
    await actions.openDmWithAuthor()
    expect(windowApi.findUserByName).not.toHaveBeenCalled()
  })

  it('opens DM on success', async () => {
    windowApi.findUserByName.mockResolvedValue({ ok: true, data: { id: 5, promo_id: 1, name: 'Bob' } })
    const actions = setup({ author_name: 'Bob' })
    await actions.openDmWithAuthor()
    expect(mockAppStore.openDm).toHaveBeenCalledWith(5, 1, 'Bob')
  })

  it('navigates to /messages if not already on messages route', async () => {
    mockCurrentRoute.value = { name: 'settings' }
    windowApi.findUserByName.mockResolvedValue({ ok: true, data: { id: 5, promo_id: 1, name: 'Bob' } })
    const actions = setup({ author_name: 'Bob' })
    await actions.openDmWithAuthor()
    expect(mockPush).toHaveBeenCalledWith('/messages')
  })

  it('shows toast when user not found', async () => {
    windowApi.findUserByName.mockResolvedValue({ ok: false })
    const actions = setup({ author_name: 'Bob' })
    await actions.openDmWithAuthor()
    expect(mockShowToast).toHaveBeenCalledWith('Utilisateur introuvable.', 'error')
  })

  it('shows toast on error', async () => {
    windowApi.findUserByName.mockRejectedValue(new Error('fail'))
    const actions = setup({ author_name: 'Bob' })
    await actions.openDmWithAuthor()
    expect(mockShowToast).toHaveBeenCalledWith("Impossible d'ouvrir la conversation.", 'error')
  })

  it('uses activePromoId fallback when promo_id is null', async () => {
    mockAppStore.activePromoId = 42
    windowApi.findUserByName.mockResolvedValue({ ok: true, data: { id: 5, promo_id: null, name: 'Bob' } })
    const actions = setup({ author_name: 'Bob' })
    await actions.openDmWithAuthor()
    expect(mockAppStore.openDm).toHaveBeenCalledWith(5, 42, 'Bob')
  })
})

describe('onReply', () => {
  it('sets quote on messagesStore', () => {
    const m = makeMsg()
    const actions = useBubbleActions(() => m)
    actions.onReply()
    expect(mockMessagesStore.setQuote).toHaveBeenCalledWith(m)
  })
})

describe('togglePin', () => {
  it('toggles pin with inverted state', () => {
    const actions = setup({ id: 7, is_pinned: false })
    actions.togglePin()
    expect(mockMessagesStore.togglePin).toHaveBeenCalledWith(7, true)
  })

  it('unpins if already pinned', () => {
    const actions = setup({ id: 7, is_pinned: true })
    actions.togglePin()
    expect(mockMessagesStore.togglePin).toHaveBeenCalledWith(7, false)
  })
})

describe('copyMessage', () => {
  it('copies message content to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const actions = setup({ content: 'Copy me' })
    await actions.copyMessage()
    expect(writeText).toHaveBeenCalledWith('Copy me')
  })

  it('does not throw when clipboard fails', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) } })
    const actions = setup()
    await expect(actions.copyMessage()).resolves.toBeUndefined()
  })
})

describe('edit flow', () => {
  it('startEdit sets editing state and content', async () => {
    const actions = setup({ content: 'Original' })
    expect(actions.editing.value).toBe(false)
    await actions.startEdit()
    expect(actions.editing.value).toBe(true)
    expect(actions.editContent.value).toBe('Original')
  })

  it('commitEdit calls editMessage with trimmed content', async () => {
    const actions = setup({ id: 3, content: 'Original' })
    await actions.startEdit()
    actions.editContent.value = '  Updated  '
    await actions.commitEdit()
    expect(mockMessagesStore.editMessage).toHaveBeenCalledWith(3, 'Updated')
    expect(actions.editing.value).toBe(false)
  })

  it('commitEdit cancels if trimmed is empty', async () => {
    const actions = setup({ content: 'Original' })
    await actions.startEdit()
    actions.editContent.value = '   '
    await actions.commitEdit()
    expect(mockMessagesStore.editMessage).not.toHaveBeenCalled()
    expect(actions.editing.value).toBe(false)
  })

  it('commitEdit cancels if trimmed equals original', async () => {
    const actions = setup({ content: 'Same' })
    await actions.startEdit()
    actions.editContent.value = 'Same'
    await actions.commitEdit()
    expect(mockMessagesStore.editMessage).not.toHaveBeenCalled()
  })

  it('cancelEdit resets state', async () => {
    const actions = setup({ content: 'Original' })
    await actions.startEdit()
    actions.cancelEdit()
    expect(actions.editing.value).toBe(false)
    expect(actions.editContent.value).toBe('')
  })

  it('onEditKeydown Enter commits', async () => {
    const actions = setup({ id: 4, content: 'Original' })
    await actions.startEdit()
    actions.editContent.value = 'New'
    const e = { key: 'Enter', shiftKey: false, preventDefault: vi.fn() } as unknown as KeyboardEvent
    actions.onEditKeydown(e)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('onEditKeydown Escape cancels', async () => {
    const actions = setup({ content: 'Original' })
    await actions.startEdit()
    actions.onEditKeydown({ key: 'Escape', shiftKey: false, preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(actions.editing.value).toBe(false)
  })

  it('onEditKeydown Shift+Enter does not commit', async () => {
    const actions = setup({ content: 'Original' })
    await actions.startEdit()
    actions.editContent.value = 'New'
    const prevent = vi.fn()
    actions.onEditKeydown({ key: 'Enter', shiftKey: true, preventDefault: prevent } as unknown as KeyboardEvent)
    expect(prevent).not.toHaveBeenCalled()
  })
})

describe('delete flow', () => {
  it('deleteMessage sets confirmingDelete', () => {
    const actions = setup()
    expect(actions.confirmingDelete.value).toBe(false)
    actions.deleteMessage()
    expect(actions.confirmingDelete.value).toBe(true)
  })

  it('confirmDelete calls store and resets', async () => {
    const actions = setup({ id: 9 })
    actions.deleteMessage()
    await actions.confirmDelete()
    expect(mockMessagesStore.deleteMessage).toHaveBeenCalledWith(9)
    expect(actions.confirmingDelete.value).toBe(false)
  })

  it('cancelDelete resets state', () => {
    const actions = setup()
    actions.deleteMessage()
    actions.cancelDelete()
    expect(actions.confirmingDelete.value).toBe(false)
  })
})

describe('reportMessage', () => {
  it('shows toast if reason is empty', async () => {
    const actions = setup()
    actions.reportReason.value = '   '
    await actions.reportMessage()
    expect(mockShowToast).toHaveBeenCalledWith('Veuillez indiquer une raison.', 'error')
    expect(windowApi.reportMessage).not.toHaveBeenCalled()
  })

  it('reports message on success', async () => {
    windowApi.reportMessage.mockResolvedValue({ ok: true })
    const actions = setup({ id: 5 })
    actions.reportingMsg.value = true
    actions.reportReason.value = 'Spam'
    await actions.reportMessage()
    expect(windowApi.reportMessage).toHaveBeenCalledWith(5, 'Spam')
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('signale'), 'info')
    expect(actions.reportingMsg.value).toBe(false)
    expect(actions.reportReason.value).toBe('')
  })

  it('shows error toast on API failure', async () => {
    windowApi.reportMessage.mockResolvedValue({ ok: false, error: 'denied' })
    const actions = setup({ id: 5 })
    actions.reportReason.value = 'Spam'
    await actions.reportMessage()
    expect(mockShowToast).toHaveBeenCalledWith('denied', 'error')
  })

  it('shows generic error toast on exception', async () => {
    windowApi.reportMessage.mockRejectedValue(new Error())
    const actions = setup({ id: 5 })
    actions.reportReason.value = 'Spam'
    await actions.reportMessage()
    expect(mockShowToast).toHaveBeenCalledWith('Erreur lors du signalement', 'error')
  })
})

describe('onMsgClick', () => {
  function makeClickEvent(target: HTMLElement): MouseEvent {
    return { target, preventDefault: vi.fn() } as unknown as MouseEvent
  }

  it('handles file card click for previewable file', () => {
    const card = document.createElement('div')
    card.className = 'msg-file-card'
    card.dataset.url = '/uploads/file.pdf'
    card.dataset.fileName = 'report.pdf'
    const e = makeClickEvent(card)
    const actions = setup()
    actions.onMsgClick(e)
    expect(e.preventDefault).toHaveBeenCalled()
    expect(mockDocumentsStore.openPreview).toHaveBeenCalled()
    expect(mockModals.documentPreview).toBe(true)
  })

  it('handles file card click for non-previewable file', () => {
    const card = document.createElement('div')
    card.className = 'msg-file-card'
    card.dataset.url = '/uploads/file.zip'
    card.dataset.fileName = 'archive.zip'
    const e = makeClickEvent(card)
    const actions = setup()
    actions.onMsgClick(e)
    expect(mockOpenExternal).toHaveBeenCalled()
  })

  it('handles anchor with data-url', () => {
    const a = document.createElement('a')
    a.dataset.url = 'https://example.com'
    const e = makeClickEvent(a)
    const actions = setup()
    actions.onMsgClick(e)
    expect(mockOpenExternal).toHaveBeenCalledWith('https://example.com')
  })

  it('handles devoir-ref click', async () => {
    const el = document.createElement('span')
    el.className = 'devoir-ref'
    el.dataset.devoirId = '42'
    const e = makeClickEvent(el)
    const actions = setup()
    actions.onMsgClick(e)
    expect(e.preventDefault).toHaveBeenCalled()
    await nextTick()
    expect(mockTravauxStore.openTravail).toHaveBeenCalledWith(42)
  })

  it('handles channel-ref click', async () => {
    const el = document.createElement('span')
    el.className = 'channel-ref'
    el.dataset.channel = 'general'
    windowApi.getChannels.mockResolvedValue({ ok: true, data: [{ name: 'general', id: 1, promo_id: 1, type: 'text' }] })
    const e = makeClickEvent(el)
    const actions = setup()
    actions.onMsgClick(e)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('ignores click on unrecognized element', () => {
    const el = document.createElement('span')
    const e = makeClickEvent(el)
    const actions = setup()
    actions.onMsgClick(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
  })
})
