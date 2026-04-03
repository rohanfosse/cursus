/**
 * Tests pour usePrefs — lecture/ecriture des preferences utilisateur via localStorage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k] }),
  length: 0,
  key: vi.fn(() => null),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

vi.mock('@/constants', () => ({
  STORAGE_KEYS: {
    SESSION: 'cc_session',
    NAV_STATE: 'cc_nav_state',
    PREFS: 'cc_prefs',
    MUTED_DMS: 'cc_muted_dms',
  },
}))

import { usePrefs } from '@/composables/usePrefs'

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
})

describe('usePrefs', () => {
  // ── getPref ───────────────────────────────────────────────────────────────

  it('returns default value when nothing is stored', () => {
    const { getPref } = usePrefs()
    expect(getPref('theme')).toBe('dark')
    expect(getPref('fontSize')).toBe('default')
    expect(getPref('notifSound')).toBe(true)
    expect(getPref('docsOpenByDefault')).toBe(false)
  })

  it('returns stored value when prefs exist in localStorage', () => {
    store['cc_prefs'] = JSON.stringify({ theme: 'light', fontSize: 'large' })
    const { getPref } = usePrefs()
    expect(getPref('theme')).toBe('light')
    expect(getPref('fontSize')).toBe('large')
  })

  it('returns default for missing keys even when other prefs are stored', () => {
    store['cc_prefs'] = JSON.stringify({ theme: 'marine' })
    const { getPref } = usePrefs()
    expect(getPref('theme')).toBe('marine')
    expect(getPref('fontSize')).toBe('default') // not stored, use default
  })

  it('returns defaults when localStorage contains corrupt JSON', () => {
    store['cc_prefs'] = '{broken!!!'
    const { getPref } = usePrefs()
    expect(getPref('theme')).toBe('dark')
    expect(getPref('notifSound')).toBe(true)
  })

  // ── setPref ───────────────────────────────────────────────────────────────

  it('persists a single pref to localStorage', () => {
    const { setPref, getPref } = usePrefs()
    setPref('theme', 'night')
    expect(getPref('theme')).toBe('night')
    expect(localStorageMock.setItem).toHaveBeenCalled()
  })

  it('preserves other prefs when setting one', () => {
    store['cc_prefs'] = JSON.stringify({ theme: 'marine', fontSize: 'large' })
    const { setPref, getPref } = usePrefs()
    setPref('density', 'compact')
    expect(getPref('theme')).toBe('marine')
    expect(getPref('fontSize')).toBe('large')
    expect(getPref('density')).toBe('compact')
  })

  it('overwrites an existing pref value', () => {
    store['cc_prefs'] = JSON.stringify({ theme: 'light' })
    const { setPref, getPref } = usePrefs()
    setPref('theme', 'cursus')
    expect(getPref('theme')).toBe('cursus')
  })

  // ── Boolean prefs ─────────────────────────────────────────────────────────

  it('handles boolean prefs correctly', () => {
    const { setPref, getPref } = usePrefs()
    setPref('notifSound', false)
    expect(getPref('notifSound')).toBe(false)
    setPref('notifSound', true)
    expect(getPref('notifSound')).toBe(true)
  })

  // ── DND prefs ─────────────────────────────────────────────────────────────

  it('reads and writes DND preferences', () => {
    const { setPref, getPref } = usePrefs()
    setPref('dndEnabled', true)
    setPref('dndStart', '23:00')
    setPref('dndEnd', '07:00')
    expect(getPref('dndEnabled')).toBe(true)
    expect(getPref('dndStart')).toBe('23:00')
    expect(getPref('dndEnd')).toBe('07:00')
  })

  // ── Default values coverage ───────────────────────────────────────────────

  it('has correct defaults for all notification prefs', () => {
    const { getPref } = usePrefs()
    expect(getPref('notifMentions')).toBe(true)
    expect(getPref('notifDms')).toBe(true)
    expect(getPref('notifDevoirs')).toBe(true)
    expect(getPref('notifAnnonces')).toBe(true)
  })

  it('has correct defaults for appearance prefs', () => {
    const { getPref } = usePrefs()
    expect(getPref('animationsEnabled')).toBe(true)
    expect(getPref('borderRadius')).toBe('default')
    expect(getPref('msgSpacing')).toBe('normal')
    expect(getPref('compactImages')).toBe(false)
    expect(getPref('showTimestamps')).toBe(true)
  })
})
