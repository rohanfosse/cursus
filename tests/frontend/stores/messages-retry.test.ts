// ─── Tests retry + queue offline — useMessagesStore.sendMessage / flushDmQueue ─
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Mock dependencies before importing the store
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@/composables/useOfflineCache', () => ({
  cacheData: vi.fn(),
  loadCached: vi.fn().mockResolvedValue(null),
}))

import { useAppStore } from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import { clearQueue, queueSize, peekAll } from '@/utils/dmQueue'
import type { Message, User } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildLocalStorageMock(): Storage {
  const store: Record<string, string> = {}
  return {
    getItem:    (key: string) => store[key] ?? null,
    setItem:    (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear:      () => { Object.keys(store).forEach(k => delete store[k]) },
    key:        (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length },
  }
}

function makeUser(): User {
  return {
    id: 1,
    name: 'Jean Dupont',
    avatar_initials: 'JD',
    photo_data: null,
    type: 'student',
    promo_id: 7,
    promo_name: 'Promo Test',
    must_change_password: 0,
  }
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 1,
    channel_id: 42,
    dm_student_id: null,
    author_id: 1,
    author_name: 'Jean Dupont',
    author_type: 'student',
    author_initials: 'JD',
    author_photo: null,
    content: 'Bonjour',
    created_at: '2026-03-21T10:00:00.000Z',
    reactions: null,
    is_pinned: 0,
    edited: 0,
    ...overrides,
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const sendMessageMock = vi.fn()

beforeEach(() => {
  // Fresh Pinia instance per test
  setActivePinia(createPinia())

  // Fresh localStorage isolates the dmQueue state between tests
  vi.stubGlobal('localStorage', buildLocalStorageMock())

  // navigator.onLine must be true or useApi short-circuits immediately
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })

  // Use fake timers to advance retry backoff without actual waiting
  vi.useFakeTimers()

  sendMessageMock.mockReset()
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    sendMessage: sendMessageMock,
    // Provide no-op stubs for any other api methods the store might call
    togglePinMessage:       vi.fn(),
    getChannelMessagesPage: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    getDmMessagesPage:      vi.fn().mockResolvedValue({ ok: true, data: [] }),
    searchMessages:         vi.fn(),
    searchDmMessages:       vi.fn(),
    getPinnedMessages:      vi.fn(),
  }

  const appStore = useAppStore()
  appStore.currentUser      = makeUser()
  appStore.activeChannelId  = 42
  appStore.activeChannelName = 'general'
  appStore.activePromoId    = 7
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ─── sendMessage retry logic ──────────────────────────────────────────────────

describe('sendMessage — retry', () => {
  it('envoie le message du premier coup et retourne true', async () => {
    const inserted = makeMessage({ id: 10, content: 'Envoi direct' })
    sendMessageMock.mockResolvedValue({ ok: true, data: inserted })

    const store = useMessagesStore()
    const ok = await store.sendMessage('Envoi direct')

    // Advance any pending timers
    await vi.runAllTimersAsync()

    expect(ok).toBe(true)
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    expect(store.messages).toContainEqual(inserted)
    expect(queueSize()).toBe(0)
  })

  it('reussit sur la deuxieme tentative apres un premier echec', async () => {
    const inserted = makeMessage({ id: 20, content: 'Retry success' })

    // First call fails, second succeeds
    sendMessageMock
      .mockResolvedValueOnce({ ok: false, error: 'Erreur reseau' })
      .mockResolvedValueOnce({ ok: true, data: inserted })

    const store = useMessagesStore()

    // sendMessage has an internal await _wait(1000) between attempts — advance timers
    const sendPromise = store.sendMessage('Retry success')
    await vi.runAllTimersAsync()
    const ok = await sendPromise

    expect(ok).toBe(true)
    expect(sendMessageMock).toHaveBeenCalledTimes(2)
    expect(store.messages).toContainEqual(inserted)
    expect(queueSize()).toBe(0)
  })

  it('met le message en queue apres 3 echecs consecutifs et retourne false', async () => {
    // All three attempts fail
    sendMessageMock.mockResolvedValue({ ok: false, error: 'Serveur indisponible' })

    const store = useMessagesStore()

    const sendPromise = store.sendMessage('Message a mettre en queue')
    await vi.runAllTimersAsync()
    const ok = await sendPromise

    expect(ok).toBe(false)
    // 3 attempts exactly
    expect(sendMessageMock).toHaveBeenCalledTimes(3)
    // The message must have been enqueued
    expect(queueSize()).toBe(1)
    expect(peekAll()[0].content).toBe('Message a mettre en queue')
    expect(store.sendError).toBe(true)
  })

  it('ne met PAS en queue si le contenu est vide', async () => {
    const store = useMessagesStore()

    const ok = await store.sendMessage('   ')

    await vi.runAllTimersAsync()

    expect(ok).toBe(false)
    expect(sendMessageMock).not.toHaveBeenCalled()
    expect(queueSize()).toBe(0)
  })
})

// ─── flushDmQueue ─────────────────────────────────────────────────────────────

describe('flushDmQueue', () => {
  it('envoie tous les messages mis en queue sequentiellement', async () => {
    // Pre-populate the queue with two messages via the public enqueue utility.
    // We test flushDmQueue in isolation here, so we seed the queue directly.
    const { enqueue } = await import('@/utils/dmQueue')
    enqueue({ content: 'queued-1', authorName: 'Jean Dupont', authorType: 'student', timestamp: 1 })
    enqueue({ content: 'queued-2', authorName: 'Jean Dupont', authorType: 'student', timestamp: 2 })

    const msg1 = makeMessage({ id: 100, content: 'queued-1' })
    const msg2 = makeMessage({ id: 101, content: 'queued-2' })

    sendMessageMock
      .mockResolvedValueOnce({ ok: true, data: msg1 })
      .mockResolvedValueOnce({ ok: true, data: msg2 })

    const store = useMessagesStore()
    await store.flushDmQueue()
    await vi.runAllTimersAsync()

    expect(sendMessageMock).toHaveBeenCalledTimes(2)
    // Queue must be drained after successful flush
    expect(queueSize()).toBe(0)
  })

  it('s\'arrete au premier echec et conserve les messages restants dans la queue', async () => {
    const { enqueue } = await import('@/utils/dmQueue')
    enqueue({ content: 'flush-fail-1', authorName: 'Jean Dupont', authorType: 'student', timestamp: 1 })
    enqueue({ content: 'flush-fail-2', authorName: 'Jean Dupont', authorType: 'student', timestamp: 2 })

    // First message fails to send
    sendMessageMock.mockResolvedValue({ ok: false, error: 'Erreur reseau' })

    const store = useMessagesStore()
    await store.flushDmQueue()
    await vi.runAllTimersAsync()

    // Only one attempt — stopped after first failure
    expect(sendMessageMock).toHaveBeenCalledTimes(1)
    // Both messages must remain in the queue (none dequeued)
    expect(queueSize()).toBe(2)
  })

  it('ne fait rien si la queue est vide', async () => {
    // Ensure queue is empty
    clearQueue()

    const store = useMessagesStore()
    await store.flushDmQueue()
    await vi.runAllTimersAsync()

    expect(sendMessageMock).not.toHaveBeenCalled()
  })
})
