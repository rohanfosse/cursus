/**
 * Tests pour useSettingsPreferences — toggles notifications, input behavior,
 * documents par defaut, notifications granulaires, et mode Ne Pas Deranger.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'

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

import { useSettingsPreferences } from '@/composables/useSettingsPreferences'

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
})

describe('useSettingsPreferences', () => {
  // ── Default values ────────────────────────────────────────────────────────

  it('initializes with correct defaults', () => {
    const s = useSettingsPreferences()
    expect(s.docsDefault.value).toBe(false)
    expect(s.notifSound.value).toBe(true)
    expect(s.notifDesktop.value).toBe(true)
    expect(s.enterToSend.value).toBe(true)
  })

  it('initializes granular notification defaults', () => {
    const s = useSettingsPreferences()
    expect(s.notifMentions.value).toBe(true)
    expect(s.notifDms.value).toBe(true)
    expect(s.notifDevoirs.value).toBe(true)
    expect(s.notifAnnonces.value).toBe(true)
  })

  it('initializes DND defaults', () => {
    const s = useSettingsPreferences()
    expect(s.dndEnabled.value).toBe(false)
    expect(s.dndStart.value).toBe('22:00')
    expect(s.dndEnd.value).toBe('08:00')
  })

  // ── Watchers persist changes ──────────────────────────────────────────────

  it('persists docsDefault change to localStorage', async () => {
    const s = useSettingsPreferences()
    s.docsDefault.value = true
    await nextTick()
    const saved = JSON.parse(store['cc_prefs'])
    expect(saved.docsOpenByDefault).toBe(true)
  })

  it('persists notifSound change', async () => {
    const s = useSettingsPreferences()
    s.notifSound.value = false
    await nextTick()
    const saved = JSON.parse(store['cc_prefs'])
    expect(saved.notifSound).toBe(false)
  })

  it('persists notifDesktop change', async () => {
    const s = useSettingsPreferences()
    s.notifDesktop.value = false
    await nextTick()
    const saved = JSON.parse(store['cc_prefs'])
    expect(saved.notifDesktop).toBe(false)
  })

  it('persists enterToSend change', async () => {
    const s = useSettingsPreferences()
    s.enterToSend.value = false
    await nextTick()
    const saved = JSON.parse(store['cc_prefs'])
    expect(saved.enterToSend).toBe(false)
  })

  it('persists granular notification toggles', async () => {
    const s = useSettingsPreferences()
    s.notifMentions.value = false
    s.notifDms.value = false
    await nextTick()
    const saved = JSON.parse(store['cc_prefs'])
    expect(saved.notifMentions).toBe(false)
    expect(saved.notifDms).toBe(false)
  })

  it('persists DND settings', async () => {
    const s = useSettingsPreferences()
    s.dndEnabled.value = true
    s.dndStart.value = '23:00'
    s.dndEnd.value = '07:00'
    await nextTick()
    const saved = JSON.parse(store['cc_prefs'])
    expect(saved.dndEnabled).toBe(true)
    expect(saved.dndStart).toBe('23:00')
    expect(saved.dndEnd).toBe('07:00')
  })

  // ── Loads stored prefs ────────────────────────────────────────────────────

  it('loads previously stored preferences', () => {
    store['cc_prefs'] = JSON.stringify({
      docsOpenByDefault: true,
      notifSound: false,
      enterToSend: false,
      notifMentions: false,
      dndEnabled: true,
      dndStart: '21:00',
      dndEnd: '09:00',
    })
    const s = useSettingsPreferences()
    expect(s.docsDefault.value).toBe(true)
    expect(s.notifSound.value).toBe(false)
    expect(s.enterToSend.value).toBe(false)
    expect(s.notifMentions.value).toBe(false)
    expect(s.dndEnabled.value).toBe(true)
    expect(s.dndStart.value).toBe('21:00')
    expect(s.dndEnd.value).toBe('09:00')
  })

  // ── isDndActive computed ──────────────────────────────────────────────────

  describe('isDndActive', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns false when dndEnabled is false', () => {
      const s = useSettingsPreferences()
      s.dndEnabled.value = false
      expect(s.isDndActive.value).toBe(false)
    })

    it('returns true when current time is within DND range (crossing midnight)', () => {
      vi.useFakeTimers()
      // Set time to 23:30 (within 22:00 - 08:00)
      vi.setSystemTime(new Date(2026, 3, 2, 23, 30))
      const s = useSettingsPreferences()
      s.dndEnabled.value = true
      s.dndStart.value = '22:00'
      s.dndEnd.value = '08:00'
      expect(s.isDndActive.value).toBe(true)
    })

    it('returns true when current time is after midnight in cross-midnight range', () => {
      vi.useFakeTimers()
      // Set time to 03:00 (within 22:00 - 08:00)
      vi.setSystemTime(new Date(2026, 3, 2, 3, 0))
      const s = useSettingsPreferences()
      s.dndEnabled.value = true
      s.dndStart.value = '22:00'
      s.dndEnd.value = '08:00'
      expect(s.isDndActive.value).toBe(true)
    })

    it('returns false when current time is outside DND range (crossing midnight)', () => {
      vi.useFakeTimers()
      // Set time to 12:00 (outside 22:00 - 08:00)
      vi.setSystemTime(new Date(2026, 3, 2, 12, 0))
      const s = useSettingsPreferences()
      s.dndEnabled.value = true
      s.dndStart.value = '22:00'
      s.dndEnd.value = '08:00'
      expect(s.isDndActive.value).toBe(false)
    })

    it('returns true when within same-day DND range', () => {
      vi.useFakeTimers()
      // Set time to 14:00 (within 13:00 - 17:00)
      vi.setSystemTime(new Date(2026, 3, 2, 14, 0))
      const s = useSettingsPreferences()
      s.dndEnabled.value = true
      s.dndStart.value = '13:00'
      s.dndEnd.value = '17:00'
      expect(s.isDndActive.value).toBe(true)
    })

    it('returns false when outside same-day DND range', () => {
      vi.useFakeTimers()
      // Set time to 18:00 (outside 13:00 - 17:00)
      vi.setSystemTime(new Date(2026, 3, 2, 18, 0))
      const s = useSettingsPreferences()
      s.dndEnabled.value = true
      s.dndStart.value = '13:00'
      s.dndEnd.value = '17:00'
      expect(s.isDndActive.value).toBe(false)
    })

    it('returns false at exactly end time (exclusive)', () => {
      vi.useFakeTimers()
      // Set time to 08:00 exactly (end of 22:00 - 08:00, exclusive)
      vi.setSystemTime(new Date(2026, 3, 2, 8, 0))
      const s = useSettingsPreferences()
      s.dndEnabled.value = true
      s.dndStart.value = '22:00'
      s.dndEnd.value = '08:00'
      expect(s.isDndActive.value).toBe(false)
    })

    it('returns true at exactly start time (inclusive)', () => {
      vi.useFakeTimers()
      // Set time to 22:00 exactly (start of 22:00 - 08:00, inclusive)
      vi.setSystemTime(new Date(2026, 3, 2, 22, 0))
      const s = useSettingsPreferences()
      s.dndEnabled.value = true
      s.dndStart.value = '22:00'
      s.dndEnd.value = '08:00'
      expect(s.isDndActive.value).toBe(true)
    })
  })
})
