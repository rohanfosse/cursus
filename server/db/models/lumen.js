/** Lumen — Cours en markdown publies par les enseignants pour leurs etudiants. */
const { getDb } = require('../connection');

// Colonnes exposees pour les listes (pas de content ni repo_snapshot : trop lourds).
// On inclut les metadonnees du snapshot (url, sha, branch, timestamp) mais jamais
// le JSON complet du snapshot — ca peut monter a 5 Mo et on n'en a besoin que pour
// la lecture d'un cours precis.
const LIST_COLS = [
  'id', 'teacher_id', 'promo_id', 'project_id',
  'title', 'summary', 'status',
  'created_at', 'updated_at', 'published_at',
  'repo_url', 'repo_commit_sha', 'repo_default_branch', 'repo_snapshot_at',
].join(', ');

// ─── Cours ───────────────────────────────────────────────────────────────────

function createLumenCourse({ teacherId, promoId, projectId = null, title, summary = '', content = '', repoUrl = null }) {
  const db = getDb();
  const res = db.prepare(
    'INSERT INTO lumen_courses (teacher_id, promo_id, project_id, title, summary, content, repo_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(teacherId, promoId, projectId, title, summary, content, repoUrl);
  return db.prepare('SELECT * FROM lumen_courses WHERE id = ?').get(res.lastInsertRowid);
}

function getLumenCourse(id) {
  // Recupere un cours meme s'il est soft-deleted (pour la restauration).
  // Les lectures etudiantes passent par getLumenCoursesForPromo qui exclut
  // automatiquement les cours deleted_at != NULL.
  return getDb().prepare('SELECT * FROM lumen_courses WHERE id = ?').get(id) || null;
}

function getLumenCoursesForPromo(promoId, { onlyPublished = false } = {}) {
  const db = getDb();
  if (onlyPublished) {
    return db.prepare(
      `SELECT ${LIST_COLS}
       FROM lumen_courses
       WHERE promo_id = ? AND status = 'published' AND deleted_at IS NULL
       ORDER BY published_at DESC, updated_at DESC`
    ).all(promoId);
  }
  return db.prepare(
    `SELECT ${LIST_COLS}
     FROM lumen_courses
     WHERE promo_id = ? AND deleted_at IS NULL
     ORDER BY status ASC, updated_at DESC`
  ).all(promoId);
}

function getLumenCoursesForTeacher(teacherId) {
  return getDb().prepare(
    `SELECT ${LIST_COLS}
     FROM lumen_courses
     WHERE teacher_id = ? AND deleted_at IS NULL
     ORDER BY updated_at DESC`
  ).all(teacherId);
}

/**
 * Liste les cours soft-deleted d'un teacher (pour la corbeille).
 * Les cours restent restorables pendant 30 jours (purge manuelle ou
 * automatique a implementer cote scheduler).
 */
function getTrashedLumenCoursesForTeacher(teacherId) {
  return getDb().prepare(
    `SELECT ${LIST_COLS}, deleted_at
     FROM lumen_courses
     WHERE teacher_id = ? AND deleted_at IS NOT NULL
     ORDER BY deleted_at DESC`
  ).all(teacherId);
}

function updateLumenCourse(id, { title, summary, content, projectId, repoUrl }) {
  const db = getDb();
  const fields = [];
  const params = [];
  if (title !== undefined)     { fields.push('title = ?');      params.push(title); }
  if (summary !== undefined)   { fields.push('summary = ?');    params.push(summary); }
  if (content !== undefined)   { fields.push('content = ?');    params.push(content); }
  if (projectId !== undefined) { fields.push('project_id = ?'); params.push(projectId); }
  if (repoUrl !== undefined)   { fields.push('repo_url = ?');   params.push(repoUrl); }
  if (fields.length === 0) return getLumenCourse(id);
  fields.push("updated_at = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE lumen_courses SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return getLumenCourse(id);
}

// ─── Snapshot d'un repo git d'exemple ────────────────────────────────────────

/**
 * Ecrit le snapshot JSON complet d'un cours (fichiers + contenu base64).
 * Atomic : remplace entierement le snapshot existant.
 */
function setLumenCourseSnapshot(id, { url, snapshot, commitSha, defaultBranch }) {
  const db = getDb();
  const json = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);
  db.prepare(
    `UPDATE lumen_courses
       SET repo_url = ?,
           repo_snapshot = ?,
           repo_commit_sha = ?,
           repo_default_branch = ?,
           repo_snapshot_at = datetime('now'),
           updated_at = datetime('now')
     WHERE id = ?`
  ).run(url, json, commitSha, defaultBranch, id);
  return getLumenCourse(id);
}

/** Retourne le snapshot JSON parse, ou null si aucun snapshot. */
function getLumenCourseSnapshot(id) {
  const row = getDb().prepare('SELECT repo_snapshot FROM lumen_courses WHERE id = ?').get(id);
  if (!row?.repo_snapshot) return null;
  try { return JSON.parse(row.repo_snapshot); }
  catch { return null; }
}

/** Efface le snapshot d'un cours (ex : URL remise a null). */
function clearLumenCourseSnapshot(id) {
  getDb().prepare(
    `UPDATE lumen_courses
       SET repo_snapshot = NULL,
           repo_commit_sha = NULL,
           repo_default_branch = NULL,
           repo_snapshot_at = NULL,
           updated_at = datetime('now')
     WHERE id = ?`
  ).run(id);
  return getLumenCourse(id);
}

/**
 * Publie un cours et signale si c'est la PREMIERE publication
 * (published_at etait NULL avant). Utilise par la route publish pour
 * declencher une notification chat uniquement au premier passage en publie.
 */
function publishLumenCourse(id) {
  const db = getDb();
  const before = db.prepare('SELECT published_at FROM lumen_courses WHERE id = ?').get(id);
  const isFirstPublish = !before?.published_at;
  db.prepare(
    "UPDATE lumen_courses SET status = 'published', published_at = COALESCE(published_at, datetime('now')), updated_at = datetime('now') WHERE id = ?"
  ).run(id);
  const course = getLumenCourse(id);
  return { course, isFirstPublish };
}

function unpublishLumenCourse(id) {
  const db = getDb();
  db.prepare(
    "UPDATE lumen_courses SET status = 'draft', updated_at = datetime('now') WHERE id = ?"
  ).run(id);
  return getLumenCourse(id);
}

/**
 * Soft delete : le cours passe en corbeille (deleted_at = now). Les etudiants
 * ne le voient plus, mais le teacher peut le restaurer via restoreLumenCourse.
 * Apres 30 jours, un job scheduler peut appeler purgeLumenCourse pour le
 * supprimer definitivement. Retourne le cours a jour.
 */
function deleteLumenCourse(id) {
  const db = getDb();
  db.prepare(
    `UPDATE lumen_courses
       SET deleted_at = datetime('now'),
           updated_at = datetime('now')
     WHERE id = ? AND deleted_at IS NULL`
  ).run(id);
  return getLumenCourse(id);
}

/** Restaure un cours soft-deleted en remettant deleted_at a NULL. */
function restoreLumenCourse(id) {
  const db = getDb();
  db.prepare(
    `UPDATE lumen_courses
       SET deleted_at = NULL,
           updated_at = datetime('now')
     WHERE id = ?`
  ).run(id);
  return getLumenCourse(id);
}

/**
 * Suppression definitive (hard delete). Utilise par le teacher pour vider
 * manuellement la corbeille, ou par un job scheduler apres 30 jours.
 */
function purgeLumenCourse(id) {
  getDb().prepare('DELETE FROM lumen_courses WHERE id = ?').run(id);
}

function getLumenStatsForPromo(promoId) {
  const row = getDb().prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
       SUM(CASE WHEN status = 'draft'     THEN 1 ELSE 0 END) AS drafts
     FROM lumen_courses WHERE promo_id = ? AND deleted_at IS NULL`
  ).get(promoId);
  return {
    total:     row?.total ?? 0,
    published: row?.published ?? 0,
    drafts:    row?.drafts ?? 0,
  };
}

// ─── Tracking lecture etudiant ───────────────────────────────────────────────

/** Marque un cours comme lu par un etudiant (idempotent). */
function markLumenCourseRead(studentId, courseId) {
  return getDb().prepare(
    `INSERT INTO lumen_course_reads (student_id, course_id, read_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(student_id, course_id) DO UPDATE SET read_at = excluded.read_at`
  ).run(studentId, courseId);
}

/**
 * Marque tous les cours publies d'une promo comme lus pour un etudiant.
 * Utilise par le bouton "Tout marquer comme lu" cote etudiant.
 * Retourne le nombre de cours marques comme lus (delta avant/apres).
 */
function markAllLumenCoursesRead(studentId, promoId) {
  const db = getDb();
  const res = db.prepare(
    `INSERT OR IGNORE INTO lumen_course_reads (student_id, course_id, read_at)
     SELECT ?, c.id, datetime('now')
     FROM lumen_courses c
     WHERE c.promo_id = ? AND c.status = 'published'
       AND NOT EXISTS (
         SELECT 1 FROM lumen_course_reads r
         WHERE r.student_id = ? AND r.course_id = c.id
       )`
  ).run(studentId, promoId, studentId);
  return res.changes;
}

/**
 * Retourne le nombre de lectures distinctes d'un cours (etudiants uniques
 * qui l'ont ouvert au moins une fois). Utilise par le dashboard prof
 * pour voir l'engagement par cours.
 */
function getLumenCourseReadCount(courseId) {
  const row = getDb().prepare(
    `SELECT COUNT(DISTINCT student_id) AS n
     FROM lumen_course_reads
     WHERE course_id = ?`
  ).get(courseId);
  return row?.n ?? 0;
}

/**
 * Meme chose mais en batch pour eviter N+1 : retourne un map {courseId → count}
 * pour tous les cours d'une promo.
 */
function getLumenReadCountsForPromo(promoId) {
  const rows = getDb().prepare(
    `SELECT r.course_id, COUNT(DISTINCT r.student_id) AS n
     FROM lumen_course_reads r
     JOIN lumen_courses c ON c.id = r.course_id
     WHERE c.promo_id = ?
     GROUP BY r.course_id`
  ).all(promoId);
  const out = {};
  for (const row of rows) out[row.course_id] = row.n;
  return out;
}

/**
 * Retourne les cours publies non-lus par un etudiant pour une promo.
 * Exclut les cours dont l'etudiant est (theoriquement) lui-meme auteur — en
 * pratique un etudiant ne publie rien mais on filtre par securite.
 */
function getUnreadLumenCoursesForStudent(studentId, promoId) {
  return getDb().prepare(
    `SELECT ${LIST_COLS}
     FROM lumen_courses c
     WHERE c.promo_id = ?
       AND c.status = 'published'
       AND NOT EXISTS (
         SELECT 1 FROM lumen_course_reads r
         WHERE r.student_id = ? AND r.course_id = c.id
       )
     ORDER BY c.published_at DESC, c.updated_at DESC`
  ).all(promoId, studentId);
}

function countUnreadLumenCoursesForStudent(studentId, promoId) {
  const row = getDb().prepare(
    `SELECT COUNT(*) AS n
     FROM lumen_courses c
     WHERE c.promo_id = ?
       AND c.status = 'published'
       AND NOT EXISTS (
         SELECT 1 FROM lumen_course_reads r
         WHERE r.student_id = ? AND r.course_id = c.id
       )`
  ).get(promoId, studentId);
  return row?.n ?? 0;
}

// ─── Notes privees etudiant sur un cours ────────────────────────────────────

/**
 * Recupere la note d'un etudiant pour un cours. Retourne null si pas de
 * note encore ecrite (pas une chaine vide — permet au frontend de
 * distinguer "jamais prise" de "note vide volontairement").
 */
function getLumenCourseNote(studentId, courseId) {
  const row = getDb().prepare(
    `SELECT student_id, course_id, content, created_at, updated_at
     FROM lumen_course_notes
     WHERE student_id = ? AND course_id = ?`
  ).get(studentId, courseId);
  return row || null;
}

/**
 * Upsert idempotent. Limite a 10_000 caracteres pour eviter les abus.
 * Le timestamp updated_at est toujours rafraichi pour permettre au
 * frontend d'afficher "modifie il y a N min".
 */
function upsertLumenCourseNote(studentId, courseId, content) {
  const trimmed = typeof content === 'string' ? content.slice(0, 10_000) : '';
  const db = getDb();
  db.prepare(
    `INSERT INTO lumen_course_notes (student_id, course_id, content, created_at, updated_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(student_id, course_id) DO UPDATE
       SET content = excluded.content,
           updated_at = datetime('now')`
  ).run(studentId, courseId, trimmed);
  return getLumenCourseNote(studentId, courseId);
}

function deleteLumenCourseNote(studentId, courseId) {
  getDb().prepare(
    'DELETE FROM lumen_course_notes WHERE student_id = ? AND course_id = ?'
  ).run(studentId, courseId);
}

/**
 * Retourne la liste des IDs de cours ayant une note non vide pour cet etudiant.
 * Utilise par le frontend pour afficher un indicateur sur les course cards
 * sans avoir a fetcher le contenu de chaque note (la vraie note reste privee
 * et n'est chargee qu'a l'ouverture du reader).
 */
function getStudentNotedCourseIds(studentId) {
  const rows = getDb().prepare(
    `SELECT course_id
     FROM lumen_course_notes
     WHERE student_id = ?
       AND length(trim(content)) > 0`
  ).all(studentId);
  return rows.map(r => r.course_id);
}

/**
 * Retourne toutes les notes non vides d'un etudiant avec le titre du cours
 * associe, triees par date de mise a jour. Utilise pour l'export .md.
 */
function getStudentNotesWithCourseTitles(studentId) {
  return getDb().prepare(
    `SELECT n.course_id, n.content, n.created_at, n.updated_at,
            c.title AS course_title, c.summary AS course_summary
     FROM lumen_course_notes n
     JOIN lumen_courses c ON c.id = n.course_id
     WHERE n.student_id = ?
       AND length(trim(n.content)) > 0
     ORDER BY n.updated_at DESC`
  ).all(studentId);
}

module.exports = {
  createLumenCourse,
  getLumenCourse,
  getLumenCoursesForPromo,
  getLumenCoursesForTeacher,
  updateLumenCourse,
  publishLumenCourse,
  unpublishLumenCourse,
  deleteLumenCourse,
  restoreLumenCourse,
  purgeLumenCourse,
  getTrashedLumenCoursesForTeacher,
  getLumenStatsForPromo,
  setLumenCourseSnapshot,
  getLumenCourseSnapshot,
  clearLumenCourseSnapshot,
  markLumenCourseRead,
  markAllLumenCoursesRead,
  getLumenCourseReadCount,
  getLumenReadCountsForPromo,
  getUnreadLumenCoursesForStudent,
  countUnreadLumenCoursesForStudent,
  getLumenCourseNote,
  upsertLumenCourseNote,
  deleteLumenCourseNote,
  getStudentNotedCourseIds,
  getStudentNotesWithCourseTitles,
};
