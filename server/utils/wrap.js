/** Helper de route : enveloppe fn(req) dans try/catch et renvoie { ok, data }.
 *  Utilise err.statusCode si present (classes AppError), sinon fallback string matching. */
const log = require('./logger')

const CLIENT_ERROR_KEYWORDS = [
  'requis', 'invalide', 'introuvable', 'autoris', 'Accès',
  'pas pu', 'incorrect', 'expiré', 'existe', 'Données invalides',
  'trop long', 'trop court', 'refusé', 'manquant', 'déjà traité',
]

function resolveStatus(err) {
  // 1. Status explicite via AppError (prioritaire)
  if (err.statusCode) return err.statusCode

  const msg = err.message || ''

  // 2. Contrainte d'unicité → 409
  if (msg.includes('UNIQUE constraint')) return 409

  // 3. Mot-clé client → 400, sinon 500
  return CLIENT_ERROR_KEYWORDS.some(kw => msg.includes(kw)) ? 400 : 500
}

module.exports = function wrap(fn) {
  return async (req, res) => {
    try {
      const data = await fn(req)
      res.json({ ok: true, data })
    } catch (err) {
      const msg = err.message || 'Erreur interne'
      const status = resolveStatus(err)

      if (status >= 500) {
        log.error('route_error', { method: req.method, path: req.path, error: msg })
      }
      res.status(status).json({ ok: false, error: msg })
    }
  }
}

module.exports.resolveStatus = resolveStatus
