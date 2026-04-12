/**
 * Synchronisation des repos d'une promo GitHub vers la base locale Lumen.
 *
 * Cycle de sync d'une promo :
 *   1. Lister les repos de l'organisation (`GET /orgs/:org/repos`)
 *   2. Pour chaque repo : upsert dans `lumen_repos`
 *   3. Pour chaque repo : generer un manifest automatique depuis l'arbre
 *      GitHub, stocker dans `lumen_repos.manifest_json` + `last_commit_sha`
 *   4. Prune : supprimer les lignes DB qui ne sont plus dans l'org
 *
 * Fetch d'un chapitre a la demande :
 *   1. Verifier le cache (`lumen_file_cache`) par sha
 *   2. Si absent ou sha different, fetch raw via Octokit
 *   3. Stocker dans le cache et retourner le contenu
 */
const { inferRepoKind } = require('./lumenManifest')
const { generateAutoManifest } = require('./lumenAutoManifest')
const { buildScaffoldFiles } = require('./lumenScaffold')
const {
  upsertLumenRepo,
  updateLumenRepoManifest,
  setLumenRepoProjectFromManifest,
  pruneLumenReposForPromo,
  getLumenReposForPromo,
  getLumenCachedFile,
  upsertLumenCachedFile,
  pruneLumenFileCacheForRepo,
  purgeStaleLumenFileCache,
  upsertLumenChapterFts,
  pruneLumenChapterFtsForRepo,
} = require('../db/models/lumen')
const { findProjectByNormalizedName } = require('../db/models/projects')

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
/**
 * Decoupe `items` en batches de taille `limit`, applique `fn` en parallele
 * dans chaque batch (un batch attend que TOUS ses items finissent avant que
 * le suivant demarre). Pas une vraie sliding window — un item lent dans un
 * batch stalle le batch entier — mais c'est suffisant pour notre cas (fetch
 * d'images de qq centaines de Ko, peu de variance). Preserve l'ordre via
 * indexation explicite.
 */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length).fill(null)
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit)
    const batchResults = await Promise.allSettled(batch.map((item, idx) => fn(item, i + idx)))
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j].status === 'fulfilled' ? batchResults[j].value : null
    }
  }
  return results
}

