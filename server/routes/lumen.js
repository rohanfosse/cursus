/**
 * Routes API Lumen — liseuse de cours adossee a GitHub.
 *
 * Modele : 1 promo = 1 organisation GitHub, 1 projet pedagogique = 1 repo,
 * le manifest est genere automatiquement depuis l'arbre du repo. Lumen stocke
 * uniquement des metadonnees (orga lookup, manifest parse, cache de fichiers,
 * notes privees etudiant, tracking lecture) ; le contenu des cours vit
 * dans GitHub.
 */
const router = require('express').Router()
const { z } = require('zod')
const wrap = require('../utils/wrap')
const authMiddleware = require('../middleware/auth')
const { requireRole, requirePromo, requirePromoAdmin, promoFromParam, promoFromTravail } = require('../middleware/authorize')
const { validate } = require('../middleware/validate')
const { AppError, NotFoundError, ForbiddenError } = require('../utils/errors')
const { buildClientForUser, validateToken, mapOctokitError } = require('../services/githubClient')
const { safeAuthorType } = require('../utils/roles')
const { syncPromoRepos, fetchChapterContent, getCachedChapter, createRepoWithScaffold, writeChapterFile } = require('../services/lumenRepoSync')
const {
  // auth
  getLumenGithubAuth,
  saveLumenGithubAuth,
  deleteLumenGithubAuth,
  // promo org
  getPromoGithubOrg,
  setPromoGithubOrg,
  // repos
  getLumenReposForPromo,
  getLumenRepo,
  setLumenRepoProject,
  setLumenRepoVisibility,
  // search (FTS5 v59)
  searchLumenChapters,
  getLumenReposByProjectName,
  getUnlinkedLumenReposForPromo,
  // notes
  getLumenChapterNote,
  upsertLumenChapterNote,
  deleteLumenChapterNote,
  getStudentLumenNotes,
  getStudentNotedChapters,
  // reads
  markLumenChapterRead,
  getStudentLumenReads,
  getLumenReadCountsForRepo,
  getLumenReadCountsForPromo,
  // chapter-travaux
  linkChapterToTravail,
  unlinkChapterFromTravail,
  getTravauxForChapter,
  getChaptersForTravail,
  // stats
  getLumenStatsForPromo,
} = require('../db/models/lumen')
const { getProjectById } = require('../db/models/projects')
const { getDb } = require('../db/connection')

router.use(authMiddleware)

// ─── Helpers ────────────────────────────────────────────────────────────────

// Normalise 'admin' / 'ta' vers 'teacher' via safeAuthorType : ces roles
// partagent la meme table teachers et le meme namespace d'id (stocke negatif
// dans le JWT), donc un seul row dans lumen_github_auth par humain.
//
// Type-check explicite sur req.user.id : sans ca, Math.abs(undefined) ou
// Math.abs(string) renvoie NaN, et un user avec un JWT mal forme se
// retrouverait silencieusement avec une cle DB invalide.
function userKey(req) {
  const type = req.user?.type
  const id = req.user?.id
  if (!type || typeof id !== 'number' || !Number.isFinite(id)) return null
  try {
    const normalized = safeAuthorType(type)
    if (normalized === 'teacher') return { userType: 'teacher', userId: Math.abs(id) }
    if (normalized === 'student') return { userType: 'student', userId: id }
  } catch { /* type inconnu */ }
  return null
}

async function requireGithubClient(req) {
  const key = userKey(req)
  if (!key) throw new ForbiddenError('GitHub non autorise pour ce type de compte')
  const octokit = await buildClientForUser(key.userType, key.userId)
  if (!octokit) throw new AppError('Compte GitHub non connecte', 401)
  return octokit
}

function promoFromRepoParam(req) {
  const id = Number(req.params.id)
  if (!id) return null
  const repo = getLumenRepo(id)
  return repo?.promo_id ?? null
}

/** Lookup promoId depuis `:id` (cas des routes /promos/:id/...). */
function promoFromIdParam(req) {
  return Number(req.params.id) || null
}

function repoOrThrow(id) {
  const repo = getLumenRepo(id)
  if (!repo) throw new NotFoundError('Repo Lumen introuvable')
  return repo
}

function parseManifestField(repo) {
  if (!repo.manifest_json) return null
  try { return JSON.parse(repo.manifest_json) } catch { return null }
}

