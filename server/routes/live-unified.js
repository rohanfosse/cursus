/**
 * Routes Live unifiees (Spark + Pulse + Code + Board).
 * Remplace /api/live et /api/rex par /api/live-v2.
 */
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap    = require('../utils/wrap')
const { getDb } = require('../db/connection')
const { requireRole, requirePromo, promoFromParam } = require('../middleware/authorize')

// ── Schemas ────────────────────────────────────────────────────────────────
const createSessionSchema = z.object({
  promoId: z.number().int().positive(),
  title:   z.string().min(1).max(200),
  isAsync: z.boolean().optional(),
  openUntil: z.string().nullable().optional(),
})

const cloneSessionSchema = z.object({
  promoId: z.number().int().positive(),
  title:   z.string().max(200).optional(),
})

const addActivitySchema = z.object({
  type:            z.string().min(1),
  title:           z.string().min(1).max(500),
  options:         z.any().optional(),
  multi:           z.union([z.boolean(), z.number()]).optional(),
  maxWords:        z.number().int().optional(),
  maxRating:       z.number().int().optional(),
  position:        z.number().int().optional(),
  timer_seconds:   z.number().int().min(1).optional(),
  correct_answers: z.any().optional(),
  language:        z.string().optional(),
})

const sessionStatusSchema = z.object({ status: z.enum(['waiting', 'active', 'ended']) })
const activityStatusSchema = z.object({ status: z.enum(['pending', 'live', 'closed']) })
const respondSchema = z.object({
  answer:  z.any().optional(),
  answers: z.array(z.any()).optional(),
  text:    z.string().optional(),
  words:   z.array(z.string()).optional(),
  mode:    z.enum(['live', 'replay']).optional(),
})
const reorderSchema = z.object({ order: z.array(z.number().int()) })
const boardCardSchema = z.object({
  columnName: z.string().optional(),
  content: z.string().min(1).max(500),
  color: z.string().optional(),
})

// ── Helpers pour authorize ─────────────────────────────────────────────────
function promoFromSessionV2(req) {
  const sessionId = Number(req.params.id ?? req.params.sessionId)
  if (!sessionId) return null
  const s = getDb().prepare('SELECT promo_id FROM live_sessions_v2 WHERE id = ?').get(sessionId)
  return s?.promo_id ?? null
}
function promoFromActivityV2(req) {
  const activityId = Number(req.params.id)
  if (!activityId) return null
  const a = getDb().prepare('SELECT ls.promo_id FROM live_activities_v2 la JOIN live_sessions_v2 ls ON ls.id = la.session_id WHERE la.id = ?').get(activityId)
  return a?.promo_id ?? null
}
function requireSessionOwnerV2(req, res, next) {
  const sessionId = Number(req.params.id ?? req.params.sessionId)
  if (!sessionId || !req.user?.id) return res.status(403).json({ ok: false, error: 'Acces refuse' })
  const s = getDb().prepare('SELECT teacher_id FROM live_sessions_v2 WHERE id = ?').get(sessionId)
  if (!s || (s.teacher_id !== req.user.id && req.user.role !== 'admin')) {
    return res.status(403).json({ ok: false, error: 'Session non autorisee' })
  }
  next()
}
function requireActivityOwnerV2(req, res, next) {
  const activityId = Number(req.params.id)
  if (!activityId || !req.user?.id) return res.status(403).json({ ok: false, error: 'Acces refuse' })
  const a = getDb().prepare('SELECT ls.teacher_id FROM live_activities_v2 la JOIN live_sessions_v2 ls ON ls.id = la.session_id WHERE la.id = ?').get(activityId)
  if (!a || (a.teacher_id !== req.user.id && req.user.role !== 'admin')) {
    return res.status(403).json({ ok: false, error: 'Activite non autorisee' })
  }
  next()
}

// ── Throttles ─────────────────────────────────────────────────────────────
const _lastEmit = new Map()
const _lastScoresEmit = new Map()

