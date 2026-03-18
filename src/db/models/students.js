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
  // Vérifie d'abord la table teachers (rôles teacher + ta)
  const teacher = getDb().prepare(
    'SELECT * FROM teachers WHERE LOWER(email) = LOWER(?) AND password = ?'
  ).get(email.trim(), password);
  if (teacher) {
    const initials = teacher.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
    return {
      id:              -(teacher.id),  // IDs négatifs pour distinguer des étudiants
      name:            teacher.name,
      avatar_initials: initials,
      photo_data:      null,
      type:            teacher.role,   // 'teacher' ou 'ta'
      promo_name:      null,
      promo_id:        null,
    };
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
  const db       = getDb();
  const students = db.prepare(`
    SELECT s.id, s.name, s.avatar_initials, s.photo_data, 'student' AS type,
           p.name AS promo_name, p.id AS promo_id
    FROM students s JOIN promotions p ON s.promo_id = p.id
    ORDER BY p.name, s.name
  `).all();

  const teachers = db.prepare('SELECT * FROM teachers ORDER BY id ASC').all().map(t => ({
    id:              -(t.id),
    name:            t.name,
    avatar_initials: t.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2),
    photo_data:      null,
    type:            t.role,
    promo_name:      null,
    promo_id:        null,
  }));

  return [...teachers, ...students];
}

module.exports = {
  getStudents, getAllStudents, getStudentProfile,
  getStudentByEmail, loginWithCredentials, registerStudent, getIdentities,
};
