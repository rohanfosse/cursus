// ─── Model : exam_events ───────────────────────────────────────────────────
// Timeline des comportements suspects pendant un examen surveille (focus
// loss, paste bloque, heartbeat) + jalons (exam_start / exam_submit /
// exam_timeout / crash_recovered). Cf. table exam_events de la migration
// v95 (server/db/schema.js).
//
// Aucun PII / aucune image / aucun audio. Le payload est un JSON libre
// pour les metadonnees (taille du paste tente, duree du focus loss, ...).

const { getDb } = require('../connection');

const VALID_TYPES = new Set([
  'exam_start', 'exam_submit', 'exam_timeout',
  'focus_loss', 'paste_blocked', 'heartbeat', 'crash_recovered',
]);

function addExamEvent({ travailId, studentId, type, ts, payload }) {
  if (!VALID_TYPES.has(type)) throw new Error(`Type d'event examen invalide : ${type}`);
  const tsMs = Number.isFinite(ts) ? Math.trunc(ts) : Date.now();
  const payloadStr = payload == null ? null : JSON.stringify(payload);
  return getDb().prepare(`
    INSERT INTO exam_events (travail_id, student_id, type, ts, payload)
    VALUES (?, ?, ?, ?, ?)
  `).run(travailId, studentId, type, tsMs, payloadStr);
}

function getExamEvents(travailId, studentId) {
  const rows = studentId != null
    ? getDb().prepare(`
        SELECT id, travail_id, student_id, type, ts, payload
        FROM exam_events
        WHERE travail_id = ? AND student_id = ?
        ORDER BY ts ASC
      `).all(travailId, studentId)
    : getDb().prepare(`
        SELECT id, travail_id, student_id, type, ts, payload
        FROM exam_events
        WHERE travail_id = ?
        ORDER BY ts ASC
      `).all(travailId);
  return rows.map((r) => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : null }));
}

/** Aggregation par etudiant pour la vue prof post-mortem. */
function getExamEventSummary(travailId) {
  return getDb().prepare(`
    SELECT
      student_id,
      SUM(type = 'focus_loss')    AS focus_loss_count,
      SUM(type = 'paste_blocked') AS paste_blocked_count,
      MAX(CASE WHEN type = 'exam_start'  THEN ts END) AS started_at,
      MAX(CASE WHEN type = 'exam_submit' THEN ts END) AS submitted_at,
      MAX(CASE WHEN type = 'exam_timeout' THEN ts END) AS timed_out_at,
      MAX(ts) AS last_event_at
    FROM exam_events
    WHERE travail_id = ?
    GROUP BY student_id
  `).all(travailId);
}

module.exports = { addExamEvent, getExamEvents, getExamEventSummary };
