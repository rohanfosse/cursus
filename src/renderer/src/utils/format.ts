// ─── Couleurs d'avatars ──────────────────────────────────────────────────────

const PALETTE = [
  '#e53935', '#8e24aa', '#1e88e5', '#00897b',
  '#43a047', '#fb8c00', '#6d4c41', '#546e7a',
]

export function avatarColor(str: string): string {
  let hash = 0
  for (const c of str) hash = (hash << 5) - hash + c.charCodeAt(0)
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export function formatGrade(note: string | number | null): string {
  if (note == null) return ''
  if (
    typeof note === 'number' ||
    (typeof note === 'string' && !isNaN(parseFloat(note)) && !['A', 'B', 'C', 'D'].includes(note))
  ) {
    return `${note}/20`
  }
  return String(note)
}

export function gradeClass(note: string | number | null): string {
  if (note == null) return 'grade-empty'
  const s = String(note).toUpperCase()
  if (s === 'A')  return 'grade-a'
  if (s === 'B')  return 'grade-b'
  if (s === 'C')  return 'grade-c'
  if (s === 'D')  return 'grade-d'
  if (s === 'NA') return 'grade-na'
  const n = parseFloat(s)
  if (isNaN(n)) return 'grade-empty'
  return n >= 14 ? 'grade-a' : n >= 10 ? 'grade-b' : n >= 8 ? 'grade-c' : 'grade-d'
}

// ─── Initiales ────────────────────────────────────────────────────────────────

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ─── Tailles fichiers ─────────────────────────────────────────────────────────

/**
 * Formate une taille en octets avec l'unite la plus lisible (o/Ko/Mo).
 * - < 1 Ko : affichage en octets brut ("512 o")
 * - < 1 Mo : Ko arrondi ("50 Ko")
 * - >= 1 Mo : Mo avec une decimale ("2.5 Mo")
 * Retourne une chaine vide si `showZero` est false et `bytes < 1` (utilise
 * dans les listes ou on ne veut pas afficher la taille pour les dossiers).
 */
export function formatBytes(bytes: number, { showZero = true } = {}): string {
  if (bytes < 0) return ''
  if (bytes < 1 && !showZero) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}
