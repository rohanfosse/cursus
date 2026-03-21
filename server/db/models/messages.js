const { getDb } = require('../connection');

const PAGE_SIZE = 50;

function getChannelMessages(channelId) {
  return getDb().prepare(
    `SELECT m.*,
           COALESCE(s.avatar_initials, substr(upper(m.author_name), 1, 2)) AS author_initials,
           COALESCE(s.photo_data, t.photo_data) AS author_photo
    FROM messages m
    LEFT JOIN students s ON s.name = m.author_name
    LEFT JOIN teachers t ON t.name = m.author_name
    WHERE m.channel_id = ? ORDER BY m.created_at ASC`
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
      `SELECT m.*, COALESCE(s.avatar_initials, substr(upper(m.author_name), 1, 2)) AS author_initials,
           COALESCE(s.photo_data, t.photo_data) AS author_photo
    FROM messages m
    LEFT JOIN students s ON s.name = m.author_name
    LEFT JOIN teachers t ON t.name = m.author_name
WHERE m.channel_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT ?`
    ).all(channelId, beforeId, PAGE_SIZE);
  }
  return getDb().prepare(
    `SELECT m.*, COALESCE(s.avatar_initials, substr(upper(m.author_name), 1, 2)) AS author_initials,
           COALESCE(s.photo_data, t.photo_data) AS author_photo
    FROM messages m
    LEFT JOIN students s ON s.name = m.author_name
    LEFT JOIN teachers t ON t.name = m.author_name
WHERE m.channel_id = ? ORDER BY m.id DESC LIMIT ?`
  ).all(channelId, PAGE_SIZE);
}

function getDmMessages(studentId) {
  return getDb().prepare(
    `SELECT m.*, COALESCE(s.avatar_initials, substr(upper(m.author_name), 1, 2)) AS author_initials,
           COALESCE(s.photo_data, t.photo_data) AS author_photo
    FROM messages m
    LEFT JOIN students s ON s.name = m.author_name
    LEFT JOIN teachers t ON t.name = m.author_name
WHERE m.dm_student_id = ? ORDER BY m.created_at ASC`
  ).all(studentId);
}

/**
 * Résoudre le nom d'un utilisateur par son ID.
 * ID négatif = enseignant (abs(id) dans teachers), ID positif = étudiant.
 */
function resolveUserName(userId) {
  if (userId < 0) {
    const t = getDb().prepare('SELECT name FROM teachers WHERE id = ?').get(Math.abs(userId))
    return t?.name ?? null
  }
  const s = getDb().prepare('SELECT name FROM students WHERE id = ?').get(userId)
  return s?.name ?? null
}

/**
 * Pagination DM — supporte les conversations bidirectionnelles.
 * Si `peerStudentId` est fourni, retourne les messages entre ces deux personnes
 * en cherchant dans la boîte de l'étudiant (dm_student_id positif).
 */
function getDmMessagesPage(studentId, beforeId, peerStudentId) {
  if (peerStudentId) {
    const selfName = resolveUserName(studentId)
    const peerName = resolveUserName(peerStudentId)

    if (selfName && peerName) {
      // La boîte DM est toujours celle de l'étudiant (id positif)
      const boxId = studentId > 0 ? studentId : (peerStudentId > 0 ? peerStudentId : studentId)

      if (beforeId) {
        return getDb().prepare(
          `SELECT m.*, COALESCE(s.avatar_initials, substr(upper(m.author_name), 1, 2)) AS author_initials, COALESCE(s.photo_data, t.photo_data) AS author_photo
           FROM messages m LEFT JOIN students s ON s.name = m.author_name LEFT JOIN teachers t ON t.name = m.author_name
           WHERE m.dm_student_id = ?
             AND m.author_name IN (?, ?)
             AND m.id < ?
           ORDER BY m.id DESC LIMIT ?`
        ).all(boxId, selfName, peerName, beforeId, PAGE_SIZE)
      }
      return getDb().prepare(
        `SELECT m.*, COALESCE(s.avatar_initials, substr(upper(m.author_name), 1, 2)) AS author_initials, COALESCE(s.photo_data, t.photo_data) AS author_photo
         FROM messages m LEFT JOIN students s ON s.name = m.author_name LEFT JOIN teachers t ON t.name = m.author_name
         WHERE m.dm_student_id = ?
           AND m.author_name IN (?, ?)
         ORDER BY m.id DESC LIMIT ?`
      ).all(boxId, selfName, peerName, PAGE_SIZE)
    }
  }

  // Fallback : boîte unique (comportement existant)
  if (beforeId) {
    return getDb().prepare(
      `SELECT m.*, COALESCE(s.avatar_initials, substr(upper(m.author_name), 1, 2)) AS author_initials,
           COALESCE(s.photo_data, t.photo_data) AS author_photo
    FROM messages m
    LEFT JOIN students s ON s.name = m.author_name
    LEFT JOIN teachers t ON t.name = m.author_name
WHERE m.dm_student_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT ?`
    ).all(studentId, beforeId, PAGE_SIZE);
  }
  return getDb().prepare(
    `SELECT m.*, COALESCE(s.avatar_initials, substr(upper(m.author_name), 1, 2)) AS author_initials,
           COALESCE(s.photo_data, t.photo_data) AS author_photo
    FROM messages m
    LEFT JOIN students s ON s.name = m.author_name
    LEFT JOIN teachers t ON t.name = m.author_name
WHERE m.dm_student_id = ? ORDER BY m.id DESC LIMIT ?`
  ).all(studentId, PAGE_SIZE);
}

