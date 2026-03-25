// ─── Routes documents ────────────────────────────────────────────────────────
const router  = require('express').Router()
const queries = require('../db/index')
const wrap    = require('../utils/wrap')
const { requireTeacher, requirePromo, promoFromChannel, promoFromParam } = require('../middleware/authorize')

// ── Documents de canal ────────────────────────────────────────────────────────
router.get('/channel/:channelId',             requirePromo(promoFromChannel), wrap((req) => queries.getChannelDocuments(Number(req.params.channelId))))
router.get('/channel/:channelId/categories',  requirePromo(promoFromChannel), wrap((req) => queries.getChannelDocumentCategories(Number(req.params.channelId))))
router.get('/promo/:promoId',                 requirePromo(promoFromParam), wrap((req) => queries.getPromoDocuments(Number(req.params.promoId))))
router.post('/channel',                       wrap((req) => queries.addChannelDocument(req.body)))
router.patch('/project/:id',                  requireTeacher, wrap((req) => queries.updateProjectDocument({ id: Number(req.params.id), ...req.body })))
router.delete('/channel/:id',                 requireTeacher, wrap((req) => queries.deleteChannelDocument(Number(req.params.id))))

// ── Recherche & liaison ───────────────────────────────────────────────────────
router.get('/search', wrap((req) => queries.searchDocuments(Number(req.query.promoId), req.query.q ?? '')))
router.patch('/link/:id', wrap((req) => queries.linkDocumentToTravail(Number(req.params.id), req.body.travailId ?? null)))

// ── Documents de projet ───────────────────────────────────────────────────────
router.get('/project', wrap((req) => queries.getProjectDocuments(
  Number(req.query.promoId),
  req.query.project ?? null,
)))
router.get('/project/categories', wrap((req) => queries.getProjectDocumentCategories(
  Number(req.query.promoId),
  req.query.project ?? null,
)))
router.post('/project', (req, res) => {
  try {
    const payload = req.body
    const result  = queries.addProjectDocument(payload)

    // Notification aux canaux du projet
    if (result?.changes && payload.project && payload.promoId && payload.authorName) {
      try {
        const channels = queries.getChannels(payload.promoId)
        const projectChannels = channels.filter((c) => c.category?.trim() === payload.project?.trim())
        const emoji   = payload.type === 'link' ? '🔗' : '📎'
        const catPart = payload.category && payload.category !== 'Général' ? ` · ${payload.category}` : ''
        const text    = `${emoji} **${payload.name}** a été ajouté aux documents${catPart}`
        for (const ch of projectChannels) {
          queries.sendMessage({
            channelId:  ch.id,
            authorName: payload.authorName,
            authorType: payload.authorType ?? 'teacher',
            content:    text,
          })
        }
      } catch (e) {
        console.warn('[addProjectDocument] Notification canal échouée :', e.message)
      }
    }

    res.json({ ok: true, data: result })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

module.exports = router
