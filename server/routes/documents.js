// ─── Routes documents ────────────────────────────────────────────────────────
const router  = require('express').Router()
const queries = require('../db/index')

function wrap(fn) {
  return (req, res) => {
    try { res.json({ ok: true, data: fn(req) }) }
    catch (err) { res.status(400).json({ ok: false, error: err.message }) }
  }
}

// ── Documents de canal ────────────────────────────────────────────────────────
router.get('/channel/:channelId',             wrap((req) => queries.getChannelDocuments(Number(req.params.channelId))))
router.get('/channel/:channelId/categories',  wrap((req) => queries.getChannelDocumentCategories(Number(req.params.channelId))))
router.get('/promo/:promoId',                 wrap((req) => queries.getPromoDocuments(Number(req.params.promoId))))
router.post('/channel',                       wrap((req) => queries.addChannelDocument(req.body)))
router.delete('/channel/:id',                 wrap((req) => queries.deleteChannelDocument(Number(req.params.id))))

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
