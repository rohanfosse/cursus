/**
 * MessageService : logique metier de creation de message.
 * Extrait de server/routes/messages.js pour separation des responsabilites.
 */
const queries = require('../db/index')
const { ForbiddenError, NotFoundError, AppError } = require('../utils/errors')
const { safeAuthorType } = require('../utils/roles')

/**
 * Valide les permissions DM et l'existence du destinataire.
 */
function validateDm(payload, user) {
  if (!payload.dmStudentId) return

  const { getDb } = require('../db/connection')

  if (user.type === 'student') {
    const peerId = payload.dmPeerId
    if (peerId != null && peerId > 0) {
      // DM etudiant-etudiant : verifier meme promo
      const sender = getDb().prepare('SELECT promo_id FROM students WHERE id = ?').get(user.id)
      const recipient = getDb().prepare('SELECT promo_id FROM students WHERE id = ?').get(peerId)
      if (!sender || !recipient || sender.promo_id !== recipient.promo_id) {
        throw new ForbiddenError('Vous ne pouvez contacter que les etudiants de votre promo.')
      }
      // Normaliser la boite : dm_student_id = min, dmPeerId = max
      payload.dmStudentId = Math.min(user.id, peerId)
      payload.dmPeerId = Math.max(user.id, peerId)
    } else {
      // DM etudiant-prof : logique existante
      if (payload.dmStudentId !== user.id) {
        throw new ForbiddenError('Vous ne pouvez envoyer des messages que dans vos propres conversations.')
      }
    }
  }

  // Verifier que le destinataire (boite) existe
  const exists = getDb().prepare('SELECT id FROM students WHERE id = ?').get(payload.dmStudentId)
  if (!exists) {
    throw new NotFoundError('Destinataire introuvable.')
  }
}

/**
 * Verifie qu'un etudiant n'ecrit pas dans un canal d'annonce.
 */
function validateChannel(payload, user) {
  if (!payload.channelId) return

  const { getDb } = require('../db/connection')
  const ch = getDb().prepare('SELECT type, archived FROM channels WHERE id = ?').get(payload.channelId)

  if (ch?.archived) {
    throw new ForbiddenError('Ce canal est archive. Vous ne pouvez plus y poster.')
  }

  if (user.type === 'student' && ch?.type === 'annonce') {
    throw new ForbiddenError('Les etudiants ne peuvent pas poster dans les canaux d\'annonce.')
  }
}

/**
 * Parse les mentions dans le contenu du message.
 */
function parseMentions(content) {
  const rawContent = content ?? ''
  const mentionEveryone = /@everyone\b/i.test(rawContent)
  const mentionNames = []
  const re = /@([\w][\w.\-]*)/g
  let m
  while ((m = re.exec(rawContent)) !== null) {
    const name = m[1].toLowerCase()
    if (name !== 'everyone') mentionNames.push(m[1])
  }
  return { mentionEveryone, mentionNames }
}

/**
 * Construit le payload de push notification Socket.io.
 */
function buildPushPayload(payload, user, message, mentions) {
  return {
    channelId: payload.channelId ?? null,
    dmStudentId: payload.dmStudentId ?? null,
    authorName: user.name ?? null,
    channelName: payload.channelName ?? null,
    promoId: payload.promoId ?? null,
    preview: (payload.content ?? '').replace(/[*_`>#[\]!]/g, '').slice(0, 80),
    mentionEveryone: mentions.mentionEveryone,
    mentionNames: mentions.mentionNames,
    message: payload.dmStudentId ? message : undefined,
  }
}

/**
 * Cree un message et retourne { message, pushPayload }.
 */
function create(payload, user) {
  // Forcer l'identite depuis le JWT (anti-usurpation)
  payload.authorName = user.name
  payload.authorId = user.id
  payload.authorType = safeAuthorType(user.type)

  // Validations
  validateDm(payload, user)
  validateChannel(payload, user)

  // Insertion
  const result = queries.sendMessage(payload)
  const message = queries.getMessageById(Number(result.lastInsertRowid))
  if (!message) {
    throw new AppError('Le message a ete insere mais n\'a pas pu etre relu.', 500)
  }

  // Mentions
  const mentions = parseMentions(payload.content)

  // Push payload
  const pushPayload = buildPushPayload(payload, user, message, mentions)

  return { message, pushPayload }
}

module.exports = { create, validateDm, validateChannel, parseMentions, buildPushPayload }
