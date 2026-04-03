/**
 * Tests pour useSwipeNav — navigation par swipe sur mobile (sidebar drawer).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

// ── Mock lifecycle hooks ────────────────────────────────────────────────────
let mountedCb: (() => void) | null = null
let unmountCb: (() => void) | null = null

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onMounted: (cb: () => void) => { mountedCb = cb },
    onUnmounted: (cb: () => void) => { unmountCb = cb },
  }
})

import { useSwipeNav } from '@/composables/useSwipeNav'

// ── Helpers ─────────────────────────────────────────────────────────────────

function createTouchEvent(type: string, clientX: number, clientY: number): TouchEvent {
  const touch = { clientX, clientY, identifier: 0, target: document.body } as Touch
  const init: TouchEventInit = {
    bubbles: true,
    cancelable: true,
  }
  if (type === 'touchstart') {
    Object.assign(init, { touches: [touch] })
  } else {
    Object.assign(init, { changedTouches: [touch] })
  }
  return new TouchEvent(type, init)
}

let originalInnerWidth: number

beforeEach(() => {
  originalInnerWidth = window.innerWidth
  Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true })
  mountedCb = null
  unmountCb = null
})

afterEach(() => {
  // Cleanup listeners if unmount was captured
  unmountCb?.()
  Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true, configurable: true })
})

function setup(options: { sidebarOpen?: boolean } = {}) {
  const sidebarOpen = ref(options.sidebarOpen ?? false)
  const toggleSidebar = vi.fn(() => { sidebarOpen.value = !sidebarOpen.value })
  useSwipeNav(sidebarOpen, toggleSidebar)
  // Simulate mount to register listeners
  mountedCb?.()
  return { sidebarOpen, toggleSidebar }
}

describe('useSwipeNav', () => {
  // ── Swipe right to open ─────────────────────────────────────────────────

  it('opens sidebar on swipe right from left edge', () => {
    const { toggleSidebar } = setup({ sidebarOpen: false })
    document.dispatchEvent(createTouchEvent('touchstart', 10, 200))
    document.dispatchEvent(createTouchEvent('touchend', 70, 200))
    expect(toggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('does not open sidebar when swipe starts outside edge zone', () => {
    const { toggleSidebar } = setup({ sidebarOpen: false })
    document.dispatchEvent(createTouchEvent('touchstart', 50, 200))
    document.dispatchEvent(createTouchEvent('touchend', 110, 200))
    expect(toggleSidebar).not.toHaveBeenCalled()
  })

  it('does not open sidebar when swipe distance is below threshold', () => {
    const { toggleSidebar } = setup({ sidebarOpen: false })
    document.dispatchEvent(createTouchEvent('touchstart', 10, 200))
    document.dispatchEvent(createTouchEvent('touchend', 40, 200))
    expect(toggleSidebar).not.toHaveBeenCalled()
  })

  // ── Swipe left to close ───────────────────────────────────────────────────

  it('closes sidebar on swipe left when sidebar is open', () => {
    const { toggleSidebar } = setup({ sidebarOpen: true })
    document.dispatchEvent(createTouchEvent('touchstart', 200, 200))
    document.dispatchEvent(createTouchEvent('touchend', 130, 200))
    expect(toggleSidebar).toHaveBeenCalledTimes(1)
  })

  it('does not close sidebar when swipe left distance is below threshold', () => {
    const { toggleSidebar } = setup({ sidebarOpen: true })
    document.dispatchEvent(createTouchEvent('touchstart', 200, 200))
    document.dispatchEvent(createTouchEvent('touchend', 175, 200))
    expect(toggleSidebar).not.toHaveBeenCalled()
  })

  // ── Vertical swipe ignored ────────────────────────────────────────────────

  it('ignores vertical swipes', () => {
    const { toggleSidebar } = setup({ sidebarOpen: false })
    document.dispatchEvent(createTouchEvent('touchstart', 10, 100))
    document.dispatchEvent(createTouchEvent('touchend', 30, 180))
    expect(toggleSidebar).not.toHaveBeenCalled()
  })

  // ── Desktop ignored ───────────────────────────────────────────────────────

  it('does not react to swipe on desktop width', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true })
    const { toggleSidebar } = setup({ sidebarOpen: false })
    document.dispatchEvent(createTouchEvent('touchstart', 10, 200))
    document.dispatchEvent(createTouchEvent('touchend', 70, 200))
    expect(toggleSidebar).not.toHaveBeenCalled()
  })

  // ── Sidebar already open, swipe right does not re-open ────────────────────

  it('does not toggle sidebar on swipe right when already open', () => {
    const { toggleSidebar } = setup({ sidebarOpen: true })
    document.dispatchEvent(createTouchEvent('touchstart', 10, 200))
    document.dispatchEvent(createTouchEvent('touchend', 70, 200))
    expect(toggleSidebar).not.toHaveBeenCalled()
  })

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  it('removes event listeners on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    setup()
    unmountCb?.()
    const removedTypes = removeSpy.mock.calls.map((c) => c[0])
    expect(removedTypes).toContain('touchstart')
    expect(removedTypes).toContain('touchend')
    removeSpy.mockRestore()
  })
})
