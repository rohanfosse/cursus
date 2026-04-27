/**
 * Helper pour generer des URLs Jitsi Meet uniques par reservation.
 *
 * On construit `<JITSI_BASE_URL>/cursus-<random16hex>` ou random16hex
 * apporte 64 bits d'entropie — non devinable, pas de collision pratique.
 *
 * `JITSI_BASE_URL` (env, default "https://meet.jit.si") permet de pointer
 * vers une instance self-hostee plus tard (ex: meet.cursus.school) sans
 * toucher au code applicatif.
 */
const crypto = require('crypto')

const DEFAULT_BASE_URL = 'https://meet.jit.si'

/** Renvoie l'URL de base Jitsi (sans slash final). */
function getJitsiBaseUrl() {
  const raw = (process.env.JITSI_BASE_URL || DEFAULT_BASE_URL).trim()
  return raw.replace(/\/+$/, '')
}

/**
 * Genere une URL de salle Jitsi unique pour une nouvelle reservation.
 * Le slug commence par `cursus-` pour etre identifiable cote operateur
 * Jitsi (en cas de besoin de moderation), suivi de 16 chars hex random.
 */
function generateJitsiUrl() {
  const slug = `cursus-${crypto.randomBytes(8).toString('hex')}`
  return `${getJitsiBaseUrl()}/${slug}`
}

module.exports = { generateJitsiUrl, getJitsiBaseUrl }
