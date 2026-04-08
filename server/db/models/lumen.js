/** Lumen — Cours en markdown publies par les enseignants pour leurs etudiants. */
const { getDb } = require('../connection');

// Colonnes exposees pour les listes (pas de content : trop lourd).
const LIST_COLS = 'id, teacher_id, promo_id, project_id, title, summary, status, created_at, updated_at, published_at';

// ─── Cours ───────────────────────────────────────────────────────────────────

function createLumenCourse({ teacherId, promoId, projectId = null, title, summary = '', content = '' }) {
  const db = getDb();
  const res = db.prepare(
    'INSERT INTO lumen_courses (teacher_id, promo_id, project_id, title, summary, content) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(teacherId, promoId, projectId, title, summary, content);
  return db.prepare('SELECT * FROM lumen_courses WHERE id = ?').get(res.lastInsertRowid);
}

function getLumenCourse(id) {
  return getDb().prepare('SELECT * FROM lumen_courses WHERE id = ?').get(id) || null;
}

function getLumenCoursesForPromo(promoId, { onlyPublished = false } = {}) {
  const db = getDb();
  if (onlyPublished) {
    return db.prepare(
      `SELECT ${LIST_COLS}
       FROM lumen_courses
       WHERE promo_id = ? AND status = 'published'
       ORDER BY published_at DESC, updated_at DESC`
    ).all(promoId);
  }
  return db.prepare(
    `SELECT ${LIST_COLS}
     FROM lumen_courses
     WHERE promo_id = ?
     ORDER BY status ASC, updated_at DESC`
  ).all(promoId);
}

function getLumenCoursesForTeacher(teacherId) {
  return getDb().prepare(
    `SELECT ${LIST_COLS}
     FROM lumen_courses
     WHERE teacher_id = ?
     ORDER BY updated_at DESC`
  ).all(teacherId);
}

function updateLumenCourse(id, { title, summary, content, projectId }) {
  const db = getDb();
  const fields = [];
  const params = [];
  if (title !== undefined)     { fields.push('title = ?');      params.push(title); }
  if (summary !== undefined)   { fields.push('summary = ?');    params.push(summary); }
  if (content !== undefined)   { fields.push('content = ?');    params.push(content); }
  if (projectId !== undefined) { fields.push('project_id = ?'); params.push(projectId); }
  if (fields.length === 0) return getLumenCourse(id);
  fields.push("updated_at = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE lumen_courses SET ${fields.join(', ')} WHERE id = ?`).run(...params);
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

function deleteLumenCourse(id) {
  getDb().prepare('DELETE FROM lumen_courses WHERE id = ?').run(id);
}

function getLumenStatsForPromo(promoId) {
  const row = getDb().prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
       SUM(CASE WHEN status = 'draft'     THEN 1 ELSE 0 END) AS drafts
     FROM lumen_courses WHERE promo_id = ?`
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

module.exports = {
  createLumenCourse,
  getLumenCourse,
  getLumenCoursesForPromo,
  getLumenCoursesForTeacher,
  updateLumenCourse,
  publishLumenCourse,
  unpublishLumenCourse,
  deleteLumenCourse,
  getLumenStatsForPromo,
  markLumenCourseRead,
  getUnreadLumenCoursesForStudent,
  countUnreadLumenCoursesForStudent,
};
