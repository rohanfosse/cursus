// ─── Validation du dépôt étudiant ─────────────────────────────────────────────
// Orchestre les validations avant toute tentative d'upload :
//   1. Fichier présent
//   2. Règles fileValidation (extension, taille, path traversal)
//   3. Deadline non dépassée

import { validateFile } from './fileValidation'

export interface DepositValidationResult {
  valid: boolean
  error?: string
}

/**
 * Valide un dépôt étudiant avant upload.
 *
 * Ordre de validation :
 * 1. Le fichier doit être non-null
 * 2. Le fichier doit passer `validateFile` (extension, taille, path traversal)
 * 3. La deadline, si fournie, ne doit pas être dans le passé
 *
 * @param file  Objet `{ name, size }` ou null si aucun fichier n'est sélectionné.
 * @param deadline ISO 8601 string ou null/undefined — ignorée si absente.
 * @returns `{ valid: true }` si tout est valide, `{ valid: false, error }` sinon.
 */
export function validateDeposit(
  file: { name: string; size: number } | null,
  deadline?: string | null,
): DepositValidationResult {
  // Règle 1 — fichier obligatoire
  if (file === null || file === undefined) {
    return { valid: false, error: 'Aucun fichier selectionne.' }
  }

  // Règle 2 — délégation à fileValidation
  const fileResult = validateFile(file)
  if (!fileResult.valid) {
    return { valid: false, error: fileResult.error }
  }

  // Règle 3 — deadline non dépassée
  if (deadline != null) {
    const deadlineDate = new Date(deadline)
    if (deadlineDate.getTime() < Date.now()) {
      return { valid: false, error: 'La date limite est depassee.' }
    }
  }

  return { valid: true }
}