function throttledResultsEmit(io, activityId, promoId) {
  const now = Date.now()
  if (now - (_lastEmit.get(activityId) || 0) < 500) return
  _lastEmit.set(activityId, now)
  const data = queries.getLiveActivityResultsAggregated(activityId)
  io.to(`live:${promoId}`).emit('live:results-update', { activityId, data })
}
function throttledScoresEmit(io, sessionId, activityId, promoId) {
  const now = Date.now()
  if (now - (_lastScoresEmit.get(sessionId) || 0) < 500) return
  _lastScoresEmit.set(sessionId, now)
  const leaderboard = queries.getLiveLeaderboardWithRound(sessionId, activityId)
  io.to(`live:${promoId}`).emit('live:scores-update', { sessionId, activityId, leaderboard })
}
setInterval(() => {
  const cutoff = Date.now() - 5 * 60_000
  for (const [k, ts] of _lastEmit) if (ts < cutoff) _lastEmit.delete(k)
  for (const [k, ts] of _lastScoresEmit) if (ts < cutoff) _lastScoresEmit.delete(k)
}, 60_000)

// ─── Sessions ──────────────────────────────────────────────────────────────

router.post('/sessions', requireRole('teacher'), validate(createSessionSchema), wrap((req) => {
  const { promoId, title, isAsync, openUntil } = req.body
  const teacherId = req.user?.id
  if (!teacherId) throw new Error('teacherId requis')
  return queries.createLiveSession({ teacherId, promoId, title, isAsync, openUntil })
}))

router.get('/sessions/:id', requirePromo(promoFromSessionV2), wrap((req) => {
  const session = queries.getLiveSession(Number(req.params.id))
  if (!session) throw new Error('Session introuvable')
  return session
}))

router.get('/sessions/code/:code', wrap((req) => {
  const session = queries.getLiveSessionByCode(req.params.code)
  if (!session) throw new Error('Session introuvable')
  // Strip correct_answers for non-teachers (prevent answer leaking)
  if (req.user?.role !== 'teacher' && req.user?.role !== 'admin' && session.activities) {
    session.activities = session.activities.map(a => ({ ...a, correct_answers: null }))
  }
  return session
}))

router.get('/sessions/promo/:promoId/active', requirePromo(promoFromParam), wrap((req) => {
  return queries.getActiveLiveSessionForPromo(Number(req.params.promoId))
}))

router.get('/sessions/promo/:promoId/history', requirePromo(promoFromParam), wrap((req) => {
  const { search, dateFrom, dateTo } = req.query
  return queries.getEndedLiveSessionsForPromo(Number(req.params.promoId), { search, dateFrom, dateTo })
}))

router.get('/sessions/promo/:promoId/stats', requirePromo(promoFromParam), wrap((req) => {
  return queries.getLiveStatsForPromoV2(Number(req.params.promoId))
}))

router.get('/sessions/promo/:promoId', requirePromo(promoFromParam), wrap((req) => {
  return queries.getLiveSessionsForPromo(Number(req.params.promoId))
}))

router.post('/sessions/:id/clone', requireRole('teacher'), validate(cloneSessionSchema), wrap((req) => {
  const teacherId = req.user?.id
  const { promoId, title } = req.body
  if (!teacherId) throw new Error('teacherId requis')
  return queries.cloneLiveSession(Number(req.params.id), { teacherId, promoId, title })
}))

router.patch('/sessions/:id/activities/reorder', requireRole('teacher'), requireSessionOwnerV2, validate(reorderSchema), wrap((req) => {
  queries.reorderLiveActivities(Number(req.params.id), req.body.order)
  return queries.getLiveSession(Number(req.params.id))
}))

