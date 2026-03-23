// ─── Routes promotions & canaux ───────────────────────────────────────────────
const router  = require('express').Router()
const queries = require('../db/index')
const wrap    = require('../utils/wrap')

// ── Promotions ────────────────────────────────────────────────────────────────
router.get('/',    wrap(() => queries.getPromotions()))
router.post('/',   wrap((req) => queries.createPromotion(req.body)))
router.delete('/:id', wrap((req) => queries.deletePromotion(Number(req.params.id))))
router.patch('/:id', (req, res) => {
  try {
    const { name, color } = req.body
    const { getDb } = require('../db/connection')
    const db = getDb()
    if (name) db.prepare('UPDATE promotions SET name = ? WHERE id = ?').run(name, Number(req.params.id))
    if (color) db.prepare('UPDATE promotions SET color = ? WHERE id = ?').run(color, Number(req.params.id))
    res.json({ ok: true, data: null })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

// ── Étudiants d'une promo ─────────────────────────────────────────────────────
router.get('/:promoId/students', wrap((req) => queries.getStudents(Number(req.params.promoId))))

// ── Canaux d'une promo ────────────────────────────────────────────────────────
router.get('/:promoId/channels', wrap((req) => queries.getChannels(Number(req.params.promoId))))

// POST /api/promotions/categories/rename
router.post('/categories/rename', wrap((req) => {
  const { promoId, old: oldName, next } = req.body
  return queries.renameCategory(promoId, oldName, next)
}))

// POST /api/promotions/categories/delete
router.post('/categories/delete', wrap((req) => {
  const { promoId, category } = req.body
  return queries.deleteCategory(promoId, category)
}))

// ── Canaux (CRUD) ─────────────────────────────────────────────────────────────
router.post('/channels',             wrap((req) => queries.createChannel(req.body)))
router.patch('/channels/:id/name',   wrap((req) => queries.renameChannel(Number(req.params.id), req.body.name)))
router.delete('/channels/:id',       wrap((req) => queries.deleteChannel(Number(req.params.id))))
router.post('/channels/members',     wrap((req) => queries.updateChannelMembers(req.body)))
router.patch('/channels/:id/category', wrap((req) => queries.updateChannelCategory(Number(req.params.id), req.body.category)))
router.patch('/channels/:id/privacy',  wrap((req) => queries.updateChannelPrivacy(Number(req.params.id), req.body.isPrivate, req.body.members)))

module.exports = router
