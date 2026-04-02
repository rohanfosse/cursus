// ─── Middleware de validation Zod ─────────────────────────────────────────────
const { ZodError } = require('zod')

/**
 * Middleware Express qui valide req.body contre un schéma Zod.
 * En cas d'erreur, renvoie un 400 avec les détails de validation.
 */
/** Extrait les détails d'erreur d'un ZodError (compatible Zod v3 et v4). */
function formatZodDetails(err) {
  const issues = err.issues ?? err.errors ?? []
  return issues.map(e => `${(e.path ?? []).join('.')}: ${e.message}`).join('; ')
}

function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          ok: false,
          error: `Données invalides - ${formatZodDetails(err)}`,
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
        return res.status(400).json({
          ok: false,
          error: `Paramètres invalides - ${formatZodDetails(err)}`,
        })
      }
      return res.status(400).json({ ok: false, error: err.message })
    }
  }
}

module.exports = { validate, validateQuery }
