/**
 * Tests pour useRealtimeClock — horloge reactive mise a jour a intervalle regulier.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock lifecycle hooks ────────────────────────────────────────────────────
let mountedCb: (() => void) | null = null
let unmountCb: (() => void) | null = null

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onMounted: (cb: () => void) => { mountedCb = cb },
    onBeforeUnmount: (cb: () => void) => { unmountCb = cb },
  }
})

import { useRealtimeClock } from '@/composables/useRealtimeClock'

beforeEach(() => {
  vi.useFakeTimers()
  mountedCb = null
  unmountCb = null
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useRealtimeClock', () => {
  it('returns a ref with the current timestamp', () => {
    const before = Date.now()
    const { now } = useRealtimeClock()
    expect(now.value).toBeGreaterThanOrEqual(before)
  })

  it('updates now every intervalMs after mount (default 30s)', () => {
    const { now } = useRealtimeClock()
    const initial = now.value

    // Simulate mount
    mountedCb?.()

    vi.advanceTimersByTime(30_000)
    expect(now.value).toBeGreaterThan(initial)
  })

  it('updates now with custom interval', () => {
    const { now } = useRealtimeClock(5_000)
    const initial = now.value

    mountedCb?.()

    vi.advanceTimersByTime(5_000)
    expect(now.value).toBeGreaterThan(initial)
  })

  it('does not update before interval elapses', () => {
    const { now } = useRealtimeClock(10_000)
    const initial = now.value

    mountedCb?.()

    vi.advanceTimersByTime(9_999)
    expect(now.value).toBe(initial)
  })

  it('updates multiple times across multiple intervals', () => {
    const { now } = useRealtimeClock(1_000)
    mountedCb?.()

    const values: number[] = [now.value]
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(1_000)
      values.push(now.value)
    }

    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1])
    }
  })

  it('clears interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    useRealtimeClock(1_000)
    mountedCb?.()

    unmountCb?.()
    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })

  it('does not update after unmount', () => {
    const { now } = useRealtimeClock(1_000)
    mountedCb?.()

    vi.advanceTimersByTime(1_000)
    const valueBeforeUnmount = now.value

    unmountCb?.()
    vi.advanceTimersByTime(5_000)
    expect(now.value).toBe(valueBeforeUnmount)
  })

  it('does not update before mount', () => {
    const { now } = useRealtimeClock(1_000)
    const initial = now.value

    vi.advanceTimersByTime(5_000)
    // No mount was called, so no interval was started
    expect(now.value).toBe(initial)
  })
})
