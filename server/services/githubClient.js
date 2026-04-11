/**
 * Factory Octokit pour Lumen.
 *
 * Chaque utilisateur (eleve ou prof) possede son propre token GitHub (PAT ou
 * OAuth) stocke dans `lumen_github_auth`. Ce module construit un client
 * Octokit authentifie a partir du user et fournit les helpers necessaires
 * pour valider un token et fetcher du contenu de repo.
 *
 * Note : @octokit/rest v22 est ESM-only donc on utilise une dynamic import()
 * cachee pour rester compatible avec le backend CommonJS.
 */
const { getLumenGithubAuth } = require('../db/models/lumen')

const USER_AGENT = 'Cursus-Lumen/1.0'

let _OctokitCtor = null
let _RequestErrorCtor = null

async function loadOctokit() {
  if (!_OctokitCtor) {
    const mod = await import('@octokit/rest')
    _OctokitCtor = mod.Octokit
  }
  return _OctokitCtor
}

async function loadRequestError() {
  if (!_RequestErrorCtor) {
    const mod = await import('@octokit/request-error')
    _RequestErrorCtor = mod.RequestError
  }
  return _RequestErrorCtor
}

/**
 * Construit un client Octokit pour un user donne, ou null si non connecte.
 * Asynchrone car Octokit est charge en dynamic import().
 * @returns {Promise<any|null>}
 */
async function buildClientForUser(userType, userId) {
  const auth = getLumenGithubAuth(userType, userId)
  if (!auth?.access_token) return null
  const Octokit = await loadOctokit()
  return new Octokit({ auth: auth.access_token, userAgent: USER_AGENT })
}

/**
 * Valide un token en appelant /user et retourne les infos publiques.
 * Throw une erreur si le token est invalide ou si l'appel echoue.
 */
async function validateToken(token) {
  const Octokit = await loadOctokit()
  const octokit = new Octokit({ auth: token, userAgent: USER_AGENT })
  const { data, headers } = await octokit.rest.users.getAuthenticated()
  return {
    login: data.login,
    name: data.name ?? data.login,
    avatarUrl: data.avatar_url,
    scopes: headers['x-oauth-scopes'] ?? '',
  }
}

/**
 * Mappe une RequestError Octokit vers un shape HTTP stable reutilisable dans les routes.
 * Accepte aussi un objet duck-typed avec { status, message, response } pour les tests.
 *
 * Les erreurs 403 sont analysees plus finement pour distinguer rate limit
 * vs permissions refusees et fournir un message actionnable (delai avant
 * reset pour le rate limit, verification d'acces sinon).
 */
async function mapOctokitError(err) {
  const RequestError = await loadRequestError().catch(() => null)
  const isOctokit = RequestError && err instanceof RequestError
  if (isOctokit || typeof err?.status === 'number') {
    const status = err.status
    if (status === 401) return { status: 401, code: 'GITHUB_UNAUTHORIZED', message: 'Token GitHub invalide ou expire (reconnecte-toi)' }
    if (status === 403) {
      const headers = err.response?.headers ?? {}
      const remaining = Number(headers['x-ratelimit-remaining'] ?? -1)
      const resetEpoch = Number(headers['x-ratelimit-reset'] ?? 0)
      if (remaining === 0 && resetEpoch > 0) {
        const waitMin = Math.max(1, Math.ceil((resetEpoch * 1000 - Date.now()) / 60_000))
        return {
          status: 429,
          code: 'GITHUB_RATE_LIMIT',
          message: `Rate limit GitHub atteint. Reessaye dans ${waitMin} minute${waitMin > 1 ? 's' : ''}.`,
        }
      }
      return { status: 403, code: 'GITHUB_FORBIDDEN', message: 'Acces GitHub refuse (verifie que ton compte est membre de l\'organisation)' }
    }
    if (status === 404) return { status: 404, code: 'GITHUB_NOT_FOUND', message: 'Ressource GitHub introuvable (organisation ou repo inexistant)' }
    if (status === 422) return { status: 422, code: 'GITHUB_INVALID', message: err.message ?? 'Donnees GitHub invalides' }
    return { status, code: 'GITHUB_ERROR', message: err.message ?? 'Erreur GitHub' }
  }
  return { status: 500, code: 'GITHUB_ERROR', message: err?.message ?? 'Erreur GitHub inconnue' }
}

module.exports = { buildClientForUser, validateToken, mapOctokitError, USER_AGENT }
