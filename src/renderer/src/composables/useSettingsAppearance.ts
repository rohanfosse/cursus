/**
 * Appearance settings composable - theme selection, font size, display density,
 * message display toggles, and CSS variable management.
 * Used by SettingsModal.vue
 */
import { ref, watch } from 'vue'
import { Monitor, Sun, Moon, Waves, Sparkles } from 'lucide-vue-next'
import { usePrefs } from '@/composables/usePrefs'

export type ThemeId = 'auto' | 'dark' | 'light' | 'sepia' | 'night' | 'marine' | 'cursus'

import { Laptop, Coffee } from 'lucide-vue-next'

export const THEMES: { id: ThemeId; label: string; icon: typeof Moon; colors: string[]; accent: string }[] = [
  { id: 'auto',   label: 'Auto',    icon: Laptop,   colors: ['#0F0D1A', '#FAFBFC', '#1A1733'], accent: '#6366F1' },
  { id: 'dark',   label: 'Sombre',  icon: Monitor,  colors: ['#0F0D1A', '#15122B', '#1A1733'], accent: '#818CF8' },
  { id: 'light',  label: 'Clair',   icon: Sun,      colors: ['#F8F9FB', '#FAFBFC', '#FFFFFF'], accent: '#6366F1' },
  { id: 'sepia',  label: 'S\u00e9pia',   icon: Coffee,   colors: ['#f0ebe3', '#f5f0e8', '#faf8f4'], accent: '#c27c2c' },
  { id: 'night',  label: 'Nuit',    icon: Moon,     colors: ['#08090c', '#0b0d11', '#0f1115'], accent: '#818CF8' },
  { id: 'marine', label: 'Marine',  icon: Waves,    colors: ['#0e1829', '#132036', '#192840'], accent: '#5B9BD5' },
]

// 'cursus' n'est plus expose comme choix (alias legacy de 'light').
// On migre la pref a la lecture pour les utilisateurs qui l'avaient.

