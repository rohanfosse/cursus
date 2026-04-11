/**
 * Modele DB Lumen — liseuse de cours adossee a GitHub.
 *
 * Schema (v56) :
 *   lumen_github_auth   — token d'acces GitHub par utilisateur
 *   lumen_repos         — un repo de cours liee a une promo
 *   lumen_file_cache    — cache local des fichiers markdown fetches
 *   lumen_chapter_notes — notes privees etudiant (cle : student_id, repo_id, path)
 *   lumen_chapter_reads — tracking de lecture par chapitre
 */
const { getDb } = require('../connection')

// ─── GitHub auth ────────────────────────────────────────────────────────────

function getLumenGithubAuth(userType, userId) {
  return getDb().prepare(`
    SELECT user_type, user_id, github_login, access_token, scopes,
           created_at, updated_at
      FROM lumen_github_auth
     WHERE user_type = ? AND user_id = ?
  `).get(userType, userId) ?? null
}

function saveLumenGithubAuth(userType, userId, { githubLogin, accessToken, scopes = '' }) {
  getDb().prepare(`
    INSERT INTO lumen_github_auth (user_type, user_id, github_login, access_token, scopes, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_type, user_id) DO UPDATE SET
      github_login = excluded.github_login,
      access_token = excluded.access_token,
      scopes       = excluded.scopes,
      updated_at   = datetime('now')
  `).run(userType, userId, githubLogin, accessToken, scopes)
}

function deleteLumenGithubAuth(userType, userId) {
  getDb().prepare('DELETE FROM lumen_github_auth WHERE user_type = ? AND user_id = ?').run(userType, userId)
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

function getLumenReposForPromo(promoId) {
  return getDb().prepare(`
    SELECT id, promo_id, owner, repo, default_branch,
           manifest_json, manifest_error, last_commit_sha, last_synced_at,
           project_id, created_at, updated_at
      FROM lumen_repos
     WHERE promo_id = ?
     ORDER BY owner, repo
  `).all(promoId)
}

function getLumenRepo(id) {
  return getDb().prepare(`
    SELECT id, promo_id, owner, repo, default_branch,
           manifest_json, manifest_error, last_commit_sha, last_synced_at,
           project_id, created_at, updated_at
      FROM lumen_repos
     WHERE id = ?
  `).get(id) ?? null
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

/** Supprime les repos d'une promo absents de la liste fournie (housekeeping apres sync). */
function pruneLumenReposForPromo(promoId, keepIds) {
  if (!keepIds.length) {
    getDb().prepare('DELETE FROM lumen_repos WHERE promo_id = ?').run(promoId)
    return
  }
  const placeholders = keepIds.map(() => '?').join(',')
  getDb().prepare(`DELETE FROM lumen_repos WHERE promo_id = ? AND id NOT IN (${placeholders})`)
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
  // promo org
  getPromoGithubOrg,
  setPromoGithubOrg,
  // repos
  getLumenReposForPromo,
  getLumenRepo,
  upsertLumenRepo,
  updateLumenRepoManifest,
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
  // stats
  getLumenStatsForPromo,
}
