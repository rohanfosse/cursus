const { getDb } = require('../connection');
const { encrypt, decrypt, decryptRow, decryptRows } = require('../../utils/crypto');
const { safeAuthorType } = require('../../utils/roles');

const PAGE_SIZE = 50;
// Plafond des endpoints "full history" (non pagines). Evite qu un canal avec
// 50 000 messages x 10 KB = 500 MB soit renvoye en une seule requete. Les
// clients sont censes utiliser getChannelMessagesPage pour le reste.
const FULL_HISTORY_LIMIT = 500;
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
  // Retourne les FULL_HISTORY_LIMIT messages les plus recents dans l ordre
  // chronologique (ASC pour l affichage). Au-dela, le client doit pager.
  const rows = getDb().prepare(
    `${MESSAGE_SELECT}
     AND m.channel_id = ?
     ORDER BY m.id DESC
     LIMIT ?`
  ).all(channelId, FULL_HISTORY_LIMIT);
  return rows.reverse();
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
  const rows = getDb().prepare(
    `${MESSAGE_SELECT}
     AND m.dm_student_id = ?
     ORDER BY m.id DESC
     LIMIT ?`
  ).all(studentId, FULL_HISTORY_LIMIT);
  return decryptRows(rows.reverse());
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

/**
 * Echappe une query utilisateur pour la syntaxe FTS5 :
 *  - retire les caracteres speciaux qui pourraient casser le parser
 *    (parentheses, double-quotes non-paires, operateurs)
 *  - ajoute un suffixe `*` aux termes pour le prefix-matching (ex: "algo"
 *    matche "algorithme") — ergonomie recherche moderne.
 *
 * Si la query devient vide apres sanitization, retourne null pour que le
 * caller fallback sur LIKE (eviter une exception FTS5 sur input vide).
 */
