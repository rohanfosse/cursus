const { getDb } = require('../connection');

function getProjectDocuments(promoId, project) {
  if (project) {
    return getDb().prepare(`
      SELECT cd.*, cd.path_or_url AS content, cd.file_size, t.title AS travail_title
      FROM channel_documents cd
      LEFT JOIN travaux t ON t.id = cd.travail_id
      WHERE cd.promo_id = ? AND cd.project = ?
      ORDER BY cd.category ASC, cd.created_at ASC
    `).all(promoId, project);
  }
  return getDb().prepare(`
    SELECT cd.*, cd.path_or_url AS content, cd.file_size, t.title AS travail_title
    FROM channel_documents cd
    LEFT JOIN travaux t ON t.id = cd.travail_id
    WHERE cd.promo_id = ?
    ORDER BY cd.category ASC, cd.created_at ASC
  `).all(promoId);
}

// Retourne les documents du canal + ceux du projet associé au canal
function getChannelDocuments(channelId) {
  const db = getDb()
  // Récupérer la catégorie (projet) et promo du canal
  const ch = db.prepare('SELECT promo_id, category FROM channels WHERE id = ?').get(channelId)
  if (ch?.category) {
    return db.prepare(`
      SELECT cd.*, cd.path_or_url AS content, cd.file_size, t.title AS travail_title
      FROM channel_documents cd
      LEFT JOIN travaux t ON t.id = cd.travail_id
      WHERE cd.channel_id = ? OR (cd.promo_id = ? AND cd.project = ?)
      ORDER BY cd.category ASC, cd.created_at ASC
    `).all(channelId, ch.promo_id, ch.category)
  }
  return db.prepare(`
    SELECT cd.*, cd.path_or_url AS content, cd.file_size, t.title AS travail_title
    FROM channel_documents cd
    LEFT JOIN travaux t ON t.id = cd.travail_id
    WHERE cd.channel_id = ?
    ORDER BY cd.category ASC, cd.created_at ASC
  `).all(channelId)
}

function getPromoDocuments(promoId) {
  return getDb().prepare(`
    SELECT cd.*, cd.path_or_url AS content, cd.file_size, t.title AS travail_title
    FROM channel_documents cd
    LEFT JOIN travaux t ON t.id = cd.travail_id
    WHERE cd.promo_id = ?
    ORDER BY cd.category ASC, cd.created_at ASC
  `).all(promoId);
}

function addProjectDocument({ promoId, project, category, type, name, pathOrUrl, description, travailId, fileSize }) {
  return getDb().prepare(`
    INSERT INTO channel_documents (promo_id, project, category, type, name, path_or_url, description, travail_id, file_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(promoId, project ?? null, category || 'Général', type, name, pathOrUrl, description ?? null, travailId ?? null, fileSize ?? null);
}

// Alias for backwards compat
function addChannelDocument({ channelId, promoId, project, category, type, name, pathOrUrl, description }) {
  if (promoId) return addProjectDocument({ promoId, project, category, type, name, pathOrUrl, description });
  // legacy: derive promoId from channelId
  const ch = getDb().prepare('SELECT promo_id, category FROM channels WHERE id = ?').get(channelId);
  return addProjectDocument({
    promoId: ch?.promo_id ?? null,
    project: project ?? ch?.category ?? null,
    category, type, name, pathOrUrl, description,
  });
}

function updateProjectDocument({ id, name, category, description, travailId }) {
  return getDb().prepare(`
    UPDATE channel_documents
    SET name = ?, category = ?, description = ?, travail_id = ?
    WHERE id = ?
  `).run(name, category || 'Général', description ?? null, travailId ?? null, id);
}

function deleteChannelDocument(id) {
  return getDb().prepare('DELETE FROM channel_documents WHERE id = ?').run(id);
}

function getProjectDocumentCategories(promoId, project) {
  if (project) {
    return getDb().prepare(`
      SELECT DISTINCT category FROM channel_documents
      WHERE promo_id = ? AND project = ?
      ORDER BY category ASC
    `).all(promoId, project).map(r => r.category);
  }
  return getDb().prepare(`
    SELECT DISTINCT category FROM channel_documents WHERE promo_id = ? ORDER BY category ASC
  `).all(promoId).map(r => r.category);
}

// Alias kept for IPC backwards compat
function getChannelDocumentCategories(channelId) {
  return getDb().prepare(`
    SELECT DISTINCT category FROM channel_documents WHERE channel_id = ? ORDER BY category ASC
  `).all(channelId).map(r => r.category);
}

function searchDocuments(promoId, query) {
  const q = (query ?? '').trim().slice(0, 200);
  if (!q) return [];
  return getDb().prepare(`
    SELECT id, name, type, category, path_or_url AS content, travail_id, created_at
    FROM channel_documents
    WHERE promo_id = ? AND name LIKE '%' || ? || '%'
    ORDER BY created_at DESC
    LIMIT 20
  `).all(promoId, q);
}

function linkDocumentToTravail(docId, travailId) {
  return getDb().prepare('UPDATE channel_documents SET travail_id = ? WHERE id = ?').run(travailId ?? null, docId);
}

module.exports = {
  getProjectDocuments, getChannelDocuments,
  getPromoDocuments, addProjectDocument, addChannelDocument,
  updateProjectDocument, deleteChannelDocument,
  getProjectDocumentCategories, getChannelDocumentCategories,
  searchDocuments, linkDocumentToTravail,
};
