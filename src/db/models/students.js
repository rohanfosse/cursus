const { getDb }  = require('../connection');
const bcrypt     = require('bcryptjs');

const crypto = require('crypto');

const BCRYPT_ROUNDS = 10;

// ── Utilitaires ───────────────────────────────────────────────────────────────

function hashPassword(plain) {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

/** Valide la robustesse d'un mot de passe (>= 8 chars, 1 majuscule, 1 chiffre, 1 spécial). */
function validatePasswordStrength(pwd) {
  if (!pwd || pwd.length < 8)       throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
  if (!/[A-Z]/.test(pwd))           throw new Error('Le mot de passe doit contenir au moins une majuscule.');
  if (!/[0-9]/.test(pwd))           throw new Error('Le mot de passe doit contenir au moins un chiffre.');
  if (!/[^A-Za-z0-9]/.test(pwd))    throw new Error('Le mot de passe doit contenir au moins un caractère spécial.');
}

/** Génère un mot de passe aléatoire temporaire (pour imports CSV). */
function generateTempPassword() {
  return crypto.randomBytes(12).toString('base64url');
}

/** Compare un mot de passe avec un hash stocké.
 *  Gère la migration transparente des mots de passe en clair (héritage).
 *  Retourne { match: bool, needsRehash: bool }
 */
function checkPassword(plain, stored) {
  if (!plain || !stored) return { match: false, needsRehash: false };
  if (stored.startsWith('$2')) {
    // Hash bcrypt — comparaison sécurisée
    return { match: bcrypt.compareSync(plain, stored), needsRehash: false };
  }
  // Mot de passe en clair hérité — migration automatique
  return { match: plain === stored, needsRehash: true };
}

// ── Lecture ───────────────────────────────────────────────────────────────────

function getStudents(promoId) {
  return getDb().prepare(
    'SELECT id, promo_id, name, email, avatar_initials, photo_data FROM students WHERE promo_id = ? ORDER BY name'
  ).all(promoId);
}

function getAllStudents() {
  return getDb().prepare(`
    SELECT s.id, s.promo_id, s.name, s.email, s.avatar_initials, s.photo_data,
           p.name AS promo_name, p.color AS promo_color
    FROM students s JOIN promotions p ON s.promo_id = p.id
    ORDER BY p.name, s.name
  `).all();
}

function getStudentProfile(studentId) {
  const db = getDb();
  const student = db.prepare(`
    SELECT s.id, s.name, s.email, s.avatar_initials, s.photo_data,
           p.name AS promo_name, p.color AS promo_color
    FROM students s JOIN promotions p ON s.promo_id = p.id
    WHERE s.id = ?
  `).get(studentId);

  const travaux = db.prepare(`
    SELECT t.id, t.title, t.deadline, t.type, t.published, t.category,
      ch.name AS channel_name,
      d.id AS depot_id, d.file_name, d.note, d.feedback, d.submitted_at
    FROM channels ch
    JOIN students s ON s.promo_id = ch.promo_id
    JOIN travaux t ON t.channel_id = ch.id
    LEFT JOIN depots d ON d.travail_id = t.id AND d.student_id = s.id
    WHERE s.id = ? AND t.published = 1
    ORDER BY t.deadline DESC
  `).all(studentId);

  return { student, travaux };
}

function getStudentByEmail(email) {
  // Ne retourne pas le mot de passe
  return getDb().prepare(`
    SELECT s.id, s.name, s.email, s.avatar_initials, s.photo_data, s.promo_id,
           p.name AS promo_name
    FROM students s JOIN promotions p ON s.promo_id = p.id
    WHERE s.email = ?
  `).get(email);
}

// ── Authentification ──────────────────────────────────────────────────────────

function loginWithCredentials(email, password) {
  const db = getDb();

  // 1. Chercher dans teachers
  const teacher = db.prepare(
    'SELECT * FROM teachers WHERE LOWER(email) = LOWER(?)'
  ).get(email.trim());

  if (teacher) {
    const { match, needsRehash } = checkPassword(password, teacher.password);
    if (!match) return null;
    if (needsRehash) {
      db.prepare('UPDATE teachers SET password = ? WHERE id = ?')
        .run(hashPassword(password), teacher.id);
    }
    const initials = teacher.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
    return {
      id:                  -(teacher.id),
      name:                teacher.name,
      avatar_initials:     initials,
      photo_data:          null,
      type:                teacher.role,
      promo_name:          null,
      promo_id:            null,
      must_change_password: teacher.must_change_password ?? 1,
    };
  }

  // 2. Chercher dans students (alias explicite pour éviter que p.name écrase s.name)
  const student = db.prepare(
    'SELECT s.*, p.name AS promo_name FROM students s JOIN promotions p ON s.promo_id = p.id WHERE LOWER(s.email) = LOWER(?)'
  ).get(email.trim());

  if (!student) return null;
  const { match, needsRehash } = checkPassword(password, student.password);
  if (!match) return null;
  if (needsRehash) {
    db.prepare('UPDATE students SET password = ? WHERE id = ?')
      .run(hashPassword(password), student.id);
  }

  return {
    id:                  student.id,
    name:                student.name,
    email:               student.email,
    avatar_initials:     student.avatar_initials,
    photo_data:          student.photo_data,
    type:                'student',
    promo_name:          student.promo_name ?? null,
    promo_id:            student.promo_id,
    must_change_password: student.must_change_password ?? 1,
  };
}

// ── Inscription ───────────────────────────────────────────────────────────────

function registerStudent({ name, email, promoId, photoData, password }) {
  const db       = getDb();
  // Validation du domaine email
  if (!email || !email.trim().toLowerCase().endsWith('@viacesi.fr')) {
    throw new Error("L'adresse email doit se terminer par @viacesi.fr.");
  }
  const existing = db.prepare('SELECT id FROM students WHERE email = ?').get(email);
  if (existing) throw new Error('Cette adresse email est déjà utilisée.');

  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const plain    = (password ?? '').trim();
  if (!plain) throw new Error('Le mot de passe est obligatoire.');
  validatePasswordStrength(plain);
  const hashed   = hashPassword(plain);

  return db.prepare(`
    INSERT INTO students (promo_id, name, email, avatar_initials, photo_data, password, must_change_password)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(promoId, name.trim(), email.trim().toLowerCase(), initials, photoData ?? null, hashed);
}

// ── Changement de mot de passe ────────────────────────────────────────────────

function changePassword(userId, isTeacher, currentPassword, newPassword) {
  validatePasswordStrength(newPassword);

  const db = getDb();

  if (isTeacher) {
    const realId  = Math.abs(userId);
    const teacher = db.prepare('SELECT * FROM teachers WHERE id = ?').get(realId);
    if (!teacher) throw new Error('Utilisateur introuvable.');
    const { match } = checkPassword(currentPassword, teacher.password);
    if (!match) throw new Error('Mot de passe actuel incorrect.');
    db.prepare('UPDATE teachers SET password = ?, must_change_password = 0 WHERE id = ?')
      .run(hashPassword(newPassword), realId);
  } else {
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(userId);
    if (!student) throw new Error('Utilisateur introuvable.');
    const { match } = checkPassword(currentPassword, student.password);
    if (!match) throw new Error('Mot de passe actuel incorrect.');
    db.prepare('UPDATE students SET password = ?, must_change_password = 0 WHERE id = ?')
      .run(hashPassword(newPassword), userId);
  }

  return true;
}

// ── Export données personnelles (RGPD art. 20) ────────────────────────────────

function exportStudentData(studentId) {
  const db = getDb();

  const profile = db.prepare(`
    SELECT s.id, s.name, s.email, s.avatar_initials,
           p.name AS promo_name
    FROM students s JOIN promotions p ON s.promo_id = p.id
    WHERE s.id = ?
  `).get(studentId);

  if (!profile) throw new Error('Étudiant introuvable.');

  const messages = db.prepare(`
    SELECT id, channel_id, dm_student_id, content, created_at, edited
    FROM messages WHERE author_name = ?
    ORDER BY created_at ASC
  `).all(profile.name);

  const submissions = db.prepare(`
    SELECT d.id, d.submitted_at, d.note, d.feedback,
           t.title AS travail_title, t.deadline, t.type
    FROM depots d
    JOIN travaux t ON t.id = d.travail_id
    WHERE d.student_id = ?
    ORDER BY d.submitted_at ASC
  `).all(studentId);

  return {
    exportedAt: new Date().toISOString(),
    profile,
    messages,
    submissions,
  };
}

// ── Identités (écran de connexion rapide) ────────────────────────────────────

function getIdentities() {
  const db       = getDb();
  const students = db.prepare(`
    SELECT s.id, s.name, s.email, s.avatar_initials, s.photo_data, 'student' AS type,
           p.name AS promo_name, p.id AS promo_id
    FROM students s JOIN promotions p ON s.promo_id = p.id
    ORDER BY p.name, s.name
  `).all();

  const teachers = db.prepare('SELECT * FROM teachers ORDER BY id ASC').all().map(t => ({
    id:              -(t.id),
    name:            t.name,
    email:           t.email,
    avatar_initials: t.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2),
    photo_data:      null,
    type:            t.role,
    promo_name:      null,
    promo_id:        null,
  }));

  return [...teachers, ...students];
}

// ── Import CSV ────────────────────────────────────────────────────────────────

function bulkImportStudents(promoId, rows) {
  const db  = getDb();
  const ins = db.prepare(`
    INSERT OR IGNORE INTO students (promo_id, name, email, avatar_initials, photo_data, password, must_change_password)
    VALUES (?, ?, ?, ?, NULL, ?, 1)
  `);
  let imported = 0;
  const errors = [];

  db.transaction(() => {
    for (const row of rows) {
      const name  = (row.name  || row.nom  || '').trim();
      const email = (row.email || row.mail || '').trim().toLowerCase();
      if (!name || !email) continue;
      const initials = name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
      const plain    = (row.password || row.mdp || '').trim() || generateTempPassword();
      try {
        const res = ins.run(promoId, name, email, initials, hashPassword(plain));
        if (res.changes) imported++;
        else errors.push(`${email} : déjà existant (ignoré)`);
      } catch (e) {
        errors.push(`${email} : ${e.message}`);
      }
    }
  })();

  return { imported, errors };
}

// ── Stats classe ──────────────────────────────────────────────────────────────

function getClasseStats(promoId) {
  return getDb().prepare(`
    SELECT
      s.id, s.name, s.avatar_initials, s.photo_data,
      (SELECT COUNT(*) FROM depots d WHERE d.student_id = s.id) AS submitted_count,
      (SELECT COUNT(*) FROM travaux t
       WHERE t.promo_id = s.promo_id AND t.published = 1
         AND t.type NOT IN ('soutenance', 'cctl')) AS total_count,
      (SELECT COUNT(*) FROM depots d WHERE d.student_id = s.id
       AND d.note IS NOT NULL AND d.note != '') AS graded_count,
      (SELECT AVG(CAST(d.note AS REAL)) FROM depots d WHERE d.student_id = s.id
       AND d.note IS NOT NULL AND d.note != '') AS avg_grade,
      (SELECT MAX(m.created_at) FROM messages m
       WHERE m.author_name = s.name AND m.channel_id IS NOT NULL) AS last_message_at
    FROM students s
    WHERE s.promo_id = ?
    ORDER BY s.name
  `).all(promoId);
}

function updateStudentPhoto(studentId, photoData) {
  return getDb().prepare('UPDATE students SET photo_data = ? WHERE id = ?')
    .run(photoData, studentId).changes;
}

module.exports = {
  getStudents, getAllStudents, getStudentProfile,
  getStudentByEmail, loginWithCredentials, registerStudent,
  changePassword, exportStudentData,
  getIdentities, bulkImportStudents, getClasseStats, updateStudentPhoto,
};
