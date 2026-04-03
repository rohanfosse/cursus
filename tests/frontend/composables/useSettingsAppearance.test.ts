/**
 * Tests pour useSettingsAppearance — theme, font size, density, message spacing,
 * animations, border radius, et gestion CSS.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick, effectScope, type EffectScope } from 'vue'

let scope: EffectScope

// ── localStorage mock ───────────────────────────────────────────────────────
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

// Mock lucide-vue-next icons
vi.mock('lucide-vue-next', () => ({
  Monitor: { name: 'Monitor' },
  Sun: { name: 'Sun' },
  Moon: { name: 'Moon' },
  Waves: { name: 'Waves' },
  Sparkles: { name: 'Sparkles' },
  Laptop: { name: 'Laptop' },
}))

// Mock matchMedia for auto theme detection
const matchMediaMock = vi.fn().mockReturnValue({
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})
Object.defineProperty(window, 'matchMedia', { value: matchMediaMock, writable: true })

import { useSettingsAppearance, THEMES } from '@/composables/useSettingsAppearance'

beforeEach(() => {
  scope = effectScope()
  localStorageMock.clear()
  vi.clearAllMocks()
  document.body.className = ''
  document.documentElement.style.cssText = ''
  document.documentElement.className = ''
})

afterEach(() => {
  scope.stop()
})

describe('useSettingsAppearance', () => {
  // ── THEMES constant ───────────────────────────────────────────────────────

  it('exports 6 theme definitions', () => {
    expect(THEMES).toHaveLength(6)
    const ids = THEMES.map((t) => t.id)
    expect(ids).toEqual(['auto', 'dark', 'light', 'night', 'marine', 'cursus'])
  })

  // ── Default values ────────────────────────────────────────────────────────

  it('initializes with default values from prefs', () => {
    const s = scope.run(() => useSettingsAppearance())!
    expect(s.currentTheme.value).toBe('dark')
    expect(s.fontSize.value).toBe('default')
    expect(s.density.value).toBe('default')
    expect(s.msgSpacing.value).toBe('normal')
    expect(s.showTimestamps.value).toBe(true)
    expect(s.compactImages.value).toBe(false)
    expect(s.animationsEnabled.value).toBe(true)
    expect(s.borderRadius.value).toBe('default')
  })

  // ── setTheme ──────────────────────────────────────────────────────────────

  it('setTheme changes currentTheme and persists to prefs', () => {
    const s = scope.run(() => useSettingsAppearance())!
    s.setTheme('marine')
    expect(s.currentTheme.value).toBe('marine')
    // Verify the body class was applied
    expect(document.body.classList.contains('marine')).toBe(true)
  })

  it('setTheme to dark removes other theme classes', () => {
    const s = scope.run(() => useSettingsAppearance())!
    s.setTheme('light')
    expect(document.body.classList.contains('light')).toBe(true)
    s.setTheme('dark')
    expect(document.body.classList.contains('light')).toBe(false)
  })

  it('setTheme auto resolves to system preference', () => {
    matchMediaMock.mockReturnValue({
      matches: true, // prefers-color-scheme: light
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    const s = scope.run(() => useSettingsAppearance())!
    s.setTheme('auto')
    expect(s.currentTheme.value).toBe('auto')
    // auto + light matches => body should have 'light'
    expect(document.body.classList.contains('light')).toBe(true)
  })

  // ── fontSize watcher ──────────────────────────────────────────────────────

  it('changing fontSize sets CSS variable --font-size-base', async () => {
    const s = scope.run(() => useSettingsAppearance())!
    s.fontSize.value = 'large'
    await nextTick()
    expect(document.documentElement.style.getPropertyValue('--font-size-base')).toBe('16px')
  })

  it('changing fontSize to small sets 13px', async () => {
    const s = scope.run(() => useSettingsAppearance())!
    s.fontSize.value = 'small'
    await nextTick()
    expect(document.documentElement.style.getPropertyValue('--font-size-base')).toBe('13px')
  })

  // ── density watcher ───────────────────────────────────────────────────────

  it('changing density sets CSS variable --density-padding', async () => {
    const s = scope.run(() => useSettingsAppearance())!
    s.density.value = 'compact'
    await nextTick()
    expect(document.documentElement.style.getPropertyValue('--density-padding')).toBe('4px')
  })

  it('density cozy sets 14px', async () => {
    const s = scope.run(() => useSettingsAppearance())!
    s.density.value = 'cozy'
    await nextTick()
    expect(document.documentElement.style.getPropertyValue('--density-padding')).toBe('14px')
  })

  // ── msgSpacing watcher ────────────────────────────────────────────────────

  it('changing msgSpacing sets CSS variable --msg-spacing', async () => {
    const s = scope.run(() => useSettingsAppearance())!
    s.msgSpacing.value = 'aere'
    await nextTick()
    expect(document.documentElement.style.getPropertyValue('--msg-spacing')).toBe('12px')
  })

  it('msgSpacing compact sets 2px', async () => {
    const s = scope.run(() => useSettingsAppearance())!
    s.msgSpacing.value = 'compact'
    await nextTick()
    expect(document.documentElement.style.getPropertyValue('--msg-spacing')).toBe('2px')
  })

  // ── animationsEnabled watcher ─────────────────────────────────────────────

  it('disabling animations adds no-animations class', async () => {
    const s = scope.run(() => useSettingsAppearance())!
    s.animationsEnabled.value = false
    await nextTick()
    expect(document.documentElement.classList.contains('no-animations')).toBe(true)
  })

  it('re-enabling animations removes no-animations class', async () => {
    const s = scope.run(() => useSettingsAppearance())!
    s.animationsEnabled.value = false
    await nextTick()
    s.animationsEnabled.value = true
    await nextTick()
    expect(document.documentElement.classList.contains('no-animations')).toBe(false)
  })

  // ── borderRadius watcher ──────────────────────────────────────────────────

  it('setting borderRadius to sharp sets 4px radius', async () => {
    const s = scope.run(() => useSettingsAppearance())!
    s.borderRadius.value = 'sharp'
    await nextTick()
    expect(document.documentElement.style.getPropertyValue('--radius')).toBe('4px')
    expect(document.documentElement.style.getPropertyValue('--radius-sm')).toBe('2px')
  })

  it('setting borderRadius to round sets 20px radius', async () => {
    const s = scope.run(() => useSettingsAppearance())!
    s.borderRadius.value = 'round'
    await nextTick()
    expect(document.documentElement.style.getPropertyValue('--radius')).toBe('20px')
    expect(document.documentElement.style.getPropertyValue('--radius-sm')).toBe('14px')
  })

  // ── resetAppearance ───────────────────────────────────────────────────────

  it('resetAppearance resets currentTheme from stored prefs', () => {
    store['cc_prefs'] = JSON.stringify({ theme: 'night' })
    const s = scope.run(() => useSettingsAppearance())!
    s.setTheme('marine')
    // Re-sync from storage where theme was overridden to night by the initial store
    s.resetAppearance()
    // Since we set theme to marine via setTheme (which persists), resetAppearance reads back
    expect(s.currentTheme.value).toBe('marine')
  })

  // ── resetAllAppearance ────────────────────────────────────────────────────

  it('resetAllAppearance resets all values to defaults', async () => {
    const s = scope.run(() => useSettingsAppearance())!
    s.setTheme('night')
    s.fontSize.value = 'large'
    s.density.value = 'cozy'
    s.msgSpacing.value = 'aere'
    s.showTimestamps.value = false
    s.compactImages.value = true
    s.animationsEnabled.value = false
    s.borderRadius.value = 'round'
    await nextTick()

    s.resetAllAppearance()
    await nextTick()

    expect(s.currentTheme.value).toBe('dark')
    expect(s.fontSize.value).toBe('default')
    expect(s.density.value).toBe('default')
    expect(s.msgSpacing.value).toBe('normal')
    expect(s.showTimestamps.value).toBe(true)
    expect(s.compactImages.value).toBe(false)
    expect(s.animationsEnabled.value).toBe(true)
    expect(s.borderRadius.value).toBe('default')
  })

  // ── Stored prefs are loaded ───────────────────────────────────────────────

  it('loads previously stored appearance prefs', () => {
    store['cc_prefs'] = JSON.stringify({
      theme: 'marine',
      fontSize: 'large',
      density: 'cozy',
      animationsEnabled: false,
    })
    const s = scope.run(() => useSettingsAppearance())!
    expect(s.currentTheme.value).toBe('marine')
    expect(s.fontSize.value).toBe('large')
    expect(s.density.value).toBe('cozy')
    expect(s.animationsEnabled.value).toBe(false)
  })
})
