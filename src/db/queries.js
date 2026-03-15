const { getDb } = require('./connection');

// ─── Schema & migrations ─────────────────────────────────────────────────────

function initSchema() {
  const db = getDb();

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
      description TEXT,
      type        TEXT NOT NULL DEFAULT 'chat' CHECK(type IN ('chat', 'annonce'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      promo_id        INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      email           TEXT NOT NULL UNIQUE,
      avatar_initials TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS groups (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      promo_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
      name     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      PRIMARY KEY (group_id, student_id)
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
      group_id    INTEGER REFERENCES groups(id) ON DELETE SET NULL,
      title       TEXT NOT NULL,
      description TEXT,
      deadline    TEXT NOT NULL,
      category    TEXT NOT NULL DEFAULT 'TP' CHECK(category IN ('TP','Projet','Devoir','Examen','Rendu'))
    );

    CREATE TABLE IF NOT EXISTS ressources (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      travail_id  INTEGER NOT NULL REFERENCES travaux(id) ON DELETE CASCADE,
      type        TEXT NOT NULL CHECK(type IN ('file', 'link')),
      name        TEXT NOT NULL,
      path_or_url TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS depots (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      travail_id   INTEGER NOT NULL REFERENCES travaux(id) ON DELETE CASCADE,
      student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      file_name    TEXT NOT NULL,
      file_path    TEXT NOT NULL,
      note         REAL,
      feedback     TEXT,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(travail_id, student_id)
    );
  `);

  migrate(db);
}

function migrate(db) {
  const col = (table) =>
    db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);

  if (!col('channels').includes('type'))
    db.exec("ALTER TABLE channels ADD COLUMN type TEXT NOT NULL DEFAULT 'chat'");

  if (!col('depots').includes('feedback'))
    db.exec('ALTER TABLE depots ADD COLUMN feedback TEXT');

  if (!col('travaux').includes('group_id'))
    db.exec('ALTER TABLE travaux ADD COLUMN group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL');

  if (!col('travaux').includes('category'))
    db.exec("ALTER TABLE travaux ADD COLUMN category TEXT NOT NULL DEFAULT 'TP'");
}

// ─── Seed ────────────────────────────────────────────────────────────────────

function seedIfEmpty() {
  const db    = getDb();
  const count = db.prepare('SELECT COUNT(*) AS n FROM promotions').get().n;
  if (count > 0) return;

  const ip = db.prepare('INSERT INTO promotions (name, color) VALUES (?, ?)');
  const ic = db.prepare('INSERT INTO channels (promo_id, name, description, type) VALUES (?, ?, ?, ?)');
  const is = db.prepare('INSERT INTO students (promo_id, name, email, avatar_initials) VALUES (?, ?, ?, ?)');
  const ig = db.prepare('INSERT INTO groups (promo_id, name) VALUES (?, ?)');
  const im = db.prepare('INSERT INTO group_members (group_id, student_id) VALUES (?, ?)');
  const imsg = db.prepare('INSERT INTO messages (channel_id, dm_student_id, author_name, author_type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const it  = db.prepare('INSERT INTO travaux (channel_id, group_id, title, description, deadline, category) VALUES (?, ?, ?, ?, ?, ?)');
  const ir  = db.prepare('INSERT INTO ressources (travail_id, type, name, path_or_url) VALUES (?, ?, ?, ?)');
  const id = db.prepare('INSERT INTO depots (travail_id, student_id, file_name, file_path, note, submitted_at) VALUES (?, ?, ?, ?, ?, ?)');

  const p1 = ip.run('BTS SIO 1ere annee', '#4A90D9').lastInsertRowid;
  const p2 = ip.run('BTS SIO 2eme annee', '#7B68EE').lastInsertRowid;
  const p3 = ip.run('Bachelor Dev Web',   '#50C878').lastInsertRowid;

  const c1 = ic.run(p1, 'annonces',     'Informations importantes',            'annonce').lastInsertRowid;
  const c2 = ic.run(p1, 'general',      'Canal principal',                     'chat').lastInsertRowid;
  const c3 = ic.run(p1, 'cours-reseau', 'Support de cours reseau et systemes', 'chat').lastInsertRowid;
  const c4 = ic.run(p1, 'remise-tp',    'Depot des travaux pratiques',         'chat').lastInsertRowid;
  const c5 = ic.run(p2, 'annonces',     'Informations importantes',            'annonce').lastInsertRowid;
  const c6 = ic.run(p2, 'general',      'Canal principal',                     'chat').lastInsertRowid;
  const c7 = ic.run(p2, 'projet-e5',    'Coordination du projet E5',           'chat').lastInsertRowid;
        ic.run(p3, 'general',       'Canal principal',                     'chat');
  const c9 = ic.run(p3, 'react-avance', 'Cours React et frameworks modernes',  'chat').lastInsertRowid;

  const s1 = is.run(p1, 'Alice Martin',    'alice.martin@cesi.fr',    'AM').lastInsertRowid;
  const s2 = is.run(p1, 'Baptiste Durand', 'baptiste.durand@cesi.fr', 'BD').lastInsertRowid;
  const s3 = is.run(p1, 'Clara Petit',     'clara.petit@cesi.fr',     'CP').lastInsertRowid;
  const s4 = is.run(p2, 'David Bernard',   'david.bernard@cesi.fr',   'DB').lastInsertRowid;
  const s5 = is.run(p2, 'Emma Leroy',      'emma.leroy@cesi.fr',      'EL').lastInsertRowid;
  const s6 = is.run(p3, 'Francois Moreau', 'francois.moreau@cesi.fr', 'FM').lastInsertRowid;

  // Groupes de TP pour la promo p1
  const g1 = ig.run(p1, 'Groupe A').lastInsertRowid;
  const g2 = ig.run(p1, 'Groupe B').lastInsertRowid;
  im.run(g1, s1); im.run(g1, s2);
  im.run(g2, s3);

  imsg.run(c1, null, 'Rohan Fosse', 'teacher', 'Bienvenue dans votre espace en ligne. Les informations importantes seront publiees ici.', '2026-03-10 08:00:00');
  imsg.run(c1, null, 'Rohan Fosse', 'teacher', 'Rappel : soutenances de TP semaine du 24 mars.', '2026-03-12 08:00:00');
  imsg.run(c2, null, 'Rohan Fosse', 'teacher', 'Bonjour a tous. N\'hesitez pas a poser vos questions ici.', '2026-03-10 09:00:00');
  imsg.run(c2, null, 'Alice Martin',    'student', 'Bonjour M. Fosse.', '2026-03-10 09:05:00');
  imsg.run(c2, null, 'Baptiste Durand', 'student', 'On peut deposer nos TP directement ici ?', '2026-03-10 09:07:00');
  imsg.run(c2, null, 'Rohan Fosse', 'teacher', 'Oui Baptiste, regardez le canal #remise-tp.', '2026-03-10 09:10:00');
  imsg.run(c3, null, 'Rohan Fosse', 'teacher', 'Le cours sur les VLANs est disponible. Pensez a reviser les adresses IP.', '2026-03-11 10:00:00');
  imsg.run(c3, null, 'Clara Petit', 'student', 'La configuration du switch sera a l\'examen ?', '2026-03-11 10:30:00');
  imsg.run(c3, null, 'Rohan Fosse', 'teacher', 'Oui Clara, toute la partie switching VLAN est au programme.', '2026-03-11 10:35:00');
  imsg.run(c5, null, 'Rohan Fosse', 'teacher', 'Soutenances E5 le mois prochain. Preparez vos contextes professionnels.', '2026-03-12 08:00:00');
  imsg.run(c6, null, 'David Bernard', 'student', 'Peut-on faire une simulation de soutenance avant ?', '2026-03-12 08:15:00');
  imsg.run(c6, null, 'Emma Leroy',   'student', 'Bonne idee David, je suis partante.', '2026-03-12 08:20:00');
  imsg.run(c6, null, 'Rohan Fosse',  'teacher', 'Je prevois des creneaux la semaine prochaine.', '2026-03-12 08:25:00');

  imsg.run(null, s1, 'Alice Martin', 'student', 'Bonjour M. Fosse, j\'ai une question sur le TP reseau.', '2026-03-13 14:00:00');
  imsg.run(null, s1, 'Rohan Fosse',  'teacher', 'Bien sur Alice, dis-moi.', '2026-03-13 14:05:00');
  imsg.run(null, s1, 'Alice Martin', 'student', 'Je n\'arrive pas a configurer le masque de sous-reseau pour la question 3.', '2026-03-13 14:06:00');
  imsg.run(null, s4, 'David Bernard','student', 'Mon contexte pro pour l\'E5 est pret. Puis-je vous l\'envoyer ?', '2026-03-14 11:00:00');
  imsg.run(null, s4, 'Rohan Fosse',  'teacher', 'Oui David, depose-le dans #projet-e5.', '2026-03-14 11:10:00');

  // Travaux avec categories
  const t1 = it.run(c4, null, 'TP Reseaux - Configuration VLAN',
    'Configurer un reseau avec 3 VLANs sur Packet Tracer. Exporter le fichier .pkt et rediger un compte-rendu.',
    '2026-03-20 23:59:00', 'TP').lastInsertRowid;

  const t2 = it.run(c4, g1, 'TD Python - Scripts reseau (Groupe A)',
    'Ecrire un script Python qui scanne un reseau local et liste les hotes actifs.',
    '2026-03-17 18:00:00', 'TP').lastInsertRowid;

  const t3 = it.run(c7, null, 'Livrable E5 - Contexte professionnel',
    'Rediger le contexte professionnel de votre projet E5 (3 a 5 pages). Format PDF.',
    '2026-03-25 12:00:00', 'Projet').lastInsertRowid;

  it.run(c9, null, 'Projet React - Application CRUD',
    'Application React complete avec gestion d\'etat, API REST et tests.',
    '2026-04-05 23:59:00', 'Projet');

  // Ressources exemples
  ir.run(t1, 'link', 'Cours VLAN - Cisco NetAcad', 'https://www.netacad.com');
  ir.run(t1, 'link', 'Telecharger Packet Tracer', 'https://www.netacad.com/courses/packet-tracer');
  ir.run(t3, 'link', 'Referentiel BTS SIO E5', 'https://www.education.gouv.fr');

  id.run(t1, s1, 'MARTIN_Alice_TP_VLAN.pkt',         '/depots/MARTIN_Alice_TP_VLAN.pkt',         16.5, '2026-03-18 20:30:00');
  id.run(t2, s2, 'DURAND_Baptiste_script_reseau.py', '/depots/DURAND_Baptiste_script_reseau.py', null, '2026-03-16 15:00:00');
  id.run(t3, s4, 'BERNARD_David_contexte_E5.pdf',    '/depots/BERNARD_David_contexte_E5.pdf',    null, '2026-03-14 11:30:00');
}

// ─── Promotions & structure ───────────────────────────────────────────────────

function getPromotions() {
  return getDb().prepare('SELECT * FROM promotions ORDER BY name').all();
}

function getChannels(promoId) {
  return getDb().prepare(
    'SELECT * FROM channels WHERE promo_id = ? ORDER BY type DESC, name ASC'
  ).all(promoId);
}

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

// Retourne toutes les identites disponibles au login (professeur + etudiants)
function getIdentities() {
  const students = getDb().prepare(`
    SELECT s.id, s.name, s.avatar_initials, 'student' AS type,
           p.name AS promo_name, p.id AS promo_id
    FROM students s JOIN promotions p ON s.promo_id = p.id
    ORDER BY p.name, s.name
  `).all();

  const teacher = { id: 0, name: 'Rohan Fosse', avatar_initials: 'RF', type: 'teacher', promo_name: null, promo_id: null };

  return [teacher, ...students];
}

// ─── Groupes ──────────────────────────────────────────────────────────────────

function getGroups(promoId) {
  return getDb().prepare(`
    SELECT g.*,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS members_count
    FROM groups g
    WHERE g.promo_id = ?
    ORDER BY g.name
  `).all(promoId);
}

function createGroup({ promoId, name }) {
  return getDb().prepare(
    'INSERT INTO groups (promo_id, name) VALUES (?, ?)'
  ).run(promoId, name);
}

function deleteGroup(groupId) {
  return getDb().prepare('DELETE FROM groups WHERE id = ?').run(groupId);
}

function getGroupMembers(groupId) {
  return getDb().prepare(`
    SELECT s.id, s.name, s.avatar_initials
    FROM group_members gm JOIN students s ON gm.student_id = s.id
    WHERE gm.group_id = ?
    ORDER BY s.name
  `).all(groupId);
}

// Remplace tous les membres d'un groupe en une transaction
function setGroupMembers({ groupId, studentIds }) {
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM group_members WHERE group_id = ?').run(groupId);
    const ins = db.prepare('INSERT INTO group_members (group_id, student_id) VALUES (?, ?)');
    for (const sid of studentIds) ins.run(groupId, sid);
  })();
}

// ─── Messages ────────────────────────────────────────────────────────────────

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

function searchMessages(channelId, query) {
  return getDb().prepare(`
    SELECT * FROM messages
    WHERE channel_id = ? AND content LIKE '%' || ? || '%'
    ORDER BY created_at ASC LIMIT 200
  `).all(channelId, query);
}

function sendMessage({ channelId, dmStudentId, authorName, authorType, content }) {
  return getDb().prepare(`
    INSERT INTO messages (channel_id, dm_student_id, author_name, author_type, content)
    VALUES (?, ?, ?, ?, ?)
  `).run(channelId ?? null, dmStudentId ?? null, authorName, authorType, content);
}

// ─── Travaux ─────────────────────────────────────────────────────────────────

function getTravaux(channelId) {
  return getDb().prepare(`
    SELECT t.*,
      g.name AS group_name,
      (SELECT COUNT(*) FROM depots d WHERE d.travail_id = t.id) AS depots_count,
      CASE
        WHEN t.group_id IS NOT NULL
          THEN (SELECT COUNT(*) FROM group_members WHERE group_id = t.group_id)
        ELSE
          (SELECT COUNT(*) FROM students WHERE promo_id =
            (SELECT promo_id FROM channels WHERE id = t.channel_id))
      END AS students_total
    FROM travaux t
    LEFT JOIN groups g ON t.group_id = g.id
    WHERE t.channel_id = ?
    ORDER BY t.deadline ASC
  `).all(channelId);
}

function getTravailById(travailId) {
  return getDb().prepare('SELECT * FROM travaux WHERE id = ?').get(travailId);
}

function createTravail({ channelId, groupId, title, description, deadline, category }) {
  return getDb().prepare(`
    INSERT INTO travaux (channel_id, group_id, title, description, deadline, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(channelId, groupId ?? null, title, description, deadline, category ?? 'TP');
}

// ─── Suivi (vue enseignant) ───────────────────────────────────────────────────

function getTravauxSuivi(travailId) {
  return getDb().prepare(`
    SELECT
      s.id AS student_id, s.name AS student_name, s.avatar_initials,
      d.id AS depot_id, d.file_name, d.file_path,
      d.note, d.feedback, d.submitted_at
    FROM travaux t
    JOIN channels c ON t.channel_id = c.id
    JOIN students s ON s.promo_id = c.promo_id
    LEFT JOIN depots d ON d.travail_id = t.id AND d.student_id = s.id
    WHERE t.id = ?
      AND (
        t.group_id IS NULL OR
        EXISTS (SELECT 1 FROM group_members gm
                WHERE gm.group_id = t.group_id AND gm.student_id = s.id)
      )
    ORDER BY s.name ASC
  `).all(travailId);
}

// ─── Vue etudiant ─────────────────────────────────────────────────────────────

// Tous les travaux visibles par un etudiant (promo + groupes)
function getStudentTravaux(studentId) {
  return getDb().prepare(`
    SELECT
      t.id, t.title, t.description, t.deadline, t.group_id,
      ch.name AS channel_name, ch.id AS channel_id,
      g.name  AS group_name,
      d.id    AS depot_id, d.file_name, d.note, d.feedback, d.submitted_at
    FROM students s
    JOIN channels ch ON ch.promo_id = s.promo_id AND ch.type = 'chat'
    JOIN travaux t   ON t.channel_id = ch.id
    LEFT JOIN groups g  ON t.group_id = g.id
    LEFT JOIN depots d  ON d.travail_id = t.id AND d.student_id = s.id
    WHERE s.id = ?
      AND (
        t.group_id IS NULL OR
        EXISTS (SELECT 1 FROM group_members gm
                WHERE gm.group_id = t.group_id AND gm.student_id = s.id)
      )
    ORDER BY
      CASE WHEN d.id IS NULL THEN 0 ELSE 1 END,
      t.deadline ASC
  `).all(studentId);
}

// ─── Depots ───────────────────────────────────────────────────────────────────

function getDepots(travailId) {
  return getDb().prepare(`
    SELECT d.*, s.name AS student_name, s.avatar_initials
    FROM depots d JOIN students s ON d.student_id = s.id
    WHERE d.travail_id = ?
    ORDER BY d.submitted_at DESC
  `).all(travailId);
}

function addDepot({ travailId, studentId, fileName, filePath }) {
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

function setFeedback({ depotId, feedback }) {
  return getDb().prepare('UPDATE depots SET feedback = ? WHERE id = ?').run(feedback, depotId);
}

// ─── Ressources ───────────────────────────────────────────────────────────────

function getRessources(travailId) {
  return getDb().prepare(
    'SELECT * FROM ressources WHERE travail_id = ? ORDER BY created_at ASC'
  ).all(travailId);
}

function addRessource({ travailId, type, name, pathOrUrl }) {
  return getDb().prepare(`
    INSERT INTO ressources (travail_id, type, name, path_or_url) VALUES (?, ?, ?, ?)
  `).run(travailId, type, name, pathOrUrl);
}

function deleteRessource(ressourceId) {
  return getDb().prepare('DELETE FROM ressources WHERE id = ?').run(ressourceId);
}

// ─── Profil etudiant ──────────────────────────────────────────────────────────

function getStudentProfile(studentId) {
  const student = getDb().prepare(`
    SELECT s.*, p.name AS promo_name, p.color AS promo_color
    FROM students s JOIN promotions p ON s.promo_id = p.id
    WHERE s.id = ?
  `).get(studentId);

  const travaux = getDb().prepare(`
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

module.exports = {
  initSchema, seedIfEmpty,
  getPromotions, getChannels, getStudents, getAllStudents,
  getGroups, createGroup, deleteGroup, getGroupMembers, setGroupMembers,
  getChannelMessages, getDmMessages, searchMessages, sendMessage,
  getTravaux, getTravailById, createTravail,
  getTravauxSuivi, getStudentTravaux,
  getDepots, addDepot, setNote, setFeedback,
  getStudentProfile,
  getIdentities,
  getRessources, addRessource, deleteRessource,
};
