const { getDb } = require('../connection');
const { encrypt, decrypt, decryptRow, decryptRows } = require('../../utils/crypto');

const PAGE_SIZE = 50;
const MESSAGE_SELECT = `
  SELECT m.*,
         m.pinned AS is_pinned,
         COALESCE(s.avatar_initials, COALESCE(substr(upper(t.name), 1, 2), substr(upper(m.author_name), 1, 2))) AS author_initials,
         COALESCE(s.photo_data, t.photo_data) AS author_photo
  FROM messages m
  LEFT JOIN students s ON s.id = m.author_id AND m.author_type = 'student'
  LEFT JOIN teachers t ON t.id = -m.author_id AND m.author_type = 'teacher'
  WHERE m.deleted_at IS NULL
`;

function getChannelMessages(channelId) {
  return getDb().prepare(
    `${MESSAGE_SELECT}
     AND m.channel_id = ?
     ORDER BY m.created_at ASC`
  ).all(channelId);
}

function getMessageById(messageId) {
  const row = getDb().prepare(
    `${MESSAGE_SELECT}
     AND m.id = ?`
  ).get(messageId) ?? null;
  return decryptRow(row);
}

/**
 * Pagination par curseur (infinite scroll vers le haut).
 * Retourne les PAGE_SIZE messages les plus récents (ou avant beforeId).
 * L'ordre DESC est inversé côté store pour afficher ASC.
 */
function getChannelMessagesPage(channelId, beforeId) {
  if (beforeId) {
    return getDb().prepare(
      `${MESSAGE_SELECT}
       AND m.channel_id = ? AND m.id < ?
       ORDER BY m.id DESC
       LIMIT ?`
    ).all(channelId, beforeId, PAGE_SIZE);
  }
  return getDb().prepare(
    `${MESSAGE_SELECT}
     AND m.channel_id = ?
     ORDER BY m.id DESC
     LIMIT ?`
  ).all(channelId, PAGE_SIZE);
}