function serializeRepo(repo) {
  // repo.project_name peut etre present si la query a fait le JOIN ; sinon
  // on lookup a la demande (cout : 1 SELECT par serialisation quand le repo
  // a un project_id). Pour les listes lourdes, preferer une query avec JOIN.
  let projectName = repo.project_name ?? null
  if (!projectName && repo.project_id) {
    const p = getProjectById(repo.project_id)
    projectName = p?.name ?? null
  }
  return {
    id: repo.id,
    promoId: repo.promo_id,
    owner: repo.owner,
    repo: repo.repo,
    fullName: `${repo.owner}/${repo.repo}`,
    defaultBranch: repo.default_branch,
    manifest: parseManifestField(repo),
    manifestError: repo.manifest_error ?? null,
    lastCommitSha: repo.last_commit_sha ?? null,
    lastSyncedAt: repo.last_synced_at ?? null,
    projectId: repo.project_id ?? null,
    projectName,
    isVisible: Boolean(repo.is_visible ?? 0),
  }
}

/** Les etudiants ne voient que les repos publies. Teachers/admins/TAs ont tout. */
function isStudent(req) {
  return req.user?.type === 'student'
}

async function handleOctokit(err) {
  const mapped = await mapOctokitError(err)
  return new AppError(mapped.message, mapped.status)
}

// ─── Schemas Zod ────────────────────────────────────────────────────────────

const tokenSchema = z.object({ token: z.string().min(10).max(200) }).strict()
const orgSchema = z.object({ org: z.string().min(1).max(100).nullable() }).strict()
const chapterPathSchema = z.object({ path: z.string().min(1).max(500) }).strict()
const noteSchema = z.object({
  path: z.string().min(1).max(500),
  content: z.string().max(10_000),
}).strict()

// ─── GitHub auth ────────────────────────────────────────────────────────────

router.get('/github/me', wrap(async (req) => {
  const key = userKey(req)
  if (!key) return { connected: false }
  const auth = getLumenGithubAuth(key.userType, key.userId)
  if (!auth) return { connected: false }
  return { connected: true, login: auth.github_login, scopes: auth.scopes ?? '' }
}))

router.post('/github/connect', validate(tokenSchema), wrap(async (req) => {
  const key = userKey(req)
  if (!key) throw new ForbiddenError('GitHub non autorise pour ce type de compte')
  let info
  try {
    info = await validateToken(req.body.token)
  } catch (err) {
    throw await handleOctokit(err)
  }
  saveLumenGithubAuth(key.userType, key.userId, {
    githubLogin: info.login,
    accessToken: req.body.token,
    scopes: info.scopes,
  })
  return { login: info.login, name: info.name, avatarUrl: info.avatarUrl }
}))

router.delete('/github/disconnect', wrap(async (req) => {
  const key = userKey(req)
  if (!key) return { disconnected: false }
  deleteLumenGithubAuth(key.userType, key.userId)
  return { disconnected: true }
}))

// ─── Promo GitHub org mapping (admin/teacher seulement) ─────────────────────

router.get('/promos/:id/github-org', requirePromo(promoFromIdParam), wrap(async (req) => {
  const promoId = Number(req.params.id)
  return { org: getPromoGithubOrg(promoId) }
}))

router.put(
  '/promos/:id/github-org',
  requireRole('teacher', 'admin'),
  requirePromoAdmin(promoFromIdParam),
  validate(orgSchema),
  wrap(async (req) => {
    const promoId = Number(req.params.id)
    setPromoGithubOrg(promoId, req.body.org)
    return { org: getPromoGithubOrg(promoId) }
  }),
)

// ─── Repos : lister / sync ──────────────────────────────────────────────────

router.get(
  '/repos/promo/:promoId',
  requirePromo(promoFromParam),
  wrap(async (req) => {
    const promoId = Number(req.params.promoId)
    const repos = getLumenReposForPromo(promoId, { visibleOnly: isStudent(req) }).map(serializeRepo)
    return { repos, org: getPromoGithubOrg(promoId) }
  }),
)