function searchMessages(channelId, query) {
  return getDb().prepare(`
    SELECT * FROM messages
    WHERE channel_id = ? AND content LIKE '%' || ? || '%'
    ORDER BY created_at ASC LIMIT 200
  `).all(channelId, query);
}

function searchDmMessages(studentId, query, peerId) {
  const params = [studentId, `%${query}%`]
  let where = `m.dm_student_id = ? AND m.content LIKE ?`

  // Filtrer par peer si fourni (conversation bidirectionnelle)
  if (peerId) {
    const selfName = resolveUserName(studentId)
    const peerName = resolveUserName(peerId)
    if (selfName && peerName) {
      where += ` AND m.author_name IN (?, ?)`
      params.push(selfName, peerName)
    }
  }

  return getDb().prepare(`
    SELECT m.*, COALESCE(s.avatar_initials, substr(upper(m.author_name), 1, 2)) AS author_initials,
           COALESCE(s.photo_data, t.photo_data) AS author_photo
    FROM messages m
    LEFT JOIN students s ON s.name = m.author_name
    LEFT JOIN teachers t ON t.name = m.author_name
    WHERE ${where}
    ORDER BY m.created_at ASC LIMIT 200
  `).all(...params);
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
             c.id AS channel_id, c.name AS channel_name, c.promo_id,
             COALESCE(s.avatar_initials, substr(upper(m.author_name), 1, 2)) AS author_initials,
             COALESCE(s.photo_data, t.photo_data) AS author_photo
      FROM messages m
      JOIN channels c ON m.channel_id = c.id
      LEFT JOIN students s ON s.name = m.author_name
      LEFT JOIN teachers t ON t.name = m.author_name
      WHERE c.promo_id = ?
        AND m.dm_student_id IS NULL
        AND m.content LIKE '%' || ? || '%'
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(promoId, query, limit);
  }
  return getDb().prepare(`
    SELECT m.id, m.content, m.author_name, m.created_at,
           c.id AS channel_id, c.name AS channel_name, c.promo_id,
           COALESCE(s.avatar_initials, substr(upper(m.author_name), 1, 2)) AS author_initials,
           COALESCE(s.photo_data, t.photo_data) AS author_photo
    FROM messages m
    JOIN channels c ON m.channel_id = c.id
    LEFT JOIN students s ON s.name = m.author_name
    LEFT JOIN teachers t ON t.name = m.author_name
    WHERE m.dm_student_id IS NULL
      AND m.content LIKE '%' || ? || '%'
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(query, limit);
}

/**
 * Contacts DM récents pour un étudiant donné.
 * dm_student_id = studentId signifie "messages dans la boîte de cet étudiant".
 * On extrait les auteurs distincts (hors l'étudiant lui-même) pour lister les contacts.
 */
function getRecentDmContacts(studentId, limit = 15) {
  const myName = resolveUserName(studentId)
  if (!myName) return [];

  // Pour les enseignants (id négatif) : chercher les étudiants à qui ils ont envoyé des DMs
  if (studentId < 0) {
    return getDb().prepare(`
      SELECT
        s.id, s.name, s.avatar_initials, s.photo_data, s.promo_id,
        MAX(m.created_at) AS last_message_at,
        (SELECT content FROM messages m2
         WHERE m2.dm_student_id = s.id AND m2.author_name IN (?, s.name)
         ORDER BY m2.created_at DESC LIMIT 1
        ) AS last_message_preview
      FROM messages m
      JOIN students s ON m.dm_student_id = s.id
      WHERE m.author_name = ?
      GROUP BY s.id
      ORDER BY last_message_at DESC
      LIMIT ?
    `).all(myName, myName, limit);
  }

  // Pour les étudiants : chercher les contacts (envoyés ET reçus)
  return getDb().prepare(`
    SELECT
      author_name AS name,
      MAX(created_at) AS last_message_at,
      (SELECT content FROM messages m2
       WHERE m2.dm_student_id = ? AND (m2.author_name = m.author_name OR m2.author_name = ?)
       ORDER BY m2.created_at DESC LIMIT 1
      ) AS last_message_preview
    FROM messages m
    WHERE m.dm_student_id = ? AND m.author_name != ?
    GROUP BY m.author_name
    ORDER BY last_message_at DESC
    LIMIT ?
  `).all(studentId, myName, studentId, myName, limit);
}

module.exports = {
  getChannelMessages, getChannelMessagesPage,
  getDmMessages, getDmMessagesPage,
  searchMessages, searchDmMessages, searchAllMessages, sendMessage,
  getPinnedMessages, togglePinMessage, updateReactions,
  deleteMessage, editMessage, getRecentDmContacts,
};
