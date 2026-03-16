const { getDb } = require('../connection');

const PAGE_SIZE = 50;

function getChannelMessages(channelId) {
  return getDb().prepare(
    'SELECT * FROM messages WHERE channel_id = ? ORDER BY created_at ASC'
  ).all(channelId);
}

/**
 * Pagination par curseur (infinite scroll vers le haut).
 * Retourne les PAGE_SIZE messages les plus récents (ou avant beforeId).
 * L'ordre DESC est inversé côté store pour afficher ASC.
 */
function getChannelMessagesPage(channelId, beforeId) {
  if (beforeId) {
    return getDb().prepare(
      'SELECT * FROM messages WHERE channel_id = ? AND id < ? ORDER BY id DESC LIMIT ?'
    ).all(channelId, beforeId, PAGE_SIZE);
  }
  return getDb().prepare(
    'SELECT * FROM messages WHERE channel_id = ? ORDER BY id DESC LIMIT ?'
  ).all(channelId, PAGE_SIZE);
}

function getDmMessages(studentId) {
  return getDb().prepare(
    'SELECT * FROM messages WHERE dm_student_id = ? ORDER BY created_at ASC'
  ).all(studentId);
}

function getDmMessagesPage(studentId, beforeId) {
  if (beforeId) {
    return getDb().prepare(
      'SELECT * FROM messages WHERE dm_student_id = ? AND id < ? ORDER BY id DESC LIMIT ?'
    ).all(studentId, beforeId, PAGE_SIZE);
  }
  return getDb().prepare(
    'SELECT * FROM messages WHERE dm_student_id = ? ORDER BY id DESC LIMIT ?'
  ).all(studentId, PAGE_SIZE);
}

function searchMessages(channelId, query) {
  return getDb().prepare(`
    SELECT * FROM messages
    WHERE channel_id = ? AND content LIKE '%' || ? || '%'
    ORDER BY created_at ASC LIMIT 200
  `).all(channelId, query);
}

function sendMessage({ channelId, dmStudentId, authorName, authorType, content }) {
  return getDb().prepare(`
    INSERT INTO messages (channel_id, dm_student_id, author_name, author_type, content)
    VALUES (?, ?, ?, ?, ?)
  `).run(channelId ?? null, dmStudentId ?? null, authorName, authorType, content);
}

function getPinnedMessages(channelId) {
  return getDb().prepare(`
    SELECT id, author_name, content, created_at
    FROM messages WHERE channel_id = ? AND pinned = 1
    ORDER BY created_at DESC LIMIT 5
  `).all(channelId);
}

function togglePinMessage(messageId, pinned) {
  return getDb().prepare('UPDATE messages SET pinned = ? WHERE id = ?')
    .run(pinned ? 1 : 0, messageId).changes;
}

module.exports = {
  getChannelMessages, getChannelMessagesPage,
  getDmMessages, getDmMessagesPage,
  searchMessages, sendMessage,
  getPinnedMessages, togglePinMessage,
};
