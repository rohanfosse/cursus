/**
 * Synchronisation des repos d'une promo GitHub vers la base locale Lumen.
 *
 * Cycle de sync d'une promo :
 *   1. Lister les repos de l'organisation (`GET /orgs/:org/repos`)
 *   2. Pour chaque repo : upsert dans `lumen_repos`
 *   3. Pour chaque repo : fetch `cursus.yaml`, parser, valider, stocker
 *      dans `lumen_repos.manifest_json` + `last_commit_sha`
 *   4. Prune : supprimer les lignes DB qui ne sont plus dans l'org
 *
 * Fetch d'un chapitre a la demande :
 *   1. Verifier le cache (`lumen_file_cache`) par sha
 *   2. Si absent ou sha different, fetch raw via Octokit
 *   3. Stocker dans le cache et retourner le contenu
 */
const { parseManifest, MANIFEST_FILENAME } = require('./lumenManifest')
const {
  upsertLumenRepo,
  updateLumenRepoManifest,
  pruneLumenReposForPromo,
  getLumenCachedFile,
  upsertLumenCachedFile,
  pruneLumenFileCacheForRepo,
  purgeStaleLumenFileCache,
} = require('../db/models/lumen')

/**
 * Liste tous les repos d'une organisation GitHub (paginated).
 */
async function listOrgRepos(octokit, org) {
  const repos = []
  for await (const { data } of octokit.paginate.iterator(octokit.rest.repos.listForOrg, {
    org,
    type: 'all',
    per_page: 100,
  })) {
    for (const r of data) {
      if (r.archived || r.disabled) continue
      repos.push({ owner: r.owner.login, repo: r.name, defaultBranch: r.default_branch ?? 'main' })
    }
  }
  return repos
}

/**
 * Fetch le contenu d'un fichier texte depuis un repo GitHub.
 * Renvoie { content, sha } ou null si 404.
 */
async function fetchFile(octokit, { owner, repo, path, ref }) {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref })
    if (Array.isArray(data) || data.type !== 'file') return null
    const content = Buffer.from(data.content, data.encoding ?? 'base64').toString('utf8')
    return { content, sha: data.sha }
  } catch (err) {
    if (err.status === 404) return null
    throw err
  }
}

/**
 * Fetch le contenu binaire d'un fichier (image, pdf, etc.) via l'API
 * contents. Retourne le buffer + mime devine depuis l'extension.
 */
async function fetchBinaryFile(octokit, { owner, repo, path, ref }) {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref })
    if (Array.isArray(data) || data.type !== 'file') return null
    const buf = Buffer.from(data.content, data.encoding ?? 'base64')
    return { buffer: buf, sha: data.sha, size: data.size }
  } catch (err) {
    if (err.status === 404) return null
    throw err
  }
}

const IMAGE_MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

const MAX_IMAGE_BYTES = 1_500_000       // 1.5 MB par image
const MAX_TOTAL_INLINE_BYTES = 6_000_000 // 6 MB total par chapitre

