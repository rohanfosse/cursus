// ─── Routes d'authentification ──────────────────────────────────────────────
const router    = require('express').Router()
const jwt       = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')
const { z }     = require('zod')
const queries   = require('../db/index')
const auth      = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { AppError, ForbiddenError } = require('../utils/errors')

// ── Schémas de validation ─────────────────────────────────────────────────────
const loginSchema = z.object({
  email:    z.string().min(1, 'Email requis').email('Format d\'email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

const registerSchema = z.object({
  name:      z.string().min(1, 'Nom requis').max(200),
  email:     z.string().email('Format d\'email invalide'),
  password:  z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  promoId:   z.number().int().positive('Promotion invalide'),
  photoData: z.string().nullable().optional(),
})

const changePasswordSchema = z.object({
  userId:     z.number().int().positive(),
  isTeacher:  z.boolean(),
  currentPwd: z.string().min(1, 'Mot de passe actuel requis'),
  newPwd:     z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères'),
})

const wrap = require('../utils/wrap')

// ── Rate-limiters (anti brute-force) ─────────────────────────────────────────
const skipInTest = () => process.env.NODE_ENV === 'test'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // 5 tentatives max par IP
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,                   // 5 inscriptions max par IP par heure
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Trop de tentatives d\'inscription. Réessayez plus tard.' },
})

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // 5 tentatives max par IP
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
})

// ── Helper : enregistrer une tentative de connexion ──────────────────────────
function logLoginAttempt(email, success, req) {
  try {
    const { getDb } = require('../db/connection')
    getDb().prepare(
      `INSERT INTO login_attempts (email, success, ip, user_agent) VALUES (?, ?, ?, ?)`
    ).run(email || '', success ? 1 : 0, req.ip, req.get('user-agent') || '')
  } catch { /* table pas encore créée - ignoré */ }
}

// POST /api/auth/login
router.post('/login', loginLimiter, validate(loginSchema), wrap(async (req) => {
  const { email, password } = req.body
  const user = queries.loginWithCredentials(email, password)
  if (!user) {
    logLoginAttempt(email, false, req)
    throw new AppError('Email ou mot de passe incorrect', 401)
  }
  logLoginAttempt(email, true, req)
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
      return res.status(403).json({ ok: false, error: 'Accès réservé aux responsables.' })
    }
    next()
  })
}, wrap(() => queries.getIdentities()))

// GET /api/auth/student-by-email?email=X  (profs uniquement)
router.get('/student-by-email', auth, (req, res, next) => {
  if (req.user?.type === 'student') return res.status(403).json({ ok: false, error: 'Accès réservé aux enseignants.' })
  next()
}, wrap((req) => queries.getStudentByEmail(req.query.email)))

// GET /api/auth/find-user?name=X  (tous les utilisateurs — utilisé pour ouvrir un DM)
router.get('/find-user', auth, wrap((req) => queries.findUserByName(req.query.name)))

// GET /api/auth/teachers  (requiert JWT - retourne les enseignants visibles pour les DMs)
router.get('/teachers', auth, wrap(() => {
  const { getDb } = require('../db/connection')
  return getDb().prepare('SELECT id, name, role, photo_data FROM teachers ORDER BY name').all().map(t => ({
    id: -(t.id),
    name: t.name,
    promo_id: null,
    promo_name: null,
    avatar_initials: t.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2),
    photo_data: t.photo_data ?? null,
    type: t.role,
  }))
}))

// POST /api/auth/register
router.post('/register', registerLimiter, validate(registerSchema), wrap((req) => queries.registerStudent(req.body)))

// POST /api/auth/change-password  (requiert JWT)
router.post('/change-password', auth, changePasswordLimiter, validate(changePasswordSchema), wrap((req) => {
  const { userId, isTeacher, currentPwd, newPwd } = req.body
  if (req.user.type === 'student' && req.user.id !== userId) {
    throw new Error('Vous ne pouvez modifier que votre propre mot de passe.')
  }
  return queries.changePassword(userId, isTeacher, currentPwd, newPwd)
}))

// GET /api/auth/export/:studentId  (requiert JWT)
router.get('/export/:studentId', auth, (req, res, next) => {
  if (req.user.type === 'student' && req.user.id !== Number(req.params.studentId)) {
    return res.status(403).json({ ok: false, error: 'Accès non autorisé.' })
  }
  next()
}, wrap((req) => {
  return queries.exportStudentData(Number(req.params.studentId))
}))

module.exports = router
