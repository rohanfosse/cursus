/** Engagement analytics — score d'engagement par etudiant. */
const { getDb } = require('../connection');

/**
 * Calcule un score d'engagement pour chaque etudiant d'une promo.
 * Composantes :
 *  - Messages envoyes dans les canaux de la promo (poids 1 par message)
 *  - Devoirs rendus a temps (poids 3 par devoir)
 *  - Devoirs rendus en retard (poids 1 par devoir, mieux que rien)
 *  - Devoirs non rendus (poids -2 par devoir manque)
 *  - Derniere activite (bonus si < 7 jours)
 */
function computeEngagementScores(promoId) {
  const db = getDb();

  // 1. Messages par etudiant (canaux de la promo)
  const msgCounts = db.prepare(`
    SELECT m.author_name AS name, COUNT(*) AS msg_count
    FROM messages m
    JOIN channels c ON m.channel_id = c.id
    WHERE c.promo_id = ? AND m.dm_student_id IS NULL
    GROUP BY m.author_name
  `).all(promoId);
  const msgMap = new Map(msgCounts.map(r => [r.name, r.msg_count]));

  // 2. Devoirs rendus (par etudiant)
  const devoirStats = db.prepare(`
    SELECT s.id, s.name,
      COUNT(t.id) AS total_devoirs,
      COUNT(d.id) AS submitted,
      SUM(CASE WHEN d.id IS NOT NULL AND d.submitted_at <= t.deadline THEN 1 ELSE 0 END) AS on_time,
      SUM(CASE WHEN d.id IS NOT NULL AND d.submitted_at > t.deadline THEN 1 ELSE 0 END) AS late,
      SUM(CASE WHEN d.id IS NULL AND t.requires_submission = 1 THEN 1 ELSE 0 END) AS missing
    FROM students s
    CROSS JOIN travaux t ON t.promo_id = s.promo_id AND t.published = 1
    LEFT JOIN depots d ON d.travail_id = t.id AND d.student_id = s.id
    WHERE s.promo_id = ?
    GROUP BY s.id
  `).all(promoId);

  // 3. Derniere activite (dernier message)
  const lastActivity = db.prepare(`
    SELECT m.author_name AS name, MAX(m.created_at) AS last_at
    FROM messages m
    JOIN channels c ON m.channel_id = c.id
    WHERE c.promo_id = ?
    GROUP BY m.author_name
  `).all(promoId);
  const lastMap = new Map(lastActivity.map(r => [r.name, r.last_at]));

  // 4. Calculer le score
  const now = Date.now();
  const SEVEN_DAYS = 7 * 86400000;

  const results = devoirStats.map(s => {
    const msgs = msgMap.get(s.name) ?? 0;
    const onTime = s.on_time ?? 0;
    const late = s.late ?? 0;
    const missing = s.missing ?? 0;

    // Score brut
    let score = (msgs * 1) + (onTime * 3) + (late * 1) + (missing * -2);

    // Bonus activite recente
    const lastAt = lastMap.get(s.name);
    if (lastAt && (now - new Date(lastAt).getTime()) < SEVEN_DAYS) {
      score += 5;
    }

    // Normaliser sur 100 (max theorique = msgs + devoirs * 3 + 5)
    const maxPossible = Math.max(1, (s.total_devoirs * 3) + 15 + 5); // 15 messages "normaux"
    const normalized = Math.min(100, Math.max(0, Math.round((score / maxPossible) * 100)));

    return {
      studentId: s.id,
      name: s.name,
      score: normalized,
      messages: msgs,
      onTime,
      late,
      missing,
      totalDevoirs: s.total_devoirs,
      submitted: s.submitted,
      lastActivity: lastAt ?? null,
      atRisk: normalized < 30,
    };
  });

  return results.sort((a, b) => b.score - a.score);
}

module.exports = { computeEngagementScores };
