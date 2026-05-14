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
  const db = getDb()

  // ── Guard : blocage strict post-échéance ─────────────────────────────────
  const travail = db.prepare('SELECT deadline, type, requires_submission, group_id FROM travaux WHERE id = ?').get(travailId)
  if (travail && travail.requires_submission) {
    if (Date.now() > new Date(travail.deadline).getTime()) {
      throw new Error('Délai expiré - dépôt refusé.')
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  const studentId  = payload.student_id  ?? payload.studentId
  const type       = payload.type        ?? 'file'
  const content    = payload.content     ?? payload.filePath ?? payload.linkUrl ?? ''
  const fileName   = payload.file_name   ?? payload.fileName
    ?? (type === 'link' ? '🔗 Lien web' : type === 'code' ? '💻 Code (examen)' : '')
  const filePath   = type === 'file' ? content : (payload.filePath ?? '')
  const linkUrl    = type === 'link' ? content : (payload.linkUrl  ?? null)
  const deployUrl  = payload.deploy_url  ?? payload.deployUrl ?? null
  const codeContent = type === 'code' ? content : (payload.code_content ?? payload.codeContent ?? null)

  // ── Devoirs de groupe : modele "un depot = toute l'equipe" ──────────────
  // N'importe quel membre peut soumettre OU ecraser le depot du groupe.
  // student_id sur le depot = dernier uploader (coherent avec "pas d'historique v1").
  // On ne peut pas utiliser ON CONFLICT(travail_id, group_id) car l'index
  // est partiel (WHERE group_id IS NOT NULL) — SQLite refuse l'upsert dans
  // ce cas. On fait donc un SELECT + UPDATE/INSERT manuel.
  if (travail && travail.group_id) {
    const existing = db.prepare(
      'SELECT id FROM depots WHERE travail_id = ? AND group_id = ?'
    ).get(travailId, travail.group_id)
    if (existing) {
      return db.prepare(`
        UPDATE depots SET
          student_id   = ?,
          file_name    = ?,
          file_path    = ?,
          link_url     = ?,
          deploy_url   = ?,
          code_content = ?,
          submitted_at = datetime('now')
        WHERE id = ?
      `).run(studentId, fileName, filePath, linkUrl, deployUrl, codeContent, existing.id)
    }
    return db.prepare(`
      INSERT INTO depots (travail_id, student_id, group_id, file_name, file_path, link_url, deploy_url, code_content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(travailId, studentId, travail.group_id, fileName, filePath, linkUrl, deployUrl, codeContent)
  }

  // ── Devoir individuel : upsert classique sur (travail_id, student_id) ───
  return db.prepare(`
    INSERT INTO depots (travail_id, student_id, file_name, file_path, link_url, deploy_url, code_content)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(travail_id, student_id) DO UPDATE SET
      file_name    = excluded.file_name,
      link_url     = excluded.link_url,
      deploy_url   = excluded.deploy_url,
      file_path    = excluded.file_path,
      code_content = excluded.code_content,
      submitted_at = datetime('now')
  `).run(travailId, studentId, fileName, filePath, linkUrl, deployUrl, codeContent);
}

function setNote({ depotId, note }) {
  return getDb().prepare('UPDATE depots SET note = ? WHERE id = ?').run(note, depotId);
}

function setFeedback({ depotId, feedback }) {
  return getDb().prepare('UPDATE depots SET feedback = ? WHERE id = ?').run(feedback, depotId);
}

// ─── Ressources ───────────────────────────────────────────────────────────────

function getRessources(travailId) {
  return getDb().prepare(`
    SELECT id, travail_id, type, name, path_or_url AS content, category, created_at, 'ressource' AS source
    FROM ressources WHERE travail_id = ?
    UNION ALL
    SELECT id, travail_id, type, name, path_or_url AS content, category, created_at, 'document' AS source
    FROM channel_documents WHERE travail_id = ?
    ORDER BY created_at ASC
  `).all(travailId, travailId);
}

function addRessource({ travailId, type, name, pathOrUrl, category }) {
  const db = getDb()
  const travail = db.prepare('SELECT promo_id, category AS project FROM travaux WHERE id = ?').get(travailId)
  if (!travail) throw new Error('Travail introuvable')
  return db.prepare(`
    INSERT INTO channel_documents (promo_id, project, category, type, name, path_or_url, travail_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(travail.promo_id, travail.project ?? null, category ?? 'autre', type, name, pathOrUrl, travailId)
}

function deleteRessource(ressourceId) {
  return getDb().prepare('DELETE FROM ressources WHERE id = ?').run(ressourceId);
}

module.exports = {
  getDepots, addDepot, setNote, setFeedback,
  getRessources, addRessource, deleteRessource,
};
