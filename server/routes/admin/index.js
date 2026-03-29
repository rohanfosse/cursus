/**
 * Routes admin - Point d'entree, monte tous les sous-routeurs sous /api/admin
 *
 * Deux niveaux d'acces :
 *   - requireAdmin     : teacher + admin  (modules promo)
 *   - requireSystemAdmin : admin uniquement (modules systeme)
 */
const router = require('express').Router()

const { hasRole, isSystemAdmin } = require('../../permissions')

// ── Middleware : acces reserve aux responsables (teacher + admin) ──────────────────
function requireAdmin(req, res, next) {
  if (!hasRole(req.user?.type, 'teacher')) {
    return res.status(403).json({ ok: false, error: 'Acces reserve aux responsables.' })
  }
  next()
}

// ── Middleware : acces reserve a l'administrateur systeme ─────────────────────
function requireSystemAdmin(req, res, next) {
  if (!isSystemAdmin(req.user?.type)) {
    return res.status(403).json({ ok: false, error: 'Acces reserve a l\'administrateur.' })
  }
  next()
}

// ── Endpoint /me : expose le role de l'utilisateur au frontend ───────────────
router.get('/me', requireAdmin, (req, res) => {
  res.json({
    ok: true,
    data: { id: req.user.id, name: req.user.name, type: req.user.type },
  })
})

// ── Routes promo (teacher + admin) ───────────────────────────────────────────
router.use(requireAdmin, require('./monitor'))
router.use(requireAdmin, require('./stats'))
router.use(requireAdmin, require('./users'))
router.use(requireAdmin, require('./moderation'))
router.use(requireAdmin, require('./scheduled'))
router.use(requireAdmin, require('./import'))
router.use(requireAdmin, require('./feedback'))

// ── Config lecture : accessible aux responsables (lecture seule banner) ────────────
const { settingsRead, modulesRead } = require('./settings-read')
router.get('/config', requireAdmin, settingsRead)
router.get('/modules', requireAdmin, modulesRead)

// ── Routes systeme (admin uniquement) ────────────────────────────────────────
router.use(requireSystemAdmin, require('./security'))
router.use(requireSystemAdmin, require('./maintenance'))
router.use(requireSystemAdmin, require('./deploy'))
router.use(requireSystemAdmin, require('./sessions'))
router.use(requireSystemAdmin, require('./settings'))
router.use(requireSystemAdmin, require('./audit'))

module.exports = router
