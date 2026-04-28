/**
 * Middleware de detection du mode demo.
 *
 * Strategie : un visiteur demo a un JWT prefixé `demo-` (cf.
 * `routes/demo.js` POST /start). Quand il appelle une route /api/demo/*,
 * ce middleware :
 *  1. Lit le JWT depuis Authorization Bearer
 *  2. Verifie sa signature avec le meme secret que la prod
 *  3. Charge la session depuis `demo_sessions` et populate
 *     - `req.demoMode = true`
 *     - `req.tenantId = session.tenant_id`
 *     - `req.demoUser = { id, name, type, promo_id, ... }`
 *
 * Si la session a expire ou le tenant a ete purge -> 401, le client doit
 * relancer un /api/demo/start.
 *
 * Note securite : le middleware est mounte UNIQUEMENT sur /api/demo/*, pas
 * sur les routes prod. Aucun risque qu'un visiteur demo touche aux donnees
 * reelles. La separation est physique (autre fichier DB).
 */
const jwt = require('jsonwebtoken')
const { getDemoDb } = require('../db/demo-connection')

const TOKEN_PREFIX = 'demo-'

function extractToken(req) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  if (!token.startsWith(TOKEN_PREFIX)) return null
  return token.slice(TOKEN_PREFIX.length)
}

function demoMode(req, res, next) {
  const token = extractToken(req)
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Token demo manquant ou invalide.' })
  }

  let decoded
  try {
    decoded = jwt.verify(token, req.app.get('jwtSecret'))
  } catch {
    return res.status(401).json({ ok: false, error: 'Token demo expire ou corrompu.' })
  }

  if (decoded.scope !== 'demo' || !decoded.sessionId || !decoded.tenantId) {
    return res.status(401).json({ ok: false, error: 'Token demo invalide.' })
  }

  // Verifier que la session existe encore en DB (pas purgée par expiration).
  const session = getDemoDb()
    .prepare(`SELECT id, tenant_id, role, user_id, user_name, expires_at FROM demo_sessions WHERE id = ?`)
    .get(decoded.sessionId)

  if (!session) {
    return res.status(401).json({ ok: false, error: 'Session demo expiree, veuillez relancer la demo.' })
  }

  if (new Date(session.expires_at) < new Date()) {
    return res.status(401).json({ ok: false, error: 'Session demo expiree, veuillez relancer la demo.' })
  }

  req.demoMode = true
  req.tenantId = session.tenant_id
  req.demoUser = {
    id:        session.user_id,
    name:      session.user_name,
    type:      session.role,
    sessionId: session.id,
  }
  next()
}

/**
 * Helper pour les routes prod qui veulent juste savoir si la requete vient
 * d'un visiteur demo (utilise par les mocks SMTP / MS Graph).
 */
function isDemoRequest(req) {
  return req.demoMode === true
}

module.exports = { demoMode, isDemoRequest, TOKEN_PREFIX }
