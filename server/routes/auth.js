// ─── Routes d'authentification ──────────────────────────────────────────────
const router    = require('express').Router()
const jwt       = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')
const queries   = require('../../src/db/index')
const auth      = require('../middleware/auth')

function wrap(fn) {
  return async (req, res) => {
    try {
      const data = await fn(req)
      res.json({ ok: true, data })
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message })
    }
  }
}

// ── Rate-limiter pour le login (anti brute-force) ───────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // 5 tentatives max par IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
})

// POST /api/auth/login
router.post('/login', loginLimiter, wrap(async (req) => {
  const { email, password } = req.body
  const user = queries.loginWithCredentials(email, password)
  if (!user) throw new Error('Email ou mot de passe incorrect')
  const secret = req.app.get('jwtSecret')
  const token  = jwt.sign(
    { id: user.id, name: user.name, type: user.type, promo_id: user.promo_id },
    secret,
    { expiresIn: '7d' },
  )
  return { ...user, token }
}))

// GET /api/auth/identities  (dev uniquement, ou enseignant authentifié)
router.get('/identities', (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next()
  auth(req, res, (err) => {
    if (err) return
    if (req.user?.type !== 'teacher') {
      return res.status(403).json({ ok: false, error: 'Accès réservé aux enseignants.' })
    }
    next()
  })
}, wrap(() => queries.getIdentities()))

// GET /api/auth/student-by-email?email=X  (requiert JWT)
router.get('/student-by-email', auth, wrap((req) => queries.getStudentByEmail(req.query.email)))

// POST /api/auth/register
router.post('/register', wrap((req) => queries.registerStudent(req.body)))

// POST /api/auth/change-password  (requiert JWT)
router.post('/change-password', auth, wrap((req) => {
  const { userId, isTeacher, currentPwd, newPwd } = req.body
  return queries.changePassword(userId, isTeacher, currentPwd, newPwd)
}))

// GET /api/auth/export/:studentId  (requiert JWT)
router.get('/export/:studentId', auth, wrap((req) => {
  return queries.exportStudentData(Number(req.params.studentId))
}))

module.exports = router
