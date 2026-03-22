/**
 * Appearance settings composable - theme selection, font size, display density,
 * message display toggles, and CSS variable management.
 * Used by SettingsModal.vue
 */
import { ref, watch } from 'vue'
import { Monitor, Sun, Moon, Waves, Sparkles } from 'lucide-vue-next'
import { usePrefs } from '@/composables/usePrefs'

import { Laptop } from 'lucide-vue-next'

export type ThemeId = 'auto' | 'dark' | 'light' | 'night' | 'marine' | 'cursus'

export const THEMES: { id: ThemeId; label: string; icon: typeof Moon; colors: string[]; accent: string }[] = [
  { id: 'auto',   label: 'Syst\u00e8me', icon: Laptop,   colors: ['#1b1e30', '#e3e8f0', '#1b1e30'], accent: '#4A90D9' },
  { id: 'dark',   label: 'Sombre',  icon: Monitor,  colors: ['#141622', '#1b1e30', '#212639'], accent: '#4dd0e1' },
  { id: 'light',  label: 'Cr\u00e8me',   icon: Sun,      colors: ['#e4ddd2', '#ede7dc', '#f8f5f0'], accent: '#b06820' },
  { id: 'night',  label: 'Nuit',    icon: Moon,     colors: ['#050710', '#08091a', '#0a0c18'], accent: '#7B8CDE' },
  { id: 'marine', label: 'Marine',  icon: Waves,    colors: ['#0a1420', '#0f1d35', '#152540'], accent: '#64B5F6' },
  { id: 'cursus', label: 'Cursus',  icon: Sparkles, colors: ['#e3e8f0', '#edf1f7', '#f7f8fb'], accent: '#3b82f6' },
]

function resolveTheme(theme: string): string {
  if (theme === 'auto' || !theme) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'cursus'
  }
  return theme
}

function applyTheme(theme: string) {
  const resolved = resolveTheme(theme)
  document.body.classList.remove('light', 'night', 'marine', 'cursus')
  if (resolved !== 'dark') document.body.classList.add(resolved)
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