async function inlineImages(octokit, repo, chapterPath, md) {
  const { owner, repo: repoName, default_branch: ref } = repo
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const matches = []
  let m
  while ((m = imageRegex.exec(md)) !== null) {
    matches.push({ full: m[0], alt: m[1], src: m[2], index: m.index })
  }
  if (!matches.length) return md

  // Phase 1 : fetch toutes les images en parallele borne (5 a la fois). On
  // collecte les resultats sans encore decider du replacement, car le budget
  // total doit etre applique sequentiellement (les premieres images dans
  // l'ordre du document gagnent). x4-x5 plus rapide que l'ancien sequentiel.
  const fetched = await mapWithConcurrency(matches, 5, async (match) => {
    const rel = resolveRelativePath(match.src, chapterPath)
    if (!rel) return { match, kind: 'skip' }
    const ext = '.' + (rel.split('.').pop() ?? '').toLowerCase()
    const mime = IMAGE_MIME_BY_EXT[ext]
    if (!mime) return { match, kind: 'skip' }
    try {
      const file = await fetchBinaryFile(octokit, { owner, repo: repoName, path: rel, ref })
      if (!file) return { match, kind: 'missing', rel }
      return { match, kind: 'ok', rel, mime, file }
    } catch {
      return { match, kind: 'error', rel }
    }
  })

  // Phase 2 : applique le budget total dans l'ordre du document.
  let totalBytes = 0
  const replacements = new Map()
  for (const item of fetched) {
    if (!item || item.kind === 'skip') continue
    const { match, rel } = item
    if (item.kind === 'missing') {
      replacements.set(match.full, `*[image manquante : ${match.alt || rel}]*`)
      continue
    }
    if (item.kind === 'error') {
      replacements.set(match.full, `*[image inaccessible : ${match.alt || rel}]*`)
      continue
    }
    const { mime, file } = item
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

  // Detection automatique pure : le manifest est toujours genere depuis
  // l'arbre du repo — convention over configuration.
  let parsed
  try {
    const autoManifest = await generateAutoManifest(octokit, {
      owner, repo, ref: defaultBranch, projectName: repo,
    })
    parsed = { ok: true, manifest: autoManifest }
  } catch (err) {
    updateLumenRepoManifest(id, {
      manifestJson: null,
      manifestError: `Auto-manifest impossible : ${err.message ?? err}`,
      lastCommitSha: commitSha,
    })
    return { ok: false, error: 'auto_manifest_failed' }
  }

  // Resout l'optionnel cursusProject du manifest contre projects.name.
  // Si match ok => ecrit project_id, effacer toute erreur prealable.
  // Si pas de champ OU pas de match => remet project_id a NULL (le
  // manifest est maitre : son absence doit delier).
  // En cas d'ambiguite ou introuvable, on stocke un avertissement dans
  // manifestError mais on continue (le sync du manifest reste valide).
  const warnings = []
  let resolvedProjectId = null
  if (parsed.manifest.cursusProject) {
    const found = findProjectByNormalizedName(dbRepo.promo_id, parsed.manifest.cursusProject)
    if (found.ok) {
      resolvedProjectId = found.project.id
    } else if (found.code === 'not_found') {
      warnings.push(`Projet Cursus "${parsed.manifest.cursusProject}" introuvable dans la promo`)
    } else if (found.code === 'ambiguous') {
      warnings.push(`Projet Cursus "${parsed.manifest.cursusProject}" ambigu (${found.matches.length} projets portent ce nom, renomme l'un d'eux)`)
    }
  }

  // Categorisation v2.63 : on infere `kind` depuis le nom du repo.
  // La valeur est ecrite dans le manifest persiste pour que la sidebar
  // puisse grouper sans recalcul.
  if (!parsed.manifest.kind) {
    parsed.manifest.kind = inferRepoKind(repo)
  }

  // Auto-manifest tronque (repo > 100k entrees GitHub) : warning lisible
  // affiche dans l'UI a cote du nom du repo. Le manifest reste exploitable.
  if (parsed.manifest.truncated) {
    warnings.push('Repo tres volumineux : tous les chapitres ne sont pas indexes')
  }

  updateLumenRepoManifest(id, {
    manifestJson: JSON.stringify(parsed.manifest),
    manifestError: warnings.length ? warnings.join(' · ') : null,
    lastCommitSha: commitSha,
  })

  // Le manifest est toujours maitre pour project_id. Si le champ
  // cursusProject est absent OU ne resout pas, on remet project_id
  // a NULL (efface le lien precedent).
  setLumenRepoProjectFromManifest(id, {
    projectId: resolvedProjectId,
    hasCursusProjectField: Boolean(parsed.manifest.cursusProject),
  })

  // Supprime du cache et de l'index FTS les fichiers qui ne sont plus
  // referencees par le manifest courant (chapitres supprimes/renomes cote
  // prof). Les deux sont synchronises pour eviter que la recherche tombe
  // sur des chapitres fantomes.
  const validPaths = parsed.manifest.chapters.map((c) => c.path)
  pruneLumenFileCacheForRepo(id, validPaths)
  pruneLumenChapterFtsForRepo(id, validPaths)

  return { ok: true, manifest: parsed.manifest, warnings }
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

  // Snapshot des repos deja en DB AVANT le sync. Permet au prune de
  // distinguer les repos supprimes cote GitHub des repos crees apres le
  // demarrage du sync (race "Nouveau cours" en parallele).
  const snapshotIds = getLumenReposForPromo(promoId).map((r) => r.id)

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

  pruneLumenReposForPromo(promoId, keepIds, snapshotIds)
  return { synced: orgRepos.length, errors }
}

/**
 * Convertit un markdown en texte plain exploitable par FTS5. Strip :
 *   - blocs de code (triple backtick OU tilde)
 *   - inline code (simple backtick)
 *   - images ![alt](...)
 *   - liens : conserve le texte, drop l'URL
 *   - HTML tags
 *   - formatting markers (**bold**, *italic*, _emph_)
 *   - headers : on garde le texte mais drop le # pour que "Introduction"
 *     soit indexe meme si ecrit "# Introduction"
 *
 * Cap a 200KB pour eviter le ReDoS sur des markdown bombs (alternations
 * non-greedy `[\s\S]*?` peuvent backtracker sur des entrees malformees).
 * Un chapitre normal fait < 50KB.
 */
const PLAIN_TEXT_MAX_INPUT = 200_000

function markdownToPlainText(md) {
  if (!md) return ''
  const capped = md.length > PLAIN_TEXT_MAX_INPUT ? md.slice(0, PLAIN_TEXT_MAX_INPUT) : md
  return capped
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ')  // blocs de code
    .replace(/`[^`\n]*`/g, ' ')                        // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')             // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')           // liens : garde le texte
    .replace(/<[^>]+>/g, ' ')                          // HTML tags
    .replace(/^#{1,6}\s+/gm, '')                       // header markers
    .replace(/[*_~]{1,3}/g, '')                        // bold/italic/strike
    .replace(/^\s*>\s?/gm, '')                         // blockquotes
    .replace(/^\s*[-*+]\s+/gm, '')                     // list bullets
    .replace(/\s+/g, ' ')                              // whitespace collapse
    .trim()
}

/**
 * Fetch un chapitre (fichier .md) avec cache par sha.
 * Si le cache contient deja le meme sha, on retourne directement le contenu
 * stocke. Sinon on fetch, on inline les images referencees en data URIs
 * puis on met a jour le cache. Les images privees sont ainsi disponibles
 * sans que le renderer ait besoin de gerer l'auth GitHub.
 *
 * Effet de bord : alimente l'index FTS5 (lumen_chapter_fts) avec le texte
 * plat du chapitre. C'est de l'indexation lazy — on index uniquement les
 * chapitres effectivement lus par au moins un utilisateur. Pour forcer
 * l'indexation complete d'un cours, il faudrait pre-fetch tous les chapitres
 * (pas fait ici : cout API GitHub eleve pour un gain marginal).
 */
async function fetchChapterContent(octokit, dbRepo, path) {
  const { id: repoId } = dbRepo
  const ext = (path.match(/\.([^./]+)$/) || [])[1]?.toLowerCase()

  // v2.64 : les PDF sont fetches comme binaires et renvoyes en data URL.
  // On ne passe pas par fetchFile (qui decode utf8) ni par inlineImages
  // (les PDF ne contiennent pas de markdown). Limite a 8 MB pour eviter
  // de saturer le cache SQLite et le transfert IPC.
  if (ext === 'pdf') {
    const cached = getLumenCachedFile(repoId, path)
    // Pour les PDFs, on shortcut le cache : la clef sha est posee au sync
    // suivant si re-fetch. On garde la meme structure que pour le markdown.
    const bin = await fetchBinaryFile(octokit, {
      owner: dbRepo.owner, repo: dbRepo.repo, path, ref: dbRepo.default_branch,
    })
    if (!bin) return null
    if (cached && cached.sha === bin.sha) {
      return { content: cached.content, sha: bin.sha, kind: 'pdf' }
    }
    if (bin.size > 8 * 1024 * 1024) {
      // PDF trop gros : on le sert quand meme mais sans cache pour ne pas
      // bloater SQLite. Le viewer peut quand meme l'afficher en streaming
      // depuis la prochaine requete.
      const dataUrl = `data:application/pdf;base64,${bin.buffer.toString('base64')}`
      return { content: dataUrl, sha: bin.sha, kind: 'pdf' }
    }
    const dataUrl = `data:application/pdf;base64,${bin.buffer.toString('base64')}`
    upsertLumenCachedFile(repoId, path, bin.sha, dataUrl)
    return { content: dataUrl, sha: bin.sha, kind: 'pdf' }
  }

  // v2.64 : .tex et .md passent par le meme chemin texte. La difference
  // de rendu se fait cote viewer (highlight.js latex pour tex, marked
  // pour md). On evite cependant l'inlining d'images pour les .tex car
  // ils n'ont pas de syntaxe ![](img) markdown.
  const file = await fetchFile(octokit, { owner: dbRepo.owner, repo: dbRepo.repo, path, ref: dbRepo.default_branch })
  if (!file) return null

  const cached = getLumenCachedFile(repoId, path)
  if (cached && cached.sha === file.sha) {
    // Cache hit : l'index FTS est deja a jour (pose au precedent fetch)
    return { content: cached.content, sha: file.sha, kind: ext === 'tex' ? 'tex' : 'markdown' }
  }

  // Pas d'inline d'images pour les .tex (le format n'a pas la syntaxe md)
  const enriched = ext === 'tex'
    ? file.content
    : await inlineImages(octokit, dbRepo, path, file.content)
  upsertLumenCachedFile(repoId, path, file.sha, enriched)

  // Index FTS5 : seulement pour le markdown (le tex est trop niche pour
  // justifier un parser specialise). Titre pioche depuis le manifest si
  // possible, sinon depuis le path. On log les erreurs au lieu de les
  // avaler silencieusement pour reperer un drift schema (ex: table FTS5
  // absente apres restore d'un backup).
  if (ext !== 'tex') {
    try {
      const manifest = dbRepo.manifest_json ? JSON.parse(dbRepo.manifest_json) : null
      const chapter = manifest?.chapters?.find((c) => c.path === path)
      const title = chapter?.title || path
      upsertLumenChapterFts(repoId, path, title, markdownToPlainText(file.content))
    } catch (err) {
      try {
        require('../utils/logger').warn('lumen_fts_upsert_failed', {
          repoId, path, error: err.message,
        })
      } catch { /* logger module unavailable in some test contexts */ }
    }
  }

  return { content: enriched, sha: file.sha, kind: ext === 'tex' ? 'tex' : 'markdown' }
}

/**
 * Retourne un chapitre depuis le cache seulement (utilise en fallback offline
 * ou quand Octokit n'est pas disponible).
 */
function getCachedChapter(repoId, path) {
  const cached = getLumenCachedFile(repoId, path)
  if (!cached) return null
  // Infere le kind depuis l'extension : pas stocke explicitement en cache
  // mais le path est suffisant pour brancher cote viewer.
  const ext = (path.match(/\.([^./]+)$/) || [])[1]?.toLowerCase()
  const kind = ext === 'pdf' ? 'pdf' : ext === 'tex' ? 'tex' : 'markdown'
  return { content: cached.content, sha: cached.sha, fetchedAt: cached.fetched_at, cached: true, kind }
}

/**
 * Cree un nouveau repo dans une organisation GitHub et y pousse le scaffold
 * Lumen "Nouveau cours" en un seul commit initial.
 *
 * Strategie :
 *   1. Cree le repo prive (auto_init=true pour avoir une branche default
 *      avec un commit racine — necessaire pour pouvoir pousser des fichiers
 *      via la Trees API).
 *   2. Construit un blob pour chaque fichier du scaffold.
 *   3. Cree un tree avec tous les blobs en une seule API call.
 *   4. Cree un commit pointant vers ce tree, avec le commit auto-init comme
 *      parent.
 *   5. Met a jour la ref de la branche default vers ce commit.
 *
 * Cette approche est preferee a N appels createOrUpdateFileContents :
 *   - 1 commit initial propre au lieu de N commits "add file X"
 *   - moins de round-trips
 *   - atomique : si une etape echoue, on n'a pas un repo a moitie scaffolde
 *
 * @param {Octokit} octokit
 * @param {{ org: string, slug: string, blocTitle: string }} params
 * @returns {Promise<{ owner: string, repo: string, defaultBranch: string }>}
 */
/**
 * Petit retry exponentiel pour les API GitHub qui peuvent renvoyer 404/409
 * pendant ~500ms apres certaines operations (create + auto_init notamment).
 */
async function retryWithBackoff(fn, { attempts = 4, baseDelayMs = 200 } = {}) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try { return await fn() }
    catch (err) {
      lastErr = err
      const transient = err.status === 404 || err.status === 409
      if (!transient || i === attempts - 1) throw err
      await new Promise((r) => setTimeout(r, baseDelayMs * (2 ** i)))
    }
  }
  throw lastErr
}

async function createRepoWithScaffold(octokit, { org, slug, blocTitle }) {
  // 1. Cree le repo (echoue avec 422 si nom deja pris)
  const { data: created } = await octokit.rest.repos.createInOrg({
    org,
    name: slug,
    description: blocTitle,
    private: true,
    auto_init: true,
  })
  const owner = created.owner.login
  const repo = created.name
  const defaultBranch = created.default_branch || 'main'

  // 2. Recupere le commit racine cree par auto_init. GitHub peut renvoyer
  //    404 transitoire pendant que le repo s'initialise — d'ou le retry.
  const branch = await retryWithBackoff(() =>
    octokit.rest.repos.getBranch({ owner, repo, branch: defaultBranch }),
  )
  const baseCommitSha = branch.data.commit.sha

  // 3. Cree un blob par fichier du scaffold (parallelise). On utilise
  //    encoding: utf-8 directement, plus simple que double-encoder en base64.
  const files = buildScaffoldFiles({ blocTitle })
  const blobResults = await Promise.allSettled(files.map(async (f) => {
    const { data } = await octokit.rest.git.createBlob({
      owner, repo,
      content: f.content,
      encoding: 'utf-8',
    })
    return { path: f.path, sha: data.sha }
  }))
  const failed = blobResults.filter((r) => r.status === 'rejected')
  if (failed.length) {
    throw new Error(`Scaffold : ${failed.length}/${files.length} fichiers n'ont pas pu etre crees`)
  }
  const blobs = blobResults.map((r) => r.value)

  // 4. Cree un tree fresh (sans base_tree) — sinon le README.md auto-genere
  //    par auto_init coexiste avec celui du scaffold (overwrite OK mais
  //    bruyant cote historique). Le scaffold est self-contained.
  const { data: tree } = await octokit.rest.git.createTree({
    owner, repo,
    tree: blobs.map((b) => ({
      path: b.path,
      mode: '100644',
      type: 'blob',
      sha: b.sha,
    })),
  })

  // 5. Commit pointant vers ce tree avec le commit auto-init comme parent,
  //    puis fast-forward de la branche default.
  const { data: commit } = await octokit.rest.git.createCommit({
    owner, repo,
    message: 'chore: scaffold Cursus',
    tree: tree.sha,
    parents: [baseCommitSha],
  })

  await octokit.rest.git.updateRef({
    owner, repo,
    ref: `heads/${defaultBranch}`,
    sha: commit.sha,
  })

  return { owner, repo, defaultBranch }
}

