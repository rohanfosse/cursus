// ─── Préférences utilisateur (localStorage) ──────────────────────────────────

const PREFS_KEY = 'cc_prefs'

interface Prefs {
  docsOpenByDefault: boolean
  theme: 'dark' | 'light'
}

const DEFAULTS: Prefs = {
  docsOpenByDefault: false,
  theme: 'dark',
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

function savePrefs(prefs: Prefs): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch {}
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
