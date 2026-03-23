/** Modèle Live Quiz - sessions interactives en direct (QCM, sondages, nuages de mots) */
const { getDb } = require('../connection');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Génère un code aléatoire de 6 caractères alphanumériques majuscules. */
function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I/O/0/1 pour éviter confusion
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── Sessions ────────────────────────────────────────────────────────────────

function createSession({ teacherId, promoId, title }) {
  const db = getDb();
  // Générer un code unique (retry si collision)
  let code;
  for (let i = 0; i < 10; i++) {
    code = generateJoinCode();
    const exists = db.prepare('SELECT 1 FROM live_sessions WHERE join_code = ?').get(code);
    if (!exists) break;
  }
  const res = db.prepare(
    'INSERT INTO live_sessions (teacher_id, promo_id, title, join_code) VALUES (?, ?, ?, ?)'
  ).run(teacherId, promoId, title, code);
  return db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(res.lastInsertRowid);
}

function getSession(id) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(id);
  if (!session) return null;
  const activities = db.prepare(
    'SELECT * FROM live_activities WHERE session_id = ? ORDER BY position ASC'
  ).all(id);
  return { ...session, activities };
}

function getSessionByCode(code) {
  return getDb().prepare('SELECT * FROM live_sessions WHERE join_code = ?').get(code) || null;
}

function getActiveSessionForPromo(promoId) {
  return getDb().prepare(
    "SELECT * FROM live_sessions WHERE promo_id = ? AND status = 'active' LIMIT 1"
  ).get(promoId) || null;
}

function getSessionsForPromo(promoId) {
  const db = getDb();
  const sessions = db.prepare(
    "SELECT * FROM live_sessions WHERE promo_id = ? AND status != 'ended' ORDER BY created_at DESC"
  ).all(promoId);
  return sessions;
}

function updateSessionStatus(id, status) {
  const db = getDb();
  if (status === 'ended') {
    db.prepare("UPDATE live_sessions SET status = ?, ended_at = datetime('now') WHERE id = ?").run(status, id);
  } else {
    db.prepare('UPDATE live_sessions SET status = ? WHERE id = ?').run(status, id);
  }
  return db.prepare('SELECT * FROM live_sessions WHERE id = ?').get(id);
}

function deleteSession(id) {
  return getDb().prepare('DELETE FROM live_sessions WHERE id = ?').run(id);
}

// ─── Activities ──────────────────────────────────────────────────────────────

