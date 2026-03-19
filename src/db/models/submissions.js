const { getDb } = require('../connection');

// ─── Dépôts ───────────────────────────────────────────────────────────────────

function getDepots(travailId) {
  return getDb().prepare(`
    SELECT d.*, s.name AS student_name, s.avatar_initials,
      CASE
        WHEN d.submitted_at > t.deadline
        THEN CAST((julianday(d.submitted_at) - julianday(t.deadline)) * 86400 AS INTEGER)
        ELSE 0
      END AS late_seconds
    FROM depots d
    JOIN students s ON d.student_id = s.id
    JOIN travaux t  ON d.travail_id = t.id
    WHERE d.travail_id = ?
    ORDER BY d.submitted_at DESC
  `).all(travailId);
}

function addDepot(payload) {
  // Accepte snake_case (frontend) ou camelCase (legacy)
  const travailId  = payload.travail_id  ?? payload.travailId

  // ── Guard : blocage strict post-échéance ─────────────────────────────────
  const NO_DEPOT_TYPES = ['soutenance', 'cctl']
  const travail = getDb().prepare('SELECT deadline, type FROM travaux WHERE id = ?').get(travailId)
  if (travail && !NO_DEPOT_TYPES.includes(travail.type)) {
    if (Date.now() > new Date(travail.deadline).getTime()) {
      throw new Error('Délai expiré — dépôt refusé.')
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  const studentId  = payload.student_id  ?? payload.studentId
  const type       = payload.type        ?? 'file'
  const content    = payload.content     ?? payload.filePath ?? payload.linkUrl ?? ''
  const fileName   = payload.file_name   ?? payload.fileName ?? (type === 'link' ? '🔗 Lien web' : '')
  const filePath   = type === 'file' ? content : (payload.filePath ?? '')
  const linkUrl    = type === 'link' ? content : (payload.linkUrl  ?? null)
  const deployUrl  = payload.deploy_url  ?? payload.deployUrl ?? null

  return getDb().prepare(`
    INSERT INTO depots (travail_id, student_id, file_name, file_path, link_url, deploy_url)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(travail_id, student_id) DO UPDATE SET
      file_name    = excluded.file_name,
      link_url     = excluded.link_url,
      deploy_url   = excluded.deploy_url,
      file_path    = excluded.file_path,
      submitted_at = datetime('now')
  `).run(travailId, studentId, fileName, filePath, linkUrl, deployUrl);
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
    'SELECT *, path_or_url AS content FROM ressources WHERE travail_id = ? ORDER BY created_at ASC'
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

module.exports = {
  getDepots, addDepot, setNote, setFeedback,
  getRessources, addRessource, deleteRessource,
};
