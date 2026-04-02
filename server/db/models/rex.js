/** REX (Retour d'Experience) — CRUD sessions, activites, reponses anonymes. */
const { getDb }          = require('../connection');
const generateJoinCode   = require('../../utils/joinCode');
const log                = require('../../utils/logger');

// ─── Sessions ────────────────────────────────────────────────────────────────

function createRexSession({ teacherId, promoId, title, isAsync = 0, openUntil = null }) {
  const db = getDb();
  // Generer un code unique (retry si collision)
  let code;
  for (let i = 0; i < 10; i++) {
    code = generateJoinCode();
    const exists = db.prepare('SELECT 1 FROM rex_sessions WHERE join_code = ?').get(code);
    if (!exists) break;
  }
  const res = db.prepare(
    'INSERT INTO rex_sessions (teacher_id, promo_id, title, join_code, is_async, open_until) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(teacherId, promoId, title, code, isAsync ? 1 : 0, openUntil);
  return db.prepare('SELECT * FROM rex_sessions WHERE id = ?').get(res.lastInsertRowid);
}

function getRexSession(id) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM rex_sessions WHERE id = ?').get(id);
  if (!session) return null;
  const activities = db.prepare(
    'SELECT * FROM rex_activities WHERE session_id = ? ORDER BY position ASC'
  ).all(id);
  return { ...session, activities };
}

function getRexSessionByCode(code) {
  return getDb().prepare('SELECT * FROM rex_sessions WHERE join_code = ?').get(code) || null;
}

function getActiveRexSession(promoId) {
  return getDb().prepare(`
    SELECT * FROM rex_sessions
    WHERE promo_id = ? AND status = 'active'
      AND (is_async = 0 OR open_until IS NULL OR open_until > datetime('now'))
    LIMIT 1
  `).get(promoId) || null;
}

function getRexSessionsForPromo(promoId) {
  return getDb().prepare(
    "SELECT * FROM rex_sessions WHERE promo_id = ? AND status != 'ended' ORDER BY created_at DESC"
  ).all(promoId);
}

function updateRexSessionStatus(id, status) {
  const db = getDb();
  if (status === 'ended') {
    db.prepare("UPDATE rex_sessions SET status = ?, ended_at = datetime('now') WHERE id = ?").run(status, id);
  } else if (status === 'active') {
    db.prepare('UPDATE rex_sessions SET status = ? WHERE id = ?').run(status, id);
    // En mode async : passer toutes les activités en 'live' immédiatement
    const session = db.prepare('SELECT is_async FROM rex_sessions WHERE id = ?').get(id);
    if (session?.is_async) {
      db.prepare(
        "UPDATE rex_activities SET status = 'live', started_at = datetime('now') WHERE session_id = ? AND status = 'pending'"
      ).run(id);
    }
  } else {
    db.prepare('UPDATE rex_sessions SET status = ? WHERE id = ?').run(status, id);
  }
  return db.prepare('SELECT * FROM rex_sessions WHERE id = ?').get(id);
}

/** Ferme automatiquement les sessions async dont la date d'expiration est dépassée. */
function autoCloseExpiredAsyncSessions() {
  const db = getDb();
  const expired = db.prepare(
    "SELECT id FROM rex_sessions WHERE is_async = 1 AND status = 'active' AND open_until IS NOT NULL AND open_until < datetime('now')"
  ).all();
  if (expired.length === 0) return;
  const close = db.prepare("UPDATE rex_sessions SET status = 'ended', ended_at = datetime('now') WHERE id = ?");
  db.transaction(() => { expired.forEach(s => close.run(s.id)); })();
  log.info('rex_auto_close', { count: expired.length });
}

function deleteRexSession(id) {
  return getDb().prepare('DELETE FROM rex_sessions WHERE id = ?').run(id);
}

// ─── Activities ──────────────────────────────────────────────────────────────

