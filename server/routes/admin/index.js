/**
 * Routes admin - Point d'entrée, monte tous les sous-routeurs sous /api/admin
 */
const router = require('express').Router()

// ── Middleware : accès réservé aux enseignants ────────────────────────────────
function requireTeacher(req, res, next) {
  if (req.user?.type !== 'teacher')
    return res.status(403).json({ ok: false, error: 'Accès réservé aux pilotes.' })
  next()
}
router.use(requireTeacher)

// ── Sous-routeurs ────────────────────────────────────────────────────────────
router.use(require('./monitor'))
router.use(require('./stats'))
router.use(require('./users'))
router.use(require('./moderation'))
router.use(require('./audit'))
router.use(require('./security'))
router.use(require('./maintenance'))
router.use(require('./deploy'))
router.use(require('./scheduled'))
router.use(require('./sessions'))
router.use(require('./import'))
router.use(require('./feedback'))
router.use(require('./settings'))

module.exports = router
