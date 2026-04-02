// ─── Validation de fichiers côté client ──────────────────────────────────────
// Miroir des règles serveur définies dans server/routes/documents.js
// Aucune dépendance externe — fonctions pures uniquement.

export interface FileValidationResult {
  valid: boolean
  error?: string
}

/** Taille maximale autorisée : 50 Mo (identique au serveur) */
const MAX_FILE_SIZE = 50 * 1024 * 1024

/**
 * Extensions bloquées (identiques à BLOCKED_EXTENSIONS côté serveur).
 * Comparaison insensible à la casse via `.toLowerCase()` lors de la validation.
 */
const BLOCKED_EXTENSIONS: ReadonlySet<string> = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.dll',
  '.scr', '.pif', '.vbs', '.wsf', '.jar', '.apk', '.ps1', '.sh',
])

/**
 * Valide un fichier avant upload.
 *
 * Règles appliquées dans cet ordre :
 * 1. Traversée de chemin — le nom ne doit pas contenir ".."
 * 2. Extension bloquée — insensible à la casse
 * 3. Taille maximale — 50 Mo
 *
 * @param file Objet contenant le nom et la taille du fichier en octets.
 * @returns `{ valid: true }` si toutes les règles passent,
 *          `{ valid: false, error: string }` dès la première violation.
 */
export function validateFile(file: { name: string; size: number }): FileValidationResult {
  // Règle 1 — traversée de chemin
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return {
      valid: false,
      error: 'Nom de fichier invalide. Les chemins relatifs ("..") et séparateurs ne sont pas autorisés.',
    }
  }

  // Règle 2 — extension bloquée
  const lastDot = file.name.lastIndexOf('.')
  if (lastDot !== -1) {
    const ext = file.name.slice(lastDot).toLowerCase()
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        error: `Ce type de fichier (${ext}) n'est pas autorisé pour des raisons de sécurité.`,
      }
    }
  }

  // Règle 3 — taille
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `Le fichier dépasse la taille maximale autorisée (50 Mo).`,
    }
  }

  return { valid: true }
}
