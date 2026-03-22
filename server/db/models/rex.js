/** REX (Retour d'Experience) — CRUD sessions, activites, reponses anonymes. */
const { getDb } = require('../connection');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Genere un code aleatoire de 6 caracteres alphanumeriques majuscules. */
function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I/O/0/1 pour eviter confusion
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── Sessions ────────────────────────────────────────────────────────────────

function createRexSession({ teacherId, promoId, title }) {
  const db = getDb();
  // Generer un code unique (retry si collision)
  let code;
  for (let i = 0; i < 10; i++) {
    code = generateJoinCode();
    const exists = db.prepare('SELECT 1 FROM rex_sessions WHERE join_code = ?').get(code);
    if (!exists) break;
  }
  const res = db.prepare(
    'INSERT INTO rex_sessions (teacher_id, promo_id, title, join_code) VALUES (?, ?, ?, ?)'
  ).run(teacherId, promoId, title, code);
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
  return getDb().prepare(
    "SELECT * FROM rex_sessions WHERE promo_id = ? AND status IN ('waiting','active') LIMIT 1"
  ).get(promoId) || null;
}

function updateRexSessionStatus(id, status) {
  const db = getDb();
  if (status === 'ended') {
    db.prepare("UPDATE rex_sessions SET status = ?, ended_at = datetime('now') WHERE id = ?").run(status, id);
  } else {
    db.prepare('UPDATE rex_sessions SET status = ? WHERE id = ?').run(status, id);
  }
  return db.prepare('SELECT * FROM rex_sessions WHERE id = ?').get(id);
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

function deleteRexActivity(id) {
  return getDb().prepare('DELETE FROM rex_activities WHERE id = ?').run(id);
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
    return { type: 'sondage_libre', total, counts: rows };
  }

  if (activity.type === 'nuage') {
    const rows = db.prepare(
      'SELECT answer, COUNT(*) as count FROM rex_responses WHERE activity_id = ? GROUP BY answer ORDER BY count DESC'
    ).all(activityId);
    const total = rows.reduce((s, r) => s + r.count, 0);
    return { type: 'nuage', total, counts: rows };
  }

  if (activity.type === 'echelle') {
    const rows = db.prepare(
      'SELECT answer, COUNT(*) as count FROM rex_responses WHERE activity_id = ? GROUP BY answer'
    ).all(activityId);
    const total = rows.reduce((s, r) => s + r.count, 0);
    const sum = rows.reduce((s, r) => s + Number(r.answer) * r.count, 0);
    const average = total > 0 ? Math.round((sum / total) * 100) / 100 : 0;
    return { type: 'echelle', total, counts: rows, average };
  }

  if (activity.type === 'question_ouverte') {
    const rows = db.prepare(
      'SELECT id, answer, pinned, created_at FROM rex_responses WHERE activity_id = ? ORDER BY pinned DESC, created_at DESC'
    ).all(activityId);
    return { type: 'question_ouverte', total: rows.length, responses: rows };
  }

  return { type: activity.type, total: 0 };
}

// ─── Pin ─────────────────────────────────────────────────────────────────────

function toggleRexPin(responseId, pinned) {
  const db = getDb();
  db.prepare('UPDATE rex_responses SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, responseId);
  return db.prepare('SELECT id, answer, pinned, created_at FROM rex_responses WHERE id = ?').get(responseId);
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
  updateRexSessionStatus,
  deleteRexSession,
  addRexActivity,
  deleteRexActivity,
  setRexActivityStatus,
  submitRexResponse,
  hasRexStudentResponded,
  getRexActivityResults,
  getRexActivityResultsAggregated,
  toggleRexPin,
  exportRexSession,
};
