const { getDb } = require('../connection');

function getPromotions() {
  return getDb().prepare('SELECT * FROM promotions ORDER BY name').all();
}

function getChannels(promoId) {
  return getDb().prepare(
    "SELECT * FROM channels WHERE promo_id = ? ORDER BY COALESCE(category, 'zzz') ASC, type DESC, name ASC"
  ).all(promoId);
}

function createPromotion({ name, color }) {
  const db      = getDb();
  const promoId = db.prepare('INSERT INTO promotions (name, color) VALUES (?, ?)').run(name, color).lastInsertRowid;
  db.prepare("INSERT INTO channels (promo_id, name, description, type) VALUES (?, 'annonces', 'Informations importantes', 'annonce')").run(promoId);
  db.prepare("INSERT INTO channels (promo_id, name, description, type) VALUES (?, 'general', 'Canal principal', 'chat')").run(promoId);
  return promoId;
}

function deletePromotion(promoId) {
  return getDb().prepare('DELETE FROM promotions WHERE id = ?').run(promoId);
}

function createChannel({ promoId, name, type, isPrivate, members, category }) {
  const db          = getDb();
  const membersJson = isPrivate && members?.length ? JSON.stringify(members) : null;
  const chType      = type === 'annonce' ? 'annonce' : 'chat';
  return db.prepare(
    'INSERT INTO channels (promo_id, name, description, type, is_private, members, category) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(promoId, name, '', chType, isPrivate ? 1 : 0, membersJson, category ?? null).lastInsertRowid;
}

function renameChannel(id, name) {
  return getDb().prepare('UPDATE channels SET name = ? WHERE id = ?').run(name, id);
}

function deleteChannel(id) {
  return getDb().prepare('DELETE FROM channels WHERE id = ?').run(id);
}

/** Renomme la catégorie pour tous les canaux d'une promo */
function renameCategory(promoId, oldCategory, newCategory) {
  return getDb().prepare('UPDATE channels SET category = ? WHERE promo_id = ? AND category = ?')
    .run(newCategory, promoId, oldCategory);
}

/** Dégroupe la catégorie (met category = null) sans supprimer les canaux */
function deleteCategory(promoId, category) {
  return getDb().prepare('UPDATE channels SET category = NULL WHERE promo_id = ? AND category = ?')
    .run(promoId, category);
}

function updateChannelMembers({ channelId, members }) {
  const membersJson = members?.length ? JSON.stringify(members) : null;
  return getDb().prepare('UPDATE channels SET members = ? WHERE id = ?').run(membersJson, channelId);
}

module.exports = {
  getPromotions, getChannels, createPromotion, deletePromotion, createChannel,
  renameChannel, deleteChannel, renameCategory, deleteCategory, updateChannelMembers,
};
