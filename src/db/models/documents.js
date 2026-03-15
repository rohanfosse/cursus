const { getDb } = require('../connection');

function getChannelDocuments(channelId) {
  return getDb().prepare(`
    SELECT * FROM channel_documents WHERE channel_id = ? ORDER BY category ASC, created_at ASC
  `).all(channelId);
}

function getPromoDocuments(promoId) {
  return getDb().prepare(`
    SELECT cd.*, c.name AS channel_name
    FROM channel_documents cd
    JOIN channels c ON cd.channel_id = c.id
    WHERE c.promo_id = ?
    ORDER BY cd.category ASC, cd.created_at ASC
  `).all(promoId);
}

function addChannelDocument({ channelId, category, type, name, pathOrUrl, description }) {
  return getDb().prepare(`
    INSERT INTO channel_documents (channel_id, category, type, name, path_or_url, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(channelId, category || 'Général', type, name, pathOrUrl, description ?? null);
}

function deleteChannelDocument(id) {
  return getDb().prepare('DELETE FROM channel_documents WHERE id = ?').run(id);
}

function getChannelDocumentCategories(channelId) {
  return getDb().prepare(`
    SELECT DISTINCT category FROM channel_documents WHERE channel_id = ? ORDER BY category ASC
  `).all(channelId).map(r => r.category);
}

module.exports = {
  getChannelDocuments, getPromoDocuments,
  addChannelDocument, deleteChannelDocument, getChannelDocumentCategories,
};