function buildFtsQuery(rawQuery) {
  const cleaned = String(rawQuery ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ') // unicode letters + numbers seulement
    .trim()
  if (!cleaned) return null
  // Decoupe en termes, ajoute prefix-match * a chaque terme >= 2 chars
  const terms = cleaned.split(/\s+/).filter(t => t.length >= 2)
  if (!terms.length) return null
  return terms.map(t => `"${t}"*`).join(' ')
}

/**
 * Recherche dans un canal donne. v2.265 : utilise FTS5 + BM25 ranking
 * (tokens unicode + remove_diacritics, prefix-matching). Fallback sur
 * LIKE si la query est trop courte (< 2 chars) ou si FTS jette (rare).
 *
 * @param {number} channelId
 * @param {string} query
 * @returns {Array} messages tries par pertinence (BM25), max 200
 */
function searchMessages(channelId, query) {
  const q = (query ?? '').slice(0, 200)
  if (!q) return []
  const fts = buildFtsQuery(q)
  if (!fts) {
    // Fallback LIKE pour query courte (1 char) — FTS5 n'aime pas les tokens < 2 chars
    return getDb().prepare(`
      ${MESSAGE_SELECT}
      AND m.channel_id = ? AND m.content LIKE '%' || ? || '%'
      ORDER BY m.created_at ASC
      LIMIT 200
    `).all(channelId, q);
  }
  try {
    return getDb().prepare(`
      ${MESSAGE_SELECT}
      AND m.channel_id = ?
      AND m.id IN (
        SELECT rowid FROM messages_fts
        WHERE messages_fts MATCH ?
        ORDER BY bm25(messages_fts) ASC
        LIMIT 200
      )
      ORDER BY m.created_at ASC
      LIMIT 200
    `).all(channelId, fts);
  } catch {
    // Si FTS5 jette (query mal formee post-sanitize), fallback LIKE
    return getDb().prepare(`
      ${MESSAGE_SELECT}
      AND m.channel_id = ? AND m.content LIKE '%' || ? || '%'
      ORDER BY m.created_at ASC
      LIMIT 200
    `).all(channelId, q);
  }
}

const SEARCH_DM_LIMIT = 200;

/**
 * Recherche DM — déchiffrement en mémoire puis filtrage (le contenu est chiffré en DB).
 * Retourne { results: Message[], truncated: boolean }.
 */
function searchDmMessages(studentId, query, peerId) {
  let sql = `${MESSAGE_SELECT} AND m.dm_student_id = ?`
  const params = [studentId]

  if (peerId) {
    sql += ` AND m.author_id IN (?, ?)`
    params.push(studentId, peerId)
  }

  sql += ` ORDER BY m.created_at DESC LIMIT 5000`
  const rows = decryptRows(getDb().prepare(sql).all(...params))

  // Filtrage en mémoire après déchiffrement
  const q = query.toLowerCase()
  const allMatches = rows.filter(r => r.content && r.content.toLowerCase().includes(q))
  const truncated = allMatches.length > SEARCH_DM_LIMIT

  return { results: allMatches.slice(0, SEARCH_DM_LIMIT), truncated }
}

function sendMessage({ channelId, dmStudentId, authorName, authorId, authorType, content, replyToId, replyToAuthor, replyToPreview }) {
  const safeType = safeAuthorType(authorType);
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

// ── Sondages ─────────────────────────────────────────────────────────────────

const { POLL_MARKER } = require('../../constants/poll');

/** Extrait la definition poll depuis content (1re ligne). Retourne null sinon. */
function parsePollDefinition(content) {
  if (!content || !content.startsWith(POLL_MARKER)) return null;
  const firstLine = content.split('\n', 1)[0];
  const json = firstLine.slice(POLL_MARKER.length).trim();
  if (!json) return null;
  try {
    const def = JSON.parse(json);
    if (!def || !Array.isArray(def.o) || def.o.length < 2) return null;
    return { ...def, o: def.o.slice(0, 10) };
  } catch { return null; }
}

/** Parse l etat de vote stocke dans poll_votes (string JSON ou null). */
function parseVotesState(raw, optionCount) {
  const empty = { totals: Array(optionCount).fill(0), voters: {} };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return empty;
    const totals = Array.isArray(parsed.totals) && parsed.totals.length === optionCount
      ? parsed.totals.map((n) => Math.max(0, Number(n) || 0))
      : Array(optionCount).fill(0);
    const voters = parsed.voters && typeof parsed.voters === 'object' ? parsed.voters : {};
    // Sanitize: keep only arrays of valid indexes
    const cleanVoters = {};
    for (const [k, v] of Object.entries(voters)) {
      if (Array.isArray(v)) {
        cleanVoters[k] = v
          .map((n) => Number(n))
          .filter((n) => Number.isInteger(n) && n >= 0 && n < optionCount);
      }
    }
    return { totals, voters: cleanVoters };
  } catch { return empty; }
}

/**
 * Enregistre un vote sur un sondage. Retourne { state, definition } ou throw.
 *   messageId   : ID du message porteur du sondage
 *   userKey     : cle stable de voter (typiquement l id signe)
 *   optionIdxs  : array d'indices selectionnes (plusieurs si multi=true)
 */
function voteOnPoll(messageId, userKey, optionIdxs) {
  const db = getDb();
  // SELECT + UPDATE doivent etre atomiques : sans transaction, deux votes
  // simultanes peuvent lire le meme totals, incrementer chacun, et le 2e
  // write ecrase le 1er (perte de vote).
  const txn = db.transaction(() => {
    const row = db.prepare('SELECT content, poll_votes FROM messages WHERE id = ? AND deleted_at IS NULL').get(messageId);
    if (!row) { const e = new Error('Message introuvable.'); e.statusCode = 404; throw e; }

    const def = parsePollDefinition(row.content);
    if (!def) { const e = new Error('Ce message n\'est pas un sondage.'); e.statusCode = 400; throw e; }

    const state = parseVotesState(row.poll_votes, def.o.length);

    const uniq = Array.from(new Set(
      (optionIdxs || [])
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < def.o.length),
    ));
    if (!def.multi) uniq.splice(1);

    const k = String(userKey);
    const prev = state.voters[k] || [];
    for (const i of prev) state.totals[i] = Math.max(0, (state.totals[i] || 0) - 1);
    for (const i of uniq) state.totals[i] = (state.totals[i] || 0) + 1;

    if (uniq.length === 0) delete state.voters[k];
    else state.voters[k] = uniq;

    db.prepare('UPDATE messages SET poll_votes = ? WHERE id = ? AND deleted_at IS NULL')
      .run(JSON.stringify(state), messageId);

    return { state, definition: def };
  });
  return txn();
}

