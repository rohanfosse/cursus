/**
 * Modele Live unifie - sessions temps reel avec 4 categories d'activites :
 * - spark : quiz gamifie (scoring Kahoot-style)
 * - pulse : feedback anonyme
 * - code  : live coding prof broadcast
 * - board : brainstorming post-its + votes
 */
const { getDb } = require('../connection');
const generateJoinCode = require('../../utils/joinCode');

// ─── Helpers ────────────────────────────────────────────────────────────────

const SPARK_TYPES = ['qcm', 'vrai_faux', 'reponse_courte', 'association', 'estimation'];
const PULSE_TYPES = ['sondage_libre', 'nuage', 'echelle', 'question_ouverte', 'sondage', 'humeur', 'priorite', 'matrice'];
const CODE_TYPES = ['live_code'];
const BOARD_TYPES = ['board'];

function getActivityCategory(type) {
  if (SPARK_TYPES.includes(type)) return 'spark';
  if (PULSE_TYPES.includes(type)) return 'pulse';
  if (CODE_TYPES.includes(type)) return 'code';
  if (BOARD_TYPES.includes(type)) return 'board';
  return 'spark';
}

function generateUniqueCode(db) {
  for (let i = 0; i < 10; i++) {
    const code = generateJoinCode();
    const exists = db.prepare('SELECT 1 FROM live_sessions_v2 WHERE join_code = ?').get(code);
    if (!exists) return code;
  }
  throw new Error('Impossible de generer un code unique');
}

// ─── Sessions ───────────────────────────────────────────────────────────────

function createLiveSession({ teacherId, promoId, title, isAsync, openUntil }) {
  const db = getDb();
  const code = generateUniqueCode(db);
  const res = db.prepare(
    'INSERT INTO live_sessions_v2 (teacher_id, promo_id, title, join_code, is_async, open_until) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(teacherId, promoId, title, code, isAsync ? 1 : 0, openUntil ?? null);
  return db.prepare('SELECT * FROM live_sessions_v2 WHERE id = ?').get(res.lastInsertRowid);
}

function getLiveSession(id) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM live_sessions_v2 WHERE id = ?').get(id);
  if (!session) return null;
  const activities = db.prepare(
    'SELECT * FROM live_activities_v2 WHERE session_id = ? ORDER BY position ASC'
  ).all(id);
  return { ...session, activities };
}

function getLiveSessionByCode(code) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM live_sessions_v2 WHERE join_code = ?').get(code);
  if (!session) return null;
  const activities = db.prepare(
    'SELECT * FROM live_activities_v2 WHERE session_id = ? ORDER BY position ASC'
  ).all(session.id);
  return { ...session, activities };
}

function getActiveLiveSessionForPromo(promoId) {
  return getDb().prepare(
    "SELECT * FROM live_sessions_v2 WHERE promo_id = ? AND status = 'active' LIMIT 1"
  ).get(promoId) || null;
}

function getLiveSessionsForPromo(promoId) {
  return getDb().prepare(
    "SELECT * FROM live_sessions_v2 WHERE promo_id = ? AND status != 'ended' ORDER BY created_at DESC"
  ).all(promoId);
}

function updateLiveSessionStatus(id, status) {
  const db = getDb();
  if (status === 'ended') {
    db.prepare("UPDATE live_sessions_v2 SET status = ?, ended_at = datetime('now') WHERE id = ?").run(status, id);
  } else {
    db.prepare('UPDATE live_sessions_v2 SET status = ? WHERE id = ?').run(status, id);
  }
  return db.prepare('SELECT * FROM live_sessions_v2 WHERE id = ?').get(id);
}

function deleteLiveSession(id) {
  return getDb().prepare('DELETE FROM live_sessions_v2 WHERE id = ?').run(id);
}

function cloneLiveSession(sourceId, { teacherId, promoId, title }) {
  const db = getDb();
  const source = getLiveSession(sourceId);
  if (!source) return null;
  const code = generateUniqueCode(db);
  const res = db.prepare(
    'INSERT INTO live_sessions_v2 (teacher_id, promo_id, title, join_code, is_async, open_until) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(teacherId, promoId, title ?? source.title, code, source.is_async, source.open_until);
  const sessionId = res.lastInsertRowid;
  const ins = db.prepare(
    'INSERT INTO live_activities_v2 (session_id, category, type, title, options, multi, max_words, max_rating, timer_seconds, correct_answers, position, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const tx = db.transaction((activities) => {
    for (const a of activities) {
      ins.run(sessionId, a.category, a.type, a.title, a.options, a.multi, a.max_words, a.max_rating, a.timer_seconds, a.correct_answers, a.position, a.language);
    }
  });
  tx(source.activities);
  return getLiveSession(sessionId);
}