function addActivity({ sessionId, type, title, options, multi, maxWords, position, timerSeconds, correctAnswers }) {
  const db = getDb();
  const res = db.prepare(
    'INSERT INTO live_activities (session_id, type, title, options, multi, max_words, position, timer_seconds, correct_answers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(sessionId, type, title, options ?? null, multi ?? 0, maxWords ?? 3, position ?? 0, timerSeconds ?? 30, correctAnswers ?? null);
  return db.prepare('SELECT * FROM live_activities WHERE id = ?').get(res.lastInsertRowid);
}

function updateActivity(id, fields) {
  const db = getDb();
  const allowed = ['title', 'type', 'options', 'multi', 'max_words', 'position', 'timer_seconds', 'correct_answers'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      // Convertir camelCase → snake_case pour max_words
      const col = key === 'maxWords' ? 'max_words' : key;
      sets.push(`${col} = ?`);
      vals.push(fields[key]);
    }
  }
  // Also handle camelCase maxWords
  if (fields.maxWords !== undefined && !fields.max_words) {
    sets.push('max_words = ?');
    vals.push(fields.maxWords);
  }
  if (sets.length === 0) return db.prepare('SELECT * FROM live_activities WHERE id = ?').get(id);
  vals.push(id);
  db.prepare(`UPDATE live_activities SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM live_activities WHERE id = ?').get(id);
}

function deleteActivity(id) {
  return getDb().prepare('DELETE FROM live_activities WHERE id = ?').run(id);
}

function reorderActivities(sessionId, orderedIds) {
  const db = getDb();
  const update = db.prepare('UPDATE live_activities SET position = ? WHERE id = ? AND session_id = ?');
  const transaction = db.transaction((ids) => {
    ids.forEach((id, index) => update.run(index, id, sessionId));
  });
  transaction(orderedIds);
}

function cloneSession(sourceId, { teacherId, promoId, title }) {
  const db = getDb();
  const source = getSession(sourceId);
  if (!source) return null;

  let code;
  for (let i = 0; i < 10; i++) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const exists = db.prepare('SELECT 1 FROM live_sessions WHERE join_code = ?').get(code);
    if (!exists) break;
  }

  const newSession = db.prepare(
    'INSERT INTO live_sessions (teacher_id, promo_id, title, join_code) VALUES (?, ?, ?, ?)'
  ).run(teacherId, promoId, title ?? source.title, code);

  const sessionId = newSession.lastInsertRowid;
  const insertActivity = db.prepare(
    'INSERT INTO live_activities (session_id, type, title, options, multi, max_words, position, timer_seconds, correct_answers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const transaction = db.transaction((activities) => {
    for (const a of activities) {
      insertActivity.run(sessionId, a.type, a.title, a.options, a.multi, a.max_words, a.position, a.timer_seconds, a.correct_answers);
    }
  });
  transaction(source.activities);

  return getSession(sessionId);
}

function setActivityStatus(id, status) {
  const db = getDb();
  if (status === 'live') {
    db.prepare("UPDATE live_activities SET status = ?, started_at = datetime('now') WHERE id = ?").run(status, id);
  } else if (status === 'closed') {
    db.prepare("UPDATE live_activities SET status = ?, closed_at = datetime('now') WHERE id = ?").run(status, id);
  } else {
    db.prepare('UPDATE live_activities SET status = ? WHERE id = ?').run(status, id);
  }
  return db.prepare('SELECT * FROM live_activities WHERE id = ?').get(id);
}

// ─── Responses ───────────────────────────────────────────────────────────────

function submitResponse({ activityId, studentId, answer }) {
  const db = getDb();
  db.prepare(
    'INSERT INTO live_responses (activity_id, student_id, answer) VALUES (?, ?, ?) ON CONFLICT(activity_id, student_id) DO UPDATE SET answer = excluded.answer, created_at = datetime(\'now\')'
  ).run(activityId, studentId, answer);
  return db.prepare(
    'SELECT * FROM live_responses WHERE activity_id = ? AND student_id = ?'
  ).get(activityId, studentId);
}

function getActivityResults(activityId) {
  return getDb().prepare(
    'SELECT * FROM live_responses WHERE activity_id = ? ORDER BY created_at ASC'
  ).all(activityId);
}

function getActivityResultsAggregated(activityId) {
  const db = getDb();
  const activity = db.prepare('SELECT * FROM live_activities WHERE id = ?').get(activityId);
  if (!activity) return null;

  const responses = db.prepare(
    'SELECT * FROM live_responses WHERE activity_id = ?'
  ).all(activityId);

  const total = responses.length;

  if (activity.type === 'qcm') {
    // Compter par option (index ou texte)
    const counts = {};
    for (const r of responses) {
      const key = r.answer;
      counts[key] = (counts[key] || 0) + 1;
    }
    return { type: 'qcm', total, counts };
  }

  if (activity.type === 'sondage') {
    // Grouper par texte de réponse
    const counts = {};
    for (const r of responses) {
      const key = r.answer;
      counts[key] = (counts[key] || 0) + 1;
    }
    return { type: 'sondage', total, counts };
  }

  if (activity.type === 'nuage') {
    // Fréquence de mots (chaque réponse peut contenir plusieurs mots séparés par des virgules)
    const freq = {};
    for (const r of responses) {
      const words = r.answer.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
      for (const w of words) {
        freq[w] = (freq[w] || 0) + 1;
      }
    }
    return { type: 'nuage', total, freq };
  }

  return { type: activity.type, total, raw: responses };
}

function hasStudentResponded(activityId, studentId) {
  const row = getDb().prepare(
    'SELECT 1 FROM live_responses WHERE activity_id = ? AND student_id = ?'
  ).get(activityId, studentId);
  return !!row;
}

// ─── Scoring (Kahoot-style) ─────────────────────────────────────────────────

function calculateScore(activityId, studentId, studentName, answerTimeMs, isCorrect) {
  const db = getDb();
  const activity = db.prepare('SELECT * FROM live_activities WHERE id = ?').get(activityId);
  if (!activity) return 0;

  const timerMs = (activity.timer_seconds || 30) * 1000;
  const points = isCorrect ? Math.round(1000 * (1 - (answerTimeMs / timerMs) * 0.5)) : 0;

  db.prepare(`
    INSERT INTO live_scores (session_id, student_id, student_name, activity_id, points, answer_time_ms, is_correct)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(activity_id, student_id) DO UPDATE SET
      points = excluded.points, answer_time_ms = excluded.answer_time_ms,
      is_correct = excluded.is_correct, student_name = excluded.student_name
  `).run(activity.session_id, studentId, studentName, activityId, points, answerTimeMs, isCorrect ? 1 : 0);

  return points;
}

function checkCorrectness(activityId, answer) {
  const db = getDb();
  const activity = db.prepare('SELECT * FROM live_activities WHERE id = ?').get(activityId);
  if (!activity || !activity.correct_answers) return null; // no correct answers defined

  let correctIndices;
  try { correctIndices = JSON.parse(activity.correct_answers); } catch { return null; }
  if (!Array.isArray(correctIndices) || correctIndices.length === 0) return null;

  // answer is a comma-separated list of indices (e.g. "0,2")
  const studentIndices = String(answer).split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
  if (studentIndices.length === 0) return false;

  // Must match exactly
  const sortedCorrect = [...correctIndices].sort((a, b) => a - b);
  const sortedStudent = [...studentIndices].sort((a, b) => a - b);
  if (sortedCorrect.length !== sortedStudent.length) return false;
  return sortedCorrect.every((v, i) => v === sortedStudent[i]);
}

function getLeaderboard(sessionId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT student_id, student_name, SUM(points) as total_points
    FROM live_scores
    WHERE session_id = ?
    GROUP BY student_id
    ORDER BY total_points DESC
  `).all(sessionId);

  return rows.map((r, i) => ({
    rank: i + 1,
    studentId: r.student_id,
    name: r.student_name,
    points: r.total_points,
  }));
}

