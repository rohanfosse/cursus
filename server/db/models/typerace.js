/**
 * Modele DB TypeRace — mini-jeu typing speed avec leaderboard par promo.
 *
 * Schema (v73) :
 *   typerace_scores — 1 ligne par partie jouee (re-jouable illimitee).
 *
 * Aggregation du leaderboard : on prend le MEILLEUR score par user dans
 * la fenetre consideree (jour / semaine / all-time). On filtre les teachers
 * de la vue etudiante (spec : profs peuvent jouer mais n'apparaissent pas
 * dans le leaderboard public).
 */
const { getDb } = require('../connection')

function insertScore({ userType, userId, promoId, phraseId, wpm, accuracy, score, durationMs }) {
  const info = getDb().prepare(`
    INSERT INTO typerace_scores (user_type, user_id, promo_id, phrase_id, wpm, accuracy, score, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userType, userId, promoId ?? null, phraseId, wpm, accuracy, score, durationMs)
  return { id: info.lastInsertRowid }
}

/**
 * Top N de la fenetre (par defaut 10) agregee par user : on garde le
 * meilleur score de chaque user dans la periode. Teachers filtres.
 *
 * @param {object} opts
 * @param {number|null} opts.promoId — null = toutes promos confondues
 * @param {'day'|'week'|'all'} opts.scope
 * @param {number} [opts.limit=10]
 */
function getLeaderboard({ promoId, scope = 'day', limit = 10 }) {
  const windowClause = windowSqlForScope(scope)
  const params = []
  let promoClause = ''
  if (promoId != null) {
    promoClause = 'AND ts.promo_id = ?'
    params.push(promoId)
  }

  // On utilise une sous-requete qui prend le meilleur score par user, puis
  // on JOIN sur students pour recuperer le nom. Les teachers sont exclus
  // via `ts.user_type = 'student'`.
  const rows = getDb().prepare(`
    SELECT
      ts.user_id AS userId,
      s.name     AS name,
      MAX(ts.score) AS bestScore,
      MAX(ts.wpm)   AS bestWpm,
      COUNT(*)      AS plays
    FROM typerace_scores ts
    JOIN students s ON s.id = ts.user_id
    WHERE ts.user_type = 'student'
      ${windowClause}
      ${promoClause}
    GROUP BY ts.user_id
    ORDER BY bestScore DESC, bestWpm DESC
    LIMIT ?
  `).all(...params, limit)

  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    name: r.name,
    bestScore: Math.round(r.bestScore),
    bestWpm: Math.round(r.bestWpm * 10) / 10, // 1 decimale
    plays: r.plays,
  }))
}

function getUserStats(userType, userId) {
  const db = getDb()

  const all = db.prepare(`
    SELECT
      COUNT(*)      AS plays,
      MAX(score)    AS bestScore,
      MAX(wpm)      AS bestWpm,
      AVG(wpm)      AS avgWpm,
      AVG(accuracy) AS avgAccuracy
    FROM typerace_scores
    WHERE user_type = ? AND user_id = ?
  `).get(userType, userId)

  const today = db.prepare(`
    SELECT MAX(score) AS bestScore, MAX(wpm) AS bestWpm, COUNT(*) AS plays
    FROM typerace_scores
    WHERE user_type = ? AND user_id = ?
      AND created_at >= datetime('now', 'start of day')
  `).get(userType, userId)

  const week = db.prepare(`
    SELECT MAX(score) AS bestScore
    FROM typerace_scores
    WHERE user_type = ? AND user_id = ?
      AND created_at >= datetime('now', '-7 days')
  `).get(userType, userId)

  // Historique 30 derniers jours : 1 point par partie (pour graphique)
  const history = db.prepare(`
    SELECT id, score, wpm, accuracy, duration_ms AS durationMs, created_at AS createdAt
    FROM typerace_scores
    WHERE user_type = ? AND user_id = ?
      AND created_at >= datetime('now', '-30 days')
    ORDER BY created_at DESC
    LIMIT 100
  `).all(userType, userId)

  return {
    allTime: {
      plays: all.plays ?? 0,
      bestScore: Math.round(all.bestScore ?? 0),
      bestWpm: Math.round((all.bestWpm ?? 0) * 10) / 10,
      avgWpm: Math.round((all.avgWpm ?? 0) * 10) / 10,
      avgAccuracy: Math.round((all.avgAccuracy ?? 0) * 1000) / 1000,
    },
    today: {
      bestScore: Math.round(today.bestScore ?? 0),
      bestWpm: Math.round((today.bestWpm ?? 0) * 10) / 10,
      plays: today.plays ?? 0,
    },
    week: {
      bestScore: Math.round(week.bestScore ?? 0),
    },
    history,
  }
}

/** Nombre de parties jouees aujourd'hui (utilise pour le cap engagement). */
function countTodayPlays(userType, userId) {
  const row = getDb().prepare(`
    SELECT COUNT(*) AS n
    FROM typerace_scores
    WHERE user_type = ? AND user_id = ?
      AND created_at >= datetime('now', 'start of day')
  `).get(userType, userId)
  return row?.n ?? 0
}

function windowSqlForScope(scope) {
  if (scope === 'day')  return "AND ts.created_at >= datetime('now', 'start of day')"
  if (scope === 'week') return "AND ts.created_at >= datetime('now', '-7 days')"
  return '' // 'all'
}

module.exports = {
  insertScore,
  getLeaderboard,
  getUserStats,
  countTodayPlays,
}
