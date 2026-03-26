/** Helper de route : enveloppe fn(req) dans try/catch et renvoie { ok, data }.
 *  Distingue les erreurs métier (400) des erreurs serveur (500). */
const log = require('./logger')

module.exports = function wrap(fn) {
  return async (req, res) => {
    try {
      const data = await fn(req)
      res.json({ ok: true, data })
    } catch (err) {
      const msg = err.message || 'Erreur interne'
      // Erreurs connues (validation, not found, auth) → 400
      // Erreurs inattendues (DB crash, bug interne) → 500
      const isClientError = msg.includes('requis') || msg.includes('invalide') ||
        msg.includes('introuvable') || msg.includes('autoris') || msg.includes('Accès') ||
        msg.includes('UNIQUE constraint') || msg.includes('pas pu')
      const status = isClientError ? 400 : 500
      if (status === 500) {
        log.error('route_error', { method: req.method, path: req.path, error: msg })
      }
      res.status(status).json({ ok: false, error: msg })
    }
  }
}
