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

function sendMessage({ channelId, dmStudentId, authorName, authorType, content, replyToId, replyToAuthor, replyToPreview }) {
  // 'ta' n'est pas dans le CHECK constraint de la table — on le stocke comme 'teacher'
  const safeType = authorType === 'ta' ? 'teacher' : authorType;
  return getDb().prepare(`
    INSERT INTO messages
      (channel_id, dm_student_id, author_name, author_type, content,
       reply_to_id, reply_to_author, reply_to_preview)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    channelId ?? null,
    dmStudentId ?? null,
    authorName,
    safeType,
    content,
    replyToId      ?? null,
    replyToAuthor  ?? null,
    replyToPreview ?? null,
  );
}

function updateReactions(msgId, reactionsJson) {
  return getDb().prepare('UPDATE messages SET reactions = ? WHERE id = ?')
    .run(reactionsJson, msgId).changes;
}

function deleteMessage(id) {
  return getDb().prepare('DELETE FROM messages WHERE id = ?').run(id).changes;
}

function editMessage(id, content) {
  return getDb().prepare('UPDATE messages SET content = ?, edited = 1 WHERE id = ?')
    .run(content.trim(), id).changes;
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

/** Recherche cross-canal dans une promo (ou toutes promos si promoId = null). */
function searchAllMessages(promoId, query, limit = 8) {
  if (promoId) {
    return getDb().prepare(`
      SELECT m.id, m.content, m.author_name, m.created_at,
             c.id AS channel_id, c.name AS channel_name, c.promo_id
      FROM messages m
      JOIN channels c ON m.channel_id = c.id
      WHERE c.promo_id = ?
        AND m.dm_student_id IS NULL
        AND m.content LIKE '%' || ? || '%'
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(promoId, query, limit);
  }
  return getDb().prepare(`
    SELECT m.id, m.content, m.author_name, m.created_at,
           c.id AS channel_id, c.name AS channel_name, c.promo_id
    FROM messages m
    JOIN channels c ON m.channel_id = c.id
    WHERE m.dm_student_id IS NULL
      AND m.content LIKE '%' || ? || '%'
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(query, limit);
}

module.exports = {
  getChannelMessages, getChannelMessagesPage,
  getDmMessages, getDmMessagesPage,
  searchMessages, searchAllMessages, sendMessage,
  getPinnedMessages, togglePinMessage, updateReactions,
  deleteMessage, editMessage,
};
