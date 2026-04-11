/**
 * Modele DB Lumen — liseuse de cours adossee a GitHub.
 *
 * Schema (v58) :
 *   lumen_github_auth     — token d'acces GitHub par utilisateur (chiffre AES-GCM)
 *   lumen_repos           — un repo de cours liee a une promo (+ is_visible v58)
 *   lumen_file_cache      — cache local des fichiers markdown fetches
 *   lumen_chapter_notes   — notes privees etudiant (cle : student_id, repo_id, path)
 *   lumen_chapter_reads   — tracking de lecture par chapitre
 *   lumen_chapter_travaux — liaison N:M chapitres <-> devoirs (v57)
 */
const { getDb } = require('../connection')
const { encrypt, decrypt } = require('../../utils/crypto')

// Liste des colonnes de lumen_repos partagee par toutes les requetes SELECT —
// extraire en constante evite de dropper une colonne dans une query lors d'une
// migration future (cf. v58 ou is_visible avait ete oublie dans 2 selects).
const LUMEN_REPO_COLUMNS = `
  id, promo_id, owner, repo, default_branch,
  manifest_json, manifest_error, last_commit_sha, last_synced_at,
  project_id, is_visible, created_at, updated_at
`

// ─── GitHub auth ────────────────────────────────────────────────────────────
//
// Les tokens d'acces GitHub sont sensibles : ils donnent acces a tous les
// repos de l'utilisateur dans le scope du PAT. On les chiffre avec AES-GCM
// (server/utils/crypto, derive de JWT_SECRET via pbkdf2). Le format
// stocke est `enc:<base64>` — les tokens en clair legacy (v2.32.x) sont
// detectes a la lecture et migres lazily au prochain write.

function getLumenGithubAuth(userType, userId) {
  const row = getDb().prepare(`
    SELECT user_type, user_id, github_login, access_token, scopes,
           created_at, updated_at
      FROM lumen_github_auth
     WHERE user_type = ? AND user_id = ?
  `).get(userType, userId) ?? null
  if (!row) return null
  const plainToken = decrypt(row.access_token)
  // Migration lazy : si le token etait en clair (legacy), on re-ecrit
  // la version chiffree en base.
  if (row.access_token && !row.access_token.startsWith('enc:') && plainToken === row.access_token) {
    getDb().prepare('UPDATE lumen_github_auth SET access_token = ? WHERE user_type = ? AND user_id = ?')
      .run(encrypt(plainToken), userType, userId)
  }
  return { ...row, access_token: plainToken }
}

function saveLumenGithubAuth(userType, userId, { githubLogin, accessToken, scopes = '' }) {
  const ciphertext = encrypt(accessToken)
  getDb().prepare(`
    INSERT INTO lumen_github_auth (user_type, user_id, github_login, access_token, scopes, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_type, user_id) DO UPDATE SET
      github_login = excluded.github_login,
      access_token = excluded.access_token,
      scopes       = excluded.scopes,
      updated_at   = datetime('now')
  `).run(userType, userId, githubLogin, ciphertext, scopes)
}

function deleteLumenGithubAuth(userType, userId) {
  getDb().prepare('DELETE FROM lumen_github_auth WHERE user_type = ? AND user_id = ?').run(userType, userId)
}

/**
 * Migration au boot : chiffre tous les tokens GitHub stockes en clair (legacy
 * v2.32.x). Appele une fois apres initSchema. Atomique via une transaction —
 * si un seul row echoue, rien n'est ecrit. Garde le code lazy de
 * getLumenGithubAuth en filet de securite mais il ne devrait plus jamais se
 * declencher en pratique apres ce boot.
 *
 * @returns {number} nombre de tokens migres (0 si tout etait deja chiffre)
 */
function migrateLumenTokensAtBoot() {
  const db = getDb()
  const rows = db.prepare(
    'SELECT user_type, user_id, access_token FROM lumen_github_auth'
  ).all()
  const legacy = rows.filter((r) => r.access_token && !String(r.access_token).startsWith('enc:'))
  if (!legacy.length) return 0

  const updateStmt = db.prepare(
    'UPDATE lumen_github_auth SET access_token = ? WHERE user_type = ? AND user_id = ?'
  )
  db.transaction(() => {
    for (const row of legacy) {
      updateStmt.run(encrypt(row.access_token), row.user_type, row.user_id)
    }
  })()
  return legacy.length
}

