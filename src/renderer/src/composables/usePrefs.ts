// ─── Préférences utilisateur (localStorage) ──────────────────────────────────
import { STORAGE_KEYS } from '@/constants'

interface Prefs {
  docsOpenByDefault: boolean
  theme: 'auto' | 'dark' | 'light' | 'night' | 'marine' | 'cursus'
  fontSize: 'small' | 'default' | 'large'
  density: 'compact' | 'default' | 'cozy'
  msgSpacing: 'compact' | 'normal' | 'aere'
  notifSound: boolean
  notifDesktop: boolean
  enterToSend: boolean
  showTimestamps: boolean
  compactImages: boolean
  rememberMe: boolean
  // Notifications granulaires
  notifMentions: boolean
  notifDms: boolean
  notifDevoirs: boolean
  notifAnnonces: boolean
  // Mode Ne Pas Deranger
  dndEnabled: boolean
  dndStart: string  // "HH:MM" format
  dndEnd: string    // "HH:MM" format
  // Apparence avancee
  animationsEnabled: boolean
  borderRadius: 'sharp' | 'default' | 'round'
}

const DEFAULTS: Prefs = {
  docsOpenByDefault: false,
  theme: 'dark',
  fontSize: 'default',
  density: 'default',
  msgSpacing: 'normal',
  notifSound: true,
  notifDesktop: true,
  enterToSend: true,
  showTimestamps: true,
  compactImages: false,
  rememberMe: false,
  // Toutes les notifs activees par defaut
  notifMentions: true,
  notifDms: true,
  notifDevoirs: true,
  notifAnnonces: true,
  // DND desactive par defaut
  dndEnabled: false,
  dndStart: '22:00',
  dndEnd: '08:00',
  animationsEnabled: true,
  borderRadius: 'default',
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
