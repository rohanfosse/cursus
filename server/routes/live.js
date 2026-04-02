/** Routes Live Quiz - sessions interactives en direct */
const router  = require('express').Router()
const queries = require('../db/index')
const wrap    = require('../utils/wrap')
const { requireRole, requirePromo, promoFromParam } = require('../middleware/authorize')

/** Lookup : live session id → promo_id */
function promoFromSession(req) {
  const { getDb } = require('../db/connection')
  const sessionId = Number(req.params.id ?? req.params.sessionId)
  if (!sessionId) return null
  const s = getDb().prepare('SELECT promo_id FROM live_sessions WHERE id = ?').get(sessionId)
  return s?.promo_id ?? null
}

/** Lookup : live activity id → promo_id (via session) */
function promoFromActivity(req) {
  const { getDb } = require('../db/connection')
  const activityId = Number(req.params.id)
  if (!activityId) return null
  const a = getDb().prepare('SELECT ls.promo_id FROM live_activities la JOIN live_sessions ls ON ls.id = la.session_id WHERE la.id = ?').get(activityId)
  return a?.promo_id ?? null
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

// ─── Throttle helper pour scores-update ──────────────────────────────────────
const _lastScoresEmit = new Map() // sessionId → timestamp
function throttledScoresEmit(io, sessionId, activityId, promoId) {
  const now = Date.now()
  const last = _lastScoresEmit.get(sessionId) || 0
  if (now - last < 500) return
  _lastScoresEmit.set(sessionId, now)
  const leaderboard = queries.getLeaderboardWithRound(sessionId, activityId)
  io.to(`live:${promoId}`).emit('live:scores-update', { sessionId, activityId, leaderboard })
}

// ─── Nettoyage périodique des maps de throttle (évite memory leak) ───────────
setInterval(() => {
  const cutoff = Date.now() - 5 * 60_000 // 5 min
  for (const [k, ts] of _lastEmit) { if (ts < cutoff) _lastEmit.delete(k) }
  for (const [k, ts] of _lastScoresEmit) { if (ts < cutoff) _lastScoresEmit.delete(k) }
}, 60_000)

// ─── Sessions ────────────────────────────────────────────────────────────────

// POST /sessions - créer une session (prof uniquement)
router.post('/sessions', requireRole('teacher'), wrap((req) => {
  const { promoId, title } = req.body
  const teacherId = req.user?.id
  if (!teacherId || !promoId || !title) throw new Error('promoId et title requis (teacherId extrait du token)')
  return queries.createSession({ teacherId, promoId, title })
}))

// GET /sessions/:id - récupérer une session + activités
router.get('/sessions/:id', requirePromo(promoFromSession), wrap((req) => {
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
router.get('/sessions/promo/:promoId/active', requirePromo(promoFromParam), wrap((req) => {
  return queries.getActiveSessionForPromo(Number(req.params.promoId))
}))

// GET /sessions/promo/:promoId/history - historique sessions terminées
router.get('/sessions/promo/:promoId/history', requirePromo(promoFromParam), wrap((req) => {
  const { search, dateFrom, dateTo } = req.query
  return queries.getEndedSessionsForPromo(Number(req.params.promoId), { search, dateFrom, dateTo })
}))

// GET /sessions/promo/:promoId/stats - statistiques quiz par promo
router.get('/sessions/promo/:promoId/stats', requirePromo(promoFromParam), wrap((req) => {
  return queries.getLiveStatsForPromo(Number(req.params.promoId))
}))

// GET /sessions/promo/:promoId - toutes les sessions non terminées (brouillons + actives)
router.get('/sessions/promo/:promoId', requirePromo(promoFromParam), wrap((req) => {
  return queries.getSessionsForPromo(Number(req.params.promoId))
}))

// POST /sessions/:id/clone - dupliquer une session (prof uniquement)
router.post('/sessions/:id/clone', requireRole('teacher'), wrap((req) => {
  const teacherId = req.user?.id
  const { promoId, title } = req.body
  if (!teacherId || !promoId) throw new Error('promoId requis')
  return queries.cloneSession(Number(req.params.id), { teacherId, promoId, title })
}))

// PATCH /sessions/:id/activities/reorder (prof uniquement)
router.patch('/sessions/:id/activities/reorder', requireRole('teacher'), wrap((req) => {
  const { order } = req.body
  if (!Array.isArray(order)) throw new Error('order (tableau d\'IDs) requis')
  queries.reorderActivities(Number(req.params.id), order)
  return queries.getSession(Number(req.params.id))
}))

// PATCH /sessions/:id/status (prof uniquement)
router.patch('/sessions/:id/status', requireRole('teacher'), (req, res) => {
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
        teacherName: req.user?.name ?? 'Responsable',
      })
    } else if (status === 'ended') {
      io.to(`live:${session.promo_id}`).emit('live:session-ended', { sessionId: session.id })
      _lastScoresEmit.delete(session.id)
    }
    res.json({ ok: true, data: session })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

// DELETE /sessions/:id (prof uniquement)
router.delete('/sessions/:id', requireRole('teacher'), wrap((req) => {
  const id = Number(req.params.id)
  _lastScoresEmit.delete(id)
  queries.deleteSession(id)
  return null
}))

// ─── Activities ──────────────────────────────────────────────────────────────

// POST /sessions/:id/activities (prof uniquement)
router.post('/sessions/:id/activities', requireRole('teacher'), wrap((req) => {
  const { type, title, options, multi, maxWords, position, timer_seconds, correct_answers } = req.body
  if (!type || !title) throw new Error('type et title requis')
  return queries.addActivity({
    sessionId: Number(req.params.id), type, title, options, multi, maxWords, position,
    timerSeconds: timer_seconds ?? 30,
    correctAnswers: correct_answers ? JSON.stringify(correct_answers) : null,
  })
}))

// PATCH /activities/:id (prof uniquement)
router.patch('/activities/:id', requireRole('teacher'), wrap((req) => {
  return queries.updateActivity(Number(req.params.id), req.body)
}))

// DELETE /activities/:id (prof uniquement)
router.delete('/activities/:id', requireRole('teacher'), wrap((req) => {
  const id = Number(req.params.id)
  _lastEmit.delete(id)
  queries.deleteActivity(id)
  return null
}))

// PATCH /activities/:id/status (prof uniquement)
router.patch('/activities/:id/status', requireRole('teacher'), (req, res) => {
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
        io.to(`live:${session.promo_id}`).emit('live:activity-pushed', {
          activity: {
            ...activity,
            timer_seconds: activity.timer_seconds ?? 30,
            started_at: activity.started_at,
          },
        })
      } else if (status === 'closed') {
        // Emit final leaderboard along with close event
        const leaderboard = queries.getLeaderboardWithRound(session.id, activity.id)
        io.to(`live:${session.promo_id}`).emit('live:activity-closed', {
          activityId: activity.id,
          leaderboard,
        })
      }
    }
    res.json({ ok: true, data: activity })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

// ─── Responses ───────────────────────────────────────────────────────────────

// POST /activities/:id/respond - soumettre une réponse
router.post('/activities/:id/respond', requirePromo(promoFromActivity), (req, res) => {
  try {
    // Sécurité : forcer l'identité depuis le JWT (anti-usurpation)
    const studentId = req.user?.id
    const studentName = req.user?.name ?? ''
    // Support multiple answer formats: { answer } or { answers } or { text } or { words }
    let answer = req.body.answer
    if (answer === undefined && req.body.answers) answer = req.body.answers.join(',')
    if (answer === undefined && req.body.text) answer = req.body.text
    if (answer === undefined && req.body.words) answer = req.body.words.join(',')
    if (!studentId || answer === undefined) throw new Error('studentId et answer requis')
    const activityId = Number(req.params.id)
    const response = queries.submitResponse({
      activityId, studentId, answer: String(answer),
    })
    const io = req.app.get('io')

    // Retrouver l'activité complète pour le scoring
    const db = require('../db/connection').getDb()
    const activityRow = db.prepare('SELECT * FROM live_activities WHERE id = ?').get(activityId)

    let scoreResult = { isCorrect: null, points: 0, rank: null }

    if (activityRow) {
      const session = queries.getSession(activityRow.session_id)

      // Calculate correctness and score for QCM with correct_answers
      const isCorrect = queries.checkCorrectness(activityId, answer)
      if (isCorrect !== null) {
        // Compute answer time (ms since activity started)
        let answerTimeMs = 0
        if (activityRow.started_at) {
          answerTimeMs = Math.max(0, Date.now() - new Date(activityRow.started_at + 'Z').getTime())
        }
        const name = studentName || `Etudiant ${studentId}`
        const points = queries.calculateScore(activityId, studentId, name, answerTimeMs, isCorrect)
        const rank = queries.getStudentRank(activityRow.session_id, studentId)
        scoreResult = { isCorrect, points, rank }
      }

      if (session) {
        throttledResultsEmit(io, activityId, session.promo_id)
        // Emit scores update if scoring is active
        if (isCorrect !== null) {
          throttledScoresEmit(io, session.id, activityId, session.promo_id)
        }
      }
    }
    res.json({ ok: true, data: { ...response, ...scoreResult } })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

// GET /activities/:id/results - résultats agrégés
router.get('/activities/:id/results', requirePromo(promoFromActivity), wrap((req) => {
  return queries.getActivityResultsAggregated(Number(req.params.id))
}))

// GET /sessions/:id/leaderboard - classement complet
router.get('/sessions/:id/leaderboard', requirePromo(promoFromSession), wrap((req) => {
  return queries.getLeaderboard(Number(req.params.id))
}))

module.exports = router