router.patch('/sessions/:id/status', requireRole('teacher'), requireSessionOwnerV2, validate(sessionStatusSchema), (req, res) => {
  try {
    const { status } = req.body
    const session = queries.updateLiveSessionStatus(Number(req.params.id), status)
    const io = req.app.get('io')
    if (status === 'active') {
      io.to(`live:${session.promo_id}`).emit('live:session-started', { sessionId: session.id })
      io.to(`live:${session.promo_id}`).emit('live:invite', {
        sessionId: session.id, title: session.title,
        joinCode: session.join_code, teacherName: req.user?.name ?? 'Responsable',
      })
    } else if (status === 'ended') {
      io.to(`live:${session.promo_id}`).emit('live:session-ended', { sessionId: session.id })
      _lastScoresEmit.delete(session.id)
    }
    res.json({ ok: true, data: session })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

router.delete('/sessions/:id', requireRole('teacher'), requireSessionOwnerV2, wrap((req) => {
  const id = Number(req.params.id)
  _lastScoresEmit.delete(id)
  queries.deleteLiveSession(id)
  return null
}))

router.get('/sessions/:id/export-csv', requireRole('teacher'), requireSessionOwnerV2, (req, res) => {
  try {
    const sessionId = Number(req.params.id)
    const csv = queries.exportLiveSessionCsv(sessionId)
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="live-session-${sessionId}.csv"`)
    res.send('\uFEFF' + csv)
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

router.get('/sessions/:id/leaderboard', requirePromo(promoFromSessionV2), wrap((req) => {
  const mode = req.query?.mode === 'replay' ? 'replay' : 'live'
  return queries.getLiveLeaderboard(Number(req.params.id), mode)
}))

// ─── Activities ────────────────────────────────────────────────────────────

router.post('/sessions/:id/activities', requireRole('teacher'), requireSessionOwnerV2, validate(addActivitySchema), wrap((req) => {
  const { type, title, options, multi, maxWords, maxRating, position, timer_seconds, correct_answers, language } = req.body
  return queries.addLiveActivity({
    sessionId: Number(req.params.id), type, title,
    options: options ? (typeof options === 'string' ? options : JSON.stringify(options)) : null,
    multi, maxWords, maxRating, position,
    timerSeconds: timer_seconds ?? 30,
    correctAnswers: correct_answers ? (typeof correct_answers === 'string' ? correct_answers : JSON.stringify(correct_answers)) : null,
    language,
  })
}))

router.patch('/activities/:id', requireRole('teacher'), requireActivityOwnerV2, wrap((req) => {
  return queries.updateLiveActivity(Number(req.params.id), req.body)
}))

router.delete('/activities/:id', requireRole('teacher'), requireActivityOwnerV2, wrap((req) => {
  const id = Number(req.params.id)
  _lastEmit.delete(id)
  queries.deleteLiveActivity(id)
  return null
}))

router.patch('/activities/:id/status', requireRole('teacher'), requireActivityOwnerV2, validate(activityStatusSchema), (req, res) => {
  try {
    const { status } = req.body
    const activity = queries.setLiveActivityStatus(Number(req.params.id), status)
    const io = req.app.get('io')
    const session = queries.getLiveSession(activity.session_id)
    if (session) {
      if (status === 'live') {
        io.to(`live:${session.promo_id}`).emit('live:activity-pushed', {
          activity: { ...activity, timer_seconds: activity.timer_seconds ?? 30, started_at: activity.started_at },
        })
      } else if (status === 'closed') {
        // Snapshot code on close
        if (activity.category === 'code' && req.body.content !== undefined) {
          queries.saveLiveCodeSnapshot(activity.id, req.body.content)
        }
        // Leaderboard (only spark)
        const leaderboard = activity.category === 'spark'
          ? queries.getLiveLeaderboardWithRound(session.id, activity.id) : []
        io.to(`live:${session.promo_id}`).emit('live:activity-closed', {
          activityId: activity.id, leaderboard,
        })
      }
    }
    res.json({ ok: true, data: activity })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

// Save code snapshot explicitly
router.patch('/activities/:id/code-snapshot', requireRole('teacher'), requireActivityOwnerV2, wrap((req) => {
  queries.saveLiveCodeSnapshot(Number(req.params.id), req.body.content ?? null)
  return { ok: true }
}))

// ─── Responses ─────────────────────────────────────────────────────────────

router.post('/activities/:id/respond', requirePromo(promoFromActivityV2), validate(respondSchema), (req, res) => {
  try {
    const studentId = req.user?.id
    const studentName = req.user?.name ?? ''
    let answer = req.body.answer
    if (answer === undefined && req.body.answers) answer = req.body.answers.join(',')
    if (answer === undefined && req.body.text) answer = req.body.text
    if (answer === undefined && req.body.words) answer = req.body.words.join(',')
    if (!studentId || answer === undefined) throw new Error('studentId et answer requis')
    const activityId = Number(req.params.id)
    const db = getDb()
    const activityRow = db.prepare('SELECT * FROM live_activities_v2 WHERE id = ?').get(activityId)
    if (!activityRow) throw new Error('Activity not found')

    // Determine mode : client envoie ?mode=replay OU le body {mode:'replay'}. Accepte uniquement si session ended.
    const requestedMode = (req.query?.mode === 'replay' || req.body?.mode === 'replay') ? 'replay' : 'live'
    const session = queries.getLiveSession(activityRow.session_id)
    let mode = 'live'
    if (requestedMode === 'replay') {
      if (!session || session.status !== 'ended') {
        throw new Error('Mode replay reserve aux sessions terminees')
      }
      mode = 'replay'
    }
    // Mode live : pas de guard supplementaire (comportement inchange pour compat)

    const response = queries.submitLiveResponse({ activityId, studentId, answer: String(answer), mode })
    const io = req.app.get('io')
    let scoreResult = { isCorrect: null, points: 0, rank: null, streak: 0 }
    if (activityRow.category === 'spark') {
      const isCorrect = queries.checkLiveCorrectness(activityId, answer)
      if (isCorrect !== null) {
        let answerTimeMs = 0
        if (activityRow.started_at) {
          answerTimeMs = Math.max(0, Date.now() - new Date(activityRow.started_at + 'Z').getTime())
        }
        const name = studentName || `Etudiant ${studentId}`
        const { points, streak } = queries.calculateLiveScore(activityId, studentId, name, answerTimeMs, isCorrect, mode)
        const rank = queries.getLiveStudentRank(activityRow.session_id, studentId, mode)
        scoreResult = { isCorrect, points, rank, streak }
      }
    }
    // Broadcast socket uniquement en mode live
    if (mode === 'live' && session) {
      throttledResultsEmit(io, activityId, session.promo_id)
      if (scoreResult.isCorrect !== null) {
        throttledScoresEmit(io, session.id, activityId, session.promo_id)
      }
    }
    res.json({ ok: true, data: { ...response, ...scoreResult, mode } })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

router.get('/activities/:id/results', requirePromo(promoFromActivityV2), wrap((req) => {
  const mode = req.query?.mode === 'replay' ? 'replay' : 'live'
  return queries.getLiveActivityResultsAggregated(Number(req.params.id), mode)
}))

// ─── Pin (pulse) ───────────────────────────────────────────────────────────
router.post('/responses/:id/pin', requireRole('teacher'), wrap((req) => {
  return queries.toggleLivePin(Number(req.params.id), !!req.body.pinned)
}))

// ─── Board ─────────────────────────────────────────────────────────────────

router.get('/activities/:id/cards', requirePromo(promoFromActivityV2), wrap((req) => {
  return queries.getBoardCards(Number(req.params.id), req.user?.id ?? null)
}))

router.post('/activities/:id/cards', requirePromo(promoFromActivityV2), validate(boardCardSchema), (req, res) => {
  try {
    const authorId = req.user?.id
    const authorName = req.user?.name ?? 'Anonyme'
    if (!authorId) throw new Error('authorId requis')
    const activityId = Number(req.params.id)
    const card = queries.addBoardCard({
      activityId, columnName: req.body.columnName,
      content: req.body.content, authorId, authorName,
      color: req.body.color,
    })
    // Broadcast
    const activity = getDb().prepare('SELECT ls.promo_id FROM live_activities_v2 la JOIN live_sessions_v2 ls ON ls.id = la.session_id WHERE la.id = ?').get(activityId)
    if (activity) {
      req.app.get('io').to(`live:${activity.promo_id}`).emit('live:board-update', {
        activityId, action: 'add', card,
      })
    }
    res.json({ ok: true, data: card })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

/** Promo check for board card routes — caches promoId on req to avoid redundant JOINs */
function promoFromCardV2(req) {
  const cardId = Number(req.params.id)
  if (!cardId) return null
  const row = getDb().prepare(`
    SELECT ls.promo_id, bc.activity_id FROM live_board_cards bc
    JOIN live_activities_v2 la ON la.id = bc.activity_id
    JOIN live_sessions_v2 ls ON ls.id = la.session_id
    WHERE bc.id = ?
  `).get(cardId)
  if (!row) return null
  req._cardPromoId = row.promo_id
  req._cardActivityId = row.activity_id
  return row.promo_id
}

function emitBoardUpdate(req, action, payload) {
  const promoId = req._cardPromoId
  if (promoId) {
    req.app.get('io').to(`live:${promoId}`).emit('live:board-update', { ...payload, action })
  }
}

// PATCH /cards/:id — update card content or column
router.patch('/cards/:id', requirePromo(promoFromCardV2), (req, res) => {
  try {
    const cardId = Number(req.params.id)
    const card = queries.updateBoardCard(cardId, { content: req.body.content, columnName: req.body.columnName })
    if (card) {
      emitBoardUpdate(req, 'update', { activityId: card.activity_id, card })
    }
    res.json({ ok: true, data: card })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

router.delete('/cards/:id', requireRole('teacher'), requirePromo(promoFromCardV2), (req, res) => {
  try {
    const cardId = Number(req.params.id)
    const activityId = req._cardActivityId
    queries.deleteBoardCard(cardId)
    emitBoardUpdate(req, 'delete', { activityId, cardId })
    res.json({ ok: true })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

router.post('/cards/:id/vote', requirePromo(promoFromCardV2), (req, res) => {
  try {
    const studentId = req.user?.id
    if (!studentId) throw new Error('studentId requis')
    const cardId = Number(req.params.id)
    const shouldVote = req.body.vote !== false
    const ok = shouldVote
      ? queries.voteBoardCard(cardId, studentId)
      : queries.unvoteBoardCard(cardId, studentId)
    const card = getDb().prepare('SELECT activity_id, votes FROM live_board_cards WHERE id = ?').get(cardId)
    if (card) {
      emitBoardUpdate(req, 'vote', { activityId: card.activity_id, cardId, votes: card.votes })
    }
    res.json({ ok: true, data: { voted: ok } })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

// ─── Self-paced toggle ────────────────────────────────────────────────────

router.patch('/sessions/:id/self-paced', requireRole('teacher'), requireSessionOwnerV2, (req, res) => {
  try {
    const sessionId = Number(req.params.id)
    const selfPaced = req.body.selfPaced ? 1 : 0
    const db = getDb()
    db.prepare('UPDATE live_sessions_v2 SET self_paced = ? WHERE id = ?').run(selfPaced, sessionId)
    const session = queries.getLiveSession(sessionId)
    if (session) {
      const io = req.app.get('io')
      io.to(`live:${session.promo_id}`).emit('live:self-paced-update', { sessionId, selfPaced: !!selfPaced })
    }
    res.json({ ok: true, data: { selfPaced: !!selfPaced } })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

// ─── Launch all pending activities (self-paced batch) ─────────────────────

router.post('/sessions/:id/launch-all', requireRole('teacher'), requireSessionOwnerV2, (req, res) => {
  try {
    const sessionId = Number(req.params.id)
    const db = getDb()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const result = db.prepare(
      "UPDATE live_activities_v2 SET status = 'live', started_at = ? WHERE session_id = ? AND status = 'pending'"
    ).run(now, sessionId)
    const session = queries.getLiveSession(sessionId)
    if (session) {
      const io = req.app.get('io')
      // Notify students that all activities are now available
      for (const act of (session.activities || []).filter(a => a.status === 'live')) {
        io.to(`live:${session.promo_id}`).emit('live:activity-pushed', {
          activity: { ...act, started_at: act.started_at },
        })
      }
    }
    res.json({ ok: true, data: { launched: result.changes } })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

// ─── Progress per activity (self-paced dashboard) ─────────────────────────

router.get('/sessions/:id/progress', requirePromo(promoFromSessionV2), wrap((req) => {
  const sessionId = Number(req.params.id)
  const db = getDb()
  const activities = db.prepare(
    'SELECT id, title, type, category, position FROM live_activities_v2 WHERE session_id = ? ORDER BY position ASC'
  ).all(sessionId)
  const counts = db.prepare(`
    SELECT la.id as activity_id, COUNT(lr.id) as response_count
    FROM live_activities_v2 la
    LEFT JOIN live_responses_v2 lr ON lr.activity_id = la.id AND lr.mode = 'live'
    WHERE la.session_id = ?
    GROUP BY la.id
  `).all(sessionId)
  const countMap = new Map(counts.map(c => [c.activity_id, c.response_count]))
  return activities.map(a => ({
    id: a.id, title: a.title, type: a.type, category: a.category,
    responseCount: countMap.get(a.id) || 0,
  }))
}))

// ─── Student responded activities (for self-paced completion tracking) ────

router.get('/sessions/:id/my-responses', requirePromo(promoFromSessionV2), wrap((req) => {
  const sessionId = Number(req.params.id)
  const studentId = req.user?.id
  if (!studentId) throw new Error('studentId requis')
  const db = getDb()
  const rows = db.prepare(`
    SELECT la.id as activity_id
    FROM live_responses_v2 lr
    JOIN live_activities_v2 la ON la.id = lr.activity_id
    WHERE la.session_id = ? AND lr.student_id = ? AND lr.mode = 'live'
  `).all(sessionId, studentId)
  return rows.map(r => r.activity_id)
}))

// ─── Message Wall moderation ──────────────────────────────────────────────

router.patch('/cards/:id/hide', requireRole('teacher'), requirePromo(promoFromCardV2), (req, res) => {
  try {
    const cardId = Number(req.params.id)
    const hidden = req.body.hidden !== false
    const card = queries.hideMessageWallCard(cardId, hidden)
    emitBoardUpdate(req, 'hide', { activityId: req._cardActivityId, cardId, hidden: !!card.hidden })
    res.json({ ok: true, data: card })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

// ─── Confusion Signal ─────────────────────────────────────────────────────

router.post('/sessions/:id/confused', requirePromo(promoFromSessionV2), (req, res) => {
  try {
    const studentId = req.user?.id
    if (!studentId) throw new Error('studentId requis')
    const sessionId = Number(req.params.id)
    const active = req.body.active !== false ? 1 : 0
    const db = getDb()
    db.prepare(`
      INSERT INTO live_confusion_signals (session_id, student_id, active)
      VALUES (?, ?, ?)
      ON CONFLICT(session_id, student_id) DO UPDATE SET active = excluded.active
    `).run(sessionId, studentId, active)
    const { count } = db.prepare(
      'SELECT COUNT(*) as count FROM live_confusion_signals WHERE session_id = ? AND active = 1'
    ).get(sessionId)
    const session = queries.getLiveSession(sessionId)
    if (session) {
      req.app.get('io').to(`live:${session.promo_id}`).emit('live:confusion-update', { sessionId, count })
    }
    res.json({ ok: true, data: { active: !!active, count } })
  } catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

router.get('/sessions/:id/confused', requirePromo(promoFromSessionV2), wrap((req) => {
  const sessionId = Number(req.params.id)
  const db = getDb()
  const { count } = db.prepare(
    'SELECT COUNT(*) as count FROM live_confusion_signals WHERE session_id = ? AND active = 1'
  ).get(sessionId)
  return { count }
}))

module.exports = router
