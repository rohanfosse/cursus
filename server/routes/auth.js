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

// Suppression de compte : exige le mot de passe + texte de confirmation
// strict pour eviter une suppression accidentelle. Le mot de passe est
// reverifie cote serveur pour bloquer une session detournee.
const deleteAccountSchema = z.object({
  password:     z.string().min(1, 'Mot de passe requis'),
  confirmation: z.literal('SUPPRIMER', { message: "Saisissez exactement 'SUPPRIMER' pour confirmer" }),
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

// POST /api/auth/refresh — renouveler le JWT si encore valide (< 7j)
router.post('/refresh', auth, (req, res) => {
  try {
    const secret = req.app.get('jwtSecret')
    const token = jwt.sign(
      { id: req.user.id, name: req.user.name, type: req.user.type, promo_id: req.user.promo_id },
      secret,
      { expiresIn: '7d' },
    )
    res.json({ ok: true, data: { token } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

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

// GET /api/auth/find-user?name=X  (utilise pour ouvrir un DM)
//
// Restriction same-promo pour les students : un etudiant ne peut chercher
// qu'un autre etudiant de SA promo (ou un enseignant, qui est cross-promo
// par nature). Sans ca, n'importe quel etudiant pouvait enumerer le
// directory complet de l'ecole en testant des noms.
router.get('/find-user', auth, wrap((req) => {
  const target = queries.findUserByName(req.query.name)
  if (!target) return null
  // Teachers/admins/TAs : pas de restriction (peuvent DM cross-promo).
  if (req.user?.type !== 'student') return target
  // Target = enseignant : autorise.
  if (target.type !== 'student') return target
  // Target = etudiant : doit etre la meme promo que le requester.
  if (target.promo_id !== req.user?.promo_id) return null
  return target
}))

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

// DELETE /api/auth/account — RGPD droit a l'effacement.
//
// Anonymise le compte (preserve les FK : depots/notes/audit log restent pour
// la formation) au lieu de hard delete. Exige password + texte 'SUPPRIMER'.
// Reserve aux students : la suppression d'un compte teacher/admin demande
// l'intervention d'un admin (cf. routes/teachers.js DELETE /:id).
router.delete('/account', auth, validate(deleteAccountSchema), wrap(async (req) => {
  if (req.user?.type !== 'student') {
    throw new ForbiddenError('La suppression d\'un compte enseignant doit etre faite par un administrateur.')
  }
  const studentId = Number(req.user.id)
  // Re-verifie le mot de passe pour bloquer une session detournee
  // (token vole via XSS ou reseau non-HTTPS).
  const bcrypt = require('bcryptjs')
  const { getDb } = require('../db/connection')
  const row = getDb().prepare('SELECT password FROM students WHERE id = ?').get(studentId)
  if (!row || !bcrypt.compareSync(req.body.password, row.password)) {
    throw new AppError('Mot de passe incorrect.', 401)
  }
  queries.anonymizeStudentAccount(studentId)
  return { ok: true }
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
