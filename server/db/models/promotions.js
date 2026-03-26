const { getDb } = require('../connection');
const cache = require('../../utils/cache');

function getPromotions() {
  return cache.wrap('promotions:all', () =>
    getDb().prepare('SELECT * FROM promotions ORDER BY name').all()
  , 30_000) // 30s TTL
}

function getChannels(promoId) {
  return cache.wrap(`channels:${promoId}`, () =>
    getDb().prepare(
      "SELECT * FROM channels WHERE promo_id = ? ORDER BY COALESCE(category, 'zzz') ASC, type DESC, name ASC"
    ).all(promoId)
  , 30_000)
}

function createPromotion({ name, color }) {
  const db      = getDb();
  const promoId = db.prepare('INSERT INTO promotions (name, color) VALUES (?, ?)').run(name, color).lastInsertRowid;
  db.prepare("INSERT INTO channels (promo_id, name, description, type) VALUES (?, 'annonces', 'Informations importantes', 'annonce')").run(promoId);
  db.prepare("INSERT INTO channels (promo_id, name, description, type) VALUES (?, 'general', 'Canal principal', 'chat')").run(promoId);
  cache.invalidate('promotions:'); cache.invalidate('channels:');
  return promoId;
}

function deletePromotion(promoId) {
  const res = getDb().prepare('DELETE FROM promotions WHERE id = ?').run(promoId);
  cache.invalidate('promotions:'); cache.invalidate('channels:');
  return res;
}

function createChannel({ promoId, name, type, isPrivate, members, category }) {
  const db          = getDb();
  const membersJson = isPrivate && members?.length ? JSON.stringify(members) : null;
  const chType      = type === 'annonce' ? 'annonce' : 'chat';
  const id = db.prepare(
    'INSERT INTO channels (promo_id, name, description, type, is_private, members, category) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(promoId, name, '', chType, isPrivate ? 1 : 0, membersJson, category ?? null).lastInsertRowid;
  cache.invalidate('channels:');
  return id;
}

function renameChannel(id, name) {
  const res = getDb().prepare('UPDATE channels SET name = ? WHERE id = ?').run(name, id);
  cache.invalidate('channels:'); return res;
}

function deleteChannel(id) {
  const res = getDb().prepare('DELETE FROM channels WHERE id = ?').run(id);
  cache.invalidate('channels:'); return res;
}

/** Renomme la catégorie pour tous les canaux d'une promo */
function renameCategory(promoId, oldCategory, newCategory) {
  const res = getDb().prepare('UPDATE channels SET category = ? WHERE promo_id = ? AND category = ?')
    .run(newCategory, promoId, oldCategory);
  cache.invalidate('channels:'); return res;
}

/** Dégroupe la catégorie (met category = null) sans supprimer les canaux */
function deleteCategory(promoId, category) {
  const res = getDb().prepare('UPDATE channels SET category = NULL WHERE promo_id = ? AND category = ?')
    .run(promoId, category);
  cache.invalidate('channels:'); return res;
}

function updateChannelMembers({ channelId, members }) {
  const membersJson = members?.length ? JSON.stringify(members) : null;
  const res = getDb().prepare('UPDATE channels SET members = ? WHERE id = ?').run(membersJson, channelId);
  cache.invalidate('channels:'); return res;
}

function updateChannelCategory(channelId, category) {
  const res = getDb().prepare('UPDATE channels SET category = ? WHERE id = ?').run(category ?? null, channelId);
  cache.invalidate('channels:'); return res;
}

function updateChannelPrivacy(channelId, isPrivate, members) {
  const db = getDb();
  const membersJson = isPrivate && members?.length ? JSON.stringify(members) : null;
  db.prepare('UPDATE channels SET is_private = ?, members = ? WHERE id = ?').run(isPrivate ? 1 : 0, membersJson, channelId);
  cache.invalidate('channels:');
  return db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
}

module.exports = {
  getPromotions, getChannels, createPromotion, deletePromotion, createChannel,
  renameChannel, deleteChannel, renameCategory, deleteCategory,
  updateChannelMembers, updateChannelCategory, updateChannelPrivacy,
};
