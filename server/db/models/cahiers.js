const { getDb } = require('../connection');

/** List cahiers for a promo, optionally filtered by project */
function getCahiers(promoId, project) {
  if (project) {
    return getDb().prepare(`
      SELECT c.id, c.promo_id, c.group_id, c.project, c.title,
             c.created_by, c.created_at, c.updated_at,
             u.name AS author_name
      FROM cahiers c
      LEFT JOIN users u ON u.id = c.created_by
      WHERE c.promo_id = ? AND c.project = ?
      ORDER BY c.updated_at DESC
    `).all(promoId, project);
  }
  return getDb().prepare(`
    SELECT c.id, c.promo_id, c.group_id, c.project, c.title,
           c.created_by, c.created_at, c.updated_at,
           u.name AS author_name
    FROM cahiers c
    LEFT JOIN users u ON u.id = c.created_by
    WHERE c.promo_id = ?
    ORDER BY c.updated_at DESC
  `).all(promoId);
}

/** Get a single cahier by id (without yjs_state for listing) */
function getCahierById(id) {
  return getDb().prepare(`
    SELECT c.id, c.promo_id, c.group_id, c.project, c.title,
           c.created_by, c.created_at, c.updated_at,
           u.name AS author_name
    FROM cahiers c
    LEFT JOIN users u ON u.id = c.created_by
    WHERE c.id = ?
  `).get(id);
}

/** Get Yjs document state (BLOB) for collaborative sync */
function getCahierYjsState(id) {
  const row = getDb().prepare('SELECT yjs_state FROM cahiers WHERE id = ?').get(id);
  return row?.yjs_state ?? null;
}

/** Save Yjs document state (BLOB) */
function saveCahierYjsState(id, yjsState) {
  return getDb().prepare(`
    UPDATE cahiers SET yjs_state = ?, updated_at = datetime('now') WHERE id = ?
  `).run(yjsState, id);
}

/** Create a new cahier */
function createCahier({ promoId, project, title, createdBy, groupId }) {
  const result = getDb().prepare(`
    INSERT INTO cahiers (promo_id, project, title, created_by, group_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(promoId, project || null, title || 'Sans titre', createdBy, groupId || null);
  return { id: result.lastInsertRowid };
}

/** Rename a cahier */
function renameCahier(id, title) {
  return getDb().prepare(`
    UPDATE cahiers SET title = ?, updated_at = datetime('now') WHERE id = ?
  `).run(title, id);
}

/** Delete a cahier */
function deleteCahier(id) {
  return getDb().prepare('DELETE FROM cahiers WHERE id = ?').run(id);
}

module.exports = {
  getCahiers,
  getCahierById,
  getCahierYjsState,
  saveCahierYjsState,
  createCahier,
  renameCahier,
  deleteCahier,
};
