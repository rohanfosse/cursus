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

  // Warm-up bots : declenche un tick ~8s apres l'arrivee du visiteur pour
  // qu'il voie de l'activite des l'ouverture du dashboard, sans attendre
  // 30s. Skippe en NODE_ENV=test (pas de worker, controle deterministe).
  if (process.env.NODE_ENV !== 'test') {
    const bots = require('../../services/demoBots')
    setTimeout(() => {
      try { bots.runOnce() } catch { /* non-blocking */ }
    }, 8_000)
    // DM de bienvenue : un bot "ami" envoie un DM perso ~15s apres start.
    // Cree un moment "tu es attendu(e)" qui colore toute la session.
    if (role === 'student') {
      setTimeout(() => {
        try { bots.sendWelcomeDm(db, tenantId, currentUser.id) } catch { /* */ }
      }, 15_000)
    }
    // Trame narrative : une story de ~5 min avec 10-12 evenements scriptes
    // tournant entre 3 trames (auth/avl/soutenance). Coexiste avec le tick
    // bots aleatoire — le visiteur voit a la fois un fil narratif et du
    // grain spontane.
    try {
      require('../../services/demoStorylines').startStoryline(tenantId)
    } catch { /* */ }
  }

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
  // Purge etats en memoire associes au tenant (sinon fuite au fil des sessions
  // sequentielles : un visiteur qui demarre 50 sessions accumulerait 50 fois
  // les bookmarks/notes/reads/typing/Hawkes). Tout est non-bloquant — si une
  // dependance manque ou throw, on retourne 200 quand meme.
  try { require('./interactive')._clearState?.(tenantId) } catch { /* */ }
  try {
    const algo = require('../../services/demoBotsAlgo')
    algo.resetLiveSim({ tenantId })
    algo.resetSubmissionSim(tenantId)
    algo.resetHawkes(tenantId)
  } catch { /* */ }
  try {
    require('../../services/demoBots').clearTyping(tenantId, null)
  } catch { /* */ }
  try {
    require('../../services/demoStorylines').cancelStoryline(tenantId)
  } catch { /* */ }
  res.json({ ok: true, data: null })
})

// Mount des sous-routers dans cet ordre :
//   1. real        : lit demo_* (presence, messages, students)
//   2. interactive : ecrit demo_* + state en memoire (bookmarks, pin,
//                    reactions, lumen notes/reads)
//   3. mocks       : fallbacks statiques + wildcard 200 [] / 403
// Un endpoint defini en amont prevaut sur un mock du meme path.
router.use(require('./real'))
router.use(require('./interactive'))
router.use(require('./mocks'))

module.exports = router