/**
 * Ecrit ou cree un fichier dans un repo Lumen via l'API Contents (v2.67).
 * Utilise pour permettre au prof d'editer rapidement un chapitre depuis
 * Cursus sans passer par GitHub.com.
 *
 * Comportement :
 *  - Si `sha` est fourni → mise a jour atomique (GitHub renvoie 409 si le
 *    sha ne correspond plus a la version courante, on surface le conflit)
 *  - Si `sha` est absent → creation pure (GitHub renvoie 422 si le fichier
 *    existe deja, on surface une erreur claire)
 *  - Le commit est fait par l'octokit du prof connecte (avec son auteur)
 *  - Le cache local + l'index FTS sont invalides apres ecriture pour eviter
 *    de servir l'ancienne version au prochain fetch
 *
 * @param {Octokit} octokit
 * @param {object} dbRepo                 Le row SQLite du repo (id, owner, repo, default_branch)
 * @param {object} params
 * @param {string} params.path            Chemin du fichier dans le repo (ex: "guides/scrum.md")
 * @param {string} params.content         Contenu UTF-8 du fichier (sera encode base64)
 * @param {string} params.message         Message de commit
 * @param {string=} params.sha            SHA du blob courant (requis pour update, omit pour create)
 * @returns {Promise<{ content: string, sha: string, commitSha: string }>}
 */