// ─── Activities ─────────────────────────────────────────────────────────────

function addLiveActivity({ sessionId, type, title, options, multi, maxWords, maxRating, position, timerSeconds, correctAnswers, language }) {
  const db = getDb();
  const category = getActivityCategory(type);
  const res = db.prepare(
    'INSERT INTO live_activities_v2 (session_id, category, type, title, options, multi, max_words, max_rating, timer_seconds, correct_answers, position, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(sessionId, category, type, title, options ?? null, multi ?? 0, maxWords ?? 3, maxRating ?? 5, timerSeconds ?? 30, correctAnswers ?? null, position ?? 0, language ?? null);
  return db.prepare('SELECT * FROM live_activities_v2 WHERE id = ?').get(res.lastInsertRowid);
}

function updateLiveActivity(id, fields) {
  const db = getDb();
  const allowed = ['title', 'type', 'options', 'multi', 'max_words', 'max_rating', 'position', 'timer_seconds', 'correct_answers', 'language', 'content'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`);
      vals.push(fields[key]);
    }
  }
  // Handle camelCase for maxWords/maxRating
  if (fields.maxWords !== undefined && fields.max_words === undefined) {
    sets.push('max_words = ?');
    vals.push(fields.maxWords);
  }
  if (fields.maxRating !== undefined && fields.max_rating === undefined) {
    sets.push('max_rating = ?');
    vals.push(fields.maxRating);
  }
  // If type changes, update category too
  if (fields.type !== undefined) {
    sets.push('category = ?');
    vals.push(getActivityCategory(fields.type));
  }
  if (sets.length === 0) return db.prepare('SELECT * FROM live_activities_v2 WHERE id = ?').get(id);
  vals.push(id);
  db.prepare(`UPDATE live_activities_v2 SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return db.prepare('SELECT * FROM live_activities_v2 WHERE id = ?').get(id);
}

function deleteLiveActivity(id) {
  return getDb().prepare('DELETE FROM live_activities_v2 WHERE id = ?').run(id);
}

function reorderLiveActivities(sessionId, orderedIds) {
  const db = getDb();
  const update = db.prepare('UPDATE live_activities_v2 SET position = ? WHERE id = ? AND session_id = ?');
  const tx = db.transaction((ids) => {
    ids.forEach((id, index) => update.run(index, id, sessionId));
  });
  tx(orderedIds);
}

function setLiveActivityStatus(id, status) {
  const db = getDb();
  if (status === 'live') {
    db.prepare("UPDATE live_activities_v2 SET status = ?, started_at = datetime('now') WHERE id = ?").run(status, id);
  } else if (status === 'closed') {
    db.prepare("UPDATE live_activities_v2 SET status = ?, closed_at = datetime('now') WHERE id = ?").run(status, id);
  } else {
    db.prepare('UPDATE live_activities_v2 SET status = ? WHERE id = ?').run(status, id);
  }
  return db.prepare('SELECT * FROM live_activities_v2 WHERE id = ?').get(id);
}

function saveLiveCodeSnapshot(activityId, content) {
  return getDb().prepare('UPDATE live_activities_v2 SET content = ? WHERE id = ?').run(content ?? null, activityId);
}

// ─── Responses ──────────────────────────────────────────────────────────────

function submitLiveResponse({ activityId, studentId, answer }) {
  const db = getDb();
  db.prepare(
    "INSERT INTO live_responses_v2 (activity_id, student_id, answer) VALUES (?, ?, ?) ON CONFLICT(activity_id, student_id) DO UPDATE SET answer = excluded.answer, created_at = datetime('now')"
  ).run(activityId, studentId, answer);
  return db.prepare('SELECT * FROM live_responses_v2 WHERE activity_id = ? AND student_id = ?').get(activityId, studentId);
}

function hasStudentRespondedLive(activityId, studentId) {
  return !!getDb().prepare('SELECT 1 FROM live_responses_v2 WHERE activity_id = ? AND student_id = ?').get(activityId, studentId);
}

function toggleLivePin(responseId, pinned) {
  const db = getDb();
  db.prepare('UPDATE live_responses_v2 SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, responseId);
  return db.prepare('SELECT id, answer, pinned, created_at FROM live_responses_v2 WHERE id = ?').get(responseId);
}

// ─── Levenshtein + normalization (fuzzy matching) ──────────────────────────

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = tmp;
    }
  }
  return dp[m];
}

