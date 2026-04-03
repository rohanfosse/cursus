/**
 * Tests pour useTeacherBento — visibilite des tuiles du bento professeur.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

import { useTeacherBento, TEACHER_TILES } from '@/composables/useTeacherBento'

describe('useTeacherBento', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockReturnValue(null)
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()

    // Reset to defaults via resetTiles
    const { resetTiles } = useTeacherBento()
    resetTiles()
  })

  // ── TEACHER_TILES ─────────────────────────────────────────────────────────
  it('exports TEACHER_TILES with at least 10 tiles', () => {
    expect(TEACHER_TILES.length).toBeGreaterThanOrEqual(10)
  })

  it('each tile has required fields', () => {
    for (const tile of TEACHER_TILES) {
      expect(tile.id).toBeDefined()
      expect(tile.label).toBeDefined()
      expect(tile.description).toBeDefined()
      expect(tile.category).toBeDefined()
      expect(tile.sizes.length).toBeGreaterThanOrEqual(1)
      expect(tile.defaultSize).toBeDefined()
      expect(typeof tile.defaultEnabled).toBe('boolean')
    }
  })

  // ── isVisible ─────────────────────────────────────────────────────────────
  it('defaultEnabled tiles are visible by default', () => {
    const { isVisible } = useTeacherBento()
    const enabledTiles = TEACHER_TILES.filter(t => t.defaultEnabled)
    for (const tile of enabledTiles) {
      expect(isVisible(tile.id)).toBe(true)
    }
  })

  it('non-defaultEnabled tiles are hidden by default', () => {
    const { isVisible } = useTeacherBento()
    const disabledTiles = TEACHER_TILES.filter(t => !t.defaultEnabled)
    for (const tile of disabledTiles) {
      expect(isVisible(tile.id)).toBe(false)
    }
  })

  // ── toggleTile ────────────────────────────────────────────────────────────
  it('toggleTile hides a visible tile', () => {
    const { isVisible, toggleTile } = useTeacherBento()
    expect(isVisible('focus')).toBe(true)
    toggleTile('focus')
    expect(isVisible('focus')).toBe(false)
  })

  it('toggleTile shows a hidden tile', () => {
    const { isVisible, toggleTile } = useTeacherBento()
    expect(isVisible('clock')).toBe(false)
    toggleTile('clock')
    expect(isVisible('clock')).toBe(true)
  })

  it('toggleTile persists to localStorage', () => {
    const { toggleTile } = useTeacherBento()
    toggleTile('focus')
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'teacher_bento_hidden',
      expect.any(String),
    )
  })

  // ── resetTiles ────────────────────────────────────────────────────────────
  it('resetTiles restores defaults', () => {
    const { toggleTile, isVisible, resetTiles } = useTeacherBento()
    toggleTile('focus') // hide it
    expect(isVisible('focus')).toBe(false)
    resetTiles()
    expect(isVisible('focus')).toBe(true)
  })

  it('resetTiles removes localStorage keys', () => {
    const { resetTiles } = useTeacherBento()
    resetTiles()
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('teacher_bento_hidden')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('teacher_bento_opt_order')
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('teacher_bento_sizes')
  })

  // ── getWidgetSize / setWidgetSize ─────────────────────────────────────────
  it('getWidgetSize returns defaultSize when no override', () => {
    const { getWidgetSize } = useTeacherBento()
    const focusTile = TEACHER_TILES.find(t => t.id === 'focus')!
    expect(getWidgetSize('focus')).toBe(focusTile.defaultSize)
  })

  it('setWidgetSize overrides the size', () => {
    const { getWidgetSize, setWidgetSize } = useTeacherBento()
    setWidgetSize('focus', '1x1')
    expect(getWidgetSize('focus')).toBe('1x1')
  })

  it('setWidgetSize persists to localStorage', () => {
    const { setWidgetSize } = useTeacherBento()
    setWidgetSize('focus', '2x1')
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'teacher_bento_sizes',
      expect.any(String),
    )
  })

  it('getWidgetSize returns 1x1 for unknown tile', () => {
    const { getWidgetSize } = useTeacherBento()
    expect(getWidgetSize('nonexistent')).toBe('1x1')
  })

  // ── reorderOptional ───────────────────────────────────────────────────────
  it('reorderOptional changes optional tile order', () => {
    const { reorderOptional, visibleOptionalTiles, toggleTile } = useTeacherBento()
    // Make two optional tiles visible
    toggleTile('clock')
    toggleTile('quote')

    const clockTile = TEACHER_TILES.find(t => t.id === 'clock')!
    const quoteTile = TEACHER_TILES.find(t => t.id === 'quote')!

    reorderOptional([quoteTile, clockTile])
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'teacher_bento_opt_order',
      expect.any(String),
    )
  })

  // ── allTiles ──────────────────────────────────────────────────────────────
  it('allTiles returns the full list', () => {
    const { allTiles } = useTeacherBento()
    expect(allTiles).toBe(TEACHER_TILES)
  })
})
