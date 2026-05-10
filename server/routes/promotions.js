// ─── Routes promotions & canaux ───────────────────────────────────────────────
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap    = require('../utils/wrap')
const {
  requireRole, requirePromo, requirePromoAdmin,
  promoFromParam, promoFromIdParam, promoFromChannelIdParam, promoFromBody,
} = require('../middleware/authorize')

// ── Schémas ─────────────────────────────────────────────────────────────────
const patchPromoSchema = z.object({
  name:  z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hex invalide').optional(),
})

const categoryRenameSchema = z.object({
  promoId: z.number().int().positive(),
  old:     z.string().min(1).max(100),
  next:    z.string().min(1).max(100),
})

const categoryDeleteSchema = z.object({
  promoId:  z.number().int().positive(),
  category: z.string().min(1).max(100),
})

const createChannelSchema = z.object({
  promoId:    z.number().int().positive(),
  name:       z.string().min(1).max(100),
  type:       z.enum(['chat', 'annonce']).optional().default('chat'),
  category:   z.string().max(100).nullable().optional(),
  is_private: z.union([z.boolean(), z.number()]).optional(),
  isPrivate:  z.union([z.boolean(), z.number()]).optional(),
  members:    z.union([z.string(), z.array(z.any())]).nullable().optional(),
  group_id:   z.number().int().nullable().optional(),
}).passthrough().transform(data => ({
  ...data,
  isPrivate: data.isPrivate ?? data.is_private ?? false,
}))

// ── Promotions ────────────────────────────────────────────────────────────────
router.get('/',    wrap(() => queries.getPromotions()))
// Creation de promo : admin uniquement. Avant : tout teacher pouvait creer
// une promo arbitraire (et s'y affecter ensuite via teacher_promos),
// privilege escalation.
router.post('/',   requireRole('admin'), wrap((req) => queries.createPromotion(req.body)))
router.delete('/:id', requireRole('admin'), wrap((req) => queries.deletePromotion(Number(req.params.id))))
// PATCH promo : admin OR teacher responsable de cette promo. Avant : tout
// teacher pouvait renommer/recolorier la promo d'un autre prof.
router.patch('/:id',
  requireRole('teacher'),
  requirePromoAdmin(promoFromIdParam),
  validate(patchPromoSchema),
  wrap((req) => {
    const { name, color } = req.body
    const { getDb } = require('../db/connection')
    const db = getDb()
    if (name)  db.prepare('UPDATE promotions SET name = ? WHERE id = ?').run(name, Number(req.params.id))
    if (color) db.prepare('UPDATE promotions SET color = ? WHERE id = ?').run(color, Number(req.params.id))
    return null
  }),
)

// ── Étudiants d'une promo ─────────────────────────────────────────────────────
router.get('/:promoId/students', requirePromo(promoFromParam), wrap((req) => queries.getStudents(Number(req.params.promoId))))

// ── Canaux d'une promo ────────────────────────────────────────────────────────
router.get('/:promoId/channels', requirePromo(promoFromParam), wrap((req) => queries.getChannels(Number(req.params.promoId))))

// Categories : ownership check sur la promo ciblee. Avant : tout teacher
// pouvait renommer/supprimer une categorie sur une promo arbitraire.
router.post('/categories/rename', requireRole('teacher'), validate(categoryRenameSchema),
  requirePromoAdmin(promoFromBody),
  wrap((req) => queries.renameCategory(req.body.promoId, req.body.old, req.body.next)),
)
router.post('/categories/delete', requireRole('admin'), validate(categoryDeleteSchema),
  wrap((req) => queries.deleteCategory(req.body.promoId, req.body.category)),
)

// ── Archivage canaux ──────────────────────────────────────────────────────────
// Toutes les ops sur /channels/:id/* resolvent la promo via le canal et
// verifient que le teacher la gere. Avant : tout teacher pouvait
// archiver/restorer/supprimer/renommer un canal cross-promo.
router.post('/channels/:id/archive',  requireRole('teacher'),
  requirePromoAdmin(promoFromChannelIdParam),
  wrap((req) => queries.archiveChannel(Number(req.params.id))),
)
router.post('/channels/:id/restore',  requireRole('teacher'),
  requirePromoAdmin(promoFromChannelIdParam),
  wrap((req) => queries.restoreChannel(Number(req.params.id))),
)
router.get('/:promoId/channels/archived', requirePromo(promoFromParam),
  wrap((req) => queries.getArchivedChannels(Number(req.params.promoId))),
)

// ── Canaux (CRUD) ─────────────────────────────────────────────────────────────
router.post('/channels',
  requireRole('teacher'),
  validate(createChannelSchema),
  requirePromoAdmin(promoFromBody),
  wrap((req) => queries.createChannel(req.body)),
)
router.patch('/channels/:id/name',
  requireRole('teacher'),
  requirePromoAdmin(promoFromChannelIdParam),
  wrap((req) => queries.renameChannel(Number(req.params.id), req.body.name)),
)
router.delete('/channels/:id',
  requireRole('teacher'),
  requirePromoAdmin(promoFromChannelIdParam),
  wrap((req) => queries.deleteChannel(Number(req.params.id))),
)
router.post('/channels/members',
  requireRole('teacher'),
  // Le body contient `channelId` ; on resolve la promo a partir du canal.
  (req, res, next) => {
    const channelId = Number(req.body?.channelId)
    if (!channelId) return next()
    const { getDb } = require('../db/connection')
    const ch = getDb().prepare('SELECT promo_id FROM channels WHERE id = ?').get(channelId)
    if (!ch) return res.status(404).json({ ok: false, error: 'Canal introuvable.' })
    req._channelPromoId = ch.promo_id
    next()
  },
  requirePromoAdmin((req) => req._channelPromoId ?? null),
  wrap((req) => queries.updateChannelMembers(req.body)),
)
router.patch('/channels/:id/category',
  requireRole('teacher'),
  requirePromoAdmin(promoFromChannelIdParam),
  wrap((req) => queries.updateChannelCategory(Number(req.params.id), req.body.category)),
)
router.patch('/channels/:id/privacy',
  requireRole('teacher'),
  requirePromoAdmin(promoFromChannelIdParam),
  wrap((req) => queries.updateChannelPrivacy(Number(req.params.id), req.body.isPrivate, req.body.members)),
)

module.exports = router
