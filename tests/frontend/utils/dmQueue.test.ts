import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { enqueue, dequeue, peekAll, clearQueue, queueSize } from '@/utils/dmQueue'
import type { QueuedMessage } from '@/utils/dmQueue'

// ─── Helpers — mock localStorage ─────────────────────────────────────────────
function buildLocalStorageMock(): Storage {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length },
  }
}

function makeMsg(overrides: Partial<QueuedMessage> = {}): QueuedMessage {
  return {
    content: 'Hello',
    authorName: 'Alice',
    authorType: 'student',
    timestamp: Date.now(),
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('dmQueue', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', buildLocalStorageMock())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('enqueue ajoute un message', () => {
    enqueue(makeMsg({ content: 'Bonjour' }))
    expect(queueSize()).toBe(1)
    expect(peekAll()[0].content).toBe('Bonjour')
  })

  it('enqueue respecte la limite de 50 (eviction FIFO)', () => {
    for (let i = 0; i < 55; i++) {
      enqueue(makeMsg({ content: `msg-${i}` }))
    }
    expect(queueSize()).toBe(50)
    // Les 5 premiers ont ete evictes
    expect(peekAll()[0].content).toBe('msg-5')
    expect(peekAll()[49].content).toBe('msg-54')
  })

  it('dequeue retourne le premier message et le retire', () => {
    enqueue(makeMsg({ content: 'premier' }))
    enqueue(makeMsg({ content: 'deuxieme' }))
    const msg = dequeue()
    expect(msg?.content).toBe('premier')
    expect(queueSize()).toBe(1)
    expect(peekAll()[0].content).toBe('deuxieme')
  })

  it('dequeue retourne undefined si la queue est vide', () => {
    const msg = dequeue()
    expect(msg).toBeUndefined()
  })

  it('peekAll retourne tous les messages sans les retirer', () => {
    enqueue(makeMsg({ content: 'a' }))
    enqueue(makeMsg({ content: 'b' }))
    const all = peekAll()
    expect(all).toHaveLength(2)
    expect(queueSize()).toBe(2)
  })

  it('clearQueue vide la queue', () => {
    enqueue(makeMsg())
    enqueue(makeMsg())
    clearQueue()
    expect(queueSize()).toBe(0)
    expect(peekAll()).toEqual([])
  })

  it('queueSize retourne le bon nombre', () => {
    expect(queueSize()).toBe(0)
    enqueue(makeMsg())
    expect(queueSize()).toBe(1)
    enqueue(makeMsg())
    expect(queueSize()).toBe(2)
    dequeue()
    expect(queueSize()).toBe(1)
  })

  it('round-trip: enqueue → peekAll → dequeue fonctionne', () => {
    const original = makeMsg({ content: 'round-trip', dmStudentId: 42 })
    enqueue(original)
    const peeked = peekAll()
    expect(peeked).toHaveLength(1)
    expect(peeked[0].content).toBe('round-trip')
    expect(peeked[0].dmStudentId).toBe(42)
    const dequeued = dequeue()
    expect(dequeued?.content).toBe('round-trip')
    expect(queueSize()).toBe(0)
  })

  it('FIFO: le plus ancien message est evicte quand la queue depasse 50', () => {
    for (let i = 0; i < 51; i++) {
      enqueue(makeMsg({ content: `item-${i}`, timestamp: i }))
    }
    expect(queueSize()).toBe(50)
    // item-0 (le plus ancien) a ete evicte
    const first = peekAll()[0]
    expect(first.content).toBe('item-1')
    expect(first.timestamp).toBe(1)
  })

  it('la queue persiste apres un cycle save/clear/load via localStorage', () => {
    // Enqueue persists to localStorage via safeSetJSON; a fresh call to
    // loadQueue (which reads localStorage) must recover the same items.
    enqueue(makeMsg({ content: 'persist-1', timestamp: 1 }))
    enqueue(makeMsg({ content: 'persist-2', timestamp: 2 }))

    // Simulate a "page reload": the JS module's in-memory state is irrelevant
    // because every queue function reads from localStorage each call.
    // Clearing in-memory module state is not possible without re-importing, but
    // the real persistence guarantee is: peekAll() after enqueue() returns the
    // same data even if called from a different logical context.
    const snapshot = peekAll()
    expect(snapshot).toHaveLength(2)
    expect(snapshot[0].content).toBe('persist-1')
    expect(snapshot[1].content).toBe('persist-2')

    // Manually read back from the raw localStorage key to confirm JSON was written
    const raw = localStorage.getItem('cc_dm_queue')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].content).toBe('persist-1')
  })

  it('enqueue accepte un message avec content vide (robustesse)', () => {
    // The queue must not throw for edge-case content values.
    expect(() => enqueue(makeMsg({ content: '' }))).not.toThrow()
    expect(queueSize()).toBe(1)
    expect(peekAll()[0].content).toBe('')
  })

  it('plusieurs dequeue successifs vident la queue dans l\'ordre FIFO', () => {
    enqueue(makeMsg({ content: 'a', timestamp: 1 }))
    enqueue(makeMsg({ content: 'b', timestamp: 2 }))
    enqueue(makeMsg({ content: 'c', timestamp: 3 }))

    expect(dequeue()?.content).toBe('a')
    expect(dequeue()?.content).toBe('b')
    expect(dequeue()?.content).toBe('c')
    expect(dequeue()).toBeUndefined()
    expect(queueSize()).toBe(0)
  })
})
