// ─── Préférences utilisateur (localStorage) ──────────────────────────────────
import { STORAGE_KEYS } from '@/constants'

interface Prefs {
  docsOpenByDefault: boolean
  theme: 'dark' | 'light' | 'night' | 'marine' | 'cursus'
  fontSize: 'small' | 'default' | 'large'
  density: 'compact' | 'default' | 'cozy'
  notifSound: boolean
  notifDesktop: boolean
  enterToSend: boolean
  showTimestamps: boolean
  compactImages: boolean
}

const DEFAULTS: Prefs = {
  docsOpenByDefault: false,
  theme: 'dark',
  fontSize: 'default',
  density: 'default',
  notifSound: true,
  notifDesktop: true,
  enterToSend: true,
  showTimestamps: true,
  compactImages: false,
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PREFS)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

function savePrefs(prefs: Prefs): void {
  try { localStorage.setItem(STORAGE_KEYS.PREFS, JSON.stringify(prefs)) } catch {}
}

export function usePrefs() {
  function getPref<K extends keyof Prefs>(key: K): Prefs[K] {
    return loadPrefs()[key]
  }

  function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
    const prefs = loadPrefs()
    prefs[key]  = value
    savePrefs(prefs)
  }

  return { getPref, setPref }
}
