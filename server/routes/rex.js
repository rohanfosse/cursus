/** Routes API REX — sessions, activites, reponses anonymes, export. */
const router  = require('express').Router()
const queries = require('../db/index')
const wrap    = require('../utils/wrap')
const { requireRole, requirePromo, promoFromParam, requireSessionOwner } = require('../middleware/authorize')
const { getDb } = require('../db/connection')

/** Lookup : rex session id → promo_id */
function promoFromRexSession(req) {
  const id = Number(req.params.id)
  if (!id) return null
  const s = getDb().prepare('SELECT promo_id FROM rex_sessions WHERE id = ?').get(id)
  return s?.promo_id ?? null
}

/** Lookup : rex activity id → promo_id (via session) */
function promoFromRexActivity(req) {
  const id = Number(req.params.id)
  if (!id) return null
  const a = getDb().prepare('SELECT rs.promo_id FROM rex_activities ra JOIN rex_sessions rs ON rs.id = ra.session_id WHERE ra.id = ?').get(id)
  return a?.promo_id ?? null
}

// ─── Throttle helper pour results-update ─────────────────────────────────────
const _lastEmit = new Map() // activityId → timestamp
function throttledResultsEmit(io, activityId, promoId) {
  const now = Date.now()
  const last = _lastEmit.get(activityId) || 0
  if (now - last < 500) return
  _lastEmit.set(activityId, now)
  const data = queries.getRexActivityResultsAggregated(activityId)
  io.to(`rex:${promoId}`).emit('rex:results-update', { activityId, data })
}

// ─── Nettoyage périodique de la map de throttle ─────────────────────────────
setInterval(() => {
  const cutoff = Date.now() - 5 * 60_000
  for (const [k, ts] of _lastEmit) { if (ts < cutoff) _lastEmit.delete(k) }
}, 60_000)

// ─── Sessions ────────────────────────────────────────────────────────────────

// POST /sessions - creer une session REX
router.post('/sessions', requireRole('teacher'), wrap((req) => {
  const { promoId, title, is_async, open_until } = req.body
  const teacherId = req.user?.id
  if (!teacherId || !promoId || !title) throw new Error('promoId et title requis (teacherId extrait du token)')
  return queries.createRexSession({ teacherId, promoId, title, isAsync: is_async, openUntil: open_until })
}))

// GET /sessions/:id - recuperer une session + activites
router.get('/sessions/:id', requirePromo(promoFromRexSession), wrap((req) => {
  const session = queries.getRexSession(Number(req.params.id))
  if (!session) throw new Error('Session introuvable')
  return session
}))

// GET /sessions/code/:code - lookup par code
router.get('/sessions/code/:code', wrap((req) => {
  const session = queries.getRexSessionByCode(req.params.code)
  if (!session) throw new Error('Session introuvable')
  return session
}))

// GET /sessions/promo/:promoId/active - session active pour une promo
router.get('/sessions/promo/:promoId/active', requirePromo(promoFromParam), wrap((req) => {
  return queries.getActiveRexSession(Number(req.params.promoId))
}))

// GET /sessions/promo/:promoId/history - historique sessions terminées
router.get('/sessions/promo/:promoId/history', requirePromo(promoFromParam), wrap((req) => {
  const { search, dateFrom, dateTo } = req.query
  return queries.getEndedRexSessionsForPromo(Number(req.params.promoId), { search, dateFrom, dateTo })
}))

// GET /sessions/promo/:promoId/stats - statistiques REX par promo
router.get('/sessions/promo/:promoId/stats', requirePromo(promoFromParam), wrap((req) => {
  return queries.getRexStatsForPromo(Number(req.params.promoId))
}))

// GET /sessions/promo/:promoId - toutes les sessions non terminées (brouillons + actives)
router.get('/sessions/promo/:promoId', requirePromo(promoFromParam), wrap((req) => {
  return queries.getRexSessionsForPromo(Number(req.params.promoId))
}))

// POST /sessions/:id/clone - dupliquer une session REX
router.post('/sessions/:id/clone', requireRole('teacher'), wrap((req) => {
  const teacherId = req.user?.id
  const { promoId, title } = req.body
  if (!teacherId || !promoId) throw new Error('promoId requis')
  return queries.cloneRexSession(Number(req.params.id), { teacherId, promoId, title })
}))

// PATCH /sessions/:id/activities/reorder - réordonner les activités
router.patch('/sessions/:id/activities/reorder', requireRole('teacher'), wrap((req) => {
  const { order } = req.body
  if (!Array.isArray(order)) throw new Error('order (tableau d\'IDs) requis')
  queries.reorderRexActivities(Number(req.params.id), order)
  return queries.getRexSession(Number(req.params.id))
}))