/** Lecture seule : l'etat des votes d'un message poll (ou null). */
function getPollState(messageId) {
  const row = getDb().prepare('SELECT content, poll_votes, channel_id, dm_student_id FROM messages WHERE id = ? AND deleted_at IS NULL').get(messageId);
  if (!row) return null;
  const def = parsePollDefinition(row.content);
  if (!def) return null;
  const state = parseVotesState(row.poll_votes, def.o.length);
  return { state, definition: def, channelId: row.channel_id, dmStudentId: row.dm_student_id };
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

  // Channel messages : FTS5 + BM25 ranking (v2.265). Fallback LIKE si la
  // query est trop courte (< 2 chars) pour eviter l'exception FTS.
  const fts = buildFtsQuery(query)
  let channelResults
  if (fts) {
    // FTS path : MATCH + ranking BM25, le ORDER BY se fait sur le score
    // FTS (plus pertinent) plutot que sur created_at DESC. Ca change
    // le comportement : les meilleurs matches en haut, pas les plus
    // recents — c'est ce qu'attend un user qui tape une requete.
    const ftsSql = promoId
      ? `SELECT m.id, m.content, m.author_name, m.author_id, m.created_at,
                c.id AS channel_id, c.name AS channel_name, c.promo_id,
                COALESCE(s.avatar_initials, COALESCE(substr(upper(t.name), 1, 2), substr(upper(m.author_name), 1, 2))) AS author_initials,
                COALESCE(s.photo_data, t.photo_data) AS author_photo,
                'channel' AS source_type
         FROM messages_fts f
         JOIN messages m ON m.id = f.rowid
         JOIN channels c ON m.channel_id = c.id
         LEFT JOIN students s ON s.id = m.author_id AND m.author_type = 'student'
         LEFT JOIN teachers t ON t.id = -m.author_id AND m.author_type = 'teacher'
         WHERE messages_fts MATCH ? AND c.promo_id = ?
           AND m.dm_student_id IS NULL AND m.deleted_at IS NULL
         ORDER BY bm25(messages_fts) ASC
         LIMIT ?`
      : `SELECT m.id, m.content, m.author_name, m.author_id, m.created_at,
                c.id AS channel_id, c.name AS channel_name, c.promo_id,
                COALESCE(s.avatar_initials, COALESCE(substr(upper(t.name), 1, 2), substr(upper(m.author_name), 1, 2))) AS author_initials,
                COALESCE(s.photo_data, t.photo_data) AS author_photo,
                'channel' AS source_type
         FROM messages_fts f
         JOIN messages m ON m.id = f.rowid
         JOIN channels c ON m.channel_id = c.id
         LEFT JOIN students s ON s.id = m.author_id AND m.author_type = 'student'
         LEFT JOIN teachers t ON t.id = -m.author_id AND m.author_type = 'teacher'
         WHERE messages_fts MATCH ?
           AND m.dm_student_id IS NULL AND m.deleted_at IS NULL
         ORDER BY bm25(messages_fts) ASC
         LIMIT ?`
    try {
      channelResults = promoId
        ? db.prepare(ftsSql).all(fts, promoId, limit)
        : db.prepare(ftsSql).all(fts, limit)
    } catch {
      channelResults = null
    }
  }

  // Fallback LIKE (query trop courte ou FTS jete) : meme logique qu'avant
  if (!channelResults) {
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
    channelResults = promoId
      ? db.prepare(channelSql).all(promoId, query, limit)
      : db.prepare(channelSql).all(query, limit);
  }

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

  // Pour les étudiants : contacts profs (boîte propre) + contacts étudiants (boîtes partagées)
  // 1) Contacts dans la boîte propre (profs et étudiants pairs)
  const ownBoxRows = getDb().prepare(`
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

  // 2) Contacts dans les boîtes partagées où l'étudiant est le peer (boxId < studentId)
  const peerBoxRows = getDb().prepare(`
    SELECT
      m.dm_student_id AS box_id,
      MAX(m.created_at) AS last_message_at,
      (SELECT content FROM messages m2
       WHERE m2.dm_student_id = m.dm_student_id AND m2.deleted_at IS NULL
       ORDER BY m2.created_at DESC LIMIT 1
      ) AS last_message_preview
    FROM messages m
    WHERE m.dm_student_id < ?
      AND m.dm_student_id IN (SELECT id FROM students WHERE promo_id = (SELECT promo_id FROM students WHERE id = ?))
      AND (m.author_id = ? OR m.author_id = m.dm_student_id)
      AND m.deleted_at IS NULL
    GROUP BY m.dm_student_id
    HAVING MAX(CASE WHEN m.author_id = ? THEN 1 ELSE 0 END) = 1
       OR MAX(CASE WHEN m.author_id = m.dm_student_id THEN 1 ELSE 0 END) = 1
    ORDER BY last_message_at DESC
    LIMIT ?
  `).all(studentId, studentId, studentId, studentId, limit);

  // Resolution des owners des boxes partagees : batch IN () plutot que
  // N+1 SELECT. A 60 contacts, l ancien pattern declenchait 60 roundtrips
  // DB par ouverture de chat — hot path perf.
  const peerContacts = (() => {
    if (!peerBoxRows.length) return []
    const boxIds = peerBoxRows.map(r => r.box_id).filter(Boolean)
    if (!boxIds.length) return []
    const placeholders = boxIds.map(() => '?').join(',')
    const peers = getDb().prepare(
      `SELECT id, name, avatar_initials, photo_data FROM students WHERE id IN (${placeholders})`
    ).all(...boxIds)
    const peerMap = new Map(peers.map(p => [p.id, p]))
    return peerBoxRows.map(r => {
      const peer = peerMap.get(r.box_id)
      return {
        author_id: peer?.id ?? r.box_id,
        name: peer?.name ?? 'Inconnu',
        last_message_at: r.last_message_at,
        last_message_preview: r.last_message_preview,
      }
    })
  })()

  const allContacts = [...ownBoxRows, ...peerContacts]
    .sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))
    .slice(0, limit)

  return allContacts.map(r => ({
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
  voteOnPoll, getPollState, parsePollDefinition,
};
