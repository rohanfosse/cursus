// ─── Middleware de validation Zod ─────────────────────────────────────────────
const { ZodError } = require('zod')

/**
 * Middleware Express qui valide req.body contre un schéma Zod.
 * En cas d'erreur, renvoie un 400 avec les détails de validation.
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
        return res.status(400).json({
          ok: false,
          error: `Données invalides — ${details}`,
        })
      }
      return res.status(400).json({ ok: false, error: err.message })
    }
  }
}

/**
 * Valide req.query contre un schéma Zod.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query)
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
        return res.status(400).json({
          ok: false,
          error: `Paramètres invalides — ${details}`,
        })
      }
      return res.status(400).json({ ok: false, error: err.message })
    }
  }
}

module.exports = { validate, validateQuery }