// PATCH /sessions/:id/status - demarrer/terminer
router.patch('/sessions/:id/status', requireRole('teacher'), (req, res) => {
  try {
    const { status } = req.body
    if (!['waiting', 'active', 'ended'].includes(status)) {
      return res.status(400).json({ ok: false, error: 'Statut invalide' })
    }
    const session = queries.updateRexSessionStatus(Number(req.params.id), status)
    const io = req.app.get('io')
    if (status === 'active') {
      io.to(`rex:${session.promo_id}`).emit('rex:session-started', { sessionId: session.id })
    } else if (status === 'ended') {
      io.to(`rex:${session.promo_id}`).emit('rex:session-ended', { sessionId: session.id })
    }
    res.json({ ok: true, data: session })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

// DELETE /sessions/:id (propre session ou admin)
router.delete('/sessions/:id', requireRole('teacher'), requireSessionOwner('rex_sessions'), wrap((req) => {
  queries.deleteRexSession(Number(req.params.id))
  return null
}))


// ─── Activities ──────────────────────────────────────────────────────────────

// POST /sessions/:id/activities - ajouter une activite
router.post('/sessions/:id/activities', requireRole('teacher'), wrap((req) => {
  const { type, title, maxWords, maxRating, position } = req.body
  if (!type || !title) throw new Error('type et title requis')
  return queries.addRexActivity({
    sessionId: Number(req.params.id), type, title, maxWords, maxRating, position,
  })
}))

// PATCH /activities/:id - modifier une activité REX
router.patch('/activities/:id', requireRole('teacher'), wrap((req) => {
  return queries.updateRexActivity(Number(req.params.id), req.body)
}))

// DELETE /activities/:id
router.delete('/activities/:id', requireRole('teacher'), wrap((req) => {
  const id = Number(req.params.id)
  _lastEmit.delete(id)
  queries.deleteRexActivity(id)
  return null
}))

// PATCH /activities/:id/status - lancer/fermer une activite
router.patch('/activities/:id/status', requireRole('teacher'), (req, res) => {
  try {
    const { status } = req.body
    if (!['pending', 'live', 'closed'].includes(status)) {
      return res.status(400).json({ ok: false, error: 'Statut invalide' })
    }
    const activity = queries.setRexActivityStatus(Number(req.params.id), status)
    const io = req.app.get('io')

    // Retrouver la session pour le promoId
    const session = queries.getRexSession(activity.session_id)
    if (session) {
      if (status === 'live') {
        io.to(`rex:${session.promo_id}`).emit('rex:activity-pushed', { activity })
      } else if (status === 'closed') {
        io.to(`rex:${session.promo_id}`).emit('rex:activity-closed', { activityId: activity.id })
      }
    }
    res.json({ ok: true, data: activity })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

// ─── Responses ───────────────────────────────────────────────────────────────

// POST /activities/:id/respond - soumettre une reponse anonyme
router.post('/activities/:id/respond', requirePromo(promoFromRexActivity), (req, res) => {
  try {
    // Sécurité : forcer l'identité depuis le JWT (anti-usurpation)
    const studentId = req.user?.id
    let answer = req.body.answer
    if (answer === undefined && req.body.words) answer = req.body.words.join(',')
    if (!studentId || answer === undefined) throw new Error('Identité et réponse requises')
    const activityId = Number(req.params.id)
    const response = queries.submitRexResponse({
      activityId, studentId, answer: String(answer),
    })
    const io = req.app.get('io')

    // Retrouver la session pour le promoId
    const db = require('../db/connection').getDb()
    const activityRow = db.prepare('SELECT session_id FROM rex_activities WHERE id = ?').get(activityId)
    if (activityRow) {
      const session = queries.getRexSession(activityRow.session_id)
      if (session) {
        throttledResultsEmit(io, activityId, session.promo_id)
      }
    }
    res.json({ ok: true, data: response })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

// GET /activities/:id/results - resultats agreges (anonymes)
router.get('/activities/:id/results', requirePromo(promoFromRexActivity), wrap((req) => {
  return queries.getRexActivityResultsAggregated(Number(req.params.id))
}))

// ─── Pin ─────────────────────────────────────────────────────────────────────

// POST /responses/:id/pin - toggle pin (teacher)
router.post('/responses/:id/pin', requireRole('teacher'), wrap((req) => {
  const { pinned } = req.body
  return queries.toggleRexPin(Number(req.params.id), pinned)
}))

// ─── Export ──────────────────────────────────────────────────────────────────

// GET /sessions/:id/export - export JSON ou CSV
router.get('/sessions/:id/export', requireRole('teacher'), requirePromo(promoFromRexSession), (req, res) => {
  try {
    const data = queries.exportRexSession(Number(req.params.id))
    if (!data) return res.status(404).json({ ok: false, error: 'Session introuvable' })

    const format = req.query.format || 'json'

    if (format === 'csv') {
      // Generer un CSV simple
      const lines = []
      lines.push('activite_id,type,titre,statut,reponse,count')
      for (const a of data.activities) {
        const r = a.results
        if (!r) continue
        if (r.type === 'question_ouverte' && r.responses) {
          for (const resp of r.responses) {
            lines.push(`${a.id},${a.type},"${a.title.replace(/"/g, '""')}",${a.status},"${resp.answer.replace(/"/g, '""')}",1`)
          }
        } else if (r.counts) {
          for (const c of r.counts) {
            lines.push(`${a.id},${a.type},"${a.title.replace(/"/g, '""')}",${a.status},"${String(c.answer).replace(/"/g, '""')}",${c.count}`)
          }
        }
      }
      res.set('Content-Type', 'text/csv; charset=utf-8')
      res.set('Content-Disposition', `attachment; filename="rex-${data.session.id}.csv"`)
      return res.send(lines.join('\n'))
    }

    res.json({ ok: true, data })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

module.exports = router
