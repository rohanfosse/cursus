import { showToast } from './utils.js';

// Appelle window.api.xxx et verifie le resultat.
// Retourne data ou null en cas d'erreur (le toast est affiche automatiquement).
export async function call(fn, ...args) {
  const result = await fn(...args);
  if (!result.ok) {
    showToast(result.error ?? 'Une erreur est survenue.', 'error');
    return null;
  }
  return result.data;
}
