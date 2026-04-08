/**
 * Lumen — Service de snapshot d'un repo git public (GitHub) attache a un cours.
 *
 * Fetch l'arborescence et le contenu des fichiers d'un repo GitHub public,
 * valide les limites dures (taille / nombre de fichiers), et serialise le
 * tout en JSON pour stockage en DB. Pas de token GitHub (repos publics
 * uniquement). Pas de follow de redirects vers d'autres hosts (anti-SSRF).
 */
const log = require('../utils/logger')

// ─── Limites dures ──────────────────────────────────────────────────────────
const MAX_FILES = 200
const MAX_TOTAL_BYTES = 5 * 1024 * 1024        // 5 Mo
const MAX_FILE_BYTES  = 512 * 1024              // 512 Ko
const FETCH_TIMEOUT_MS = 30_000                 // 30 s
const GITHUB_API_HOST = 'https://api.github.com'
const USER_AGENT = 'Cursus-Lumen-Snapshot'

// ─── Codes d'erreur stables ─────────────────────────────────────────────────
const ErrorCodes = Object.freeze({
  INVALID_URL:         'INVALID_URL',
  REPO_NOT_FOUND:      'REPO_NOT_FOUND',
  RATE_LIMIT:          'RATE_LIMIT',
  TIMEOUT:             'TIMEOUT',
  TOO_MANY_FILES:      'TOO_MANY_FILES',
  TOTAL_SIZE_EXCEEDED: 'TOTAL_SIZE_EXCEEDED',
  FILE_SIZE_EXCEEDED:  'FILE_SIZE_EXCEEDED',
  FETCH_ERROR:         'FETCH_ERROR',
})

class SnapshotError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'SnapshotError'
    this.code = code
    this.details = details
  }
}

// ─── Parsing URL ────────────────────────────────────────────────────────────

/**
 * Extrait { owner, repo } depuis une URL GitHub publique.
 * Accepte : https://github.com/owner/repo, https://github.com/owner/repo.git,
 * avec ou sans trailing slash. Refuse tout autre host ou scheme.
 * @param {string} url
 * @returns {{ owner: string, repo: string }}
 */
function parseGitHubUrl(url) {
  if (typeof url !== 'string' || url.trim() === '') {
    throw new SnapshotError(ErrorCodes.INVALID_URL, 'URL vide ou absente.')
  }
  let parsed
  try { parsed = new URL(url.trim()) }
  catch {
    throw new SnapshotError(ErrorCodes.INVALID_URL, 'URL mal formee.', { url })
  }
  if (parsed.protocol !== 'https:') {
    throw new SnapshotError(ErrorCodes.INVALID_URL, 'Seul HTTPS est accepte.', { url })
  }
  if (parsed.host !== 'github.com') {
    throw new SnapshotError(ErrorCodes.INVALID_URL, 'Seul github.com est accepte.', { host: parsed.host })
  }
  // Pathname attendu : /owner/repo ou /owner/repo.git ou /owner/repo/
  const segments = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/')
  if (segments.length < 2) {
    throw new SnapshotError(ErrorCodes.INVALID_URL, 'URL doit etre de la forme github.com/owner/repo.', { url })
  }
  const owner = segments[0]
  let repo = segments[1]
  if (repo.endsWith('.git')) repo = repo.slice(0, -4)
  if (!owner || !repo) {
    throw new SnapshotError(ErrorCodes.INVALID_URL, 'Owner ou repo manquant.', { url })
  }
  return { owner, repo }
}

// ─── Fetch helpers ──────────────────────────────────────────────────────────

/**
 * Wrapper fetch GitHub avec headers standards, timeout, et mapping d'erreurs.
 * @param {string} path API path starting with /
 * @param {AbortSignal} signal
 */
