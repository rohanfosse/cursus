// ─── Modele uploads : tracking owner + scope des fichiers servis sous /uploads
//
// Pourquoi : avant, le middleware /uploads (server/index.js) ne validait que
// la signature du JWT. N'importe quel utilisateur authentifie pouvait donc
// telecharger n'importe quel fichier dont il connaissait/devinait le nom.
// Avec ~48 bits d'entropie (Date.now + 6 hex bytes), le brute-force est
// infaisable mais l'interception (URL vue dans devtools, log, ecran d'un
// camarade) restait exploitable.
//
// Ce modele track chaque upload : owner (qui a uploade), kind (a quoi ca sert),
// channel_id / dm_peer_id / travail_id (scope d'acces). Le middleware
// `canAccessUpload` decide en fonction.

const { getDb } = require('../connection')

const VALID_KINDS = new Set([
  'message-attachment', // pj dans un message canal
  'dm-attachment',      // pj dans un DM
  'depot',              // rendu de devoir
  'document',           // doc dans Documents
  'photo-profile',      // photo de profil
  'signature',          // signature scannee
  'cahier',             // cahier collaboratif
  'image-paste',        // collage d'image dans un message
  'audio',              // memo vocal
  'attachment',         // generique fallback
])

/**
 * Enregistre un upload. Idempotent sur `filename` (PRIMARY KEY).
 *
 * @param {object} opts
 * @param {string} opts.filename     Nom de fichier (resultat multer)
 * @param {number} opts.ownerId      ID de l'uploader (cote teacher : positif, on stocke abs)
 * @param {string} opts.ownerType    'student' | 'teacher' | 'ta' | 'admin'
 * @param {string} [opts.kind]       Kind dans VALID_KINDS (defaut 'attachment')
 * @param {number} [opts.channelId]
 * @param {number} [opts.dmPeerId]
 * @param {number} [opts.travailId]
 * @param {number} [opts.fileSize]
 * @param {string} [opts.originalName]
 */
function recordUpload({ filename, ownerId, ownerType, kind, channelId, dmPeerId, travailId, fileSize, originalName }) {
  const k = VALID_KINDS.has(kind) ? kind : 'attachment'
  return getDb().prepare(`
    INSERT OR REPLACE INTO uploads
      (filename, owner_id, owner_type, kind, channel_id, dm_peer_id, travail_id, file_size, original_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    filename,
    Math.abs(Number(ownerId)),
    ownerType,
    k,
    channelId ?? null,
    dmPeerId ?? null,
    travailId ?? null,
    fileSize ?? null,
    originalName ?? null,
  )
}

/** Lookup d'une entree par filename. Retourne null si absente (legacy file). */
function getUpload(filename) {
  return getDb().prepare('SELECT * FROM uploads WHERE filename = ?').get(filename) ?? null
}

/**
 * Verifie qu'un user peut acceder a un fichier.
 *
 * Regles :
 *  - admin : toujours OK
 *  - photo-profile : OK pour tout user authentifie (publique au sein de l'app)
 *  - owner du fichier : OK
 *  - teacher / ta : OK si la promo associee (channel/travail/dmPeer) est dans
 *    ses promos. Pour les DMs, OK si l'un des peers est l'utilisateur courant.
 *  - student : OK si membre du canal / participant au DM / etudiant cible du
 *    travail.
 *  - Pas d'entree dans `uploads` (legacy) : OK pour tout user authentifie
 *    (compatibilite ascendante — les anciens fichiers n'avaient pas de row).
 *
 * @param {object} user  req.user (JWT decode)
 * @param {string} filename
 * @returns {boolean}
 */
function canAccessUpload(user, filename) {
  if (!user) return false
  if (user.type === 'admin') return true

  const row = getUpload(filename)
  // Legacy : aucune entree -> on autorise les utilisateurs authentifies pour
  // ne pas casser les URLs deja stockees dans messages.content / depots.
  // Une fois la transition complete (toutes les nouvelles uploads ont une row),
  // on pourra durcir en bloquant les legacy.
  if (!row) return true

  const meId = Math.abs(Number(user.id))

  // Photos de profil : visibles dans toute l'app.
  if (row.kind === 'photo-profile') return true

  // Owner direct.
  if (row.owner_id === meId && row.owner_type === user.type) return true

  // Pour le reste : on delegue les checks scope a un helper qui interroge la
  // DB selon le contexte (canal/DM/travail).
  return _canAccessByScope(user, row)
}

function _canAccessByScope(user, row) {
  const db = getDb()
  const meId = Math.abs(Number(user.id))

  // Travail (depot) : owner = etudiant proprio, ou teacher gerant la promo.
  if (row.travail_id) {
    const travail = db.prepare('SELECT promo_id FROM travaux WHERE id = ?').get(row.travail_id)
    if (!travail) return false
    if (user.type === 'student') {
      return user.promo_id === travail.promo_id
    }
    if (user.type === 'teacher' || user.type === 'ta') {
      const owns = db.prepare(
        'SELECT 1 FROM teacher_promos WHERE teacher_id = ? AND promo_id = ? LIMIT 1'
      ).get(meId, travail.promo_id)
      return !!owns
    }
    return false
  }

  // Canal : tout le monde de la promo (public) ou membres (prive).
  if (row.channel_id) {
    const ch = db.prepare('SELECT promo_id, is_private, members FROM channels WHERE id = ?').get(row.channel_id)
    if (!ch) return false
    if (user.type === 'teacher' || user.type === 'ta') {
      const owns = db.prepare(
        'SELECT 1 FROM teacher_promos WHERE teacher_id = ? AND promo_id = ? LIMIT 1'
      ).get(meId, ch.promo_id)
      return !!owns
    }
    if (user.type === 'student') {
      if (user.promo_id !== ch.promo_id) return false
      if (!ch.is_private) return true
      try {
        const members = Array.isArray(ch.members) ? ch.members : JSON.parse(ch.members ?? '[]')
        return members.includes(meId)
      } catch { return false }
    }
    return false
  }

  // DM : peer1/peer2 = owner_id et dm_peer_id.
  if (row.dm_peer_id) {
    const peerA = row.owner_id
    const peerB = row.dm_peer_id
    return meId === Math.abs(peerA) || meId === Math.abs(peerB)
  }

  // Pas de scope -> seul l'owner peut acceder.
  return false
}

/** Supprime l'entree (utilise pour purge de fichiers orphelins). */
function deleteUpload(filename) {
  return getDb().prepare('DELETE FROM uploads WHERE filename = ?').run(filename)
}

module.exports = {
  recordUpload,
  getUpload,
  canAccessUpload,
  deleteUpload,
  VALID_KINDS,
}
