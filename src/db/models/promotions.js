const { getDb } = require('../connection');

function getPromotions() {
  return getDb().prepare('SELECT * FROM promotions ORDER BY name').all();
}

function getChannels(promoId) {
  return getDb().prepare(
    'SELECT * FROM channels WHERE promo_id = ? ORDER BY type DESC, name ASC'
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

function createChannel({ promoId, name, isPrivate, members }) {
  const db          = getDb();
  const membersJson = isPrivate && members?.length ? JSON.stringify(members) : null;
  return db.prepare(
    'INSERT INTO channels (promo_id, name, description, type, is_private, members) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(promoId, name, '', 'chat', isPrivate ? 1 : 0, membersJson).lastInsertRowid;
}

module.exports = { getPromotions, getChannels, createPromotion, deletePromotion, createChannel };
