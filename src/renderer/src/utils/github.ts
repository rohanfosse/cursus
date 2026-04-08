/**
 * Utilitaires partages pour la manipulation d'URLs GitHub publiques.
 * Utilises par l'editeur Lumen (validation au blur), le panneau projet
 * (bouton "Voir sur GitHub"), et les tests.
 *
 * Le backend a son propre parsing (server/services/lumenSnapshot.js) car
 * il ne partage pas de code avec le frontend — mais les deux doivent
 * suivre les memes regles.
 */

/**
 * Valide qu'une URL pointe vers un repo GitHub public (format minimal
 * attendu : https://github.com/owner/repo, avec ou sans trailing slash,
 * .git, ou sous-chemins).
 */
export function isValidGitHubUrl(url: string): boolean {
  if (typeof url !== 'string' || url.trim() === '') return false
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'https:' || u.host !== 'github.com') return false
    const segments = u.pathname.replace(/^\/+|\/+$/g, '').split('/')
    return segments.length >= 2 && !!segments[0] && !!segments[1]
  } catch {
    return false
  }
}

/**
 * Extrait { owner, repo } d'une URL GitHub publique ou retourne null si
 * l'URL est invalide. Pendant frontend de parseGitHubUrl cote backend.
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  if (!isValidGitHubUrl(url)) return null
  const u = new URL(url.trim())
  const segments = u.pathname.replace(/^\/+|\/+$/g, '').split('/')
  const owner = segments[0]
  let repo = segments[1]
  if (repo.endsWith('.git')) repo = repo.slice(0, -4)
  return { owner, repo }
}
