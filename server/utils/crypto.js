// ─── Chiffrement AES-256-GCM pour les messages privés (DM) ─────────────────────
const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16
const PREFIX = 'enc:'

let _key = null

/** Dérive une clé AES-256 à partir du JWT_SECRET (PBKDF2). */
function getKey() {
  if (_key) return _key
  const secret = process.env.JWT_SECRET || 'changeme-dev-secret'
  _key = crypto.pbkdf2Sync(secret, 'cursus-msg-encryption-salt', 100000, 32, 'sha256')
  return _key
}

/** Chiffre un texte en AES-256-GCM. Retourne `enc:<base64(iv+tag+ciphertext)>`. */
function encrypt(plaintext) {
  if (!plaintext) return plaintext
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/** Déchiffre un texte chiffré. Les textes non chiffrés (legacy) passent tels quels. */
function decrypt(data) {
  if (!data || !data.startsWith(PREFIX)) return data
  try {
    const buf = Buffer.from(data.slice(PREFIX.length), 'base64')
    const iv = buf.subarray(0, IV_LENGTH)
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH)
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
    decipher.setAuthTag(tag)
    return decipher.update(encrypted, null, 'utf8') + decipher.final('utf8')
  } catch {
    return data // fallback si déchiffrement impossible (données legacy)
  }
}

/** Déchiffre le contenu d'une ligne message si c'est un DM. */
function decryptRow(row) {
  if (!row) return row
  if (row.dm_student_id && row.content) {
    row.content = decrypt(row.content)
  }
  if (row.last_message_preview) {
    row.last_message_preview = decrypt(row.last_message_preview)
  }
  return row
}

/** Déchiffre le contenu de plusieurs lignes messages. */
function decryptRows(rows) {
  if (!rows) return rows
  return rows.map(decryptRow)
}

module.exports = { encrypt, decrypt, decryptRow, decryptRows }
