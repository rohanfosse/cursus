/** Carnet de suivi — notes privees du professeur sur les etudiants. */
const { getDb } = require('../connection');

function getNotesByStudent(studentId, teacherId) {
  return getDb().prepare(`
    SELECT tn.*, s.name AS student_name
    FROM teacher_notes tn
    JOIN students s ON s.id = tn.student_id
    WHERE tn.student_id = ? AND tn.teacher_id = ?
    ORDER BY tn.created_at DESC
  `).all(studentId, teacherId);
}

function getNotesByPromo(promoId, teacherId) {
  return getDb().prepare(`
    SELECT tn.*, s.name AS student_name
    FROM teacher_notes tn
    JOIN students s ON s.id = tn.student_id
    WHERE tn.promo_id = ? AND tn.teacher_id = ?
    ORDER BY tn.created_at DESC
  `).all(promoId, teacherId);
}

function getNotesCountByStudent(promoId, teacherId) {
  return getDb().prepare(`
    SELECT tn.student_id, COUNT(*) as count,
           MAX(tn.created_at) as last_note_at,
           s.name AS student_name
    FROM teacher_notes tn
    JOIN students s ON s.id = tn.student_id
    WHERE tn.promo_id = ? AND tn.teacher_id = ?
    GROUP BY tn.student_id
    ORDER BY s.name ASC
  `).all(promoId, teacherId);
}

function createNote({ teacherId, studentId, promoId, content, tag }) {
  const db = getDb();
  const res = db.prepare(
    'INSERT INTO teacher_notes (teacher_id, student_id, promo_id, content, tag) VALUES (?, ?, ?, ?, ?)'
  ).run(teacherId, studentId, promoId, content, tag ?? 'observation');
  return db.prepare('SELECT * FROM teacher_notes WHERE id = ?').get(res.lastInsertRowid);
}

function updateNote(id, { content, tag }) {
  const db = getDb();
  db.prepare(
    "UPDATE teacher_notes SET content = ?, tag = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(content, tag, id);
  return db.prepare('SELECT * FROM teacher_notes WHERE id = ?').get(id);
}

function deleteNote(id) {
  return getDb().prepare('DELETE FROM teacher_notes WHERE id = ?').run(id);
}

module.exports = {
  getNotesByStudent,
  getNotesByPromo,
  getNotesCountByStudent,
  createNote,
  updateNote,
  deleteNote,
};