/**
 * Cree un nouveau repo dans l'org GitHub de la promo et y pousse le scaffold
 * Lumen "Nouveau cours" (README + projet + process-daily + 1 prosit exemple).
 * Apres creation, declenche un sync auto pour ramener le repo dans la sidebar.
 *
 * Body : { slug: string, blocTitle: string }
 * - slug : nom du repo GitHub (ex: "5-Base-de-Donnees")
 * - blocTitle : titre humain du bloc (ex: "Bloc 5 — Bases de donnees")
 */
const newCourseSchema = z.object({
  slug: z.string().min(1).max(80).regex(
    /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/,
    'Slug invalide : alphanumerique, ., _, - uniquement (ne commence pas par - ou .)',
  ),
  blocTitle: z.string().min(1).max(200),
}).strict()

router.post(
  '/promos/:id/repos',
  requireRole('teacher', 'admin'),
  requirePromoAdmin(promoFromIdParam),
  validate(newCourseSchema),
  wrap(async (req) => {
    const promoId = Number(req.params.id)
    const org = getPromoGithubOrg(promoId)
    if (!org) throw new AppError('Aucune organisation GitHub configuree pour cette promo', 400)

    const octokit = await requireGithubClient(req)
    let created
    try {
      created = await createRepoWithScaffold(octokit, {
        org,
        slug: req.body.slug,
        blocTitle: req.body.blocTitle,
      })
    } catch (err) {
      // 422 = validation GitHub : nom deja pris (le plus frequent), nom
      // reserve, longueur, plan d'org. On extrait le 1er message d'erreur
      // de la response pour donner du contexte au lieu d'un 409 generique.
      if (err.status === 422) {
        const ghMsg = err.response?.data?.errors?.[0]?.message
          || err.response?.data?.message
          || 'le nom est invalide ou deja pris'
        const isAlreadyExists = /already exists/i.test(ghMsg)
        throw new AppError(
          `Impossible de creer "${req.body.slug}" dans ${org} : ${ghMsg}`,
          isAlreadyExists ? 409 : 422,
        )
      }
      throw await handleOctokit(err)
    }

    // Sync auto pour ramener le nouveau repo dans la DB locale + sidebar.
    // Le repo herite du default is_visible=0 (cf. v58) — il est masque aux
    // etudiants tant que le prof ne le publie pas.
    try {
      await syncPromoRepos(octokit, { promoId, org })
    } catch {
      // Le repo est cree cote GitHub meme si le sync echoue. On laisse
      // remonter le repo cote client mais on ne bloque pas la creation.
    }

    const repos = getLumenReposForPromo(promoId, { visibleOnly: false }).map(serializeRepo)
    return { created, repos }
  }),
)

router.post(
  '/repos/sync/promo/:promoId',
  requirePromo(promoFromParam),
  wrap(async (req) => {
    const promoId = Number(req.params.promoId)
    const org = getPromoGithubOrg(promoId)
    if (!org) throw new AppError('Aucune organisation GitHub configuree pour cette promo', 400)
    const octokit = await requireGithubClient(req)
    let result
    try {
      result = await syncPromoRepos(octokit, { promoId, org })
    } catch (err) {
      throw await handleOctokit(err)
    }
    const repos = getLumenReposForPromo(promoId, { visibleOnly: isStudent(req) }).map(serializeRepo)
    return { synced: result.synced, errors: result.errors, repos }
  }),
)

router.get(
  '/repos/:id',
  requirePromo(promoFromRepoParam),
  wrap(async (req) => {
    const repo = repoOrThrow(Number(req.params.id))
    if (isStudent(req) && !repo.is_visible) {
      throw new NotFoundError('Repo Lumen introuvable')
    }
    return serializeRepo(repo)
  }),
)

// ─── Recherche fulltext FTS5 (v59) ──────────────────────────────────────────

/**
 * Echappe la query utilisateur pour FTS5. FTS5 a un mini-DSL (AND/OR/NOT,
 * quotes, prefix *, ...). Les caracteres speciaux non-echappes font planter
 * la query avec "fts5: syntax error". On transforme la saisie libre en une
 * serie de tokens entre guillemets + prefix match sur le dernier, ce qui
 * donne une experience "search-as-you-type" raisonnable sans exposer le
 * DSL FTS5 a l'utilisateur final.
 *
 *   "hello world"      -> "hello" AND "world"*
 *   "classe héritage"  -> "classe" AND "héritage"*
 *   ""                 -> null (pas de query)
 */