// ─── Promo ↔ GitHub org mapping ─────────────────────────────────────────────

function getPromoGithubOrg(promoId) {
  const row = getDb().prepare('SELECT github_org FROM promotions WHERE id = ?').get(promoId)
  return row?.github_org ?? null
}

function setPromoGithubOrg(promoId, org) {
  const value = org && org.trim() ? org.trim() : null
  getDb().prepare('UPDATE promotions SET github_org = ? WHERE id = ?').run(value, promoId)
}

// ─── Repos ──────────────────────────────────────────────────────────────────

/**
 * Liste les repos d'une promo. Si `visibleOnly` est true (vue etudiant),
 * filtre sur `is_visible = 1` — le prof decide explicitement quels repos
 * sont publies. Teachers/admins appellent avec false pour tout voir.
 */
function getLumenReposForPromo(promoId, { visibleOnly = false } = {}) {
  const where = visibleOnly ? 'WHERE promo_id = ? AND is_visible = 1' : 'WHERE promo_id = ?'
  return getDb().prepare(`
    SELECT ${LUMEN_REPO_COLUMNS}
      FROM lumen_repos
     ${where}
     ORDER BY owner, repo
  `).all(promoId)
}

function getLumenRepo(id) {
  return getDb().prepare(`
    SELECT ${LUMEN_REPO_COLUMNS}
      FROM lumen_repos
     WHERE id = ?
  `).get(id) ?? null
}

/**
 * Teacher/admin bascule la visibilite d'un repo pour les etudiants.
 * Renvoie la nouvelle valeur booleenne effective.
 */
function setLumenRepoVisibility(id, visible) {
  const value = visible ? 1 : 0
  getDb().prepare(
    'UPDATE lumen_repos SET is_visible = ?, updated_at = datetime(\'now\') WHERE id = ?'
  ).run(value, id)
  return Boolean(value)
}

function upsertLumenRepo({ promoId, owner, repo, defaultBranch = 'main' }) {
  const db = getDb()
  db.prepare(`
    INSERT INTO lumen_repos (promo_id, owner, repo, default_branch, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(promo_id, owner, repo) DO UPDATE SET
      default_branch = excluded.default_branch,
      updated_at     = datetime('now')
  `).run(promoId, owner, repo, defaultBranch)
  return db.prepare('SELECT * FROM lumen_repos WHERE promo_id = ? AND owner = ? AND repo = ?')
    .get(promoId, owner, repo)
}

function updateLumenRepoManifest(id, { manifestJson, manifestError, lastCommitSha }) {
  getDb().prepare(`
    UPDATE lumen_repos
       SET manifest_json   = ?,
           manifest_error  = ?,
           last_commit_sha = ?,
           last_synced_at  = datetime('now'),
           updated_at      = datetime('now')
     WHERE id = ?
  `).run(manifestJson ?? null, manifestError ?? null, lastCommitSha ?? null, id)
}

function deleteLumenRepo(id) {
  getDb().prepare('DELETE FROM lumen_repos WHERE id = ?').run(id)
}

/**
 * Ecrit project_id apres parsing du manifest.
 * - Si hasCursusProjectField est true, ecrit la valeur resolue (ou NULL
 *   si pas de match). Le manifest est maitre.
 * - Si hasCursusProjectField est false, on NE TOUCHE PAS project_id :
 *   il peut avoir ete pose via l'UI fallback, et l'absence du champ
 *   dans le yaml n'est pas une demande de deliaison (c'est juste un
 *   repo qui ne declare rien).
 */
