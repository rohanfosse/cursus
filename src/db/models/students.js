const { getDb } = require('../connection');

function getStudents(promoId) {
  return getDb().prepare(
    'SELECT * FROM students WHERE promo_id = ? ORDER BY name'
  ).all(promoId);
}

function getAllStudents() {
  return getDb().prepare(`
    SELECT s.*, p.name AS promo_name, p.color AS promo_color
    FROM students s JOIN promotions p ON s.promo_id = p.id
    ORDER BY p.name, s.name
  `).all();
}

function getStudentProfile(studentId) {
  const db = getDb();

  const student = db.prepare(`
    SELECT s.*, p.name AS promo_name, p.color AS promo_color
    FROM students s JOIN promotions p ON s.promo_id = p.id
    WHERE s.id = ?
  `).get(studentId);

  const travaux = db.prepare(`
    SELECT t.id, t.title, t.deadline,
      ch.name AS channel_name,
      d.id AS depot_id, d.file_name, d.note, d.feedback, d.submitted_at
    FROM channels ch
    JOIN students s  ON s.promo_id = ch.promo_id
    JOIN travaux t   ON t.channel_id = ch.id
    LEFT JOIN depots d ON d.travail_id = t.id AND d.student_id = s.id
    WHERE s.id = ?
    ORDER BY t.deadline DESC
  `).all(studentId);

  return { student, travaux };
}

function getStudentByEmail(email) {
  return getDb().prepare(`
    SELECT s.*, p.name AS promo_name
    FROM students s JOIN promotions p ON s.promo_id = p.id
    WHERE s.email = ?
  `).get(email);
}

function loginWithCredentials(email, password) {
  const TEACHER_EMAIL    = 'rohan.fosse@cesi.fr';
  const TEACHER_PASSWORD = 'admin';
  if (email.trim().toLowerCase() === TEACHER_EMAIL && password === TEACHER_PASSWORD) {
    return { id: 0, name: 'Rohan Fosse', avatar_initials: 'RF', photo_data: null, type: 'teacher', promo_name: null, promo_id: null };
  }
  return getDb().prepare(`
    SELECT s.id, s.name, s.email, s.avatar_initials, s.photo_data, 'student' AS type,
           p.name AS promo_name, p.id AS promo_id
    FROM students s JOIN promotions p ON s.promo_id = p.id
    WHERE LOWER(s.email) = LOWER(?) AND s.password = ?
  `).get(email.trim(), password) ?? null;
}

function registerStudent({ name, email, promoId, photoData, password }) {
  const db       = getDb();
  const existing = db.prepare('SELECT id FROM students WHERE email = ?').get(email);
  if (existing) throw new Error('Cette adresse email est deja utilisee.');

  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const pwd      = (password ?? '').trim() || 'cesi1234';
  return db.prepare(`
    INSERT INTO students (promo_id, name, email, avatar_initials, photo_data, password)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(promoId, name.trim(), email.trim().toLowerCase(), initials, photoData ?? null, pwd);
}

function getIdentities() {
  const students = getDb().prepare(`
    SELECT s.id, s.name, s.avatar_initials, s.photo_data, 'student' AS type,
           p.name AS promo_name, p.id AS promo_id
    FROM students s JOIN promotions p ON s.promo_id = p.id
    ORDER BY p.name, s.name
  `).all();

  const teacher = { id: 0, name: 'Rohan Fosse', avatar_initials: 'RF', photo_data: null, type: 'teacher', promo_name: null, promo_id: null };
  return [teacher, ...students];
}

module.exports = {
  getStudents, getAllStudents, getStudentProfile,
  getStudentByEmail, loginWithCredentials, registerStudent, getIdentities,
};
