const { getDb } = require('../connection');

// ─── Travaux ──────────────────────────────────────────────────────────────────

function getTravaux(channelId) {
  return getDb().prepare(`
    SELECT t.*,
      g.name AS group_name,
      (SELECT COUNT(*) FROM depots d WHERE d.travail_id = t.id) AS depots_count,
      CASE
        WHEN t.group_id IS NOT NULL
          THEN (SELECT COUNT(*) FROM group_members WHERE group_id = t.group_id)
        ELSE
          (SELECT COUNT(*) FROM students WHERE promo_id = t.promo_id)
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

function createTravail({ promoId, channelId, groupId, title, description, startDate, deadline, category, type, published }) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO travaux (promo_id, channel_id, group_id, title, description, start_date, deadline, category, type, published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    promoId, channelId ?? null, groupId ?? null, title, description, startDate ?? null,
    deadline, category ?? null, type ?? 'devoir',
    published != null ? (published ? 1 : 0) : 1
  );
  if (groupId) {
    const travailId = result.lastInsertRowid;
    const members   = db.prepare('SELECT student_id FROM group_members WHERE group_id = ?').all(groupId);
    const ins       = db.prepare('INSERT OR IGNORE INTO travail_group_members (travail_id, student_id, group_id) VALUES (?, ?, ?)');
    for (const m of members) ins.run(travailId, m.student_id, groupId);
  }
  return result;
}

function updateTravailPublished({ travailId, published }) {
  return getDb().prepare('UPDATE travaux SET published = ? WHERE id = ?').run(published ? 1 : 0, travailId);
}

// ─── Suivi (vue enseignant) ───────────────────────────────────────────────────

function getTravauxSuivi(travailId) {
  return getDb().prepare(`
    SELECT
      s.id AS student_id, s.name AS student_name, s.avatar_initials, s.photo_data,
      d.id AS depot_id, d.file_name, d.file_path, d.link_url, d.deploy_url,
      d.note, d.feedback, d.submitted_at,
      tgm.group_id   AS travail_group_id,
      tg.name        AS travail_group_name
    FROM travaux t
    JOIN students s ON s.promo_id = t.promo_id
    LEFT JOIN depots d   ON d.travail_id = t.id AND d.student_id = s.id
    LEFT JOIN travail_group_members tgm ON tgm.travail_id = t.id AND tgm.student_id = s.id
    LEFT JOIN groups tg  ON tg.id = tgm.group_id
    WHERE t.id = ?
      AND (
        t.group_id IS NULL
        OR EXISTS (SELECT 1 FROM travail_group_members WHERE travail_id = t.id AND student_id = s.id)
        OR EXISTS (SELECT 1 FROM group_members WHERE group_id = t.group_id AND student_id = s.id)
      )
    ORDER BY tg.name NULLS LAST, s.name ASC
  `).all(travailId);
}

// ─── Vue étudiant ─────────────────────────────────────────────────────────────

function getStudentTravaux(studentId) {
  return getDb().prepare(`
    SELECT
      t.id, t.title, t.description, t.deadline, t.group_id, t.category, t.type,
      tgm_g.name AS group_name,
      d.id    AS depot_id, d.file_name, d.link_url, d.deploy_url, d.note, d.feedback, d.submitted_at
    FROM students s
    JOIN travaux t ON t.promo_id = s.promo_id
    LEFT JOIN travail_group_members tgm ON tgm.travail_id = t.id AND tgm.student_id = s.id
    LEFT JOIN groups tgm_g ON tgm_g.id = tgm.group_id
    LEFT JOIN depots d  ON d.travail_id = t.id AND d.student_id = s.id
    WHERE s.id = ?
      AND t.published = 1
      AND (
        t.group_id IS NULL
        OR EXISTS (SELECT 1 FROM travail_group_members WHERE travail_id = t.id AND student_id = s.id)
        OR EXISTS (SELECT 1 FROM group_members WHERE group_id = t.group_id AND student_id = s.id)
      )
    ORDER BY t.deadline ASC
  `).all(studentId);
}

// ─── Groupes par projet ───────────────────────────────────────────────────────

function getTravailGroupMembers(travailId) {
  return getDb().prepare(`
    SELECT tgm.*, s.name AS student_name, s.avatar_initials, g.name AS group_name
    FROM travail_group_members tgm
    JOIN students s ON tgm.student_id = s.id
    JOIN groups   g ON tgm.group_id   = g.id
    WHERE tgm.travail_id = ?
    ORDER BY g.name, s.name
  `).all(travailId);
}

function setTravailGroupMember({ travailId, studentId, groupId }) {
  if (groupId === null) {
    return getDb().prepare(
      'DELETE FROM travail_group_members WHERE travail_id = ? AND student_id = ?'
    ).run(travailId, studentId);
  }
  return getDb().prepare(`
    INSERT INTO travail_group_members (travail_id, student_id, group_id)
    VALUES (?, ?, ?)
    ON CONFLICT(travail_id, student_id) DO UPDATE SET group_id = excluded.group_id
  `).run(travailId, studentId, groupId);
}

// ─── Gantt ────────────────────────────────────────────────────────────────────

function getGanttData(promoId) {
  const db = getDb();
  const base = `
    SELECT t.id, t.title, t.category, t.type, t.published,
           t.start_date, t.deadline, t.group_id,
           g.name AS group_name,
           ch.name AS channel_name, ch.id AS channel_id,
           p.name AS promo_name, p.color AS promo_color, p.id AS promo_id,
           (SELECT COUNT(*) FROM depots d WHERE d.travail_id = t.id) AS depots_count,
           CASE WHEN t.group_id IS NOT NULL
             THEN (SELECT COUNT(*) FROM group_members WHERE group_id = t.group_id)
             ELSE (SELECT COUNT(*) FROM students WHERE promo_id = t.promo_id)
           END AS students_total
    FROM travaux t
    JOIN promotions p ON p.id = t.promo_id
    LEFT JOIN channels ch ON ch.id = t.channel_id
    LEFT JOIN groups g ON g.id = t.group_id
  `;
  if (promoId) {
    return db.prepare(`${base} WHERE t.promo_id = ? ORDER BY t.deadline ASC`).all(promoId);
  }
  return db.prepare(`${base} ORDER BY p.name ASC, t.deadline ASC`).all();
}

// ─── Tous les rendus (vue professeur) ─────────────────────────────────────────

function getAllRendus(promoId) {
  const db   = getDb();
  const base = `
    SELECT d.id, d.file_name, d.file_path, d.note, d.feedback, d.submitted_at,
           s.id AS student_id, s.name AS student_name, s.avatar_initials, s.photo_data,
           t.id AS travail_id, t.title AS travail_title, t.category, t.deadline,
           ch.name AS channel_name,
           p.name AS promo_name, p.color AS promo_color
    FROM depots d
    JOIN students s   ON s.id  = d.student_id
    JOIN travaux t    ON t.id  = d.travail_id
    JOIN promotions p ON p.id  = t.promo_id
    LEFT JOIN channels ch ON ch.id = t.channel_id
  `;
  if (promoId) {
    return db.prepare(`${base} WHERE p.id = ? ORDER BY d.submitted_at DESC`).all(promoId);
  }
  return db.prepare(`${base} ORDER BY d.submitted_at DESC`).all();
}

// ─── Échéancier professeur ────────────────────────────────────────────────────

function getTeacherSchedule() {
  const db = getDb();

  const aNoter = db.prepare(`
    SELECT d.id AS depot_id, d.file_name, d.submitted_at,
           s.name AS student_name, s.avatar_initials,
           t.id AS travail_id, t.title AS travail_title, t.deadline, t.category,
           ch.name AS channel_name,
           p.name  AS promo_name, p.color AS promo_color
    FROM depots d
    JOIN students s   ON s.id  = d.student_id
    JOIN travaux t    ON t.id  = d.travail_id
    JOIN promotions p ON p.id  = t.promo_id
    LEFT JOIN channels ch ON ch.id = t.channel_id
    WHERE d.note IS NULL
    ORDER BY d.submitted_at ASC
  `).all();

  const jalons = db.prepare(`
    SELECT t.id, t.title, t.deadline, t.description, t.category,
           ch.name AS channel_name,
           p.name  AS promo_name, p.color AS promo_color
    FROM travaux t
    JOIN promotions p ON p.id = t.promo_id
    LEFT JOIN channels ch ON ch.id = t.channel_id
    WHERE t.type = 'jalon'
      AND t.published = 1
      AND t.deadline >= datetime('now')
      AND t.deadline <= datetime('now', '+30 days')
    ORDER BY t.deadline ASC
  `).all();

  const brouillons = db.prepare(`
    SELECT t.id, t.title, t.deadline, t.category, t.type,
           ch.name AS channel_name,
           p.name  AS promo_name, p.color AS promo_color
    FROM travaux t
    JOIN promotions p ON p.id = t.promo_id
    LEFT JOIN channels ch ON ch.id = t.channel_id
    WHERE t.published = 0
    ORDER BY t.deadline ASC
  `).all();

  const urgents = db.prepare(`
    SELECT t.id, t.title, t.deadline, t.category,
           ch.name AS channel_name,
           p.name  AS promo_name, p.color AS promo_color,
           (SELECT COUNT(*) FROM depots d WHERE d.travail_id = t.id) AS depots_count,
           CASE WHEN t.group_id IS NOT NULL
             THEN (SELECT COUNT(*) FROM group_members WHERE group_id = t.group_id)
             ELSE (SELECT COUNT(*) FROM students WHERE promo_id = t.promo_id)
           END AS students_total
    FROM travaux t
    JOIN promotions p ON p.id = t.promo_id
    LEFT JOIN channels ch ON ch.id = t.channel_id
    WHERE t.type = 'devoir'
      AND t.published = 1
      AND t.deadline >= datetime('now')
      AND t.deadline <= datetime('now', '+7 days')
    ORDER BY t.deadline ASC
  `).all();

  return { aNoter, jalons, brouillons, urgents };
}

// ─── Action de masse : marquer les non-rendus comme D ────────────────────────

function markNonSubmittedAsD(travailId) {
  const db      = getDb();
  const travail = db.prepare('SELECT promo_id FROM travaux WHERE id = ?').get(travailId);
  if (!travail) return 0;

  const students = db.prepare(`
    SELECT s.id FROM students s
    LEFT JOIN depots d ON d.travail_id = ? AND d.student_id = s.id
    WHERE s.promo_id = ? AND d.id IS NULL
  `).all(travailId, travail.promo_id);

  if (!students.length) return 0;
  const ins = db.prepare(
    `INSERT OR IGNORE INTO depots (travail_id, student_id, file_name, file_path, note) VALUES (?, ?, '—', '', 'D')`
  );
  db.transaction(() => { for (const s of students) ins.run(travailId, s.id); })();
  return students.length;
}

// ─── Projets (catégories distinctes) ─────────────────────────────────────────

function getTravailCategories(promoId) {
  const rows = getDb().prepare(`
    SELECT DISTINCT t.category
    FROM travaux t
    WHERE t.promo_id = ? AND t.category IS NOT NULL AND t.category != ''
    ORDER BY t.category ASC
  `).all(promoId);
  return rows.map(r => r.category);
}

module.exports = {
  getTravaux, getTravailById, createTravail, updateTravailPublished,
  getTravauxSuivi, getStudentTravaux,
  getTravailGroupMembers, setTravailGroupMember,
  getGanttData, getAllRendus, getTeacherSchedule, markNonSubmittedAsD,
  getTravailCategories,
};
