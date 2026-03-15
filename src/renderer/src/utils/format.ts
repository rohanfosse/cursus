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
  if (note == null) return ''
  if (typeof note === 'string' && ['A', 'B', 'C', 'D'].includes(note)) {
    return note === 'A' ? 'note-good' : note === 'D' ? 'note-low' : 'note-mid'
  }
  const n = parseFloat(String(note))
  return n >= 14 ? 'note-good' : n >= 10 ? 'note-mid' : 'note-low'
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
