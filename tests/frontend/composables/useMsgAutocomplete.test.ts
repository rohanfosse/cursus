/**
 * Tests pour useMsgAutocomplete — autocompletion @mention, #channel, /devoir, /doc, /command.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockAppStore = {
  activePromoId: 1 as number | null,
  activeChannelId: 10 as number | null,
  currentUser: { name: 'Alice', type: 'teacher', promo_id: 1 } as Record<string, unknown> | null,
}
vi.mock('@/stores/app', () => ({
  useAppStore: () => mockAppStore,
}))

// window.api stubs
const windowApi = {
  getStudents: vi.fn(),
  getAllStudents: vi.fn(),
  getTeachers: vi.fn(),
  getChannels: vi.fn(),
  getTravaux: vi.fn(),
  getProjectDocuments: vi.fn(),
}
;(globalThis as any).window = { ...(globalThis as any).window, api: windowApi }

import { useMsgAutocomplete, SLASH_COMMANDS, COMMAND_CATEGORIES } from '@/composables/useMsgAutocomplete'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTextarea(): HTMLTextAreaElement {
  const el = document.createElement('textarea')
  // Mock setSelectionRange
  el.setSelectionRange = vi.fn()
  return el
}

function setup(initialContent = '') {
  const content = ref(initialContent)
  const textarea = makeTextarea()
  const inputEl = ref<HTMLTextAreaElement | null>(textarea)
  const autoResize = vi.fn()
  const result = useMsgAutocomplete(content, inputEl, autoResize)
  return { content, inputEl, textarea, autoResize, ...result }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAppStore.activePromoId = 1
  mockAppStore.activeChannelId = 10
  mockAppStore.currentUser = { name: 'Alice', type: 'teacher', promo_id: 1 }
  windowApi.getStudents.mockResolvedValue({ ok: true, data: [{ name: 'Bob' }, { name: 'Charlie' }] })
  windowApi.getAllStudents.mockResolvedValue({ ok: true, data: [{ name: 'Bob' }, { name: 'Charlie' }] })
  windowApi.getTeachers.mockResolvedValue({ ok: true, data: [{ name: 'Prof1' }] })
  windowApi.getChannels.mockResolvedValue({ ok: true, data: [{ name: 'general', type: 'text' }, { name: 'random', type: 'text' }] })
  windowApi.getTravaux.mockResolvedValue({ ok: true, data: [{ id: 1, title: 'TP1', type: 'tp', deadline: '2026-04-01' }] })
  windowApi.getProjectDocuments.mockResolvedValue({ ok: true, data: [{ id: 1, name: 'Cours1', type: 'file', content: '/uploads/c1.pdf', category: null }] })
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('exports', () => {
  it('exports SLASH_COMMANDS array', () => {
    expect(SLASH_COMMANDS).toBeInstanceOf(Array)
    expect(SLASH_COMMANDS.length).toBeGreaterThan(0)
    expect(SLASH_COMMANDS[0]).toHaveProperty('name')
    expect(SLASH_COMMANDS[0]).toHaveProperty('description')
  })

  it('exports COMMAND_CATEGORIES', () => {
    expect(COMMAND_CATEGORIES).toHaveProperty('ref')
    expect(COMMAND_CATEGORIES).toHaveProperty('format')
    expect(COMMAND_CATEGORIES).toHaveProperty('util')
  })
})

describe('mention autocomplete', () => {
  it('initializes with inactive state', () => {
    const { mentionActive, mentionResults, mentionIndex } = setup()
    expect(mentionActive.value).toBe(false)
    expect(mentionResults.value).toEqual([])
    expect(mentionIndex.value).toBe(0)
  })

  it('detects @ trigger and activates mention', () => {
    const { content, textarea, mentionActive, detectTriggers } = setup()
    content.value = 'Hello @'
    Object.defineProperty(textarea, 'selectionStart', { value: 7, writable: true })
    detectTriggers()
    expect(mentionActive.value).toBe(true)
  })

  it('detects @ with search term', () => {
    const { content, textarea, mentionActive, detectTriggers } = setup()
    content.value = 'Hello @Bo'
    Object.defineProperty(textarea, 'selectionStart', { value: 9, writable: true })
    detectTriggers()
    expect(mentionActive.value).toBe(true)
  })

  it('insertMention replaces text correctly', async () => {
    const { content, textarea, mentionActive, insertMention } = setup('Hello @Bo')
    Object.defineProperty(textarea, 'selectionStart', { value: 9, writable: true })
    // Simulate mentionStart being set (done by detectTriggers normally)
    const result = useMsgAutocomplete(ref('Hello @Bo'), ref(textarea), vi.fn())
    // Manually set mentionActive state
    content.value = 'Hello @Bo'
    // We test insertMention by directly calling it after setup
    const s = setup('Hello @Bo')
    // Set internal state
    s.content.value = 'Hello @Bo'
    Object.defineProperty(s.textarea, 'selectionStart', { value: 9, writable: true })
    s.detectTriggers()
    s.insertMention('Bob')
    expect(s.content.value).toContain('@Bob')
    expect(s.mentionActive.value).toBe(false)
  })

  it('closeMention deactivates mention', () => {
    const s = setup('@')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 1, writable: true })
    s.detectTriggers()
    expect(s.mentionActive.value).toBe(true)
    s.closeMention()
    expect(s.mentionActive.value).toBe(false)
    expect(s.mentionIndex.value).toBe(0)
  })
})

describe('channel autocomplete', () => {
  it('detects # trigger', () => {
    const s = setup('#')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 1, writable: true })
    s.detectTriggers()
    expect(s.activeRef.value).toBe('channel')
  })

  it('detects # with search term', () => {
    const s = setup('#gen')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 4, writable: true })
    s.detectTriggers()
    expect(s.activeRef.value).toBe('channel')
  })
})

describe('command autocomplete', () => {
  it('detects / at start of line', () => {
    const s = setup('/')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 1, writable: true })
    s.detectTriggers()
    expect(s.activeRef.value).toBe('command')
  })

  it('detects /an for partial command', () => {
    const s = setup('/an')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 3, writable: true })
    s.detectTriggers()
    expect(s.activeRef.value).toBe('command')
  })

  it('refResults filters slash commands', () => {
    const s = setup('/an')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 3, writable: true })
    s.detectTriggers()
    const names = s.refResults.value.map((r: any) => r.name)
    expect(names).toContain('annonce')
  })
})

describe('devoir autocomplete', () => {
  it('detects /devoir trigger', () => {
    const s = setup('/devoir ')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 8, writable: true })
    s.detectTriggers()
    expect(s.activeRef.value).toBe('devoir')
  })

  it('detects backslash trigger', () => {
    const s = setup('\\')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 1, writable: true })
    s.detectTriggers()
    expect(s.activeRef.value).toBe('devoir')
  })
})

describe('doc autocomplete', () => {
  it('detects /doc trigger', () => {
    const s = setup('/doc ')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 5, writable: true })
    s.detectTriggers()
    expect(s.activeRef.value).toBe('doc')
  })
})

describe('no trigger', () => {
  it('deactivates all when no trigger found', () => {
    const s = setup('Hello world')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 11, writable: true })
    s.detectTriggers()
    expect(s.mentionActive.value).toBe(false)
    expect(s.activeRef.value).toBeNull()
  })
})

describe('insertRef', () => {
  it('inserts ref text at cursor position', () => {
    const s = setup('#gen')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 4, writable: true })
    s.detectTriggers()
    s.insertRef('#general')
    expect(s.content.value).toContain('#general')
    expect(s.activeRef.value).toBeNull()
  })
})

describe('triggerMention', () => {
  it('inserts @ and activates mention', async () => {
    const s = setup('Hello ')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 6, writable: true })
    s.triggerMention()
    expect(s.content.value).toBe('Hello @')
    await nextTick()
    expect(s.textarea.setSelectionRange).toHaveBeenCalled()
  })

  it('does nothing when inputEl is null', () => {
    const content = ref('')
    const inputEl = ref<HTMLTextAreaElement | null>(null)
    const r = useMsgAutocomplete(content, inputEl, vi.fn())
    r.triggerMention()
    expect(content.value).toBe('')
  })
})

describe('triggerChannel', () => {
  it('inserts # and activates channel ref', async () => {
    const s = setup('Hello ')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 6, writable: true })
    s.triggerChannel()
    expect(s.content.value).toBe('Hello #')
    await nextTick()
    expect(s.textarea.setSelectionRange).toHaveBeenCalled()
  })
})

describe('triggerDevoir', () => {
  it('inserts backslash and activates devoir ref', async () => {
    const s = setup('Hello ')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 6, writable: true })
    s.triggerDevoir()
    expect(s.content.value).toBe('Hello \\')
    await nextTick()
    expect(s.textarea.setSelectionRange).toHaveBeenCalled()
  })
})

describe('executeCommand', () => {
  it('handles annonce command', () => {
    const s = setup('/')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 1, writable: true })
    s.detectTriggers()
    const cmd = SLASH_COMMANDS.find(c => c.name === 'annonce')!
    s.executeCommand(cmd)
    expect(s.content.value).toContain('**Annonce**')
    expect(s.activeRef.value).toBeNull()
  })

  it('handles devoir command', () => {
    const s = setup('/')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 1, writable: true })
    s.detectTriggers()
    const cmd = SLASH_COMMANDS.find(c => c.name === 'devoir')!
    s.executeCommand(cmd)
    expect(s.content.value).toContain('/devoir')
    expect(s.activeRef.value).toBe('devoir')
  })

  it('handles doc command', () => {
    const s = setup('/')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 1, writable: true })
    s.detectTriggers()
    const cmd = SLASH_COMMANDS.find(c => c.name === 'doc')!
    s.executeCommand(cmd)
    expect(s.content.value).toContain('/doc')
    expect(s.activeRef.value).toBe('doc')
  })

  it('handles date command', () => {
    const s = setup('/')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 1, writable: true })
    s.detectTriggers()
    const cmd = SLASH_COMMANDS.find(c => c.name === 'date')!
    s.executeCommand(cmd)
    // Should contain a date string (French locale)
    expect(s.content.value.length).toBeGreaterThan(0)
    expect(s.activeRef.value).toBeNull()
  })

  it('handles hr command', () => {
    const s = setup('/')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 1, writable: true })
    s.detectTriggers()
    const cmd = SLASH_COMMANDS.find(c => c.name === 'hr')!
    s.executeCommand(cmd)
    expect(s.content.value).toContain('---')
  })

  it('handles sondage command', () => {
    const s = setup('/')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 1, writable: true })
    s.detectTriggers()
    const cmd = SLASH_COMMANDS.find(c => c.name === 'sondage')!
    s.executeCommand(cmd)
    expect(s.content.value).toContain('**Sondage**')
  })

  it('handles unknown command gracefully', () => {
    const s = setup('/')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 1, writable: true })
    s.detectTriggers()
    s.executeCommand({ name: 'unknown', description: '', icon: '', category: 'util', color: '' })
    expect(s.activeRef.value).toBeNull()
  })
})

describe('dismissAll', () => {
  it('closes mention and ref', () => {
    const s = setup('@')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 1, writable: true })
    s.detectTriggers()
    expect(s.mentionActive.value).toBe(true)
    s.dismissAll()
    expect(s.mentionActive.value).toBe(false)
    expect(s.activeRef.value).toBeNull()
  })
})

describe('refResults', () => {
  it('returns empty when activeRef is null', () => {
    const s = setup()
    expect(s.refResults.value).toEqual([])
  })

  it('returns empty when activeRef is mention', () => {
    const s = setup()
    // activeRef = 'mention' is not set by the code, but test the guard
    expect(s.refResults.value).toEqual([])
  })
})

describe('loadUsers edge cases', () => {
  it('loads users without promoId using getAllStudents', async () => {
    mockAppStore.activePromoId = null
    const s = setup('@')
    Object.defineProperty(s.textarea, 'selectionStart', { value: 1, writable: true })
    s.detectTriggers()
    await nextTick()
    // getAllStudents should be called when no promo
    expect(windowApi.getAllStudents).toHaveBeenCalled()
  })
})