async function githubFetch(path, signal) {
  const url = `${GITHUB_API_HOST}${path}`
  let res
  try {
    res = await fetch(url, {
      signal,
      redirect: 'error', // anti-SSRF : pas de redirect vers d'autres hosts
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new SnapshotError(ErrorCodes.TIMEOUT, 'Timeout lors du fetch GitHub.', { path })
    }
    throw new SnapshotError(ErrorCodes.FETCH_ERROR, `Echec reseau : ${err?.message ?? 'inconnu'}`, { path })
  }
  if (res.status === 404) {
    throw new SnapshotError(ErrorCodes.REPO_NOT_FOUND, 'Repo ou ressource introuvable sur GitHub.', { path })
  }
  if (res.status === 403) {
    // Rate limit : 'X-RateLimit-Remaining: 0' + 'X-RateLimit-Reset'
    const remaining = res.headers.get('x-ratelimit-remaining')
    if (remaining === '0') {
      const resetTs = Number(res.headers.get('x-ratelimit-reset')) || 0
      const resetAt = resetTs ? new Date(resetTs * 1000).toISOString() : null
      throw new SnapshotError(ErrorCodes.RATE_LIMIT, 'Rate limit GitHub atteint.', { resetAt })
    }
    throw new SnapshotError(ErrorCodes.FETCH_ERROR, 'Acces refuse par GitHub (403).', { path })
  }
  if (!res.ok) {
    throw new SnapshotError(ErrorCodes.FETCH_ERROR, `GitHub a repondu ${res.status}.`, { path, status: res.status })
  }
  try {
    return await res.json()
  } catch {
    throw new SnapshotError(ErrorCodes.FETCH_ERROR, 'Reponse GitHub non-JSON.', { path })
  }
}

/**
 * Recupere les metadonnees du repo (default_branch, size).
 */
async function fetchRepoMetadata(owner, repo, signal) {
  const data = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, signal)
  return {
    default_branch: data.default_branch,
    size_kb: data.size ?? 0,
  }
}

/**
 * Recupere l'arborescence complete (recursive) du repo a un ref donne.
 * Retourne uniquement les blobs (fichiers), pas les trees (dossiers).
 * @returns {Array<{ path:string, sha:string, size:number }>}
 */
async function fetchRepoTree(owner, repo, ref, signal) {
  const data = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    signal,
  )
  if (data.truncated) {
    // GitHub tronque l'arbre au-dela de ~100k entrees ou 7 Mo : on refuse net.
    throw new SnapshotError(
      ErrorCodes.TOO_MANY_FILES,
      'Arborescence trop large pour etre snapshotee (tronquee par GitHub).',
      { truncated: true },
    )
  }
  if (!Array.isArray(data.tree)) {
    throw new SnapshotError(ErrorCodes.FETCH_ERROR, 'Reponse tree GitHub invalide.')
  }
  return data.tree
    .filter(entry => entry.type === 'blob')
    .map(entry => ({
      path: entry.path,
      sha: entry.sha,
      size: entry.size ?? 0,
    }))
}

/**
 * Recupere le contenu base64 d'un blob par son SHA.
 * Utilise l'endpoint blobs (pas contents) : plus fiable pour les gros fichiers
 * et ne depend pas du path (ce qui evite les problemes d'encodage des slashes).
 */
