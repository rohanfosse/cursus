/**
 * Appearance settings composable — theme selection, font size, display density,
 * message display toggles, and CSS variable management.
 * Used by SettingsModal.vue
 */
import { ref, watch } from 'vue'
import { Monitor, Sun, Moon, Waves, Sparkles } from 'lucide-vue-next'
import { usePrefs } from '@/composables/usePrefs'

export type ThemeId = 'dark' | 'light' | 'night' | 'marine' | 'cursus'

export const THEMES: { id: ThemeId; label: string; icon: typeof Moon; colors: string[]; accent: string }[] = [
  { id: 'dark',   label: 'Sombre',  icon: Monitor,  colors: ['#1a1d21', '#1d2128', '#222529'], accent: '#4A90D9' },
  { id: 'light',  label: 'Cr\u00e8me',   icon: Sun,      colors: ['#f0ebe3', '#f5f0e8', '#faf8f4'], accent: '#c27c2c' },
  { id: 'night',  label: 'Nuit',    icon: Moon,     colors: ['#08090c', '#0b0d11', '#0f1115'], accent: '#7B8CDE' },
  { id: 'marine', label: 'Marine',  icon: Waves,    colors: ['#0e1829', '#132036', '#192840'], accent: '#5B9BD5' },
  { id: 'cursus', label: 'Cursus',  icon: Sparkles, colors: ['#eef2f7', '#f4f6f9', '#f9fafb'], accent: '#3b82f6' },
]

function applyTheme(theme: string) {
  document.body.classList.remove('light', 'night', 'marine', 'cursus')
  if (theme !== 'dark') document.body.classList.add(theme)
}

export function useSettingsAppearance() {
  const { getPref, setPref } = usePrefs()

  const currentTheme   = ref(getPref('theme') ?? 'dark')
  const fontSize       = ref<string>(getPref('fontSize') ?? 'default')
  const density        = ref<string>(getPref('density') ?? 'default')
  const showTimestamps = ref(getPref('showTimestamps') ?? true)
  const compactImages  = ref(getPref('compactImages') ?? false)

  watch(fontSize, (v) => {
    setPref('fontSize', v as 'small' | 'default' | 'large')
    const sizes: Record<string, string> = { small: '13px', default: '14.5px', large: '16px' }
    document.documentElement.style.setProperty('--font-size-base', sizes[v])
  })

  watch(density, (v) => {
    setPref('density', v as 'compact' | 'default' | 'cozy')
    const spacings: Record<string, string> = { compact: '2px', default: '6px', cozy: '10px' }
    document.documentElement.style.setProperty('--msg-spacing', spacings[v])
  })

  watch(showTimestamps, (v) => setPref('showTimestamps', v))
  watch(compactImages,  (v) => setPref('compactImages', v))

  function setTheme(theme: ThemeId) {
    currentTheme.value = theme
    setPref('theme', theme)
    applyTheme(theme)
  }

  /** Re-sync refs from stored prefs (called when modal opens). */
  function resetAppearance() {
    currentTheme.value = getPref('theme') ?? 'dark'
  }

  return {
    currentTheme,
    fontSize,
    density,
    showTimestamps,
    compactImages,
    THEMES,
    setTheme,
    resetAppearance,
  }
}
