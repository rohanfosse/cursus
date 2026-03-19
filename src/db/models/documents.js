const { getDb } = require('../connection');

function getProjectDocuments(promoId, project) {
  if (project) {
    return getDb().prepare(`
      SELECT *, path_or_url AS content FROM channel_documents
      WHERE promo_id = ? AND project = ?
      ORDER BY category ASC, created_at ASC
    `).all(promoId, project);
  }
  return getDb().prepare(`
    SELECT *, path_or_url AS content FROM channel_documents
    WHERE promo_id = ?
    ORDER BY category ASC, created_at ASC
  `).all(promoId);
}

// Alias kept for IPC backwards compat
function getChannelDocuments(channelId) {
  return getDb().prepare(`
    SELECT *, path_or_url AS content FROM channel_documents WHERE channel_id = ? ORDER BY category ASC, created_at ASC
  `).all(channelId);
}

function getPromoDocuments(promoId) {
  return getDb().prepare(`
    SELECT *, path_or_url AS content FROM channel_documents WHERE promo_id = ?
    ORDER BY category ASC, created_at ASC
  `).all(promoId);
}

function addProjectDocument({ promoId, project, category, type, name, pathOrUrl, description }) {
  return getDb().prepare(`
    INSERT INTO channel_documents (promo_id, project, category, type, name, path_or_url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(promoId, project ?? null, category || 'Général', type, name, pathOrUrl, description ?? null);
}

// Alias for backwards compat
function addChannelDocument({ channelId, promoId, project, category, type, name, pathOrUrl, description }) {
  if (promoId) return addProjectDocument({ promoId, project, category, type, name, pathOrUrl, description });
  // legacy: derive promoId from channelId
  const ch = getDb().prepare('SELECT promo_id, category FROM channels WHERE id = ?').get(channelId);
  return addProjectDocument({
    promoId: ch?.promo_id ?? 1,
    project: project ?? ch?.category ?? null,
    category, type, name, pathOrUrl, description,
  });
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

module.exports = {
  getProjectDocuments, getChannelDocuments,
  getPromoDocuments, addProjectDocument, addChannelDocument,
  deleteChannelDocument,
  getProjectDocumentCategories, getChannelDocumentCategories,
};
