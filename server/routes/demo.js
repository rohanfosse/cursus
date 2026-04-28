/**
 * Routes du mode demo (sandbox sans inscription).
 *
 * - POST /start  : cree une nouvelle session demo (token + dataset seed)
 * - POST /end    : termine la session, purge le tenant
 * - GET  /status : health check (sessions actives, prochain reset)
 *
 * Routes "applicatives" en mode demo (lecture/ecriture sur le tenant) :
 * - GET  /promotions
 * - GET  /channels?promoId=
 * - GET  /channels/:id/messages
 * - POST /channels/:id/messages
 * - GET  /assignments?channelId=
 *
 * Toutes les routes /api/demo/* (sauf /start) passent par le middleware
 * `demoMode` qui populate `req.tenantId` et `req.demoUser`.
 */
const router  = require('express').Router()
const jwt     = require('jsonwebtoken')
const crypto  = require('crypto')
const rateLimit = require('express-rate-limit')

const { getDemoDb, purgeExpiredSessions } = require('../db/demo-connection')
const { seedTenant } = require('../db/demo-seed')
const { demoMode } = require('../middleware/demoMode')

const SESSION_TTL_HOURS = 24

// Rate limit anti-abus : 5 demarrages par IP par heure (l'utilisateur n'a
// aucune raison legitime de creer 6 sessions en 1h).
const startLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: () => 'demo-start',
  message: { ok: false, error: 'Trop de demarrages de demo. Reessayez dans une heure.' },
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
})