function normalizeAnswer(s) {
  return String(s).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─── Scoring (Spark uniquement) ────────────────────────────────────────────

function countStreak(rows) {
  let streak = 0;
  for (const s of rows) {
    if (s.is_correct) streak++;
    else break;
  }
  return streak;
}

function calculateLiveScore(activityId, studentId, studentName, answerTimeMs, isCorrect) {
  const db = getDb();
  const activity = db.prepare('SELECT * FROM live_activities_v2 WHERE id = ?').get(activityId);
  if (!activity) return { points: 0, streak: 0 };

  const timerMs = Math.max(1000, (activity.timer_seconds || 30) * 1000);
  const clampedTime = Math.max(0, Math.min(answerTimeMs, timerMs));
  let points = isCorrect ? Math.round(1000 * (1 - (clampedTime / timerMs) * 0.5)) : 0;

  let streak = 0;
  if (isCorrect) {
    // Only count streaks within the same session, only for spark activities
    const prevScores = db.prepare(`
      SELECT ls.is_correct FROM live_scores ls
      JOIN live_activities_v2 la ON la.id = ls.activity_id
      WHERE ls.session_id = ? AND ls.student_id = ? AND ls.activity_id != ? AND la.category = 'spark'
      ORDER BY ls.rowid DESC
    `).all(activity.session_id, studentId, activityId);
    streak = countStreak(prevScores);
    points = Math.round(points * (1 + Math.min(streak * 0.1, 0.5)));
    streak += 1;
  }

  db.prepare(`
    INSERT INTO live_scores (session_id, student_id, student_name, activity_id, points, answer_time_ms, is_correct)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(activity_id, student_id) DO UPDATE SET
      points = excluded.points, answer_time_ms = excluded.answer_time_ms,
      is_correct = excluded.is_correct, student_name = excluded.student_name
  `).run(activity.session_id, studentId, studentName, activityId, points, answerTimeMs, isCorrect ? 1 : 0);

  return { points, streak };
}

function checkLiveCorrectness(activityId, answer) {
  const db = getDb();
  const activity = db.prepare('SELECT * FROM live_activities_v2 WHERE id = ?').get(activityId);
  if (!activity || !activity.correct_answers) return null;

  let parsed;
  try { parsed = JSON.parse(activity.correct_answers); } catch { return null; }
  if (!parsed || (typeof parsed !== 'object')) return null;

  if (activity.type === 'estimation') {
    const { target, margin } = parsed;
    if (target === undefined) return null;
    const studentVal = Number(answer);
    if (isNaN(studentVal)) return false;
    return Math.abs(studentVal - target) <= (margin ?? 0);
  }

  if (activity.type === 'association') {
    if (!Array.isArray(parsed)) return null;
    const mapping = String(answer).split(',').map(s => Number(s.trim()));
    if (mapping.length !== parsed.length) return false;
    return mapping.every((v, i) => v === i);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  if (activity.type === 'reponse_courte') {
    const student = normalizeAnswer(answer);
    if (!student) return false;
    return parsed.some(accepted => {
      const target = normalizeAnswer(accepted);
      if (student === target) return true;
      const maxDist = Math.max(1, Math.floor(target.length / 4));
      return levenshtein(student, target) <= maxDist;
    });
  }

  const correct = parsed;
  const student = String(answer).split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
  if (student.length === 0) return false;
  const sc = [...correct].sort((a, b) => a - b);
  const ss = [...student].sort((a, b) => a - b);
  if (sc.length !== ss.length) return false;
  return sc.every((v, i) => v === ss[i]);
}

function getLiveLeaderboard(sessionId) {
  const db = getDb();
  // Only count spark activities
  const rows = db.prepare(`
    SELECT ls.student_id, ls.student_name, SUM(ls.points) as total_points
    FROM live_scores ls
    JOIN live_activities_v2 la ON la.id = ls.activity_id
    WHERE ls.session_id = ? AND la.category = 'spark'
    GROUP BY ls.student_id
    ORDER BY total_points DESC
  `).all(sessionId);
  return rows.map((r, i) => ({ rank: i + 1, studentId: r.student_id, name: r.student_name, points: r.total_points }));
}

function getLiveLeaderboardWithRound(sessionId, activityId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT s.student_id, s.student_name, SUM(s.points) as total_points,
      COALESCE((SELECT points FROM live_scores WHERE activity_id = ? AND student_id = s.student_id), 0) as points_this_round
    FROM live_scores s
    JOIN live_activities_v2 la ON la.id = s.activity_id
    WHERE s.session_id = ? AND la.category = 'spark'
    GROUP BY s.student_id
    ORDER BY total_points DESC
  `).all(activityId, sessionId);
  return rows.map((r, i) => ({
    rank: i + 1, studentId: r.student_id, name: r.student_name,
    points: r.total_points, pointsThisRound: r.points_this_round,
  }));
}

function getLiveStudentRank(sessionId, studentId) {
  const board = getLiveLeaderboard(sessionId);
  const entry = board.find(e => e.studentId === studentId);
  return entry ? entry.rank : board.length + 1;
}

// ─── Aggregation (fusion live.js + rex.js) ─────────────────────────────────

function getLiveActivityResultsAggregated(activityId) {
  const db = getDb();
  const activity = db.prepare('SELECT * FROM live_activities_v2 WHERE id = ?').get(activityId);
  if (!activity) return null;

  const responses = db.prepare('SELECT * FROM live_responses_v2 WHERE activity_id = ?').all(activityId);
  const total = responses.length;

  // ── Spark types ─────────────────────────────────────────────────────
  if (activity.type === 'qcm' || activity.type === 'vrai_faux') {
    const counts = {};
    for (const r of responses) counts[r.answer] = (counts[r.answer] || 0) + 1;
    return { type: activity.type, total, counts };
  }
  if (activity.type === 'reponse_courte') {
    const counts = {};
    for (const r of responses) {
      const key = normalizeAnswer(r.answer);
      counts[key] = (counts[key] || 0) + 1;
    }
    return { type: 'reponse_courte', total, counts };
  }
  if (activity.type === 'association') {
    let parsed; try { parsed = JSON.parse(activity.correct_answers || '[]'); } catch { parsed = []; }
    let correctCount = 0;
    for (const r of responses) {
      const mapping = String(r.answer).split(',').map(Number);
      if (mapping.length === parsed.length && mapping.every((v, i) => v === i)) correctCount++;
    }
    return { type: 'association', total, correctCount };
  }
  if (activity.type === 'estimation') {
    let parsed; try { parsed = JSON.parse(activity.correct_answers || '{}'); } catch { parsed = {}; }
    const { target, margin } = parsed;
    const values = responses.map(r => Number(r.answer)).filter(n => !isNaN(n));
    let correctCount = 0;
    if (target !== undefined) {
      for (const v of values) if (Math.abs(v - target) <= (margin ?? 0)) correctCount++;
    }
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    return { type: 'estimation', total, correctCount, average: Math.round(avg * 100) / 100, values };
  }

  // ── Pulse types ─────────────────────────────────────────────────────
  if (activity.type === 'sondage_libre' || activity.type === 'nuage' && activity.category === 'pulse') {
    const counts = {};
    for (const r of responses) counts[r.answer] = (counts[r.answer] || 0) + 1;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (activity.type === 'nuage') {
      return { type: 'nuage', total, freq: sorted.map(([word, count]) => ({ word, count })) };
    }
    return { type: 'sondage_libre', total, counts: sorted.map(([text, count]) => ({ text, count })) };
  }
  // Spark nuage (word cloud from comma-separated words)
  if (activity.type === 'nuage') {
    const freq = {};
    for (const r of responses) {
      const words = r.answer.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
      for (const w of words) freq[w] = (freq[w] || 0) + 1;
    }
    return { type: 'nuage', total, freq };
  }
  if (activity.type === 'echelle') {
    const dist = {};
    for (const r of responses) {
      const n = Number(r.answer);
      if (!isNaN(n)) dist[n] = (dist[n] || 0) + 1;
    }
    const distribution = Object.entries(dist).map(([rating, count]) => ({ rating: Number(rating), count }));
    const sum = distribution.reduce((s, d) => s + d.rating * d.count, 0);
    const average = total > 0 ? Math.round((sum / total) * 100) / 100 : 0;
    return { type: 'echelle', total, distribution, average };
  }
  if (activity.type === 'question_ouverte') {
    const rows = db.prepare(
      'SELECT id, answer, pinned, created_at FROM live_responses_v2 WHERE activity_id = ? ORDER BY pinned DESC, created_at DESC'
    ).all(activityId);
    return { type: 'question_ouverte', total: rows.length, answers: rows.map(r => ({ id: r.id, answer: r.answer, pinned: !!r.pinned, created_at: r.created_at })) };
  }
  if (activity.type === 'sondage') {
    // Could be spark sondage (text) or pulse sondage (index into options)
    const counts = {};
    for (const r of responses) counts[r.answer] = (counts[r.answer] || 0) + 1;
    if (activity.category === 'pulse') {
      let opts = [];
      try { opts = JSON.parse(activity.options || '[]'); } catch { /* ignore */ }
      const ccts = opts.map((text, i) => ({ text, count: counts[String(i)] || 0 }));
      return { type: 'sondage', total, counts: ccts };
    }
    return { type: 'sondage', total, counts };
  }
  if (activity.type === 'humeur') {
    const counts = {};
    for (const r of responses) counts[r.answer] = (counts[r.answer] || 0) + 1;
    const emojis = Object.entries(counts).map(([emoji, count]) => ({ emoji, count })).sort((a, b) => b.count - a.count);
    return { type: 'humeur', total, emojis };
  }
  if (activity.type === 'priorite') {
    let items = [];
    try { items = JSON.parse(activity.options || '[]'); } catch { /* ignore */ }
    const rankSums = Array(items.length).fill(0);
    for (const r of responses) {
      const order = r.answer.split(',').map(Number);
      order.forEach((itemIdx, rank) => { if (itemIdx >= 0 && itemIdx < items.length) rankSums[itemIdx] += rank; });
    }
    const rankings = items.map((item, i) => ({ item, avgRank: total > 0 ? Math.round((rankSums[i] / total) * 100) / 100 : 0 }));
    rankings.sort((a, b) => a.avgRank - b.avgRank);
    return { type: 'priorite', total, rankings };
  }
  if (activity.type === 'matrice') {
    let names = [];
    try { names = JSON.parse(activity.options || '[]'); } catch { /* ignore */ }
    const sums = {};
    for (const name of names) sums[name] = 0;
    for (const r of responses) {
      try {
        const ratings = JSON.parse(r.answer);
        for (const name of names) if (ratings[name] !== undefined) sums[name] += Number(ratings[name]);
      } catch { /* ignore */ }
    }
    const criteria = names.map(name => ({ name, average: total > 0 ? Math.round((sums[name] / total) * 100) / 100 : 0 }));
    return { type: 'matrice', total, criteria };
  }

  // ── Code / Board : pas d'aggregation classique ─────────────────────
  if (activity.type === 'live_code') {
    return { type: 'live_code', total: 0, content: activity.content, language: activity.language };
  }
  if (activity.type === 'board') {
    const cards = getBoardCards(activityId);
    return { type: 'board', total: cards.length, cards };
  }

  return { type: activity.type, total, raw: responses };
}

// ─── Board ──────────────────────────────────────────────────────────────────

function getBoardCards(activityId, studentId = null) {
  const db = getDb();
  const cards = db.prepare(
    'SELECT * FROM live_board_cards WHERE activity_id = ? ORDER BY votes DESC, created_at ASC'
  ).all(activityId);
  if (studentId) {
    const votes = db.prepare('SELECT card_id FROM live_board_votes WHERE student_id = ?').all(studentId);
    const votedSet = new Set(votes.map(v => v.card_id));
    return cards.map(c => ({ ...c, voted_by_me: votedSet.has(c.id) }));
  }
  return cards;
}

function addBoardCard({ activityId, columnName, content, authorId, authorName, color }) {
  const db = getDb();
  const res = db.prepare(
    'INSERT INTO live_board_cards (activity_id, column_name, content, author_id, author_name, color) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(activityId, columnName || 'Idees', content, authorId, authorName, color || '#3b82f6');
  return db.prepare('SELECT * FROM live_board_cards WHERE id = ?').get(res.lastInsertRowid);
}

function deleteBoardCard(id) {
  return getDb().prepare('DELETE FROM live_board_cards WHERE id = ?').run(id);
}

function voteBoardCard(cardId, studentId) {
  const db = getDb();
  try {
    db.prepare('INSERT INTO live_board_votes (card_id, student_id) VALUES (?, ?)').run(cardId, studentId);
    db.prepare('UPDATE live_board_cards SET votes = votes + 1 WHERE id = ?').run(cardId);
    return true;
  } catch {
    return false;
  }
}

function unvoteBoardCard(cardId, studentId) {
  const db = getDb();
  const res = db.prepare('DELETE FROM live_board_votes WHERE card_id = ? AND student_id = ?').run(cardId, studentId);
  if (res.changes > 0) {
    db.prepare('UPDATE live_board_cards SET votes = MAX(0, votes - 1) WHERE id = ?').run(cardId);
    return true;
  }
  return false;
}

// ─── Historique / Stats ─────────────────────────────────────────────────────

function getEndedLiveSessionsForPromo(promoId, { search, dateFrom, dateTo } = {}) {
  const db = getDb();
  let where = "ls.promo_id = ? AND ls.status = 'ended'";
  const params = [promoId];
  if (search) { where += " AND ls.title LIKE '%' || ? || '%'"; params.push(search); }
  if (dateFrom) { where += ' AND ls.created_at >= ?'; params.push(dateFrom); }
  if (dateTo) { where += ' AND ls.created_at <= ?'; params.push(dateTo); }
  return db.prepare(`
    SELECT ls.*,
      (SELECT COUNT(*) FROM live_activities_v2 WHERE session_id = ls.id) AS activity_count,
      (SELECT COUNT(DISTINCT lr.student_id)
       FROM live_responses_v2 lr
       JOIN live_activities_v2 la ON lr.activity_id = la.id
       WHERE la.session_id = ls.id) AS participant_count
    FROM live_sessions_v2 ls
    WHERE ${where}
    ORDER BY ls.ended_at DESC
    LIMIT 50
  `).all(...params);
}

function getLiveStatsForPromoV2(promoId) {
  const db = getDb();
  const totalSessions = db.prepare("SELECT COUNT(*) as c FROM live_sessions_v2 WHERE promo_id = ? AND status = 'ended'").get(promoId).c;
  const enrolledStudents = db.prepare('SELECT COUNT(*) as c FROM students WHERE promo_id = ?').get(promoId).c;
  const activityTypeDistribution = db.prepare(`
    SELECT la.type, COUNT(*) as count
    FROM live_activities_v2 la
    JOIN live_sessions_v2 ls ON la.session_id = ls.id
    WHERE ls.promo_id = ? AND ls.status = 'ended'
    GROUP BY la.type
  `).all(promoId);
  const participationTrend = db.prepare(`
    SELECT ls.id as sessionId, ls.title, ls.ended_at as endedAt,
      (SELECT COUNT(DISTINCT lr.student_id)
       FROM live_responses_v2 lr
       JOIN live_activities_v2 la ON lr.activity_id = la.id
       WHERE la.session_id = ls.id) as participants
    FROM live_sessions_v2 ls
    WHERE ls.promo_id = ? AND ls.status = 'ended'
    ORDER BY ls.ended_at ASC
  `).all(promoId).map(r => ({ ...r, enrolled: enrolledStudents }));
  const avgParticipationRate = totalSessions > 0 && enrolledStudents > 0
    ? Math.round(participationTrend.reduce((s, r) => s + r.participants / r.enrolled, 0) / totalSessions * 100)
    : 0;
  const scoreAgg = db.prepare(`
    SELECT AVG(CASE WHEN ls2.answer_time_ms > 0 THEN ls2.answer_time_ms END) as avg_ms,
      COUNT(CASE WHEN ls2.is_correct = 1 THEN 1 END) as correct,
      COUNT(*) as total
    FROM live_scores ls2
    JOIN live_sessions_v2 sess ON sess.id = ls2.session_id
    WHERE sess.promo_id = ? AND sess.status = 'ended'
  `).get(promoId);
  return {
    totalSessions, avgParticipationRate, enrolledStudents, activityTypeDistribution, participationTrend,
    avgResponseTimeMs: Math.round(scoreAgg?.avg_ms ?? 0),
    avgCorrectnessRate: scoreAgg?.total > 0 ? Math.round(scoreAgg.correct / scoreAgg.total * 100) : 0,
  };
}

// ─── Export CSV ─────────────────────────────────────────────────────────────

function exportLiveSessionCsv(sessionId) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM live_sessions_v2 WHERE id = ?').get(sessionId);
  if (!session) throw new Error('Session introuvable');
  const activities = db.prepare('SELECT * FROM live_activities_v2 WHERE session_id = ? ORDER BY position ASC').all(sessionId);
  const scores = db.prepare(`
    SELECT ls.student_id, ls.student_name, ls.activity_id, ls.points, ls.is_correct, ls.answer_time_ms
    FROM live_scores ls WHERE ls.session_id = ?
  `).all(sessionId);
  const responses = db.prepare(`
    SELECT lr.activity_id, lr.student_id, lr.answer
    FROM live_responses_v2 lr
    JOIN live_activities_v2 la ON la.id = lr.activity_id
    WHERE la.session_id = ?
  `).all(sessionId);

  const respMap = new Map();
  for (const r of responses) respMap.set(`${r.activity_id}-${r.student_id}`, r.answer);
  const studentMap = new Map();
  for (const s of scores) if (!studentMap.has(s.student_id)) studentMap.set(s.student_id, s.student_name);
  for (const r of responses) if (!studentMap.has(r.student_id)) studentMap.set(r.student_id, `Etudiant ${r.student_id}`);
  const scoreMap = new Map();
  for (const s of scores) scoreMap.set(`${s.activity_id}-${s.student_id}`, s);

  const esc = (val) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) return '"' + str.replace(/"/g, '""') + '"';
    return str;
  };

  const headers = ['Etudiant'];
  for (const act of activities) {
    headers.push(`${act.title} (Reponse)`);
    if (act.category === 'spark') {
      headers.push(`${act.title} (Correct)`);
      headers.push(`${act.title} (Points)`);
      headers.push(`${act.title} (Temps ms)`);
    }
  }
  headers.push('Total Points');
  const rows = [headers.map(esc).join(',')];
  for (const [studentId, studentName] of studentMap) {
    const row = [esc(studentName)];
    let totalPts = 0;
    for (const act of activities) {
      const key = `${act.id}-${studentId}`;
      const resp = respMap.get(key) ?? '';
      row.push(esc(resp));
      if (act.category === 'spark') {
        const sc = scoreMap.get(key);
        row.push(sc ? (sc.is_correct ? 'Oui' : 'Non') : '');
        row.push(sc ? String(sc.points) : '0');
        row.push(sc ? String(sc.answer_time_ms) : '');
        totalPts += sc ? sc.points : 0;
      }
    }
    row.push(String(totalPts));
    rows.push(row.join(','));
  }
  return rows.join('\n');
}

module.exports = {
  // Helpers
  getActivityCategory,
  // Sessions
  createLiveSession, getLiveSession, getLiveSessionByCode,
  getActiveLiveSessionForPromo, getLiveSessionsForPromo,
  updateLiveSessionStatus, deleteLiveSession, cloneLiveSession,
  // Activities
  addLiveActivity, updateLiveActivity, deleteLiveActivity,
  reorderLiveActivities, setLiveActivityStatus, saveLiveCodeSnapshot,
  // Responses
  submitLiveResponse, hasStudentRespondedLive, toggleLivePin,
  // Scoring (spark)
  calculateLiveScore, checkLiveCorrectness,
  getLiveLeaderboard, getLiveLeaderboardWithRound, getLiveStudentRank,
  // Aggregation
  getLiveActivityResultsAggregated,
  // Board
  getBoardCards, addBoardCard, deleteBoardCard, voteBoardCard, unvoteBoardCard,
  // Historique / Stats / Export
  getEndedLiveSessionsForPromo, getLiveStatsForPromoV2, exportLiveSessionCsv,
};