function buildFtsQuery(raw) {
  if (!raw || typeof raw !== 'string') return null
  // Tokenize sur les espaces et caracteres non-word (hors accents). Lower-case
  // inutile : FTS5 tokenize + normalise via unicode61 (cf. migration v59).
  const tokens = raw
    .split(/[\s,;.:!?()[\]{}<>"']+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
  if (!tokens.length) return null
  // Echappe les guillemets internes en les remplacant par des espaces
  // (on encadre chaque token entre " apres nettoyage).
  const clean = tokens.map((t) => `"${t.replace(/"/g, ' ').trim()}"`).filter((t) => t.length > 2)
  if (!clean.length) return null
  // Le dernier token est pris en prefix-match (search-as-you-type).
  clean[clean.length - 1] = clean[clean.length - 1].replace(/"$/, '"*')
  return clean.join(' AND ')
}

const searchQuerySchema = z.object({
  q: z.string().min(2).max(200),
  limit: z.coerce.number().int().positive().max(100).optional(),
}).strict()

/**
 * Recherche cross-repos dans une promo. Scope les repos selon la visibilite
 * etudiant (filter is_visible=1) et retourne les N premiers resultats
 * ordonnes par rank FTS5. Chaque resultat contient un snippet contextualise
 * avec les termes matchants encadres par <mark>...</mark> (le client doit
 * les echapper ou les rendre tels quels selon sa politique XSS).
 */
router.get(
  '/promos/:promoId/search',
  requirePromo(promoFromParam),
  wrap(async (req) => {
    const promoId = Number(req.params.promoId)
    const parsed = searchQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError('Parametre q invalide (2-200 chars)', 400)
    }
    const ftsQuery = buildFtsQuery(parsed.data.q)
    if (!ftsQuery) return { results: [] }

    // Scope : repos visibles pour un student, tous les repos pour teacher/admin
    const repos = getLumenReposForPromo(promoId, { visibleOnly: isStudent(req) })
    const repoIds = repos.map((r) => r.id)
    if (!repoIds.length) return { results: [] }

    // Map repo_id -> fullName pour enrichir les resultats cote UI
    const repoNames = new Map()
    for (const r of repos) {
      const manifest = parseManifestField(r)
      repoNames.set(r.id, manifest?.project ?? `${r.owner}/${r.repo}`)
    }

    let rows
    try {
      rows = searchLumenChapters({
        repoIds,
        query: ftsQuery,
        limit: parsed.data.limit ?? 50,
      })
    } catch (err) {
      // fts5 MATCH parsing errors (cas edge des caracteres speciaux non
      // echappes par buildFtsQuery) : return empty au lieu de crash.
      if (/fts5/i.test(err.message)) return { results: [] }
      throw err
    }

    return {
      results: rows.map((r) => ({
        repoId: r.repo_id,
        repoName: repoNames.get(r.repo_id) ?? 'Repo inconnu',
        chapterPath: r.chapter_path,
        chapterTitle: r.title,
        snippet: r.snippet,
        rank: r.rank,
      })),
    }
  }),
)

/**
 * Bascule la visibilite etudiante d'un repo (teacher/admin + responsable
 * de promo uniquement). Body : { visible: boolean }.
 */
const visibilitySchema = z.object({ visible: z.boolean() }).strict()

router.put(
  '/repos/:id/visibility',
  requireRole('teacher', 'admin'),
  requirePromoAdmin(promoFromRepoParam),
  validate(visibilitySchema),
  wrap(async (req) => {
    const repo = repoOrThrow(Number(req.params.id))
    setLumenRepoVisibility(repo.id, req.body.visible)
    return serializeRepo(getLumenRepo(repo.id))
  }),
)

// ─── Repos lies a un projet (integration bidirectionnelle) ──────────────────

/**
 * Liste les repos Lumen lies a un projet identifie par son nom (+ promoId).
 * Utilise cette version par-nom car le frontend Cursus manipule les projets
 * par category/name (legacy), pas par id numerique. Le matching reutilise
 * la normalisation findProjectByNormalizedName (case + trim + NFD).
 */
router.get(
  '/repos/by-project-name',
  requirePromo((req) => Number(req.query.promoId) || null),
  wrap(async (req) => {
    const promoId = Number(req.query.promoId)
    const name = String(req.query.name ?? '').trim()
    if (!name) return { repos: [] }
    // Filtre etudiant coherent avec /repos/promo/:id : un student ne doit pas
    // pouvoir decouvrir un repo masque via l'integration projets.
    const raw = getLumenReposByProjectName(promoId, name)
    const filtered = isStudent(req) ? raw.filter((r) => r.is_visible) : raw
    return { repos: filtered.map(serializeRepo) }
  }),
)

/**
 * Liste les repos d'une promo non encore lies a un projet. Utilise par le
 * picker UI fallback (teacher) pour proposer les candidats a la liaison.
 */
router.get(
  '/repos/promo/:promoId/unlinked',
  requireRole('teacher', 'admin'),
  requirePromoAdmin(promoFromParam),
  wrap(async (req) => {
    const promoId = Number(req.params.promoId)
    const repos = getUnlinkedLumenReposForPromo(promoId).map(serializeRepo)
    return { repos }
  }),
)

/**
 * Setter UI fallback : associe un repo a un projet. Teacher/admin uniquement.
 * Refuse si le manifest du repo declare deja un cursusProject (le yaml gagne).
 * Body : { projectId: number | null } — null pour delier.
 */
const setRepoProjectSchema = z.object({
  projectId: z.number().int().positive().nullable(),
}).strict()

router.put(
  '/repos/:id/project',
  requireRole('teacher', 'admin'),
  requirePromoAdmin(promoFromRepoParam),
  validate(setRepoProjectSchema),
  wrap(async (req) => {
    const repo = repoOrThrow(Number(req.params.id))

    // Protection : si le manifest declare deja un cursusProject, le yaml est
    // maitre et l'UI ne doit pas pouvoir ecraser la valeur.
    const manifest = parseManifestField(repo)
    if (manifest?.cursusProject) {
      throw new AppError(
        `Le manifest declare deja cursusProject: "${manifest.cursusProject}".`,
        409,
      )
    }

    // Verifie que le projectId appartient bien a la meme promo (securite).
    if (req.body.projectId !== null) {
      const project = getProjectById(req.body.projectId)
      if (!project || project.promo_id !== repo.promo_id) {
        throw new NotFoundError('Projet introuvable dans cette promo')
      }
    }

    setLumenRepoProject(repo.id, req.body.projectId)
    const updated = getLumenRepo(repo.id)
    return serializeRepo(updated)
  }),
)

// ─── Chapitres : contenu markdown ───────────────────────────────────────────

router.get(
  '/repos/:id/content',
  requirePromo(promoFromRepoParam),
  wrap(async (req) => {
    const repo = repoOrThrow(Number(req.params.id))
    if (isStudent(req) && !repo.is_visible) {
      throw new NotFoundError('Repo Lumen introuvable')
    }
    const path = String(req.query.path ?? '').trim()
    if (!path) throw new AppError('Parametre path requis', 400)

    // Securite : empeche de fetcher un fichier arbitraire du repo via
    // Lumen — seuls les chapitres declares dans le manifest sont servis,
    // PLUS leurs compagnons .pdf/.tex (v2.71) pour le toggle PDF/TeX.
    const manifest = parseManifestField(repo)
    const inManifest = manifest?.chapters?.some((c) =>
      c.path === path || c.companionPdf === path || c.companionTex === path,
    )
    if (!inManifest) throw new NotFoundError('Chapitre non declare dans le manifest')

    const key = userKey(req)
    const octokit = key ? await buildClientForUser(key.userType, key.userId) : null
    if (octokit) {
      try {
        const file = await fetchChapterContent(octokit, repo, path)
        if (!file) throw new NotFoundError('Fichier introuvable dans le repo')
        return { content: file.content, sha: file.sha, cached: false, kind: file.kind }
      } catch (err) {
        if (err.statusCode) throw err
        const cached = getCachedChapter(repo.id, path)
        if (cached) return cached
        throw await handleOctokit(err)
      }
    }

    const cached = getCachedChapter(repo.id, path)
    if (!cached) throw new AppError('Compte GitHub non connecte et pas de cache disponible', 401)
    return cached
  }),
)

// ─── Edition de fichier (v2.67) ──────────────────────────────────────────
//
// Reserve aux profs/admins. Permet de modifier un chapitre existant ou de
// creer un nouveau fichier dans un repo Lumen, directement depuis Cursus,
// sans passer par GitHub.com. Utilise l'octokit du prof connecte.
//
// Ces routes acceptent UNIQUEMENT des fichiers .md, .pdf et .tex (alignes
// sur ce que la sidebar / le viewer savent rendre). Les autres extensions
// sont rejetees pour eviter d'utiliser Lumen comme un client git generique.

const writeFileBodySchema = z.object({
  path: z.string().min(1).max(500).regex(
    /\.(md|pdf|tex)$/i,
    'Extension doit etre .md, .pdf ou .tex',
  ),
  content: z.string().max(2_000_000),  // 2 MB raw, garde-fou anti-bourrage
  message: z.string().max(200).optional(),
  sha: z.string().max(80).optional(),  // omit pour create, requis pour update
})

async function writeFileWithAuth(req, expectedSha) {
  const repo = repoOrThrow(Number(req.params.id))
  const octokit = await requireGithubClient(req)
  try {
    const result = await writeChapterFile(octokit, repo, {
      path: req.body.path,
      content: req.body.content,
      message: req.body.message,
      sha: expectedSha,
    })
    return { ok: true, ...result }
  } catch (err) {
    // 409 = conflit de SHA (qqn a edite entre temps)
    // 422 = creation refusee (file existe deja, ou path invalide)
    if (err.status === 409) throw new AppError('Conflit : le fichier a ete modifie depuis votre derniere lecture. Recharge le chapitre et reessaie.', 409)
    if (err.status === 422) throw new AppError(err.message ?? 'Operation refusee par GitHub', 422)
    throw await handleOctokit(err)
  }
}

router.put(
  '/repos/:id/file',
  requireRole('teacher', 'admin'),
  requirePromoAdmin(promoFromRepoParam),
  validate(writeFileBodySchema),
  wrap(async (req) => {
    if (!req.body.sha) throw new AppError('SHA requis pour une modification (sinon utiliser POST pour creer)', 400)
    return writeFileWithAuth(req, req.body.sha)
  }),
)

router.post(
  '/repos/:id/file',
  requireRole('teacher', 'admin'),
  requirePromoAdmin(promoFromRepoParam),
  validate(writeFileBodySchema),
  wrap(async (req) => {
    if (req.body.sha) throw new AppError('SHA interdit pour une creation (sinon utiliser PUT pour modifier)', 400)
    return writeFileWithAuth(req, undefined)
  }),
)

// ─── Reads tracking ─────────────────────────────────────────────────────────

router.post(
  '/repos/:id/read',
  requireRole('student'),
  requirePromo(promoFromRepoParam),
  validate(chapterPathSchema),
  wrap(async (req) => {
    const repoId = Number(req.params.id)
    try {
      markLumenChapterRead(req.user.id, repoId, req.body.path)
    } catch {
      // Echec du tracking silencieux — ne pas bloquer l'UX
    }
    return { ok: true }
  }),
)

router.get(
  '/my-reads',
  requireRole('student'),
  wrap(async (req) => {
    return { reads: getStudentLumenReads(req.user.id) ?? [] }
  }),
)

router.get(
  '/repos/:id/read-counts',
  requireRole('teacher', 'admin'),
  requirePromoAdmin(promoFromRepoParam),
  wrap(async (req) => {
    const repoId = Number(req.params.id)
    return { counts: getLumenReadCountsForRepo(repoId) }
  }),
)

router.get(
  '/read-counts/promo/:promoId',
  requireRole('teacher', 'admin'),
  requirePromoAdmin(promoFromParam),
  wrap(async (req) => {
    const promoId = Number(req.params.promoId)
    return { counts: getLumenReadCountsForPromo(promoId) }
  }),
)

// ─── Notes privees etudiant ─────────────────────────────────────────────────

router.get(
  '/repos/:id/note',
  requireRole('student'),
  requirePromo(promoFromRepoParam),
  wrap(async (req) => {
    const repoId = Number(req.params.id)
    const path = String(req.query.path ?? '').trim()
    if (!path) throw new AppError('Parametre path requis', 400)
    const note = getLumenChapterNote(req.user.id, repoId, path)
    return { note: note ?? null }
  }),
)

router.put(
  '/repos/:id/note',
  requireRole('student'),
  requirePromo(promoFromRepoParam),
  validate(noteSchema),
  wrap(async (req) => {
    const repoId = Number(req.params.id)
    const note = upsertLumenChapterNote(req.user.id, repoId, req.body.path, req.body.content)
    return { note }
  }),
)

router.delete(
  '/repos/:id/note',
  requireRole('student'),
  requirePromo(promoFromRepoParam),
  validate(chapterPathSchema),
  wrap(async (req) => {
    const repoId = Number(req.params.id)
    deleteLumenChapterNote(req.user.id, repoId, req.body.path)
    return { ok: true }
  }),
)

router.get(
  '/my-notes',
  requireRole('student'),
  wrap(async (req) => {
    return { notes: getStudentLumenNotes(req.user.id) }
  }),
)

router.get(
  '/my-noted-chapters',
  requireRole('student'),
  wrap(async (req) => {
    return { items: getStudentNotedChapters(req.user.id) }
  }),
)

// ─── Liaison devoirs <-> chapitres ──────────────────────────────────────────

const chapterTravailBodySchema = z.object({
  travailId: z.number().int().positive(),
  repoId: z.number().int().positive(),
  chapterPath: z.string().min(1).max(500),
}).strict()

/**
 * Liste les devoirs lies a un chapitre. Appele depuis LumenChapterViewer
 * pour afficher "Devoirs lies" en footer. Auth : requirePromo via le
 * repo (acces a son chapitre = acces au lien).
 */
router.get(
  '/repos/:id/chapters/travaux',
  requirePromo(promoFromRepoParam),
  wrap(async (req) => {
    const repoId = Number(req.params.id)
    const path = String(req.query.path ?? '').trim()
    if (!path) throw new AppError('Parametre path requis', 400)
    const travaux = getTravauxForChapter(repoId, path)
    return { travaux }
  }),
)

/**
 * Liste les chapitres lies a un devoir. Appele depuis la vue devoir
 * pour afficher "Chapitres a revoir". Auth : requirePromo via travail.
 */
router.get(
  '/travaux/:id/chapters',
  requirePromo(promoFromTravail),
  wrap(async (req) => {
    const travailId = Number(req.params.id)
    const chapters = getChaptersForTravail(travailId)
    return { chapters }
  }),
)

/**
 * Associe un chapitre a un devoir. Teacher/admin uniquement, verifie
 * que travail et repo appartiennent a la meme promo (impossible de
 * lier un chapitre promo A a un devoir promo B).
 */
router.post(
  '/chapters/travaux',
  requireRole('teacher', 'admin'),
  validate(chapterTravailBodySchema),
  wrap(async (req) => {
    const { travailId, repoId, chapterPath } = req.body
    const db = getDb()
    const travail = db.prepare('SELECT promo_id FROM travaux WHERE id = ?').get(travailId)
    const repo = getLumenRepo(repoId)
    if (!travail) throw new NotFoundError('Devoir introuvable')
    if (!repo) throw new NotFoundError('Repo introuvable')
    if (travail.promo_id !== repo.promo_id) {
      throw new AppError('Devoir et repo doivent appartenir a la meme promo', 400)
    }
    // Verifie que le chapitre est declare dans le manifest du repo
    const manifest = parseManifestField(repo)
    const exists = manifest?.chapters?.some((c) => c.path === chapterPath)
    if (!exists) throw new NotFoundError('Chapitre non declare dans le manifest')
    linkChapterToTravail(travailId, repoId, chapterPath)
    return { ok: true }
  }),
)

router.delete(
  '/chapters/travaux',
  requireRole('teacher', 'admin'),
  validate(chapterTravailBodySchema),
  wrap(async (req) => {
    const { travailId, repoId, chapterPath } = req.body
    unlinkChapterFromTravail(travailId, repoId, chapterPath)
    return { ok: true }
  }),
)

// ─── Stats ──────────────────────────────────────────────────────────────────

router.get(
  '/stats/promo/:promoId',
  requireRole('teacher', 'admin'),
  requirePromoAdmin(promoFromParam),
  wrap(async (req) => {
    return getLumenStatsForPromo(Number(req.params.promoId))
  }),
)

module.exports = router
