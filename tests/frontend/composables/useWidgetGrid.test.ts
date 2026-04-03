/**
 * Tests pour useWidgetGrid — grille responsive pour le systeme de widgets.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// ── Mock lifecycle hooks ─────────────────────────────────────────────────────
const mountedCallbacks: (() => void)[] = []
const unmountCallbacks: (() => void)[] = []
vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onMounted: (cb: () => void) => { mountedCallbacks.push(cb) },
    onBeforeUnmount: (cb: () => void) => { unmountCallbacks.push(cb) },
  }
})

// Mock ResizeObserver
const observeFn = vi.fn()
const disconnectFn = vi.fn()
class MockResizeObserver {
  callback: (entries: { contentRect: { width: number } }[]) => void
  constructor(cb: (entries: { contentRect: { width: number } }[]) => void) {
    this.callback = cb
  }
  observe = observeFn
  disconnect = disconnectFn
  unobserve = vi.fn()
}
Object.defineProperty(globalThis, 'ResizeObserver', { value: MockResizeObserver, writable: true })

import { useWidgetGrid } from '@/composables/useWidgetGrid'

describe('useWidgetGrid', () => {
  beforeEach(() => {
    mountedCallbacks.length = 0
    unmountCallbacks.length = 0
    observeFn.mockClear()
    disconnectFn.mockClear()
  })

  // ── columns default ───────────────────────────────────────────────────────
  it('defaults to 4 columns', () => {
    const containerRef = ref(null)
    const { columns } = useWidgetGrid(containerRef)
    expect(columns.value).toBe(4)
  })

  // ── clampSize ─────────────────────────────────────────────────────────────
  it('clampSize returns size unchanged when it fits in 4 columns', () => {
    const containerRef = ref(null)
    const { clampSize } = useWidgetGrid(containerRef)
    expect(clampSize('4x1')).toBe('4x1')
    expect(clampSize('2x2')).toBe('2x2')
    expect(clampSize('2x1')).toBe('2x1')
    expect(clampSize('1x1')).toBe('1x1')
  })

  it('clampSize reduces 4x1 to 2x1 when 2 columns', () => {
    const el = { offsetWidth: 800 } as HTMLElement
    const containerRef = ref(el)
    const { columns, clampSize } = useWidgetGrid(containerRef)

    // Simulate 2 columns
    columns.value = 2
    expect(clampSize('4x1')).toBe('2x1')
  })

  it('clampSize keeps 2x1 when 2 columns', () => {
    const containerRef = ref(null)
    const { columns, clampSize } = useWidgetGrid(containerRef)
    columns.value = 2
    expect(clampSize('2x1')).toBe('2x1')
  })

  it('clampSize reduces everything to 1x1 when 1 column', () => {
    const containerRef = ref(null)
    const { columns, clampSize } = useWidgetGrid(containerRef)
    columns.value = 1
    expect(clampSize('4x1')).toBe('1x1')
    expect(clampSize('2x2')).toBe('1x1')
    expect(clampSize('2x1')).toBe('1x1')
    expect(clampSize('1x1')).toBe('1x1')
  })

  // ── gridClass ─────────────────────────────────────────────────────────────
  it('gridClass returns 4col class for 4 columns', () => {
    const containerRef = ref(null)
    const { gridClass } = useWidgetGrid(containerRef)
    expect(gridClass.value).toBe('wg-grid--4col')
  })

  it('gridClass returns 2col class for 2 columns', () => {
    const containerRef = ref(null)
    const { columns, gridClass } = useWidgetGrid(containerRef)
    columns.value = 2
    expect(gridClass.value).toBe('wg-grid--2col')
  })

  it('gridClass returns 1col class for 1 column', () => {
    const containerRef = ref(null)
    const { columns, gridClass } = useWidgetGrid(containerRef)
    columns.value = 1
    expect(gridClass.value).toBe('wg-grid--1col')
  })

  // ── gridStyle ─────────────────────────────────────────────────────────────
  it('gridStyle has correct grid template for 4 columns', () => {
    const containerRef = ref(null)
    const { gridStyle } = useWidgetGrid(containerRef)
    expect(gridStyle.value.display).toBe('grid')
    expect(gridStyle.value.gridTemplateColumns).toBe('repeat(4, 1fr)')
    expect(gridStyle.value.gap).toBe('12px')
  })

  it('gridStyle updates when columns change', () => {
    const containerRef = ref(null)
    const { columns, gridStyle } = useWidgetGrid(containerRef)
    columns.value = 2
    expect(gridStyle.value.gridTemplateColumns).toBe('repeat(2, 1fr)')
  })

  // ── onMounted with container ──────────────────────────────────────────────
  it('observes container on mount when element exists', () => {
    const el = { offsetWidth: 1200 } as HTMLElement
    const containerRef = ref(el)
    useWidgetGrid(containerRef)

    for (const cb of mountedCallbacks) cb()
    expect(observeFn).toHaveBeenCalledWith(el)
  })

  it('does not observe when container is null', () => {
    const containerRef = ref(null)
    useWidgetGrid(containerRef)

    for (const cb of mountedCallbacks) cb()
    expect(observeFn).not.toHaveBeenCalled()
  })

  // ── Breakpoints ───────────────────────────────────────────────────────────
  it('sets 4 columns for width >= 1024', () => {
    const el = { offsetWidth: 1024 } as HTMLElement
    const containerRef = ref(el)
    const { columns } = useWidgetGrid(containerRef)

    for (const cb of mountedCallbacks) cb()
    expect(columns.value).toBe(4)
  })

  it('sets 2 columns for width >= 600 and < 1024', () => {
    const el = { offsetWidth: 700 } as HTMLElement
    const containerRef = ref(el)
    const { columns } = useWidgetGrid(containerRef)

    for (const cb of mountedCallbacks) cb()
    expect(columns.value).toBe(2)
  })

  it('sets 1 column for width < 600', () => {
    const el = { offsetWidth: 500 } as HTMLElement
    const containerRef = ref(el)
    const { columns } = useWidgetGrid(containerRef)

    for (const cb of mountedCallbacks) cb()
    expect(columns.value).toBe(1)
  })
})
