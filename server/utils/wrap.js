/** Helper de route : enveloppe fn(req) dans try/catch et renvoie { ok, data }.
 *  Utilise err.statusCode si present (classes AppError), sinon fallback string matching. */
const log = require('./logger')

module.exports = function wrap(fn) {
  return async (req, res) => {
    try {
      const data = await fn(req)
      res.json({ ok: true, data })
    } catch (err) {
      const msg = err.message || 'Erreur interne'

      // 1. Status explicite via AppError (prioritaire)
      let status = err.statusCode

      // 2. Fallback : string matching pour retrocompatibilite
      if (!status) {
        if (msg.includes('UNIQUE constraint')) {
          status = 409
        } else {
          const isClientError = msg.includes('requis') || msg.includes('invalide') ||
            msg.includes('introuvable') || msg.includes('autoris') || msg.includes('Accès') ||
            msg.includes('pas pu') || msg.includes('incorrect') || msg.includes('expiré') ||
            msg.includes('existe') || msg.includes('Données invalides') ||
            msg.includes('trop long') || msg.includes('trop court')
          status = isClientError ? 400 : 500
        }
      }

      if (status >= 500) {
        log.error('route_error', { method: req.method, path: req.path, error: msg })
      }
      res.status(status).json({ ok: false, error: msg })
    }
  }
}
