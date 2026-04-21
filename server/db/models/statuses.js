/**
 * Statuts personnalises utilisateurs (emoji + texte + expiration optionnelle).
 * Diffuses via socket dans presence:update + event status:change.
 *
 * Convention d'identite : user_id est l'id signe du JWT
 *   - students : positif
 *   - teachers : negatif
 */
const { getDb } = require('../connection');
const { safeAuthorType } = require('../../utils/roles');

const MAX_TEXT_LEN = 100;
const MAX_EMOJI_LEN = 16;  // plusieurs codepoints possibles pour un emoji compose

/**
 * Met a jour ou cree le statut d'un user. Si emoji et text sont tous deux
 * vides, le statut est supprime (retour { cleared: true }).
 */
function setUserStatus({ userId, userType, emoji = null, text = null, expiresAt = null }) {
  const cleanEmoji = emoji ? String(emoji).slice(0, MAX_EMOJI_LEN) : null;
  const cleanText  = text ? String(text).slice(0, MAX_TEXT_LEN) : null;
  if (!cleanEmoji && !cleanText) {
    return clearUserStatus(userId);
  }
  getDb().prepare(`
    INSERT INTO user_statuses (user_id, user_type, emoji, text, expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      user_type  = excluded.user_type,
      emoji      = excluded.emoji,
      text       = excluded.text,
      expires_at = excluded.expires_at,
      updated_at = datetime('now')
  `).run(userId, safeAuthorType(userType), cleanEmoji, cleanText, expiresAt);
  return getUserStatus(userId);
}

function clearUserStatus(userId) {
  const res = getDb().prepare('DELETE FROM user_statuses WHERE user_id = ?').run(userId);
  return { cleared: res.changes > 0 };
}

function getUserStatus(userId) {
  const row = getDb().prepare(
    'SELECT user_id, emoji, text, expires_at, updated_at FROM user_statuses WHERE user_id = ?'
  ).get(userId);
  if (!row) return null;
  // Filtrer les statuts expires (defense en profondeur : le cron purge aussi)
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    clearUserStatus(userId);
    return null;
  }
  return { userId: row.user_id, emoji: row.emoji, text: row.text, expiresAt: row.expires_at, updatedAt: row.updated_at };
}

/**
 * Liste les statuts actifs (non expires) pour un ensemble d'userIds.
 * Utilise a la connexion socket pour envoyer les statuts courants avec
 * presence:update.
 */
function listActiveStatuses(userIds = null) {
  const db = getDb();
  let rows;
  if (Array.isArray(userIds) && userIds.length) {
    const placeholders = userIds.map(() => '?').join(',');
    rows = db.prepare(
      `SELECT user_id, emoji, text, expires_at
         FROM user_statuses
        WHERE user_id IN (${placeholders})
          AND (expires_at IS NULL OR expires_at > datetime('now'))`
    ).all(...userIds);
  } else {
    rows = db.prepare(
      `SELECT user_id, emoji, text, expires_at
         FROM user_statuses
        WHERE expires_at IS NULL OR expires_at > datetime('now')`
    ).all();
  }
  return rows.map(r => ({
    userId: r.user_id, emoji: r.emoji, text: r.text, expiresAt: r.expires_at,
  }));
}

/**
 * Purge les statuts expires. Retourne la liste des user_id purges pour que
 * le cron puisse emettre des status:change vers chacun (UI en temps reel).
 */
function purgeExpiredStatuses() {
  const db = getDb();
  const expired = db.prepare(
    `SELECT user_id FROM user_statuses WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')`
  ).all().map(r => r.user_id);
  if (!expired.length) return [];
  const placeholders = expired.map(() => '?').join(',');
  db.prepare(`DELETE FROM user_statuses WHERE user_id IN (${placeholders})`).run(...expired);
  return expired;
}

module.exports = {
  MAX_TEXT_LEN,
  MAX_EMOJI_LEN,
  setUserStatus,
  clearUserStatus,
  getUserStatus,
  listActiveStatuses,
  purgeExpiredStatuses,
};