// ──────────────────────────────────────────────────────────────────────
//  POST /api/demo/start { role: 'teacher'|'student' }
// ──────────────────────────────────────────────────────────────────────
router.post('/start', startLimiter, (req, res) => {
  const role = req.body?.role === 'teacher' ? 'teacher' : 'student'
  const db = getDemoDb()

  // Purge opportuniste avant de creer une nouvelle session (pas de cron en MVP).
  try { purgeExpiredSessions() } catch { /* non-blocking */ }

  const sessionId = crypto.randomUUID()
  const tenantId  = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000).toISOString()

  let seedResult
  try {
    seedResult = seedTenant(db, tenantId, role)
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Erreur creation session demo : ' + err.message })
  }

  const { currentUser } = seedResult

  db.prepare(
    `INSERT INTO demo_sessions (id, tenant_id, role, user_id, user_name, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(sessionId, tenantId, role, currentUser.id, currentUser.name, expiresAt)

  const secret = req.app.get('jwtSecret')
  const token  = 'demo-' + jwt.sign(
    { scope: 'demo', sessionId, tenantId, role },
    secret,
    { expiresIn: SESSION_TTL_HOURS + 'h' },
  )

  res.json({
    ok: true,
    data: {
      token,
      currentUser,
      expiresAt,
      message: 'Session demo demarree. Donnees ephemeres, reset apres 24h.',
    },
  })
})

// ──────────────────────────────────────────────────────────────────────
//  Routes authentifiees (toutes derriere demoMode)
// ──────────────────────────────────────────────────────────────────────
router.use(demoMode)

// POST /api/demo/end : termine la session courante.
router.post('/end', (req, res) => {
  const db = getDemoDb()
  const tenantId = req.tenantId
  const txn = db.transaction(() => {
    const tables = [
      'demo_promotions', 'demo_channels', 'demo_students', 'demo_teachers',
      'demo_messages', 'demo_assignments', 'demo_sessions',
    ]
    for (const t of tables) {
      db.prepare(`DELETE FROM ${t} WHERE tenant_id = ?`).run(tenantId)
    }
  })
  txn()
  res.json({ ok: true, data: null })
})

// ──────────────────────────────────────────────────────────────────────
//  Routes applicatives (lecture/ecriture dans le tenant)
// ──────────────────────────────────────────────────────────────────────

// GET /api/demo/promotions
router.get('/promotions', (req, res) => {
  const rows = getDemoDb()
    .prepare(`SELECT id, name, color FROM demo_promotions WHERE tenant_id = ? ORDER BY id`)
    .all(req.tenantId)
  res.json({ ok: true, data: rows })
})

// GET /api/demo/promotions/:id/channels
router.get('/promotions/:promoId/channels', (req, res) => {
  const rows = getDemoDb().prepare(
    `SELECT id, promo_id, name, type, description, category, is_private, archived, created_at
     FROM demo_channels
     WHERE tenant_id = ? AND promo_id = ?
     ORDER BY id`
  ).all(req.tenantId, Number(req.params.promoId))
  res.json({ ok: true, data: rows })
})

// GET /api/demo/promotions/:id/students
router.get('/promotions/:promoId/students', (req, res) => {
  const rows = getDemoDb().prepare(
    `SELECT id, promo_id, name, email, avatar_initials, photo_data
     FROM demo_students
     WHERE tenant_id = ? AND promo_id = ?
     ORDER BY name`
  ).all(req.tenantId, Number(req.params.promoId))
  res.json({ ok: true, data: rows })
})

// GET /api/demo/messages/channel/:channelId/page
router.get('/messages/channel/:channelId/page', (req, res) => {
  const rows = getDemoDb().prepare(
    `SELECT
       id, channel_id, dm_student_id, author_id, author_name, author_type,
       author_initials, author_photo, content, reactions, is_pinned, edited, created_at
     FROM demo_messages
     WHERE tenant_id = ? AND channel_id = ?
     ORDER BY id ASC
     LIMIT 100`
  ).all(req.tenantId, Number(req.params.channelId))
  res.json({ ok: true, data: { messages: rows, hasMore: false } })
})

// POST /api/demo/messages
router.post('/messages', (req, res) => {
  const { channelId, content } = req.body || {}
  if (!channelId || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ ok: false, error: 'channelId et content requis.' })
  }
  if (content.length > 10_000) {
    return res.status(400).json({ ok: false, error: 'Message trop long (max 10000 caracteres).' })
  }

  const u = req.demoUser
  // L'init du seed renvoie un objet "currentUser" complet ; ici on a juste
  // les champs minimaux dans le JWT/session, donc on reconstruit pour le
  // message en cherchant les initiales depuis la table students/teachers.
  const db = getDemoDb()
  let initials = ''
  if (u.type === 'teacher') {
    const t = db.prepare(`SELECT name FROM demo_teachers WHERE id = ? AND tenant_id = ?`).get(-u.id, req.tenantId)
    initials = (t?.name || u.name).split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
  } else {
    const s = db.prepare(`SELECT avatar_initials FROM demo_students WHERE id = ? AND tenant_id = ?`).get(u.id, req.tenantId)
    initials = s?.avatar_initials || u.name.slice(0, 2).toUpperCase()
  }

  const result = db.prepare(
    `INSERT INTO demo_messages
       (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(req.tenantId, Number(channelId), u.id, u.name, u.type, initials, content.trim())

  const msg = db.prepare(
    `SELECT id, channel_id, dm_student_id, author_id, author_name, author_type,
            author_initials, author_photo, content, reactions, is_pinned, edited, created_at
     FROM demo_messages WHERE id = ?`
  ).get(result.lastInsertRowid)

  res.json({ ok: true, data: msg })
})

// GET /api/demo/assignments?channelId=
router.get('/assignments', (req, res) => {
  const channelId = Number(req.query.channelId)
  const rows = getDemoDb().prepare(
    `SELECT id, channel_id, title, description, type, deadline, is_published, created_at
     FROM demo_assignments
     WHERE tenant_id = ? ${channelId ? 'AND channel_id = ?' : ''}
     ORDER BY deadline ASC NULLS LAST`
  ).all(...(channelId ? [req.tenantId, channelId] : [req.tenantId]))
  res.json({ ok: true, data: rows })
})

// GET /api/demo/status (compteurs internes, pas auth-protege puisque post-demoMode)
router.get('/status', (req, res) => {
  const db = getDemoDb()
  const counts = {
    messages:    db.prepare(`SELECT COUNT(*) c FROM demo_messages WHERE tenant_id = ?`).get(req.tenantId).c,
    channels:    db.prepare(`SELECT COUNT(*) c FROM demo_channels WHERE tenant_id = ?`).get(req.tenantId).c,
    assignments: db.prepare(`SELECT COUNT(*) c FROM demo_assignments WHERE tenant_id = ?`).get(req.tenantId).c,
  }
  res.json({ ok: true, data: { tenant: req.tenantId, counts } })
})

module.exports = router
