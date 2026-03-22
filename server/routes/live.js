/** Routes Live Quiz - sessions interactives en direct */
const router  = require('express').Router()
const queries = require('../db/index')

function wrap(fn) {
  return (req, res) => {
    try { res.json({ ok: true, data: fn(req) }) }
    catch (err) { res.status(400).json({ ok: false, error: err.message }) }
  }
}

// ─── Throttle helper pour results-update ─────────────────────────────────────
const _lastEmit = new Map() // activityId → timestamp
function throttledResultsEmit(io, activityId, promoId) {
  const now = Date.now()
  const last = _lastEmit.get(activityId) || 0
  if (now - last < 500) return
  _lastEmit.set(activityId, now)
  const data = queries.getActivityResultsAggregated(activityId)
  io.to(`live:${promoId}`).emit('live:results-update', { activityId, data })
}

// ─── Sessions ────────────────────────────────────────────────────────────────

// POST /sessions - créer une session
router.post('/sessions', wrap((req) => {
  const { promoId, title } = req.body
  const teacherId = req.user?.id
  if (!teacherId || !promoId || !title) throw new Error('promoId et title requis (teacherId extrait du token)')
  return queries.createSession({ teacherId, promoId, title })
}))

// GET /sessions/:id - récupérer une session + activités
router.get('/sessions/:id', wrap((req) => {
  const session = queries.getSession(Number(req.params.id))
  if (!session) throw new Error('Session introuvable')
  return session
}))

// GET /sessions/code/:code - lookup par code
router.get('/sessions/code/:code', wrap((req) => {
  const session = queries.getSessionByCode(req.params.code)
  if (!session) throw new Error('Session introuvable')
  return session
}))

// GET /sessions/promo/:promoId/active - session active pour une promo
router.get('/sessions/promo/:promoId/active', wrap((req) => {
  return queries.getActiveSessionForPromo(Number(req.params.promoId))
}))

// PATCH /sessions/:id/status - mettre à jour le statut
router.patch('/sessions/:id/status', (req, res) => {
  try {
    const { status } = req.body
    if (!['waiting', 'active', 'ended'].includes(status)) {
      return res.status(400).json({ ok: false, error: 'Statut invalide' })
    }
    const session = queries.updateSessionStatus(Number(req.params.id), status)
    const io = req.app.get('io')
    if (status === 'active') {
      io.to(`live:${session.promo_id}`).emit('live:session-started', { sessionId: session.id })
      // Envoyer une invitation aux étudiants de la promo
      io.to(`live:${session.promo_id}`).emit('live:invite', {
        sessionId: session.id,
        title: session.title,
        joinCode: session.join_code,
        teacherName: req.user?.name ?? 'Pilote',
      })
    } else if (status === 'ended') {
      io.to(`live:${session.promo_id}`).emit('live:session-ended', { sessionId: session.id })
    }
    res.json({ ok: true, data: session })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

// DELETE /sessions/:id
router.delete('/sessions/:id', wrap((req) => {
  queries.deleteSession(Number(req.params.id))
  return null
}))

// ─── Activities ──────────────────────────────────────────────────────────────

// POST /sessions/:id/activities - ajouter une activité
router.post('/sessions/:id/activities', wrap((req) => {
  const { type, title, options, multi, maxWords, position } = req.body
  if (!type || !title) throw new Error('type et title requis')
  return queries.addActivity({
    sessionId: Number(req.params.id), type, title, options, multi, maxWords, position,
  })
}))

// PATCH /activities/:id - modifier une activité
router.patch('/activities/:id', wrap((req) => {
  return queries.updateActivity(Number(req.params.id), req.body)
}))

// DELETE /activities/:id
router.delete('/activities/:id', wrap((req) => {
  queries.deleteActivity(Number(req.params.id))
  return null
}))

// PATCH /activities/:id/status - push/close une activité
router.patch('/activities/:id/status', (req, res) => {
  try {
    const { status } = req.body
    if (!['pending', 'live', 'closed'].includes(status)) {
      return res.status(400).json({ ok: false, error: 'Statut invalide' })
    }
    const activity = queries.setActivityStatus(Number(req.params.id), status)
    const io = req.app.get('io')

    // Retrouver la session pour le promoId
    const session = queries.getSession(activity.session_id)
    if (session) {
      if (status === 'live') {
        io.to(`live:${session.promo_id}`).emit('live:activity-pushed', { activity })
      } else if (status === 'closed') {
        io.to(`live:${session.promo_id}`).emit('live:activity-closed', { activityId: activity.id })
      }
    }
    res.json({ ok: true, data: activity })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

// ─── Responses ───────────────────────────────────────────────────────────────

// POST /activities/:id/respond - soumettre une réponse
router.post('/activities/:id/respond', (req, res) => {
  try {
    const { studentId, answer } = req.body
    if (!studentId || answer === undefined) throw new Error('studentId et answer requis')
    const response = queries.submitResponse({
      activityId: Number(req.params.id), studentId, answer: String(answer),
    })
    const io = req.app.get('io')

    // Retrouver la session pour le promoId
    const activity = require('../db/connection').getDb()
      .prepare('SELECT session_id FROM live_activities WHERE id = ?')
      .get(Number(req.params.id))
    if (activity) {
      const session = queries.getSession(activity.session_id)
      if (session) {
        throttledResultsEmit(io, Number(req.params.id), session.promo_id)
      }
    }
    res.json({ ok: true, data: response })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

// GET /activities/:id/results - résultats agrégés
router.get('/activities/:id/results', wrap((req) => {
  return queries.getActivityResultsAggregated(Number(req.params.id))
}))

module.exports = router
