/**
 * Tests unitaires pour le composable useClockTimer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return { ...actual }
})

import { useClockTimer } from '@/composables/useClockTimer'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-22T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useClockTimer', () => {
  it('now ref is initialized to Date.now()', () => {
    const refreshCb = vi.fn().mockResolvedValue(undefined)
    const { now } = useClockTimer(refreshCb)
    expect(now.value).toBe(new Date('2026-03-22T12:00:00Z').getTime())
  })

  it('timer updates now value after clockMs', () => {
    const refreshCb = vi.fn().mockResolvedValue(undefined)
    const { now, start } = useClockTimer(refreshCb, { clockMs: 1000 })
    start()
    const initial = now.value
    vi.advanceTimersByTime(1000)
    expect(now.value).toBeGreaterThan(initial)
  })

  it('refresh callback is called after refreshMs', () => {
    const refreshCb = vi.fn().mockResolvedValue(undefined)
    const { start } = useClockTimer(refreshCb, { clockMs: 5000, refreshMs: 10000 })
    start()
    expect(refreshCb).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10000)
    expect(refreshCb).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10000)
    expect(refreshCb).toHaveBeenCalledTimes(2)
  })

  it('cleanup stops intervals', () => {
    const refreshCb = vi.fn().mockResolvedValue(undefined)
    const { now, start, cleanup } = useClockTimer(refreshCb, { clockMs: 1000, refreshMs: 2000 })
    start()
    cleanup()
    const afterCleanup = now.value
    vi.advanceTimersByTime(5000)
    expect(now.value).toBe(afterCleanup)
    expect(refreshCb).not.toHaveBeenCalled()
  })

  it('start calls cleanup first (no double intervals)', () => {
    const refreshCb = vi.fn().mockResolvedValue(undefined)
    const { start } = useClockTimer(refreshCb, { clockMs: 1000, refreshMs: 2000 })
    start()
    start() // second start should not double intervals
    vi.advanceTimersByTime(2000)
    expect(refreshCb).toHaveBeenCalledTimes(1)
  })

  it('uses default intervals when no opts provided', () => {
    const refreshCb = vi.fn().mockResolvedValue(undefined)
    const { now, start } = useClockTimer(refreshCb)
    start()
    const initial = now.value
    // Default clockMs is 30_000
    vi.advanceTimersByTime(30000)
    expect(now.value).toBeGreaterThan(initial)
    // Default refreshMs is 60_000
    expect(refreshCb).not.toHaveBeenCalled()
    vi.advanceTimersByTime(30000)
    expect(refreshCb).toHaveBeenCalledTimes(1)
  })
})