async function fetchBlobContent(owner, repo, sha, signal) {
  const data = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${encodeURIComponent(sha)}`,
    signal,
  )
  if (data.encoding !== 'base64' || typeof data.content !== 'string') {
    throw new SnapshotError(ErrorCodes.FETCH_ERROR, `Encoding inattendu pour le blob ${sha}.`)
  }
  // GitHub renvoie le base64 avec des sauts de ligne tous les 60 chars — on nettoie.
  return data.content.replace(/\n/g, '')
}

// ─── Validation des limites ────────────────────────────────────────────────

function validateTreeAgainstLimits(tree) {
  if (tree.length > MAX_FILES) {
    throw new SnapshotError(
      ErrorCodes.TOO_MANY_FILES,
      `Le projet a ${tree.length} fichiers (limite : ${MAX_FILES}).`,
      { actual: tree.length, limit: MAX_FILES },
    )
  }
  let total = 0
  for (const entry of tree) {
    if (entry.size > MAX_FILE_BYTES) {
      throw new SnapshotError(
        ErrorCodes.FILE_SIZE_EXCEEDED,
        `Le fichier ${entry.path} fait ${entry.size} octets (limite : ${MAX_FILE_BYTES}).`,
        { path: entry.path, actual: entry.size, limit: MAX_FILE_BYTES },
      )
    }
    total += entry.size
    if (total > MAX_TOTAL_BYTES) {
      throw new SnapshotError(
        ErrorCodes.TOTAL_SIZE_EXCEEDED,
        `Le projet total depasse ${MAX_TOTAL_BYTES} octets (arret a ${total}).`,
        { actual: total, limit: MAX_TOTAL_BYTES },
      )
    }
  }
  return total
}

// ─── Orchestration ─────────────────────────────────────────────────────────

/**
 * Construit un snapshot complet a partir d'une URL GitHub publique.
 *
 * Pipeline :
 *   1. Parse URL → { owner, repo }
 *   2. Fetch metadata → default_branch
 *   3. Fetch tree (recursive)
 *   4. Validate limits (count / per-file / total)
 *   5. Fetch contenu de chaque blob (serialise pour ne pas saturer GitHub)
 *   6. Retourne le JSON snapshot
 *
 * @param {string} url URL github.com/owner/repo
 * @returns {Promise<object>} snapshot JSON
 */
async function buildSnapshot(url) {
  const { owner, repo } = parseGitHubUrl(url)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const startedAt = Date.now()
  try {
    log.info('lumen_snapshot_started', { owner, repo })
    const { default_branch } = await fetchRepoMetadata(owner, repo, controller.signal)
    if (!default_branch) {
      throw new SnapshotError(ErrorCodes.FETCH_ERROR, 'default_branch manquant dans la reponse GitHub.')
    }
    const tree = await fetchRepoTree(owner, repo, default_branch, controller.signal)
    const total_size = validateTreeAgainstLimits(tree)

    // Fetch des contenus en serie (simple, et evite de flamber le rate limit).
    // Pour 200 fichiers max, 200 requetes consecutives restent dans le timeout
    // de 30s avec une moyenne de < 150ms par appel GitHub API.
    const files = []
    for (const entry of tree) {
      const content_base64 = await fetchBlobContent(owner, repo, entry.sha, controller.signal)
      files.push({
        path: entry.path,
        size: entry.size,
        content_base64,
      })
    }

    // On fetch le commit courant pour figer le SHA precisement (default_branch
    // peut bouger entre le fetch metadata et maintenant).
    const headCommit = await githubFetch(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(default_branch)}`,
      controller.signal,
    )

    const snapshot = {
      repo_url: `https://github.com/${owner}/${repo}`,
      default_branch,
      commit_sha: headCommit.sha ?? null,
      fetched_at: new Date().toISOString(),
      files,
      total_size,
      file_count: files.length,
    }
    log.info('lumen_snapshot_built', {
      owner,
      repo,
      branch: default_branch,
      sha: snapshot.commit_sha,
      files: files.length,
      size: total_size,
      duration_ms: Date.now() - startedAt,
    })
    return snapshot
  } catch (err) {
    const code = err instanceof SnapshotError ? err.code : 'UNEXPECTED'
    log.warn('lumen_snapshot_failed', {
      owner,
      repo,
      code,
      message: err?.message,
      duration_ms: Date.now() - startedAt,
    })
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// ─── Mapping erreur → code HTTP ────────────────────────────────────────────

/**
 * Table de mapping des codes d'erreur vers les statuts HTTP correspondants.
 * Utilisee par les routes pour convertir une SnapshotError en reponse 4xx/5xx.
 */
const httpStatusFor = Object.freeze({
  [ErrorCodes.INVALID_URL]:         400,
  [ErrorCodes.REPO_NOT_FOUND]:      404,
  [ErrorCodes.RATE_LIMIT]:          429,
  [ErrorCodes.TOO_MANY_FILES]:      413,
  [ErrorCodes.TOTAL_SIZE_EXCEEDED]: 413,
  [ErrorCodes.FILE_SIZE_EXCEEDED]:  413,
  [ErrorCodes.TIMEOUT]:             504,
  [ErrorCodes.FETCH_ERROR]:         502,
})

module.exports = {
  buildSnapshot,
  parseGitHubUrl,
  fetchRepoMetadata,
  fetchRepoTree,
  fetchBlobContent,
  validateTreeAgainstLimits,
  SnapshotError,
  ErrorCodes,
  httpStatusFor,
  // Export des constantes pour les tests
  _limits: { MAX_FILES, MAX_TOTAL_BYTES, MAX_FILE_BYTES, FETCH_TIMEOUT_MS },
}