function addRexActivity({ sessionId, type, title, maxWords, maxRating, position }) {
  const db = getDb();
  const res = db.prepare(
    'INSERT INTO rex_activities (session_id, type, title, max_words, max_rating, position) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(sessionId, type, title, maxWords ?? 3, maxRating ?? 5, position ?? 0);
  return db.prepare('SELECT * FROM rex_activities WHERE id = ?').get(res.lastInsertRowid);
}

function updateRexActivity(id, fields) {
  const db = getDb();
  const allowed = ['title', 'type', 'max_words', 'max_rating', 'position'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) { sets.push(`${key} = ?`); vals.push(fields[key]); }
  }
  if (fields.maxWords !== undefined && fields.max_words === undefined) { sets.push('max_words = ?'); vals.push(fields.maxWords); }
  if (fields.maxRating !== undefined && fields.max_rating === undefined) { sets.push('max_rating = ?'); vals.push(fields.maxRating); }
  if (sets.length === 0) return db.prepare('SELECT * FROM rex_activities WHERE id = ?').get(id);
  vals.push(id);
  db.prepare(`UPDATE rex_activities SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM rex_activities WHERE id = ?').get(id);
}

function deleteRexActivity(id) {
  return getDb().prepare('DELETE FROM rex_activities WHERE id = ?').run(id);
}

function reorderRexActivities(sessionId, orderedIds) {
  const db = getDb();
  const update = db.prepare('UPDATE rex_activities SET position = ? WHERE id = ? AND session_id = ?');
  const transaction = db.transaction((ids) => {
    ids.forEach((id, index) => update.run(index, id, sessionId));
  });
  transaction(orderedIds);
}

function cloneRexSession(sourceId, { teacherId, promoId, title }) {
  const db = getDb();
  const source = getRexSession(sourceId);
  if (!source) return null;

  let code;
  for (let i = 0; i < 10; i++) {
    code = generateJoinCode();
    const exists = db.prepare('SELECT 1 FROM rex_sessions WHERE join_code = ?').get(code);
    if (!exists) break;
  }

  const newSession = db.prepare(
    'INSERT INTO rex_sessions (teacher_id, promo_id, title, join_code) VALUES (?, ?, ?, ?)'
  ).run(teacherId, promoId, title ?? source.title, code);

  const sessionId = newSession.lastInsertRowid;
  const insertActivity = db.prepare(
    'INSERT INTO rex_activities (session_id, type, title, max_words, max_rating, position) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const transaction = db.transaction((activities) => {
    for (const a of activities) {
      insertActivity.run(sessionId, a.type, a.title, a.max_words, a.max_rating, a.position);
    }
  });
  transaction(source.activities);

  return getRexSession(sessionId);
}

function setRexActivityStatus(id, status) {
  const db = getDb();
  if (status === 'live') {
    db.prepare("UPDATE rex_activities SET status = ?, started_at = datetime('now') WHERE id = ?").run(status, id);
  } else if (status === 'closed') {
    db.prepare("UPDATE rex_activities SET status = ?, closed_at = datetime('now') WHERE id = ?").run(status, id);
  } else {
    db.prepare('UPDATE rex_activities SET status = ? WHERE id = ?').run(status, id);
  }
  return db.prepare('SELECT * FROM rex_activities WHERE id = ?').get(id);
}

// ─── Responses ───────────────────────────────────────────────────────────────

function submitRexResponse({ activityId, studentId, answer }) {
  const db = getDb();
  db.prepare(
    "INSERT INTO rex_responses (activity_id, student_id, answer) VALUES (?, ?, ?) ON CONFLICT(activity_id, student_id) DO UPDATE SET answer = excluded.answer, created_at = datetime('now')"
  ).run(activityId, studentId, answer);
  // Ne PAS retourner student_id dans la reponse
  return db.prepare(
    'SELECT id, activity_id, answer, pinned, created_at FROM rex_responses WHERE activity_id = ? AND student_id = ?'
  ).get(activityId, studentId);
}

function hasRexStudentResponded(activityId, studentId) {
  const row = getDb().prepare(
    'SELECT 1 FROM rex_responses WHERE activity_id = ? AND student_id = ?'
  ).get(activityId, studentId);
  return !!row;
}

/** Resultats ANONYMES - ne retourne JAMAIS student_id. */
function getRexActivityResults(activityId) {
  return getDb().prepare(
    'SELECT id, answer, pinned, created_at FROM rex_responses WHERE activity_id = ? ORDER BY created_at ASC'
  ).all(activityId);
}

/** Resultats agreges selon le type d'activite - ANONYME. */
function getRexActivityResultsAggregated(activityId) {
  const db = getDb();
  const activity = db.prepare('SELECT * FROM rex_activities WHERE id = ?').get(activityId);
  if (!activity) return null;

  if (activity.type === 'sondage_libre') {
    const rows = db.prepare(
      'SELECT answer, COUNT(*) as count FROM rex_responses WHERE activity_id = ? GROUP BY answer ORDER BY count DESC'
    ).all(activityId);
    const total = rows.reduce((s, r) => s + r.count, 0);
    return { type: 'sondage_libre', total, counts: rows.map(r => ({ text: r.answer, count: r.count })) };
  }

  if (activity.type === 'nuage') {
    const rows = db.prepare(
      'SELECT answer, COUNT(*) as count FROM rex_responses WHERE activity_id = ? GROUP BY answer ORDER BY count DESC'
    ).all(activityId);
    const total = rows.reduce((s, r) => s + r.count, 0);
    return { type: 'nuage', total, freq: rows.map(r => ({ word: r.answer, count: r.count })) };
  }

  if (activity.type === 'echelle') {
    const rows = db.prepare(
      'SELECT answer, COUNT(*) as count FROM rex_responses WHERE activity_id = ? GROUP BY answer'
    ).all(activityId);
    const total = rows.reduce((s, r) => s + r.count, 0);
    const sum = rows.reduce((s, r) => s + Number(r.answer) * r.count, 0);
    const average = total > 0 ? Math.round((sum / total) * 100) / 100 : 0;
    return { type: 'echelle', total, distribution: rows.map(r => ({ rating: Number(r.answer), count: r.count })), average };
  }

  if (activity.type === 'question_ouverte') {
    const rows = db.prepare(
      'SELECT id, answer, pinned, created_at FROM rex_responses WHERE activity_id = ? ORDER BY pinned DESC, created_at DESC'
    ).all(activityId);
    return { type: 'question_ouverte', total: rows.length, answers: rows.map(r => ({ id: r.id, answer: r.answer, pinned: !!r.pinned, created_at: r.created_at })) };
  }

  return { type: activity.type, total: 0 };
}

// ─── Pin ─────────────────────────────────────────────────────────────────────

function toggleRexPin(responseId, pinned) {
  const db = getDb();
  db.prepare('UPDATE rex_responses SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, responseId);
  return db.prepare('SELECT id, answer, pinned, created_at FROM rex_responses WHERE id = ?').get(responseId);
}

// ─── Historique par promo ────────────────────────────────────────────────────

function getEndedRexSessionsForPromo(promoId, { search, dateFrom, dateTo } = {}) {
  const db = getDb();
  let where = "rs.promo_id = ? AND rs.status = 'ended'";
  const params = [promoId];
  if (search) { where += " AND rs.title LIKE '%' || ? || '%'"; params.push(search); }
  if (dateFrom) { where += ' AND rs.created_at >= ?'; params.push(dateFrom); }
  if (dateTo) { where += ' AND rs.created_at <= ?'; params.push(dateTo); }
  return db.prepare(`
    SELECT rs.*,
      (SELECT COUNT(*) FROM rex_activities WHERE session_id = rs.id) AS activity_count,
      (SELECT COUNT(DISTINCT rr.student_id)
       FROM rex_responses rr
       JOIN rex_activities ra ON rr.activity_id = ra.id
       WHERE ra.session_id = rs.id) AS participant_count
    FROM rex_sessions rs
    WHERE ${where}
    ORDER BY rs.ended_at DESC
    LIMIT 50
  `).all(...params);
}

// ─── Stats par promo ────────────────────────────────────────────────────────

function getRexStatsForPromo(promoId) {
  const db = getDb();

  const totalSessions = db.prepare(
    "SELECT COUNT(*) as c FROM rex_sessions WHERE promo_id = ? AND status = 'ended'"
  ).get(promoId).c;

  const enrolledStudents = db.prepare(
    'SELECT COUNT(*) as c FROM students WHERE promo_id = ?'
  ).get(promoId).c;

  const activityTypeDistribution = db.prepare(`
    SELECT ra.type, COUNT(*) as count
    FROM rex_activities ra
    JOIN rex_sessions rs ON ra.session_id = rs.id
    WHERE rs.promo_id = ? AND rs.status = 'ended'
    GROUP BY ra.type
  `).all(promoId);

  const participationTrend = db.prepare(`
    SELECT rs.id as sessionId, rs.title, rs.ended_at as endedAt,
      (SELECT COUNT(DISTINCT rr.student_id)
       FROM rex_responses rr
       JOIN rex_activities ra ON rr.activity_id = ra.id
       WHERE ra.session_id = rs.id) as participants
    FROM rex_sessions rs
    WHERE rs.promo_id = ? AND rs.status = 'ended'
    ORDER BY rs.ended_at ASC
  `).all(promoId).map(r => ({ ...r, enrolled: enrolledStudents }));

  const avgParticipationRate = totalSessions > 0 && enrolledStudents > 0
    ? Math.round(participationTrend.reduce((s, r) => s + r.participants / r.enrolled, 0) / totalSessions * 100)
    : 0;

  return { totalSessions, avgParticipationRate, enrolledStudents, activityTypeDistribution, participationTrend };
}

// ─── Export ──────────────────────────────────────────────────────────────────

function exportRexSession(sessionId) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM rex_sessions WHERE id = ?').get(sessionId);
  if (!session) return null;
  const activities = db.prepare(
    'SELECT * FROM rex_activities WHERE session_id = ? ORDER BY position ASC'
  ).all(sessionId);
  const result = {
    session: { id: session.id, title: session.title, status: session.status, created_at: session.created_at, ended_at: session.ended_at },
    activities: activities.map(a => ({
      id: a.id,
      type: a.type,
      title: a.title,
      status: a.status,
      results: getRexActivityResultsAggregated(a.id),
    })),
  };
  return result;
}

module.exports = {
  createRexSession,
  getRexSession,
  getRexSessionByCode,
  getActiveRexSession,
  getRexSessionsForPromo,
  updateRexSessionStatus,
  autoCloseExpiredAsyncSessions,
  deleteRexSession,
  addRexActivity,
  updateRexActivity,
  deleteRexActivity,
  reorderRexActivities,
  cloneRexSession,
  setRexActivityStatus,
  submitRexResponse,
  hasRexStudentResponded,
  getRexActivityResults,
  getRexActivityResultsAggregated,
  toggleRexPin,
  exportRexSession,
  getEndedRexSessionsForPromo,
  getRexStatsForPromo,
};
