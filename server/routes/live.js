/** Routes Live Quiz - sessions interactives en direct */
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap    = require('../utils/wrap')
const { getDb } = require('../db/connection')
const { requireRole, requirePromo, promoFromParam, requireSessionOwner, requireActivityOwner } = require('../middleware/authorize')

// ── Schémas Zod ────────────────────────────────────────────────────────────────
const createSessionSchema = z.object({
  promoId: z.number().int().positive('promoId requis'),
  title:   z.string().min(1, 'Titre requis').max(200),
}).passthrough()

const cloneSessionSchema = z.object({
  promoId: z.number().int().positive('promoId requis'),
  title:   z.string().max(200).optional(),
}).passthrough()

const addActivitySchema = z.object({
  type:            z.string().min(1, 'Type requis'),
  title:           z.string().min(1, 'Titre requis').max(500),
  options:         z.any().optional(),
  multi:           z.union([z.boolean(), z.number()]).optional(),
  maxWords:        z.number().int().optional(),
  position:        z.number().int().optional(),
  timer_seconds:   z.number().int().min(1).optional(),
  correct_answers: z.any().optional(),
}).passthrough()

const updateActivitySchema = z.object({}).passthrough()

const sessionStatusSchema = z.object({
  status: z.enum(['waiting', 'active', 'ended'], { message: 'Statut invalide' }),
}).passthrough()

const activityStatusSchema = z.object({
  status: z.enum(['pending', 'live', 'closed'], { message: 'Statut invalide' }),
}).passthrough()

const respondSchema = z.object({
  answer:  z.any().optional(),
  answers: z.array(z.any()).optional(),
  text:    z.string().optional(),
  words:   z.array(z.string()).optional(),
}).passthrough()

const reorderSchema = z.object({
  order: z.array(z.number().int()),
}).passthrough()

/** Lookup : live session id → promo_id */
function promoFromSession(req) {
  const sessionId = Number(req.params.id ?? req.params.sessionId)
  if (!sessionId) return null
  const s = getDb().prepare('SELECT promo_id FROM live_sessions WHERE id = ?').get(sessionId)
  return s?.promo_id ?? null
}

/** Lookup : live activity id → promo_id (via session) */
function promoFromActivity(req) {
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
router.post('/sessions', requireRole('teacher'), validate(createSessionSchema), wrap((req) => {
  const { promoId, title } = req.body
  const teacherId = req.user?.id
  if (!teacherId) throw new Error('teacherId extrait du token requis')
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
router.post('/sessions/:id/clone', requireRole('teacher'), validate(cloneSessionSchema), wrap((req) => {
  const teacherId = req.user?.id
  const { promoId, title } = req.body
  if (!teacherId) throw new Error('teacherId requis')
  return queries.cloneSession(Number(req.params.id), { teacherId, promoId, title })
}))

// PATCH /sessions/:id/activities/reorder (prof uniquement — propre session ou admin)
router.patch('/sessions/:id/activities/reorder', requireRole('teacher'), requireSessionOwner('live_sessions'), validate(reorderSchema), wrap((req) => {
  queries.reorderActivities(Number(req.params.id), req.body.order)
  return queries.getSession(Number(req.params.id))
}))

// PATCH /sessions/:id/status (prof uniquement — propre session ou admin)
router.patch('/sessions/:id/status', requireRole('teacher'), requireSessionOwner('live_sessions'), validate(sessionStatusSchema), (req, res) => {
  try {
    const { status } = req.body
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

// DELETE /sessions/:id (prof uniquement — propre session ou admin)
router.delete('/sessions/:id', requireRole('teacher'), requireSessionOwner('live_sessions'), wrap((req) => {
  const id = Number(req.params.id)
  _lastScoresEmit.delete(id)
  queries.deleteSession(id)
  return null
}))

// ─── Activities ──────────────────────────────────────────────────────────────

// POST /sessions/:id/activities (prof uniquement — propre session ou admin)
router.post('/sessions/:id/activities', requireRole('teacher'), requireSessionOwner('live_sessions'), validate(addActivitySchema), wrap((req) => {
  const { type, title, options, multi, maxWords, position, timer_seconds, correct_answers } = req.body
  return queries.addActivity({
    sessionId: Number(req.params.id), type, title, options, multi, maxWords, position,
    timerSeconds: timer_seconds ?? 30,
    correctAnswers: correct_answers ? JSON.stringify(correct_answers) : null,
  })
}))

// PATCH /activities/:id (prof uniquement — propre activité ou admin)
router.patch('/activities/:id', requireRole('teacher'), requireActivityOwner('live_activities', 'live_sessions'), validate(updateActivitySchema), wrap((req) => {
  return queries.updateActivity(Number(req.params.id), req.body)
}))

// DELETE /activities/:id (prof uniquement — propre activité ou admin)
router.delete('/activities/:id', requireRole('teacher'), requireActivityOwner('live_activities', 'live_sessions'), wrap((req) => {
  const id = Number(req.params.id)
  _lastEmit.delete(id)
  queries.deleteActivity(id)
  return null
}))

// PATCH /activities/:id/status (prof uniquement — propre activité ou admin)
router.patch('/activities/:id/status', requireRole('teacher'), requireActivityOwner('live_activities', 'live_sessions'), validate(activityStatusSchema), (req, res) => {
  try {
    const { status } = req.body
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
router.post('/activities/:id/respond', requirePromo(promoFromActivity), validate(respondSchema), (req, res) => {
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

    let scoreResult = { isCorrect: null, points: 0, rank: null, streak: 0 }

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
        const { points, streak } = queries.calculateScore(activityId, studentId, name, answerTimeMs, isCorrect)
        const rank = queries.getStudentRank(activityRow.session_id, studentId)
        scoreResult = { isCorrect, points, rank, streak }
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

// GET /sessions/:id/export-csv - exporter les résultats d'une session en CSV (prof uniquement)
router.get('/sessions/:id/export-csv', requireRole('teacher'), requireSessionOwner('live_sessions'), (req, res) => {
  try {
    const sessionId = Number(req.params.id)
    const csv = queries.exportSessionCsv(sessionId)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="spark-session-${sessionId}.csv"`)
    res.send('\uFEFF' + csv) // BOM for Excel UTF-8 compat
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

// GET /sessions/:id/leaderboard - classement complet
router.get('/sessions/:id/leaderboard', requirePromo(promoFromSession), wrap((req) => {
  return queries.getLeaderboard(Number(req.params.id))
}))

module.exports = router
