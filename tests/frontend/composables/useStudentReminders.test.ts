/**
 * Tests pour useStudentReminders — rappels de deadline etudiants.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────
const showToast = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast }),
}))

const mockSafeGetJSON = vi.fn(() => [])
const mockSafeSetJSON = vi.fn()
vi.mock('@/utils/safeStorage', () => ({
  safeGetJSON: (...args: unknown[]) => mockSafeGetJSON(...args),
  safeSetJSON: (...args: unknown[]) => mockSafeSetJSON(...args),
}))

// Mock lifecycle hooks so they run inline
const mountedCallbacks: (() => void)[] = []
const unmountedCallbacks: (() => void)[] = []
vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onMounted: (cb: () => void) => { mountedCallbacks.push(cb) },
    onUnmounted: (cb: () => void) => { unmountedCallbacks.push(cb) },
  }
})

// Stub window.Notification
Object.defineProperty(globalThis, 'Notification', {
  value: vi.fn(),
  writable: true,
  configurable: true,
})
Object.defineProperty(globalThis.Notification, 'permission', {
  value: 'granted',
  writable: true,
  configurable: true,
})

import { useStudentReminders } from '@/composables/useStudentReminders'

describe('useStudentReminders', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    showToast.mockClear()
    mockSafeGetJSON.mockReturnValue([])
    mockSafeSetJSON.mockClear()
    mountedCallbacks.length = 0
    unmountedCallbacks.length = 0
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── addReminder ─────────────────────────────────────────────────────────
  it('adds a reminder for a future deadline', () => {
    const futureDate = new Date(Date.now() + 48 * 3600_000).toISOString()
    const { addReminder, reminders } = useStudentReminders()

    const result = addReminder(1, 'TP1', futureDate, 24)
    expect(result).toBe(true)
    expect(reminders.value.length).toBe(1)
    expect(reminders.value[0].devoirId).toBe(1)
    expect(reminders.value[0].devoirTitle).toBe('TP1')
    expect(reminders.value[0].notified).toBe(false)
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('24h'), 'success')
    expect(mockSafeSetJSON).toHaveBeenCalled()
  })

  it('returns false and shows info toast if deadline is too close', () => {
    const tooSoon = new Date(Date.now() + 1 * 3600_000).toISOString() // 1h from now
    const { addReminder, reminders } = useStudentReminders()

    const result = addReminder(1, 'TP1', tooSoon, 24) // 24h before, but deadline is 1h away
    expect(result).toBe(false)
    expect(reminders.value.length).toBe(0)
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('trop proche'), 'info')
  })

  it('replaces an existing reminder for the same devoir', () => {
    const future = new Date(Date.now() + 72 * 3600_000).toISOString()
    const { addReminder, reminders } = useStudentReminders()

    addReminder(1, 'TP1', future, 24)
    addReminder(1, 'TP1 updated', future, 12)
    expect(reminders.value.length).toBe(1)
    expect(reminders.value[0].devoirTitle).toBe('TP1 updated')
  })

  // ── removeReminder ────────────────────────────────────────────────────────
  it('removes a reminder by devoir id', () => {
    const future = new Date(Date.now() + 48 * 3600_000).toISOString()
    const { addReminder, removeReminder, reminders } = useStudentReminders()

    addReminder(1, 'TP1', future, 24)
    expect(reminders.value.length).toBe(1)
    removeReminder(1)
    expect(reminders.value.length).toBe(0)
    expect(mockSafeSetJSON).toHaveBeenCalled()
  })

  it('removeReminder is a no-op for unknown devoir id', () => {
    const future = new Date(Date.now() + 48 * 3600_000).toISOString()
    const { addReminder, removeReminder, reminders } = useStudentReminders()

    addReminder(1, 'TP1', future, 24)
    removeReminder(999)
    expect(reminders.value.length).toBe(1)
  })

  // ── hasReminder ───────────────────────────────────────────────────────────
  it('hasReminder returns true for an active (non-notified) reminder', () => {
    const future = new Date(Date.now() + 48 * 3600_000).toISOString()
    const { addReminder, hasReminder } = useStudentReminders()

    addReminder(1, 'TP1', future, 24)
    expect(hasReminder(1)).toBe(true)
  })

  it('hasReminder returns false when no reminder exists', () => {
    const { hasReminder } = useStudentReminders()
    expect(hasReminder(42)).toBe(false)
  })

  // ── checkReminders (via onMounted) ────────────────────────────────────────
  it('notifies when a reminder time has passed', () => {
    // Pre-load a reminder that should fire immediately
    mockSafeGetJSON.mockReturnValue([{
      devoirId: 1,
      devoirTitle: 'TP1',
      deadline: new Date(Date.now() + 1 * 3600_000).toISOString(),
      remindAt: Date.now() - 1000, // already past
      notified: false,
    }])

    useStudentReminders()

    // Trigger onMounted
    for (const cb of mountedCallbacks) cb()

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('TP1'), 'info')
  })

  it('loads reminders from storage on creation', () => {
    const stored = [{
      devoirId: 5,
      devoirTitle: 'TP5',
      deadline: new Date(Date.now() + 72 * 3600_000).toISOString(),
      remindAt: Date.now() + 48 * 3600_000,
      notified: false,
    }]
    mockSafeGetJSON.mockReturnValue(stored)

    const { reminders } = useStudentReminders()
    expect(reminders.value.length).toBe(1)
    expect(reminders.value[0].devoirId).toBe(5)
  })

  // ── Default hoursBeforeDeadline ───────────────────────────────────────────
  it('uses default 24h before deadline when no hours specified', () => {
    const future = new Date(Date.now() + 48 * 3600_000).toISOString()
    const { addReminder, reminders } = useStudentReminders()

    addReminder(1, 'TP1', future)
    const expected = new Date(future).getTime() - 24 * 3600_000
    expect(reminders.value[0].remindAt).toBe(expected)
  })
})
