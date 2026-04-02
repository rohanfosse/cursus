// ─── Middleware JWT ────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken')

function authMiddleware(req, res, next) {
  const header = req.headers['authorization']
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Non authentifié' })
  }
  const token = header.slice(7)
  try {
    const secret = req.app.get('jwtSecret')
    req.user = jwt.verify(token, secret)
    next()
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Token expiré'
      : 'Token invalide ou expiré'
    return res.status(401).json({ ok: false, error: message })
  }
}

module.exports = authMiddleware