function getLeaderboardWithRound(sessionId, activityId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      s.student_id,
      s.student_name,
      SUM(s.points) as total_points,
      COALESCE((SELECT points FROM live_scores WHERE activity_id = ? AND student_id = s.student_id), 0) as points_this_round
    FROM live_scores s
    WHERE s.session_id = ?
    GROUP BY s.student_id
    ORDER BY total_points DESC
  `).all(activityId, sessionId);

  return rows.map((r, i) => ({
    rank: i + 1,
    studentId: r.student_id,
    name: r.student_name,
    points: r.total_points,
    pointsThisRound: r.points_this_round,
  }));
}

function getActivityScores(activityId) {
  return getDb().prepare(
    'SELECT * FROM live_scores WHERE activity_id = ? ORDER BY points DESC'
  ).all(activityId);
}

function getStudentRank(sessionId, studentId) {
  const board = getLeaderboard(sessionId);
  const entry = board.find(e => e.studentId === studentId);
  return entry ? entry.rank : board.length + 1;
}

module.exports = {
  createSession,
  getSession,
  getSessionByCode,
  getActiveSessionForPromo,
  getSessionsForPromo,
  updateSessionStatus,
  deleteSession,
  addActivity,
  updateActivity,
  deleteActivity,
  reorderActivities,
  cloneSession,
  setActivityStatus,
  submitResponse,
  getActivityResults,
  getActivityResultsAggregated,
  hasStudentResponded,
  calculateScore,
  checkCorrectness,
  getLeaderboard,
  getLeaderboardWithRound,
  getActivityScores,
  getStudentRank,
};