/** Resout un chemin relatif par rapport a un fichier de reference. */
function resolveRelativePath(link, currentPath) {
  if (!link || /^(https?:|data:|mailto:|#)/i.test(link)) return null
  if (link.startsWith('/')) return link.replace(/^\/+/, '')
  const dirParts = currentPath.split('/').slice(0, -1)
  const parts = link.split('/')
  for (const p of parts) {
    if (p === '..') dirParts.pop()
    else if (p !== '.' && p !== '') dirParts.push(p)
  }
  return dirParts.join('/')
}

/**
 * Scanne un markdown pour trouver toutes les images ![alt](path) et
 * remplace les chemins relatifs par des data URIs inlinees apres fetch
 * via octokit. Les URLs absolues (http, data:) sont laissees telles
 * quelles. Les images trop grosses ou au-dela du budget total sont
 * remplacees par un placeholder lisible.
 */
async function inlineImages(octokit, repo, chapterPath, md) {
  const { owner, repo: repoName, default_branch: ref } = repo
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const matches = []
  let m
  while ((m = imageRegex.exec(md)) !== null) {
    matches.push({ full: m[0], alt: m[1], src: m[2], index: m.index })
  }
  if (!matches.length) return md

  let totalBytes = 0
  const replacements = new Map()

  for (const match of matches) {
    const rel = resolveRelativePath(match.src, chapterPath)
    if (!rel) continue
    const ext = '.' + (rel.split('.').pop() ?? '').toLowerCase()
    const mime = IMAGE_MIME_BY_EXT[ext]
    if (!mime) continue

    try {
      const file = await fetchBinaryFile(octokit, { owner, repo: repoName, path: rel, ref })
      if (!file) {
        replacements.set(match.full, `*[image manquante : ${match.alt || rel}]*`)
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        replacements.set(match.full, `*[image trop volumineuse (${Math.round(file.size / 1024)} Ko) : ${match.alt || rel}]*`)
        continue
      }
      if (totalBytes + file.size > MAX_TOTAL_INLINE_BYTES) {
        replacements.set(match.full, `*[image non chargee (budget atteint) : ${match.alt || rel}]*`)
        continue
      }
      totalBytes += file.size
      const dataUri = `data:${mime};base64,${file.buffer.toString('base64')}`
      replacements.set(match.full, `![${match.alt}](${dataUri})`)
    } catch {
      replacements.set(match.full, `*[image inaccessible : ${match.alt || rel}]*`)
    }
  }

  let result = md
  for (const [original, replacement] of replacements) {
    result = result.split(original).join(replacement)
  }
  return result
}

/**
 * Recupere le SHA du dernier commit sur la branche par defaut du repo.
 */
async function getLatestCommitSha(octokit, { owner, repo, defaultBranch }) {
  try {
    const { data } = await octokit.rest.repos.getBranch({ owner, repo, branch: defaultBranch })
    return data.commit?.sha ?? null
  } catch {
    return null
  }
}

/**
 * Sync un repo individuel : fetch manifest + commit sha, met a jour la DB.
 * Apres un sync reussi, purge du cache les chapitres qui n'existent
 * plus dans le manifest (fichier renomme ou supprime cote prof).
 */
async function syncRepo(octokit, dbRepo) {
  const { owner, repo, default_branch: defaultBranch, id } = dbRepo
  const commitSha = await getLatestCommitSha(octokit, { owner, repo, defaultBranch })

  const manifestFile = await fetchFile(octokit, { owner, repo, path: MANIFEST_FILENAME, ref: defaultBranch })
  if (!manifestFile) {
    updateLumenRepoManifest(id, {
      manifestJson: null,
      manifestError: `Fichier ${MANIFEST_FILENAME} absent a la racine du repo`,
      lastCommitSha: commitSha,
    })
    return { ok: false, error: 'manifest_missing' }
  }

  const parsed = parseManifest(manifestFile.content)
  if (!parsed.ok) {
    updateLumenRepoManifest(id, {
      manifestJson: null,
      manifestError: parsed.error,
      lastCommitSha: commitSha,
    })
    return { ok: false, error: parsed.error }
  }

  updateLumenRepoManifest(id, {
    manifestJson: JSON.stringify(parsed.manifest),
    manifestError: null,
    lastCommitSha: commitSha,
  })

  // Supprime du cache les fichiers qui ne sont plus referencees par le
  // manifest courant (chapitres supprimes/renomes cote prof).
  const validPaths = parsed.manifest.chapters.map((c) => c.path)
  pruneLumenFileCacheForRepo(id, validPaths)

  return { ok: true, manifest: parsed.manifest }
}

/**
 * Synchronise tous les repos d'une organisation pour une promo donnee.
 * Les appels GitHub sont parallelises par batch de 5 pour eviter de
 * taper le rate limit secondaire tout en restant bien plus rapide que
 * le mode sequentiel (O(n) round-trips → ceil(n/5)).
 * @returns {Promise<{synced: number, errors: Array<{repo: string, error: string}>}>}
 */
const SYNC_CONCURRENCY = 5

async function syncPromoRepos(octokit, { promoId, org }) {
  // Purge opportuniste du cache global obsolete (> 30 jours) a chaque
  // sync d'une promo — evite la croissance non-bornee de la table
  // lumen_file_cache sur des chapitres oublies.
  purgeStaleLumenFileCache(30)

  const orgRepos = await listOrgRepos(octokit, org)

  const dbRepos = orgRepos.map((r) => upsertLumenRepo({
    promoId,
    owner: r.owner,
    repo: r.repo,
    defaultBranch: r.defaultBranch,
  }))
  const keepIds = dbRepos.map((r) => r.id)

  const errors = []
  for (let i = 0; i < dbRepos.length; i += SYNC_CONCURRENCY) {
    const batch = dbRepos.slice(i, i + SYNC_CONCURRENCY)
    const results = await Promise.all(batch.map((repo) =>
      syncRepo(octokit, repo).catch((err) => ({ ok: false, error: err.message ?? 'sync_failed' })),
    ))
    results.forEach((result, j) => {
      if (!result.ok) {
        errors.push({ repo: `${batch[j].owner}/${batch[j].repo}`, error: result.error })
      }
    })
  }

  pruneLumenReposForPromo(promoId, keepIds)
  return { synced: orgRepos.length, errors }
}

/**
 * Fetch un chapitre (fichier .md) avec cache par sha.
 * Si le cache contient deja le meme sha, on retourne directement le contenu
 * stocke. Sinon on fetch, on inline les images referencees en data URIs
 * puis on met a jour le cache. Les images privees sont ainsi disponibles
 * sans que le renderer ait besoin de gerer l'auth GitHub.
 */
async function fetchChapterContent(octokit, dbRepo, path) {
  const { id: repoId } = dbRepo
  const file = await fetchFile(octokit, { owner: dbRepo.owner, repo: dbRepo.repo, path, ref: dbRepo.default_branch })
  if (!file) return null

  const cached = getLumenCachedFile(repoId, path)
  if (cached && cached.sha === file.sha) {
    return { content: cached.content, sha: file.sha }
  }

  const enriched = await inlineImages(octokit, dbRepo, path, file.content)
  upsertLumenCachedFile(repoId, path, file.sha, enriched)
  return { content: enriched, sha: file.sha }
}

/**
 * Retourne un chapitre depuis le cache seulement (utilise en fallback offline
 * ou quand Octokit n'est pas disponible).
 */
function getCachedChapter(repoId, path) {
  const cached = getLumenCachedFile(repoId, path)
  if (!cached) return null
  return { content: cached.content, sha: cached.sha, fetchedAt: cached.fetched_at, cached: true }
}

module.exports = {
  listOrgRepos,
  fetchFile,
  getLatestCommitSha,
  syncRepo,
  syncPromoRepos,
  fetchChapterContent,
  getCachedChapter,
}
