// ─── Routes groupes ───────────────────────────────────────────────────────────
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap    = require('../utils/wrap')
const { requireRole, requirePromo, promoFromParam, requireGroupOwner } = require('../middleware/authorize')

// ── Schémas Zod ────────────────────────────────────────────────────────────────
const createGroupSchema = z.object({
  promoId: z.number().int().positive('promoId requis'),
  name:    z.string().min(1, 'Nom requis').max(200),
}).passthrough()

const setGroupMembersSchema = z.object({
  groupId:    z.number().int().positive('groupId requis'),
  studentIds: z.array(z.number().int().positive()),
}).passthrough()

router.get('/',               requirePromo(promoFromParam), wrap((req) => queries.getGroups(Number(req.query.promoId))))
router.post('/',              requireRole('teacher'), validate(createGroupSchema), wrap((req) => queries.createGroup(req.body)))
router.delete('/:id',         requireRole('teacher'), requireGroupOwner, wrap((req) => queries.deleteGroup(Number(req.params.id))))
router.get('/:id/members', (req, res, next) => {
  // Étudiants : vérifier que le groupe appartient à leur promo
  if (req.user?.type === 'student') {
    const { getDb } = require('../db/connection')
    const grp = getDb().prepare('SELECT promo_id FROM groups WHERE id = ?').get(Number(req.params.id))
    if (grp && grp.promo_id !== req.user.promo_id) {
      return res.status(403).json({ ok: false, error: 'Accès non autorisé à ce groupe.' })
    }
  }
  next()
}, wrap((req) => queries.getGroupMembers(Number(req.params.id))))
router.post('/:id/members',   requireRole('teacher'), requireGroupOwner, validate(setGroupMembersSchema), wrap((req) => queries.setGroupMembers(req.body)))

module.exports = router