function setLumenRepoProjectFromManifest(id, { projectId, hasCursusProjectField }) {
  if (!hasCursusProjectField) return
  getDb().prepare('UPDATE lumen_repos SET project_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(projectId, id)
}

/**
 * Setter UI fallback : un teacher associe manuellement un repo a un
 * projet depuis la vue projet. N'est pas appele si le manifest declare
 * deja un cursusProject (protection cote route).
 */
function setLumenRepoProject(id, projectId) {
  getDb().prepare('UPDATE lumen_repos SET project_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(projectId, id)
}

/**
 * Liste les repos d'une promo lies a un projet donne (par nom).
 * Le matching utilise la meme normalisation que findProjectByNormalizedName.
 * Retourne aussi le manifest JSON parse pour que le frontend puisse
 * afficher les chapitres directement.
 */
function getLumenReposByProjectName(promoId, projectName) {
  const { normalizeProjectName } = require('./projects')
  const normalized = normalizeProjectName(projectName)
  if (!normalized) return []
  // Note : on duplique la liste de colonnes ici car le JOIN demande l'alias r.,
  // on garde aligne avec LUMEN_REPO_COLUMNS pour eviter le drift.
  const rows = getDb().prepare(`
    SELECT r.id, r.promo_id, r.owner, r.repo, r.default_branch,
           r.manifest_json, r.manifest_error, r.last_commit_sha,
           r.last_synced_at, r.project_id, r.is_visible, r.created_at, r.updated_at,
           p.name AS project_name
      FROM lumen_repos r
      JOIN projects p ON p.id = r.project_id
     WHERE r.promo_id = ?
     ORDER BY r.owner, r.repo
  `).all(promoId)
  return rows.filter((r) => normalizeProjectName(r.project_name) === normalized)
}

/** Liste les repos d'une promo non encore lies a un projet (pour picker UI). */
function getUnlinkedLumenReposForPromo(promoId) {
  return getDb().prepare(`
    SELECT ${LUMEN_REPO_COLUMNS}
      FROM lumen_repos
     WHERE promo_id = ? AND project_id IS NULL
     ORDER BY owner, repo
  `).all(promoId)
}

/**
 * Supprime les repos d'une promo absents de la liste fournie (housekeeping
 * apres sync).
 *
 * Si `snapshotIds` est fourni, le prune ne touche QUE les repos dont l'id
 * etait deja en DB au debut du sync (snapshot pris avant `listOrgRepos`).
 * Cela evite la race ou un repo cree via "Nouveau cours" pendant le sync se
 * fait pruner parce qu'il n'est pas dans le `keepIds` issu de l'API GitHub.
 *
 * @param {number} promoId
 * @param {number[]} keepIds — repos a preserver (issus du sync)
 * @param {number[]} [snapshotIds] — optionnel, ids deja en DB au debut du sync
 */
function pruneLumenReposForPromo(promoId, keepIds, snapshotIds) {
  const db = getDb()

  if (snapshotIds) {
    // Mode safe : ne supprime que les repos qui etaient deja en DB ET qui ne
    // sont plus dans la liste sync. Les nouveaux repos crees pendant le sync
    // (id non dans snapshot) sont preserves.
    const toDelete = snapshotIds.filter((id) => !keepIds.includes(id))
    if (!toDelete.length) return
    const placeholders = toDelete.map(() => '?').join(',')
    db.prepare(`DELETE FROM lumen_repos WHERE promo_id = ? AND id IN (${placeholders})`)
      .run(promoId, ...toDelete)
    return
  }

  // Mode legacy : supprime tout ce qui n'est pas dans keepIds (utilise pour
  // les chemins ou il n'y a pas de race possible).
  if (!keepIds.length) {
    db.prepare('DELETE FROM lumen_repos WHERE promo_id = ?').run(promoId)
    return
  }
  const placeholders = keepIds.map(() => '?').join(',')
  db.prepare(`DELETE FROM lumen_repos WHERE promo_id = ? AND id NOT IN (${placeholders})`)
    .run(promoId, ...keepIds)
}

// ─── File cache ─────────────────────────────────────────────────────────────

function getLumenCachedFile(repoId, path) {
  return getDb().prepare(`
    SELECT repo_id, path, sha, content, fetched_at
      FROM lumen_file_cache
     WHERE repo_id = ? AND path = ?
  `).get(repoId, path) ?? null
}

function upsertLumenCachedFile(repoId, path, sha, content) {
  getDb().prepare(`
    INSERT INTO lumen_file_cache (repo_id, path, sha, content, fetched_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(repo_id, path) DO UPDATE SET
      sha        = excluded.sha,
      content    = excluded.content,
      fetched_at = datetime('now')
  `).run(repoId, path, sha, content)
}

function clearLumenFileCacheForRepo(repoId) {
  getDb().prepare('DELETE FROM lumen_file_cache WHERE repo_id = ?').run(repoId)
}

/**
 * Supprime les entrees du cache dont le path n'est plus reference par
 * le manifest d'un repo (apres un sync qui a retire des chapitres).
 * Si keepPaths est vide, ne touche a rien — le manifest est absent ou
 * invalide et on ne veut pas purger un cache qui pourrait encore servir.
 */
function pruneLumenFileCacheForRepo(repoId, keepPaths) {
  if (!keepPaths.length) return
  const placeholders = keepPaths.map(() => '?').join(',')
  getDb().prepare(`DELETE FROM lumen_file_cache WHERE repo_id = ? AND path NOT IN (${placeholders})`)
    .run(repoId, ...keepPaths)
}

/**
 * Purge les entrees du cache globalement obsoletes (> 30 jours).
 * Appele periodiquement (au syncPromoRepos par exemple) pour eviter
 * une croissance non-bornee sur des repos actifs ou des chapitres
 * jamais ouverts par personne.
 */
function purgeStaleLumenFileCache(days = 30) {
  getDb().prepare(`DELETE FROM lumen_file_cache WHERE fetched_at < datetime('now', ?)`)
    .run(`-${days} days`)
}

// ─── Notes ──────────────────────────────────────────────────────────────────

const NOTE_MAX_LEN = 10_000

function getLumenChapterNote(studentId, repoId, path) {
  return getDb().prepare(`
    SELECT student_id, repo_id, path, content, created_at, updated_at
      FROM lumen_chapter_notes
     WHERE student_id = ? AND repo_id = ? AND path = ?
  `).get(studentId, repoId, path) ?? null
}

function upsertLumenChapterNote(studentId, repoId, path, content) {
  const safe = typeof content === 'string' ? content.slice(0, NOTE_MAX_LEN) : ''
  getDb().prepare(`
    INSERT INTO lumen_chapter_notes (student_id, repo_id, path, content, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(student_id, repo_id, path) DO UPDATE SET
      content    = excluded.content,
      updated_at = datetime('now')
  `).run(studentId, repoId, path, safe)
  return getLumenChapterNote(studentId, repoId, path)
}

function deleteLumenChapterNote(studentId, repoId, path) {
  getDb().prepare('DELETE FROM lumen_chapter_notes WHERE student_id = ? AND repo_id = ? AND path = ?')
    .run(studentId, repoId, path)
}

function getStudentLumenNotes(studentId) {
  return getDb().prepare(`
    SELECT n.student_id, n.repo_id, n.path, n.content, n.updated_at,
           r.owner, r.repo, r.manifest_json
      FROM lumen_chapter_notes n
      JOIN lumen_repos r ON r.id = n.repo_id
     WHERE n.student_id = ?
       AND n.content != ''
     ORDER BY r.owner, r.repo, n.path
  `).all(studentId)
}

function getStudentNotedChapters(studentId) {
  return getDb().prepare(`
    SELECT repo_id, path
      FROM lumen_chapter_notes
     WHERE student_id = ? AND content != ''
  `).all(studentId)
}

// ─── Reads (tracking) ────────────────────────────────────────────────────────

function markLumenChapterRead(studentId, repoId, path) {
  getDb().prepare(`
    INSERT INTO lumen_chapter_reads (student_id, repo_id, path, read_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(student_id, repo_id, path) DO UPDATE SET read_at = datetime('now')
  `).run(studentId, repoId, path)
}

function getStudentLumenReads(studentId) {
  return getDb().prepare(`
    SELECT repo_id, path, read_at
      FROM lumen_chapter_reads
     WHERE student_id = ?
  `).all(studentId)
}

function getLumenReadCountsForRepo(repoId) {
  return getDb().prepare(`
    SELECT path, COUNT(DISTINCT student_id) AS readers
      FROM lumen_chapter_reads
     WHERE repo_id = ?
     GROUP BY path
  `).all(repoId)
}

function getLumenReadCountsForPromo(promoId) {
  return getDb().prepare(`
    SELECT cr.repo_id, cr.path, COUNT(DISTINCT cr.student_id) AS readers
      FROM lumen_chapter_reads cr
      JOIN lumen_repos r ON r.id = cr.repo_id
     WHERE r.promo_id = ?
     GROUP BY cr.repo_id, cr.path
  `).all(promoId)
}

// ─── Liaison devoirs <-> chapitres ──────────────────────────────────────────

/**
 * Associe un chapitre a un devoir. Idempotent via INSERT OR IGNORE :
 * appeler plusieurs fois avec les memes args ne provoque pas d'erreur.
 */
function linkChapterToTravail(travailId, repoId, chapterPath) {
  getDb().prepare(`
    INSERT OR IGNORE INTO lumen_chapter_travaux (travail_id, repo_id, chapter_path)
    VALUES (?, ?, ?)
  `).run(travailId, repoId, chapterPath)
}

function unlinkChapterFromTravail(travailId, repoId, chapterPath) {
  getDb().prepare(`
    DELETE FROM lumen_chapter_travaux
     WHERE travail_id = ? AND repo_id = ? AND chapter_path = ?
  `).run(travailId, repoId, chapterPath)
}

/**
 * Liste les devoirs lies a un chapitre donne, avec leurs metadonnees
 * essentielles (id, titre, deadline, type). Utilise pour afficher
 * "Ce chapitre est utilise dans X devoirs" sous LumenChapterViewer.
 */
function getTravauxForChapter(repoId, chapterPath) {
  return getDb().prepare(`
    SELECT t.id, t.title, t.deadline, t.type, t.category, t.promo_id, t.published
      FROM lumen_chapter_travaux lct
      JOIN travaux t ON t.id = lct.travail_id
     WHERE lct.repo_id = ? AND lct.chapter_path = ?
     ORDER BY t.deadline ASC NULLS LAST
  `).all(repoId, chapterPath)
}

/**
 * Liste les chapitres lies a un devoir, avec les metadonnees du repo
 * (owner, repo, manifest_json) pour permettre au frontend d'afficher
 * le titre humain du chapitre depuis le manifest.
 */
function getChaptersForTravail(travailId) {
  return getDb().prepare(`
    SELECT lct.travail_id, lct.repo_id, lct.chapter_path, lct.created_at,
           r.owner, r.repo, r.manifest_json
      FROM lumen_chapter_travaux lct
      JOIN lumen_repos r ON r.id = lct.repo_id
     WHERE lct.travail_id = ?
     ORDER BY r.owner, r.repo, lct.chapter_path
  `).all(travailId)
}

/** Compte des devoirs lies par chapitre pour un repo (widget / stats). */
function getChapterTravailCountsForRepo(repoId) {
  return getDb().prepare(`
    SELECT chapter_path, COUNT(*) AS count
      FROM lumen_chapter_travaux
     WHERE repo_id = ?
     GROUP BY chapter_path
  `).all(repoId)
}

// ─── Stats ──────────────────────────────────────────────────────────────────

function getLumenStatsForPromo(promoId) {
  const db = getDb()
  const { repos } = db.prepare('SELECT COUNT(*) AS repos FROM lumen_repos WHERE promo_id = ?').get(promoId)
  const { reads } = db.prepare(`
    SELECT COUNT(*) AS reads
      FROM lumen_chapter_reads cr
      JOIN lumen_repos r ON r.id = cr.repo_id
     WHERE r.promo_id = ?
  `).get(promoId)
  return { repos, reads }
}

module.exports = {
  // auth
  getLumenGithubAuth,
  saveLumenGithubAuth,
  deleteLumenGithubAuth,
  migrateLumenTokensAtBoot,
  // promo org
  getPromoGithubOrg,
  setPromoGithubOrg,
  // repos
  getLumenReposForPromo,
  getLumenRepo,
  upsertLumenRepo,
  updateLumenRepoManifest,
  setLumenRepoProjectFromManifest,
  setLumenRepoProject,
  setLumenRepoVisibility,
  getLumenReposByProjectName,
  getUnlinkedLumenReposForPromo,
  deleteLumenRepo,
  pruneLumenReposForPromo,
  // file cache
  getLumenCachedFile,
  upsertLumenCachedFile,
  clearLumenFileCacheForRepo,
  pruneLumenFileCacheForRepo,
  purgeStaleLumenFileCache,
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
  // chapter-travaux liaison
  linkChapterToTravail,
  unlinkChapterFromTravail,
  getTravauxForChapter,
  getChaptersForTravail,
  getChapterTravailCountsForRepo,
  // stats
  getLumenStatsForPromo,
}
