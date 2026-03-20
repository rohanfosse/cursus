// ─── Routes messages ─────────────────────────────────────────────────────────
const router  = require('express').Router()
const queries = require('../../src/db/index')

function wrap(fn) {
  return (req, res) => {
    try { res.json({ ok: true, data: fn(req) }) }
    catch (err) { res.status(400).json({ ok: false, error: err.message }) }
  }
}

// ── Lecture ───────────────────────────────────────────────────────────────────
router.get('/channel/:channelId',       wrap((req) => queries.getChannelMessages(Number(req.params.channelId))))
router.get('/dm/:studentId',            wrap((req) => queries.getDmMessages(Number(req.params.studentId))))
router.get('/channel/:channelId/page',  wrap((req) => {
  const before = req.query.before ? Number(req.query.before) : null
  return queries.getChannelMessagesPage(Number(req.params.channelId), before)
}))
router.get('/dm/:studentId/page', wrap((req) => {
  const before = req.query.before ? Number(req.query.before) : null
  return queries.getDmMessagesPage(Number(req.params.studentId), before)
}))
router.get('/search', wrap((req) => queries.searchMessages(Number(req.query.channelId), req.query.q)))
router.post('/search-all', wrap((req) => {
  const { promoId, query, limit } = req.body
  return queries.searchAllMessages(promoId ?? null, query, limit ?? 8)
}))
router.get('/pinned/:channelId', wrap((req) => queries.getPinnedMessages(Number(req.params.channelId))))
router.get('/dm-contacts/:studentId', wrap((req) => queries.getRecentDmContacts(Number(req.params.studentId), Number(req.query.limit) || 15)))

// ── Écriture ──────────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const payload = req.body

    // ── Sécurité : forcer l'identité depuis le JWT (anti-usurpation) ────────
    payload.authorName = req.user.name
    payload.authorType = req.user.type === 'ta' ? 'teacher' : req.user.type

    // ── Sécurité : bloquer les étudiants sur les canaux d'annonce ───────────
    if (payload.channelId && req.user.type === 'student') {
      const { getDb } = require('../../src/db/connection')
      const ch = getDb().prepare('SELECT type FROM channels WHERE id = ?').get(payload.channelId)
      if (ch?.type === 'annonce') {
        return res.status(403).json({ ok: false, error: 'Les étudiants ne peuvent pas poster dans les canaux d\'annonce.' })
      }
    }

    const result  = queries.sendMessage(payload)

    // ── Parsing des mentions ─────────────────────────────────────────────────
    const rawContent      = payload.content ?? ''
    const mentionEveryone = /@everyone\b/i.test(rawContent)
    const mentionNames    = []
    const re = /@([\w][\w.\-]*)/g
    let m
    while ((m = re.exec(rawContent)) !== null) {
      const name = m[1].toLowerCase()
      if (name !== 'everyone') mentionNames.push(m[1])
    }

    const push = {
      channelId:       payload.channelId   ?? null,
      dmStudentId:     payload.dmStudentId ?? null,
      authorName:      req.user.name       ?? null,
      channelName:     payload.channelName ?? null,
      promoId:         payload.promoId     ?? null,
      preview:         rawContent.replace(/[*_`>#[\]!]/g, '').slice(0, 80),
      mentionEveryone,
      mentionNames,
    }
    // Broadcast via Socket.io
    req.app.get('io')?.emit('msg:new', push)

    res.json({ ok: true, data: result })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

router.post('/pin',       wrap((req) => queries.togglePinMessage(req.body.messageId, req.body.pinned)))
router.post('/reactions', wrap((req) => queries.updateReactions(req.body.msgId, req.body.reactionsJson)))
router.delete('/:id',     wrap((req) => queries.deleteMessage(Number(req.params.id))))
router.patch('/:id',      wrap((req) => queries.editMessage(Number(req.params.id), req.body.content)))

// ── Signalement de message ──────────────────────────────────────────────────
router.post('/:id/report', wrap((req) => {
  const messageId = Number(req.params.id)
  const { reason, details } = req.body
  return queries.createReport({
    messageId,
    reporterId: Math.abs(req.user.id),
    reporterName: req.user.name,
    reporterType: req.user.type,
    reason: reason || 'other',
    details: details || null,
  })
}))

module.exports = router
