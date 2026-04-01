/**
 * Tests pour useToast — systeme de toast global (singleton).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useToast, toastState } from '@/composables/useToast'

beforeEach(() => {
  vi.useFakeTimers()
  toastState.visible = false
  toastState.message = ''
  toastState.type = 'error'
  toastState.detail = undefined
  toastState.onUndo = undefined
})

afterEach(() => {
  vi.useRealTimers()
})

describe('showToast', () => {
  it('shows a toast with message and type', () => {
    const { showToast } = useToast()
    showToast('Hello', 'success')
    expect(toastState.visible).toBe(true)
    expect(toastState.message).toBe('Hello')
    expect(toastState.type).toBe('success')
  })

  it('defaults to error type', () => {
    const { showToast } = useToast()
    showToast('Error occurred')
    expect(toastState.type).toBe('error')
  })

  it('auto-dismisses success after 4s', () => {
    const { showToast } = useToast()
    showToast('Done', 'success')
    expect(toastState.visible).toBe(true)
    vi.advanceTimersByTime(4000)
    expect(toastState.visible).toBe(false)
  })

  it('auto-dismisses error after 8s', () => {
    const { showToast } = useToast()
    showToast('Fail', 'error')
    vi.advanceTimersByTime(4000)
    expect(toastState.visible).toBe(true)
    vi.advanceTimersByTime(4000)
    expect(toastState.visible).toBe(false)
  })

  it('auto-dismisses info after 4s', () => {
    const { showToast } = useToast()
    showToast('Info', 'info')
    vi.advanceTimersByTime(4000)
    expect(toastState.visible).toBe(false)
  })

  it('replaces previous toast', () => {
    const { showToast } = useToast()
    showToast('First', 'success')
    showToast('Second', 'error')
    expect(toastState.message).toBe('Second')
    expect(toastState.type).toBe('error')
  })

  it('resets timer on new toast', () => {
    const { showToast } = useToast()
    showToast('First', 'success')
    vi.advanceTimersByTime(3000)
    showToast('Second', 'success')
    vi.advanceTimersByTime(3000)
    expect(toastState.visible).toBe(true) // 3s into second toast, not dismissed
    vi.advanceTimersByTime(1000)
    expect(toastState.visible).toBe(false) // 4s total for second toast
  })

  it('supports detail text', () => {
    const { showToast } = useToast()
    showToast('Title', 'error', 'Detail text here')
    expect(toastState.detail).toBe('Detail text here')
  })

  it('clears onUndo from previous undo toast', () => {
    const { showToast, showUndoToast } = useToast()
    showUndoToast('Undo me')
    expect(toastState.onUndo).toBeDefined()
    showToast('Normal toast', 'success')
    expect(toastState.onUndo).toBeUndefined()
  })
})

describe('dismissToast', () => {
  it('hides the toast immediately', () => {
    const { showToast, dismissToast } = useToast()
    showToast('Visible', 'success')
    expect(toastState.visible).toBe(true)
    dismissToast()
    expect(toastState.visible).toBe(false)
  })

  it('cancels the auto-dismiss timer', () => {
    const { showToast, dismissToast } = useToast()
    showToast('Visible', 'success')
    dismissToast()
    vi.advanceTimersByTime(5000)
    // No error thrown, timer was cleared
    expect(toastState.visible).toBe(false)
  })
})

describe('showUndoToast', () => {
  it('shows an undo toast', () => {
    const { showUndoToast } = useToast()
    showUndoToast('Action undoable')
    expect(toastState.visible).toBe(true)
    expect(toastState.type).toBe('undo')
    expect(toastState.message).toBe('Action undoable')
  })

  it('resolves true when undo is clicked', async () => {
    const { showUndoToast } = useToast()
    const promise = showUndoToast('Undo me')
    toastState.onUndo!()
    expect(await promise).toBe(true)
    expect(toastState.visible).toBe(false)
  })

  it('resolves false after timeout', async () => {
    const { showUndoToast } = useToast()
    const promise = showUndoToast('Undo me', 3000)
    vi.advanceTimersByTime(3000)
    expect(await promise).toBe(false)
    expect(toastState.visible).toBe(false)
  })

  it('ignores undo after timeout', async () => {
    const { showUndoToast } = useToast()
    const promise = showUndoToast('Undo me', 1000)
    vi.advanceTimersByTime(1000)
    const result = await promise
    expect(result).toBe(false)
    // Calling onUndo after settlement does nothing
    toastState.onUndo?.()
    expect(toastState.visible).toBe(false)
  })

  it('uses default 5s duration', () => {
    const { showUndoToast } = useToast()
    showUndoToast('Test')
    vi.advanceTimersByTime(4999)
    expect(toastState.visible).toBe(true)
    vi.advanceTimersByTime(1)
    expect(toastState.visible).toBe(false)
  })
})
