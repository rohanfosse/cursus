/**
 * Helpers couleur pour la personnalisation de l'accent (v2.286).
 *
 * Les tokens d'accent du theme sont composes :
 *   --accent       (hex)
 *   --accent-rgb   ("R,G,B" string, utilise dans rgba(var(--accent-rgb), .X))
 *   --accent-hover (variante claire pour hover)
 *   --accent-dark  (variante foncee pour active / contraste)
 *
 * Quand l'utilisateur choisit une couleur custom, on doit recalculer ces
 * 4 valeurs a partir d'un seul hex pour eviter les hovers/borders qui
 * resteraient sur l'ancien indigo (bug v2.285 corrige en v2.286).
 */

export interface AccentTokens {
  /** Hex normalise #RRGGBB */
  hex: string
  /** "R,G,B" pour usage en rgba(var(--accent-rgb), alpha) */
  rgb: string
  /** Variante eclaircie (~12 % en luminance), pour les hovers */
  hover: string
  /** Variante assombrie (~12 % en luminance), pour les actives / focus rings */
  dark: string
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/**
 * Parse un hex (#abc, #aabbcc, abc, aabbcc) en triplet RGB. Retourne null
 * si invalide. Tolere absence de #, casse libre.
 */
export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null
  const m = hex.trim().match(HEX_RE)
  if (!m) return null
  let h = m[1]
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function clamp(n: number, lo = 0, hi = 255): number {
  return Math.max(lo, Math.min(hi, n))
}

function toHex2(n: number): string {
  return clamp(Math.round(n)).toString(16).padStart(2, '0')
}

/**
 * Eclaircit ou assombrit une couleur d'un pourcentage (0..1) via simple
 * shift en luminance RGB. Pas aussi rigoureux qu'une conversion HSL mais
 * largement suffisant pour generer un hover/active visuellement coherent.
 *
 * shift > 0 -> eclaircit (vers blanc)
 * shift < 0 -> assombrit (vers noir)
 */
export function shiftHex(hex: string, shift: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const factor = shift > 0 ? shift : -shift
  const target = shift > 0 ? 255 : 0
  const blend = (c: number) => c + (target - c) * factor
  return `#${toHex2(blend(rgb.r))}${toHex2(blend(rgb.g))}${toHex2(blend(rgb.b))}`
}

/**
 * Construit l'ensemble complet des tokens d'accent a partir d'un hex
 * fourni par l'utilisateur. Retourne null si le hex est invalide (l'UI
 * doit alors retomber sur les valeurs du theme).
 */
export function buildAccentTokens(hex: string): AccentTokens | null {
  const rgb = parseHex(hex)
  if (!rgb) return null
  const normalizedHex = `#${toHex2(rgb.r)}${toHex2(rgb.g)}${toHex2(rgb.b)}`
  return {
    hex: normalizedHex,
    rgb: `${rgb.r},${rgb.g},${rgb.b}`,
    hover: shiftHex(normalizedHex, 0.12),
    dark: shiftHex(normalizedHex, -0.18),
  }
}