async function writeChapterFile(octokit, dbRepo, { path, content, message, sha }) {
  const { owner, repo, default_branch: defaultBranch, id: repoId } = dbRepo
  const contentBase64 = Buffer.from(content, 'utf8').toString('base64')

  const params = {
    owner,
    repo,
    path,
    message: message || (sha ? `docs: edit ${path}` : `docs: add ${path}`),
    content: contentBase64,
    branch: defaultBranch,
  }
  if (sha) params.sha = sha

  const { data } = await octokit.rest.repos.createOrUpdateFileContents(params)

  // Invalide le cache local : le prochain fetch repassera par GitHub.
  // On ne re-fetch pas ici pour eviter un round-trip inutile (le client
  // appellera getLumenChapterContent juste apres pour rafraichir l'UI).
  try {
    const { deleteLumenCachedFile, deleteLumenChapterFts } = require('../db/models/lumen')
    if (typeof deleteLumenCachedFile === 'function') deleteLumenCachedFile(repoId, path)
    if (typeof deleteLumenChapterFts === 'function') deleteLumenChapterFts(repoId, path)
  } catch { /* noop : si pas dispo, le cache repop au prochain fetch */ }

  return {
    content,
    sha: data.content?.sha ?? '',
    commitSha: data.commit?.sha ?? '',
  }
}

module.exports = {
  listOrgRepos,
  fetchFile,
  getLatestCommitSha,
  syncRepo,
  syncPromoRepos,
  fetchChapterContent,
  getCachedChapter,
  createRepoWithScaffold,
  writeChapterFile,
}
