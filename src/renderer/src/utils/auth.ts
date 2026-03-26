// ─── Authentification des URLs de fichiers uploadés ─────────────────────────
import { STORAGE_KEYS } from '@/constants'

/** Extrait le JWT token depuis la session stockée en localStorage. */
export function getAuthToken(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION)
    if (raw) return JSON.parse(raw)?.token ?? ''
  } catch { /* session corrompue */ }
  return ''
}

/**
 * Ajoute le token JWT en query param aux URLs `/uploads/` pour l'auth.
 * Les autres URLs passent telles quelles.
 */
export function authUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (!url.includes('/uploads/')) return url
  const token = getAuthToken()
  if (!token) return url
  // Séparer le hash (#size=xxx) du reste de l'URL
  const hashIdx = url.indexOf('#')
  const base = hashIdx >= 0 ? url.slice(0, hashIdx) : url
  const hash = hashIdx >= 0 ? url.slice(hashIdx) : ''
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}token=${encodeURIComponent(token)}${hash}`
}
