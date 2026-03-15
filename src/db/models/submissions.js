const { getDb } = require('../connection');

// ─── Dépôts ───────────────────────────────────────────────────────────────────

function getDepots(travailId) {
  return getDb().prepare(`
    SELECT d.*, s.name AS student_name, s.avatar_initials
    FROM depots d JOIN students s ON d.student_id = s.id
    WHERE d.travail_id = ?
    ORDER BY d.submitted_at DESC
  `).all(travailId);
}

function addDepot({ travailId, studentId, fileName, filePath, linkUrl, deployUrl }) {
  return getDb().prepare(`
    INSERT INTO depots (travail_id, student_id, file_name, file_path, link_url, deploy_url)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(travail_id, student_id) DO UPDATE SET
      file_name    = excluded.file_name,
      link_url     = excluded.link_url,
      deploy_url   = excluded.deploy_url,
      file_path    = excluded.file_path,
      submitted_at = datetime('now')
  `).run(travailId, studentId, fileName ?? '🔗 Lien web', filePath ?? '', linkUrl ?? null, deployUrl ?? null);
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

module.exports = {
  getDepots, addDepot, setNote, setFeedback,
  getRessources, addRessource, deleteRessource,
};
