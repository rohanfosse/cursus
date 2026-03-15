const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const DB_PATH = path.join(app.getPath('userData'), 'cesi-classroom.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    seedIfEmpty();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS promotions (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#4A90D9'
    );

    CREATE TABLE IF NOT EXISTS channels (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      promo_id    INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS students (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      promo_id        INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      email           TEXT NOT NULL UNIQUE,
      avatar_initials TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id    INTEGER REFERENCES channels(id) ON DELETE CASCADE,
      dm_student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      author_name   TEXT NOT NULL,
      author_type   TEXT NOT NULL CHECK(author_type IN ('teacher', 'student')),
      content       TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      CHECK(
        (channel_id IS NULL AND dm_student_id IS NOT NULL) OR
        (channel_id IS NOT NULL AND dm_student_id IS NULL)
      )
    );

    CREATE TABLE IF NOT EXISTS travaux (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id  INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      description TEXT,
      deadline    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS depots (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      travail_id   INTEGER NOT NULL REFERENCES travaux(id) ON DELETE CASCADE,
      student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      file_name    TEXT NOT NULL,
      file_path    TEXT NOT NULL,
      note         REAL,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(travail_id, student_id)
    );
  `);
}

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as n FROM promotions').get().n;
  if (count > 0) return;

  // Promotions
  const insertPromo = db.prepare('INSERT INTO promotions (name, color) VALUES (?, ?)');
  const p1 = insertPromo.run('BTS SIO 1ere annee',  '#4A90D9').lastInsertRowid;
  const p2 = insertPromo.run('BTS SIO 2eme annee',  '#7B68EE').lastInsertRowid;
  const p3 = insertPromo.run('Bachelor Dev Web',    '#50C878').lastInsertRowid;

  // Channels
  const insertChannel = db.prepare('INSERT INTO channels (promo_id, name, description) VALUES (?, ?, ?)');
  const c1 = insertChannel.run(p1, 'general',      'Canal principal de la promo').lastInsertRowid;
  const c2 = insertChannel.run(p1, 'cours-reseau', 'Support de cours reseau et systemes').lastInsertRowid;
  const c3 = insertChannel.run(p1, 'remise-tp',    'Depot des travaux pratiques').lastInsertRowid;
  const c4 = insertChannel.run(p2, 'general',      'Canal principal de la promo').lastInsertRowid;
  const c5 = insertChannel.run(p2, 'projet-e5',    'Coordination du projet E5').lastInsertRowid;
  insertChannel.run(p3, 'general',       'Canal principal de la promo');
  const c7 = insertChannel.run(p3, 'react-avance', 'Cours React et frameworks modernes').lastInsertRowid;

  // Students
  const insertStudent = db.prepare('INSERT INTO students (promo_id, name, email, avatar_initials) VALUES (?, ?, ?, ?)');
  const s1 = insertStudent.run(p1, 'Alice Martin',    'alice.martin@cesi.fr',    'AM').lastInsertRowid;
  const s2 = insertStudent.run(p1, 'Baptiste Durand', 'baptiste.durand@cesi.fr', 'BD').lastInsertRowid;
  insertStudent.run(p1, 'Clara Petit',    'clara.petit@cesi.fr',    'CP');
  const s4 = insertStudent.run(p2, 'David Bernard',  'david.bernard@cesi.fr',  'DB').lastInsertRowid;
  insertStudent.run(p2, 'Emma Leroy',     'emma.leroy@cesi.fr',     'EL');
  insertStudent.run(p3, 'Francois Moreau','francois.moreau@cesi.fr', 'FM');

  // Messages canal
  const insertMsg = db.prepare(`
    INSERT INTO messages (channel_id, dm_student_id, author_name, author_type, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertMsg.run(c1, null, 'Rohan Fosse', 'teacher', 'Bonjour a tous. Bienvenue dans votre espace de classe en ligne.', '2026-03-10 09:00:00');
  insertMsg.run(c1, null, 'Alice Martin',    'student', 'Bonjour M. Fosse. Merci pour cet outil, c\'est tres pratique.', '2026-03-10 09:05:00');
  insertMsg.run(c1, null, 'Baptiste Durand', 'student', 'On peut deposer nos TP directement ici ?', '2026-03-10 09:07:00');
  insertMsg.run(c1, null, 'Rohan Fosse', 'teacher', 'Exactement Baptiste, regardez le canal #remise-tp pour les details.', '2026-03-10 09:10:00');
  insertMsg.run(c2, null, 'Rohan Fosse', 'teacher', 'Le cours sur les VLANs est disponible en PDF. Pensez a reviser les adresses IP.', '2026-03-11 10:00:00');
  insertMsg.run(c2, null, 'Clara Petit', 'student', 'La configuration du switch sera a l\'examen ?', '2026-03-11 10:30:00');
  insertMsg.run(c2, null, 'Rohan Fosse', 'teacher', 'Oui Clara, toute la partie switching VLAN est au programme.', '2026-03-11 10:35:00');
  insertMsg.run(c4, null, 'Rohan Fosse', 'teacher', 'Rappel : soutenances E5 le mois prochain. Preparez vos contextes professionnels.', '2026-03-12 08:00:00');
  insertMsg.run(c4, null, 'David Bernard', 'student', 'Est-ce qu\'on peut faire une simulation de soutenance avant ?', '2026-03-12 08:15:00');
  insertMsg.run(c4, null, 'Emma Leroy',   'student', 'Bonne idee David, je suis partante aussi.', '2026-03-12 08:20:00');

  // Messages directs
  insertMsg.run(null, s1, 'Alice Martin', 'student', 'Bonjour M. Fosse, j\'ai une question sur le dernier TP reseau.', '2026-03-13 14:00:00');
  insertMsg.run(null, s1, 'Rohan Fosse',  'teacher', 'Bien sur Alice, quelle est ta question ?', '2026-03-13 14:05:00');
  insertMsg.run(null, s1, 'Alice Martin', 'student', 'Je n\'arrive pas a configurer le masque de sous-reseau pour la question 3.', '2026-03-13 14:06:00');
  insertMsg.run(null, s4, 'David Bernard','student', 'M. Fosse, mon contexte pro pour l\'E5 est pret, puis-je vous l\'envoyer pour relecture ?', '2026-03-14 11:00:00');
  insertMsg.run(null, s4, 'Rohan Fosse',  'teacher', 'Bien sur David, depose-le dans le canal #projet-e5 pour que je puisse commenter.', '2026-03-14 11:10:00');

  // Travaux
  const insertTravail = db.prepare('INSERT INTO travaux (channel_id, title, description, deadline) VALUES (?, ?, ?, ?)');
  const t1 = insertTravail.run(c3, 'TP Reseaux - Configuration VLAN',       'Configurer un reseau avec 3 VLANs sur Packet Tracer. Exporter le fichier .pkt et rediger un compte-rendu.',          '2026-03-20 23:59:00').lastInsertRowid;
  const t2 = insertTravail.run(c3, 'TD Python - Scripts reseau',             'Ecrire un script Python qui scanne un reseau local et liste les hotes actifs.',                                        '2026-03-17 18:00:00').lastInsertRowid;
  const t3 = insertTravail.run(c5, 'Livrable E5 - Contexte professionnel',   'Rediger le contexte professionnel de votre projet E5 (3-5 pages). Format PDF obligatoire.',                          '2026-03-25 12:00:00').lastInsertRowid;
  insertTravail.run(c7, 'Projet React - Application CRUD',          'Creer une application React complete avec gestion d\'etat, appels API REST et tests unitaires.',             '2026-04-05 23:59:00');

  // Depots initiaux
  const insertDepot = db.prepare(`
    INSERT INTO depots (travail_id, student_id, file_name, file_path, note, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertDepot.run(t1, s1, 'MARTIN_Alice_TP_VLAN.pkt',            '/depots/MARTIN_Alice_TP_VLAN.pkt',            16.5, '2026-03-18 20:30:00');
  insertDepot.run(t2, s2, 'DURAND_Baptiste_script_reseau.py',    '/depots/DURAND_Baptiste_script_reseau.py',    null, '2026-03-16 15:00:00');
  insertDepot.run(t3, s4, 'BERNARD_David_contexte_E5.pdf',       '/depots/BERNARD_David_contexte_E5.pdf',       null, '2026-03-14 11:30:00');
}

// ─── Requetes ───────────────────────────────────────────────────────────────

function getPromotions() {
  return getDb().prepare('SELECT * FROM promotions ORDER BY name').all();
}

function getChannels(promoId) {
  return getDb().prepare('SELECT * FROM channels WHERE promo_id = ? ORDER BY name').all(promoId);
}

function getStudents(promoId) {
  return getDb().prepare('SELECT * FROM students WHERE promo_id = ? ORDER BY name').all(promoId);
}

function getAllStudents() {
  return getDb().prepare(`
    SELECT s.*, p.name AS promo_name, p.color AS promo_color
    FROM students s
    JOIN promotions p ON s.promo_id = p.id
    ORDER BY p.name, s.name
  `).all();
}

function getChannelMessages(channelId) {
  return getDb().prepare(
    'SELECT * FROM messages WHERE channel_id = ? ORDER BY created_at ASC'
  ).all(channelId);
}

function getDmMessages(studentId) {
  return getDb().prepare(
    'SELECT * FROM messages WHERE dm_student_id = ? ORDER BY created_at ASC'
  ).all(studentId);
}

function sendMessage({ channelId, dmStudentId, authorName, authorType, content }) {
  return getDb().prepare(`
    INSERT INTO messages (channel_id, dm_student_id, author_name, author_type, content)
    VALUES (?, ?, ?, ?, ?)
  `).run(channelId ?? null, dmStudentId ?? null, authorName, authorType, content);
}

function getTravaux(channelId) {
  // depots_count inclus pour eviter les requetes N+1 dans le renderer
  return getDb().prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM depots d WHERE d.travail_id = t.id) AS depots_count
    FROM travaux t
    WHERE t.channel_id = ?
    ORDER BY t.deadline ASC
  `).all(channelId);
}

function getDepots(travailId) {
  return getDb().prepare(`
    SELECT d.*, s.name AS student_name, s.avatar_initials
    FROM depots d
    JOIN students s ON d.student_id = s.id
    WHERE d.travail_id = ?
    ORDER BY d.submitted_at DESC
  `).all(travailId);
}

function addDepot({ travailId, studentId, fileName, filePath }) {
  // ON CONFLICT preserves la note existante
  return getDb().prepare(`
    INSERT INTO depots (travail_id, student_id, file_name, file_path)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(travail_id, student_id) DO UPDATE SET
      file_name    = excluded.file_name,
      file_path    = excluded.file_path,
      submitted_at = datetime('now', 'localtime')
  `).run(travailId, studentId, fileName, filePath);
}

function setNote({ depotId, note }) {
  return getDb().prepare('UPDATE depots SET note = ? WHERE id = ?').run(note, depotId);
}

function createTravail({ channelId, title, description, deadline }) {
  return getDb().prepare(`
    INSERT INTO travaux (channel_id, title, description, deadline) VALUES (?, ?, ?, ?)
  `).run(channelId, title, description, deadline);
}

module.exports = {
  getPromotions,
  getChannels,
  getStudents,
  getAllStudents,
  getChannelMessages,
  getDmMessages,
  sendMessage,
  getTravaux,
  getDepots,
  addDepot,
  setNote,
  createTravail,
};
