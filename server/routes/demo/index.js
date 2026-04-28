/**
 * Routes du mode demo (sandbox sans inscription) — point d'entree.
 *
 * Le mode demo est split en 3 fichiers :
 *  - index.js  (ce fichier) : router racine, POST /start, POST /end,
 *    mounts de demoMode middleware, real.js et mocks.js
 *  - real.js   : endpoints qui lisent/ecrivent reellement les tables
 *    demo_* (promotions, channels, messages, students, presence, status)
 *  - mocks.js  : endpoints fictifs (lecture vide ou hardcoded) pour les
 *    features prod non couvertes par le seed (booking, documents avances,
 *    live history, lumen, kanban, etc.). Le wildcard 404-fallback est ici.
 *
 * Tout passe derriere `demoMode` middleware sauf POST /start (la session
 * n'existe pas encore au moment du start).
 *
 * Pour ajouter un nouvel endpoint : voir README.md de ce dossier.
 */
const router  = require('express').Router()
const jwt     = require('jsonwebtoken')
const crypto  = require('crypto')
const rateLimit = require('express-rate-limit')

const { getDemoDb, purgeExpiredSessions } = require('../../db/demo-connection')
const { seedTenant } = require('../../db/demo-seed')
const { demoMode } = require('../../middleware/demoMode')

const SESSION_TTL_HOURS = 24

// Rate limit anti-abus : 5 demarrages par IP par heure (l'utilisateur n'a
// aucune raison legitime de creer 6 sessions en 1h). Skip en NODE_ENV=test
// pour que les tests E2E (multi-workers) ne soient pas rate-limites.
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
//
//  Cree un nouveau tenant_id (UUID), seed le dataset, signe un JWT
//  prefixe `demo-` et retourne le `currentUser` complet pour que le
//  frontend puisse hydrater appStore.login() sans round-trip.
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

// POST /api/demo/end : termine la session courante (purge le tenant_id).
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

// Mount des sous-routers : real (lit demo_*) puis mocks (fallbacks). L'ordre
// compte — un endpoint defini dans real.js prevaut sur un mock du meme path.
router.use(require('./real'))
router.use(require('./mocks'))

module.exports = router