function getDmMessages(studentId) {
  return decryptRows(getDb().prepare(
    `${MESSAGE_SELECT}
     AND m.dm_student_id = ?
     ORDER BY m.created_at ASC`
  ).all(studentId));
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
 * Pagination DM - supporte les conversations bidirectionnelles.
 * Si `peerStudentId` est fourni, retourne les messages entre ces deux personnes
 * en cherchant dans la boîte de l'étudiant (dm_student_id positif).
 */
function getDmMessagesPage(studentId, beforeId, peerStudentId) {
  if (peerStudentId) {
    // La boîte DM est toujours celle de l'étudiant (id positif)
    const boxId = studentId > 0 ? studentId : (peerStudentId > 0 ? peerStudentId : studentId)

    if (beforeId) {
      return decryptRows(getDb().prepare(
        `${MESSAGE_SELECT}
         AND m.dm_student_id = ?
           AND m.author_id IN (?, ?)
           AND m.id < ?
         ORDER BY m.id DESC
         LIMIT ?`
      ).all(boxId, studentId, peerStudentId, beforeId, PAGE_SIZE))
    }
    return decryptRows(getDb().prepare(
      `${MESSAGE_SELECT}
       AND m.dm_student_id = ?
         AND m.author_id IN (?, ?)
       ORDER BY m.id DESC
       LIMIT ?`
    ).all(boxId, studentId, peerStudentId, PAGE_SIZE))
  }

  // Fallback : boîte unique (comportement existant)
  if (beforeId) {
    return decryptRows(getDb().prepare(
      `${MESSAGE_SELECT}
       AND m.dm_student_id = ? AND m.id < ?
       ORDER BY m.id DESC
       LIMIT ?`
    ).all(studentId, beforeId, PAGE_SIZE))
  }
  return decryptRows(getDb().prepare(
    `${MESSAGE_SELECT}
     AND m.dm_student_id = ?
     ORDER BY m.id DESC
     LIMIT ?`
  ).all(studentId, PAGE_SIZE));
}

function searchMessages(channelId, query) {
  const q = (query ?? '').slice(0, 200)
  if (!q) return []
  return getDb().prepare(`
    ${MESSAGE_SELECT}
    AND m.channel_id = ? AND m.content LIKE '%' || ? || '%'
    ORDER BY m.created_at ASC
    LIMIT 200
  `).all(channelId, q);
}

/**
 * Recherche DM — déchiffrement en mémoire puis filtrage (le contenu est chiffré en DB).
 */
function searchDmMessages(studentId, query, peerId) {
  let sql = `${MESSAGE_SELECT} AND m.dm_student_id = ?`
  const params = [studentId]

  if (peerId) {
    sql += ` AND m.author_id IN (?, ?)`
    params.push(studentId, peerId)
  }

  sql += ` ORDER BY m.created_at ASC LIMIT 5000`
  const rows = decryptRows(getDb().prepare(sql).all(...params))

  // Filtrage en mémoire après déchiffrement
  const q = query.toLowerCase()
  return rows.filter(r => r.content && r.content.toLowerCase().includes(q)).slice(0, 200)
}

function sendMessage({ channelId, dmStudentId, authorName, authorId, authorType, content, replyToId, replyToAuthor, replyToPreview }) {
  // 'ta' n'est pas dans le CHECK constraint de la table - on le stocke comme 'teacher'
  const safeType = authorType === 'ta' ? 'teacher' : authorType;
  // Chiffrer le contenu des DMs
  const storedContent = dmStudentId ? encrypt(content) : content;
  return getDb().prepare(`
    INSERT INTO messages
      (channel_id, dm_student_id, author_name, author_id, author_type, content,
       reply_to_id, reply_to_author, reply_to_preview)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    channelId ?? null,
    dmStudentId ?? null,
    authorName,
    authorId ?? null,
    safeType,
    storedContent,
    replyToId      ?? null,
    replyToAuthor  ?? null,
    replyToPreview ?? null,
  );
}

function updateReactions(msgId, reactionsJson) {
  return getDb().prepare('UPDATE messages SET reactions = ? WHERE id = ? AND deleted_at IS NULL')
    .run(reactionsJson, msgId).changes;
}

/** Soft delete — marque le message comme supprimé sans le retirer de la base. */
function deleteMessage(id) {
  return getDb().prepare("UPDATE messages SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL")
    .run(id).changes;
}

function editMessage(id, content) {
  // Vérifier si c'est un DM pour chiffrer
  const msg = getDb().prepare('SELECT dm_student_id FROM messages WHERE id = ?').get(id)
  const storedContent = msg?.dm_student_id ? encrypt(content.trim()) : content.trim()
  return getDb().prepare('UPDATE messages SET content = ?, edited = 1 WHERE id = ? AND deleted_at IS NULL')
    .run(storedContent, id).changes;
}

function getPinnedMessages(channelId) {
  return getDb().prepare(`
    SELECT id, author_name, content, created_at
    FROM messages WHERE channel_id = ? AND pinned = 1 AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 5
  `).all(channelId);
}

function togglePinMessage(messageId, pinned) {
  return getDb().prepare('UPDATE messages SET pinned = ? WHERE id = ? AND deleted_at IS NULL')
    .run(pinned ? 1 : 0, messageId).changes;
}

/** Recherche cross-canal dans une promo (ou toutes promos si promoId = null). */
function searchAllMessages(promoId, query, limit = 8, userId = null) {
  const db = getDb();

  // Channel messages (non chiffrés — recherche LIKE classique)
  const channelSql = promoId
    ? `SELECT m.id, m.content, m.author_name, m.author_id, m.created_at,
             c.id AS channel_id, c.name AS channel_name, c.promo_id,
             COALESCE(s.avatar_initials, COALESCE(substr(upper(t.name), 1, 2), substr(upper(m.author_name), 1, 2))) AS author_initials,
             COALESCE(s.photo_data, t.photo_data) AS author_photo,
             'channel' AS source_type
       FROM messages m
       JOIN channels c ON m.channel_id = c.id
       LEFT JOIN students s ON s.id = m.author_id AND m.author_type = 'student'
       LEFT JOIN teachers t ON t.id = -m.author_id AND m.author_type = 'teacher'
       WHERE c.promo_id = ? AND m.dm_student_id IS NULL AND m.deleted_at IS NULL
         AND m.content LIKE '%' || ? || '%'
       ORDER BY m.created_at DESC LIMIT ?`
    : `SELECT m.id, m.content, m.author_name, m.author_id, m.created_at,
             c.id AS channel_id, c.name AS channel_name, c.promo_id,
             COALESCE(s.avatar_initials, COALESCE(substr(upper(t.name), 1, 2), substr(upper(m.author_name), 1, 2))) AS author_initials,
             COALESCE(s.photo_data, t.photo_data) AS author_photo,
             'channel' AS source_type
       FROM messages m
       JOIN channels c ON m.channel_id = c.id
       LEFT JOIN students s ON s.id = m.author_id AND m.author_type = 'student'
       LEFT JOIN teachers t ON t.id = -m.author_id AND m.author_type = 'teacher'
       WHERE m.dm_student_id IS NULL AND m.deleted_at IS NULL AND m.content LIKE '%' || ? || '%'
       ORDER BY m.created_at DESC LIMIT ?`;

  const channelResults = promoId
    ? db.prepare(channelSql).all(promoId, query, limit)
    : db.prepare(channelSql).all(query, limit);

  // DM messages (chiffrés — déchiffrement + filtrage en mémoire)
  if (userId) {
    const dmRows = decryptRows(db.prepare(`
      SELECT m.id, m.content, m.author_name, m.author_id, m.created_at,
             NULL AS channel_id, 'Message direct' AS channel_name, NULL AS promo_id,
             m.dm_student_id,
             COALESCE(s.avatar_initials, COALESCE(substr(upper(t.name), 1, 2), substr(upper(m.author_name), 1, 2))) AS author_initials,
             COALESCE(s.photo_data, t.photo_data) AS author_photo,
             'dm' AS source_type
      FROM messages m
      LEFT JOIN students s ON s.id = m.author_id AND m.author_type = 'student'
      LEFT JOIN teachers t ON t.id = -m.author_id AND m.author_type = 'teacher'
      WHERE m.dm_student_id = ? AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC LIMIT 2000
    `).all(userId));

    const q = query.toLowerCase()
    const dmFiltered = dmRows
      .filter(r => r.content && r.content.toLowerCase().includes(q))
      .slice(0, Math.ceil(limit / 2))

    return [...channelResults, ...dmFiltered]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  return channelResults;
}

/**
 * Contacts DM récents pour un étudiant donné.
 * dm_student_id = studentId signifie "messages dans la boîte de cet étudiant".
 * On extrait les auteurs distincts (hors l'étudiant lui-même) pour lister les contacts.
 */
function getRecentDmContacts(studentId, limit = 15) {
  // Pour les enseignants (id négatif) : chercher les étudiants à qui ils ont envoyé des DMs
  if (studentId < 0) {
    const rows = getDb().prepare(`
      SELECT
        s.id, s.name, s.avatar_initials, s.photo_data, s.promo_id,
        MAX(m.created_at) AS last_message_at,
        (SELECT content FROM messages m2
         WHERE m2.dm_student_id = s.id AND m2.author_id IN (?, s.id) AND m2.deleted_at IS NULL
         ORDER BY m2.created_at DESC LIMIT 1
        ) AS last_message_preview
      FROM messages m
      JOIN students s ON m.dm_student_id = s.id
      WHERE m.author_id = ? AND m.deleted_at IS NULL
      GROUP BY s.id
      ORDER BY last_message_at DESC
      LIMIT ?
    `).all(studentId, studentId, limit);
    return rows.map(r => ({
      ...r,
      last_message_preview: r.last_message_preview ? decrypt(r.last_message_preview) : null,
    }))
  }

  // Pour les étudiants : chercher les contacts (envoyés ET reçus)
  const rows = getDb().prepare(`
    SELECT
      m.author_id,
      m.author_name AS name,
      MAX(m.created_at) AS last_message_at,
      (SELECT content FROM messages m2
       WHERE m2.dm_student_id = ? AND m2.author_id IN (m.author_id, ?) AND m2.deleted_at IS NULL
       ORDER BY m2.created_at DESC LIMIT 1
      ) AS last_message_preview
    FROM messages m
    WHERE m.dm_student_id = ? AND m.author_id != ? AND m.deleted_at IS NULL
    GROUP BY m.author_id
    ORDER BY last_message_at DESC
    LIMIT ?
  `).all(studentId, studentId, studentId, studentId, limit);
  return rows.map(r => ({
    ...r,
    last_message_preview: r.last_message_preview ? decrypt(r.last_message_preview) : null,
  }))
}

/**
 * Retourne tous les fichiers (images + pièces jointes) envoyés par des étudiants
 * dans les conversations DM privées avec le professeur.
 * Parsé depuis le contenu markdown des messages (déchiffré en mémoire).
 */
function getDmFiles() {
  // Charger les messages DM étudiants, déchiffrer, puis filtrer ceux avec des fichiers
  const allRows = decryptRows(getDb().prepare(`
    SELECT m.id AS message_id, m.content, m.created_at, m.author_name, m.dm_student_id,
           s.id AS student_id, s.name AS student_name
    FROM messages m
    LEFT JOIN students s ON s.id = m.dm_student_id
    WHERE m.dm_student_id IS NOT NULL
      AND m.deleted_at IS NULL
      AND m.author_type = 'student'
    ORDER BY m.created_at DESC
    LIMIT 2000
  `).all());

  // Filtrer les messages contenant des fichiers après déchiffrement
  const rows = allRows.filter(r => r.content && (r.content.includes('📎') || r.content.includes('![')))

  const fileRe  = /\[📎\s*([^\]]+)\]\(([^)]+)\)/g;
  const imageRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const result  = [];

  for (const row of rows) {
    const push = (name, url, isImage) => {
      const cleanUrl = url.replace(/#size=\d+/, '');
      const sizeMatch = url.match(/#size=(\d+)/);
      // Extraire le nom original du fichier (retire le prefix timestamp_hex_)
      let fileName = name.trim();
      if (!fileName) {
        const raw = cleanUrl.split('/').pop() || '';
        // Format serveur: "1774343958211_05da371d8f_nom-original.ext"
        const cleaned = raw.replace(/^\d+_[a-f0-9]+_/, '');
        fileName = decodeURIComponent(cleaned) || raw;
      }
      result.push({
        message_id:   row.message_id,
        student_id:   row.student_id,
        student_name: row.student_name ?? row.author_name,
        file_name:    fileName,
        file_url:     cleanUrl,
        is_image:     isImage,
        file_size:    sizeMatch ? parseInt(sizeMatch[1]) : null,
        sent_at:      row.created_at,
      });
    };
    let m;
    fileRe.lastIndex  = 0;
    imageRe.lastIndex = 0;
    while ((m = fileRe.exec(row.content))  !== null) push(m[1], m[2], false);
    while ((m = imageRe.exec(row.content)) !== null) push(m[1], m[2], true);
  }

  return result;
}

module.exports = {
  getMessageById,
  getChannelMessages, getChannelMessagesPage,
  getDmMessages, getDmMessagesPage,
  searchMessages, searchDmMessages, searchAllMessages, sendMessage,
  getPinnedMessages, togglePinMessage, updateReactions,
  deleteMessage, editMessage, getRecentDmContacts,
  getDmFiles, resolveUserName,
};