/** Resolve 'auto' theme to actual theme based on system preference. */
function resolveTheme(theme: ThemeId): string {
  if (theme !== 'auto') return theme
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(theme: ThemeId) {
  const resolved = resolveTheme(theme)
  document.body.classList.add('theme-transitioning')
  document.body.classList.remove('light', 'sepia', 'night', 'marine', 'cursus')
  if (resolved !== 'dark') document.body.classList.add(resolved)
  setTimeout(() => document.body.classList.remove('theme-transitioning'), 350)
}

// Listen for system theme changes (for 'auto' mode)
let _systemThemeListener: ((e: MediaQueryListEvent) => void) | null = null
function setupSystemThemeListener(currentThemeRef: { value: ThemeId }) {
  if (_systemThemeListener) return
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  _systemThemeListener = () => {
    if (currentThemeRef.value === 'auto') applyTheme('auto')
  }
  mq.addEventListener('change', _systemThemeListener)
}

/**
 * Migration one-shot v2.272 (alignement landing).
 *   - 'cursus' (ancien clair indigo) -> 'light'
 *   - 'light'  (ancien creme/sepia)  -> 'sepia'   (le nouveau 'light' est indigo)
 * Pose le flag `themeMigratedLandingV2` pour eviter une re-migration.
 * Retourne le theme apres migration.
 */
function migrateThemePref(
  getPref: ReturnType<typeof usePrefs>['getPref'],
  setPref: ReturnType<typeof usePrefs>['setPref'],
): ThemeId {
  const alreadyMigrated = getPref('themeMigratedLandingV2')
  const stored = (getPref('theme') ?? 'dark') as ThemeId
  if (alreadyMigrated) return stored

  let migrated: ThemeId = stored
  if (stored === 'cursus') migrated = 'light'
  else if (stored === 'light') migrated = 'sepia'

  if (migrated !== stored) setPref('theme', migrated)
  setPref('themeMigratedLandingV2', true)
  return migrated
}

export function useSettingsAppearance() {
  const { getPref, setPref } = usePrefs()

  const initialTheme = migrateThemePref(getPref, setPref)
  const currentTheme   = ref<ThemeId>(initialTheme)
  const fontSize       = ref<string>(getPref('fontSize') ?? 'default')
  const density        = ref<string>(getPref('density') ?? 'default')
  const msgSpacing     = ref<string>(getPref('msgSpacing') ?? 'normal')
  const showTimestamps    = ref(getPref('showTimestamps') ?? true)
  const compactImages     = ref(getPref('compactImages') ?? false)
  const animationsEnabled = ref(getPref('animationsEnabled') ?? true)
  const borderRadius      = ref<string>(getPref('borderRadius') ?? 'default')
  const customAccent      = ref<string>(getPref('customAccent') ?? '')
  const highContrast      = ref(getPref('highContrast') ?? false)

  watch(fontSize, (v) => {
    setPref('fontSize', v as 'small' | 'default' | 'large')
    const sizes: Record<string, string> = { small: '13px', default: '14px', large: '16px' }
    document.documentElement.style.setProperty('--font-size-base', sizes[v])
  })

  watch(density, (v) => {
    setPref('density', v as 'compact' | 'default' | 'cozy')
    const spacings: Record<string, string> = { compact: '4px', default: '8px', cozy: '14px' }
    document.documentElement.style.setProperty('--density-padding', spacings[v])
  })

  watch(msgSpacing, (v) => {
    setPref('msgSpacing', v as 'compact' | 'normal' | 'aere')
    const spacings: Record<string, string> = { compact: '2px', normal: '6px', aere: '12px' }
    document.documentElement.style.setProperty('--msg-spacing', spacings[v])
  })

  watch(showTimestamps, (v) => setPref('showTimestamps', v))
  watch(compactImages,  (v) => setPref('compactImages', v))

  watch(animationsEnabled, (v) => {
    setPref('animationsEnabled', v)
    if (!v) document.documentElement.classList.add('no-animations')
    else document.documentElement.classList.remove('no-animations')
  })

  watch(borderRadius, (v) => {
    setPref('borderRadius', v as 'sharp' | 'default' | 'round')
    const radii: Record<string, string> = { sharp: '4px', default: '12px', round: '20px' }
    document.documentElement.style.setProperty('--radius', radii[v])
    document.documentElement.style.setProperty('--radius-sm', v === 'sharp' ? '2px' : v === 'round' ? '14px' : '8px')
  })

  watch(customAccent, (v) => {
    setPref('customAccent', v)
    if (v) {
      document.documentElement.style.setProperty('--accent', v)
      document.documentElement.style.setProperty('--accent-light', v)
      document.documentElement.style.setProperty('--accent-subtle', v + '1a')
    } else {
      document.documentElement.style.removeProperty('--accent')
      document.documentElement.style.removeProperty('--accent-light')
      document.documentElement.style.removeProperty('--accent-subtle')
    }
  })

  watch(highContrast, (v) => {
    setPref('highContrast', v)
    if (v) document.documentElement.classList.add('high-contrast')
    else document.documentElement.classList.remove('high-contrast')
  })

  function setTheme(theme: ThemeId) {
    currentTheme.value = theme
    setPref('theme', theme)
    applyTheme(theme)
  }

  // Init: apply theme + listen for system changes + apply appearance prefs
  applyTheme(currentTheme.value as ThemeId)
  setupSystemThemeListener(currentTheme as { value: ThemeId })
  // Apply initial border radius
  const initRadii: Record<string, string> = { sharp: '4px', default: '12px', round: '20px' }
  document.documentElement.style.setProperty('--radius', initRadii[borderRadius.value] ?? '12px')
  // Apply initial animations pref
  if (!animationsEnabled.value) document.documentElement.classList.add('no-animations')
  // Apply initial custom accent
  if (customAccent.value) {
    document.documentElement.style.setProperty('--accent', customAccent.value)
    document.documentElement.style.setProperty('--accent-light', customAccent.value)
    document.documentElement.style.setProperty('--accent-subtle', customAccent.value + '1a')
  }
  // Apply initial high contrast
  if (highContrast.value) document.documentElement.classList.add('high-contrast')

  /** Re-sync refs from stored prefs (called when modal opens). */
  function resetAppearance() {
    currentTheme.value = migrateThemePref(getPref, setPref)
  }

  function resetAllAppearance() {
    setTheme('dark')
    fontSize.value = 'default'
    density.value = 'default'
    msgSpacing.value = 'normal'
    showTimestamps.value = true
    compactImages.value = false
    animationsEnabled.value = true
    borderRadius.value = 'default'
    customAccent.value = ''
    highContrast.value = false
  }

  return {
    currentTheme,
    fontSize,
    density,
    msgSpacing,
    showTimestamps,
    compactImages,
    animationsEnabled,
    borderRadius,
    customAccent,
    highContrast,
    THEMES,
    setTheme,
    resetAppearance,
    resetAllAppearance,
  }
}
