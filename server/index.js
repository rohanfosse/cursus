// ─── Serveur Express + Socket.io - Cursus ─────────────────────────────────────
require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const express    = require('express')
const http       = require('http')
const { Server } = require('socket.io')
const cors       = require('cors')
const jwt        = require('jsonwebtoken')
const queries    = require('./db/index')
const log        = require('./utils/logger')

const PORT = process.env.PORT ?? 3001

// CORS_ORIGIN accepte un seul domaine ou une liste separee par virgules.
// Ex : "https://app.cursus.school" ou "https://app.cursus.school,https://cursus.school"
//
// Defaut en developpement : http://localhost:5173 (vite dev server).
// Defaut en production : null = cors() refuse tout (fail closed).
// L'admin DOIT configurer CORS_ORIGIN en prod, mais on prefere refuser
// les requetes cross-origin plutot que d'autoriser localhost en cas
// d'oubli.
function parseCorsOrigin(raw) {
  if (!raw) return null
  if (raw === '*') return '*'  // delegue a cors() qui acceptera *
  const list = raw.split(',').map(s => s.trim()).filter(Boolean)
  return list.length === 1 ? list[0] : list
}

const IS_DEV = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || !process.env.NODE_ENV
const ORIGIN = process.env.CORS_ORIGIN
  ? parseCorsOrigin(process.env.CORS_ORIGIN)
  : (IS_DEV ? 'http://localhost:5173' : null)

// ── Verifications de securite au demarrage ──────────────────────────────────
// JWT_SECRET : fail-fast en non-dev (faille reelle : forgeabilite de tokens).
// CORS_ORIGIN : warn bruyant mais pas d'exit. Hotfix v2.331.2 : le fail-fast
// CORS de v2.331 a brique des prods avec .env mal configures (502 au pilote).
// L'admin doit corriger CORS_ORIGIN au plus tot, mais le serveur reste up
// pour eviter la coupure totale.
// Persistance des boot failures hors stdout : a ce stade la DB n'est pas
// encore initialisee (donc on ne peut pas utiliser log.error() qui ecrit
// dans error_reports). On append a un fichier flat dans le meme volume
// Docker persistant que la DB SQLite (`/data/db/boot-errors.log` par
// defaut). L'admin peut ensuite cat ce fichier via SSH ou un endpoint si
// le serveur ne demarre pas.
function logBootFailure(reason, meta = {}) {
  const fsSync = require('fs')
  const pathMod = require('path')
  try {
    const dbPath = process.env.DB_PATH || pathMod.join(__dirname, '../data/db/cursus.db')
    const logFile = pathMod.join(pathMod.dirname(dbPath), 'boot-errors.log')
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      reason,
      nodeEnv: process.env.NODE_ENV,
      pid: process.pid,
      version: (() => { try { return require('../package.json').version } catch { return 'unknown' } })(),
      ...meta,
    }) + '\n'
    fsSync.appendFileSync(logFile, entry, { mode: 0o600 })
  } catch {
    /* Best effort : si on ne peut pas ecrire (volume non monte, perms),
       on tombe au moins sur le console.error d'au dessus. */
  }
  console.error(`[BOOT_FAILURE] ${reason}`, meta)
}

const SECRET = process.env.JWT_SECRET ?? 'changeme-dev-secret'
if (!IS_DEV) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    logBootFailure('JWT_SECRET absent ou trop court', { length: process.env.JWT_SECRET?.length ?? 0 })
    console.error('[SECURITY] JWT_SECRET absent ou trop court (min 32 caracteres). Arret du serveur.')
    process.exit(1)
  }
  // CORS_ORIGIN doit etre configure en non-dev. Le fallback localhost:5173
  // devient une faille en prod, mais on prefere logger fort et continuer
  // plutot que crasher (ce qui couperait l'app entiere).
  if (!process.env.CORS_ORIGIN) {
    log.error('cors_origin_missing', {
      msg: '[SECURITY] CORS_ORIGIN absent en non-development. Le serveur demarre avec localhost:5173 par defaut, ce qui est une mauvaise configuration de production. Definissez CORS_ORIGIN dans .env immediatement.',
      nodeEnv: process.env.NODE_ENV,
    })
  } else if (process.env.CORS_ORIGIN === '*') {
    log.error('cors_origin_wildcard', {
      msg: '[SECURITY] CORS_ORIGIN=* en non-development. Risque de fuite credentialed. Limitez a votre domaine.',
    })
  }
  if (!process.env.DEPLOY_SECRET || process.env.DEPLOY_SECRET.length < 16) {
    log.warn('deploy_secret_missing', { msg: 'DEPLOY_SECRET absent ou trop court — webhook de deploiement desactive.' })
  }
} else if (!process.env.JWT_SECRET) {
  log.warn('jwt_secret_default', { msg: 'JWT_SECRET non defini — secret par defaut utilise. Ne pas utiliser en dehors du developpement local.' })
}

const app    = express()
app.set("trust proxy", 1)
const server = http.createServer(app)
const io     = new Server(server, {
  cors: { origin: ORIGIN, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
  pingTimeout: 60000,
})

// ── Middleware global ─────────────────────────────────────────────────────────
app.use(cors({ origin: ORIGIN }))
app.use(express.json({ limit: '20mb' }))

// ── Headers de sécurité ─────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  // 'wasm-unsafe-eval' + jsdelivr + blob: ajoutes pour Pyodide (runner .ipynb
  // Lumen). Le runner est opt-in (bouton Executer sur un chapitre .ipynb).
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' wss: ws: https://cdn.jsdelivr.net blob: data:; frame-ancestors 'self'")
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  next()
})

// ── Logging des requêtes (temps de réponse, erreurs) ─────────────────────────
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - start
    if (res.statusCode >= 400) {
      log.warn('request', { method: req.method, path: req.path, status: res.statusCode, ms, ip: req.ip })
    } else if (ms > 1000) {
      log.warn('slow_request', { method: req.method, path: req.path, status: res.statusCode, ms })
    }
  })
  next()
})

const rateLimit = require('express-rate-limit')
// `skipInTest` : tous les tests E2E partagent la meme IP (localhost) et
// martelent l'API en parallele (plusieurs workers Playwright + bundle Vue
// qui charge plein de chunks). Sans skip, on touchait la limite globale et
// /api/demo/start retournait 429 au milieu des tests.
const skipInTest = () => process.env.NODE_ENV === 'test'
// Limite générale : 300 req/min par IP
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false, skip: skipInTest }))
// Limite stricte sur l'auth : 20 req/min par IP
const authLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false, skip: skipInTest })

// Expose io et secret pour les routes
app.set('io', io)
app.set('jwtSecret', SECRET)

// ── Routes publiques (auth) ───────────────────────────────────────────────────
app.use('/api/auth', authLimiter, require('./routes/auth'))

// ── Routes mode demo (sandbox sans inscription) ──────────────────────────────
// Mountees avant le authMiddleware /api : POST /start est public (cree une
// session), et les autres routes ont leur propre middleware demoMode qui
// valide le token JWT prefixe `demo-`. Aucune route /api/demo/* n'accede a la
// DB de prod (DB physiquement separee : `cursus_demo.sqlite`).
app.use('/api/demo', require('./routes/demo'))

// ── Error reporting (sans auth — le frontend peut reporter avant login) ─────
app.use('/api/report-error', require('./routes/error-report'))

// ── Update config + telemetrie (public, appele par l'auto-updater au boot) ──
app.use('/api/update', require('./routes/update-config'))

// ── Abonnement iCal public (/ical/:token.ics) — sans JWT, auth par token opaque
app.use('/ical', require('./routes/public-ical'))

// ── Routes booking publiques — sans JWT ─────────────────────────────────────
// Mountees AVANT authMiddleware sinon les liens d'invitation envoyes par
// mail (publicBooking, cancellation, campaignPublic) tombent en 401. Chaque
// sous-route valide son propre token opaque (booking_token, cancel_token,
// invite_token) et a son rate limiter — pas de fuite.
app.use('/api/bookings', require('./routes/bookings-public'))

// ── Middleware JWT pour toutes les routes /api/* suivantes ─────────────────────
const authMiddleware = require('./middleware/auth')
app.use('/api', authMiddleware)

// ── Rate limit par utilisateur sur les mutations (POST/PUT/PATCH/DELETE) ──────
const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ? String(req.user.id) : 'anon',
  skip: (req) => req.method === 'GET' || skipInTest(),
  message: { ok: false, error: 'Trop de requêtes. Réessayez dans une minute.' },
  validate: { xForwardedForHeader: false },
})
app.use('/api', writeLimiter)

// ── Middleware mode lecture seule (bloque POST/PUT/PATCH/DELETE pour non-teachers) ──
app.use('/api', (req, res, next) => {
  if (req.method === 'GET') return next()
  try {
    const { getAppConfig } = require('./db/models/admin')
    const { hasRole } = require('./permissions')
    if (getAppConfig('read_only') === '1' && !hasRole(req.user?.type, 'ta')) {
      return res.status(503).json({ ok: false, error: 'La plateforme est en mode lecture seule.' })
    }
  } catch (err) { log.warn('read_only_check_failed', { error: err.message }) }
  next()
})

// ── Session tracking (async, non bloquant) ──────────────────────────────────
app.use('/api', (req, _res, next) => {
  if (req.user && req.headers.authorization) {
    try {
      const crypto = require('crypto')
      const token = req.headers.authorization.replace('Bearer ', '')
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 32)
      const { upsertSession } = require('./db/models/admin')
      upsertSession({
        userId: req.user.id, userName: req.user.name, userType: req.user.type,
        tokenHash, ip: req.ip, userAgent: req.get('user-agent') || '',
      })
    } catch (err) { log.warn('session_upsert_failed', { error: err.message }) }
  }
  next()
})

// ── Visit tracking (async, non bloquant) ─────────────────────────────────────
app.use('/api', (req, _res, next) => {
  if (req.method === 'GET' && req.user && !req.path.startsWith('/admin')) {
    try {
      const { recordVisit } = require('./db/models/admin')
      recordVisit({
        userId: req.user.id,
        userName: req.user.name,
        userType: req.user.type,
        path: req.path,
      })
    } catch (err) { log.warn('visit_record_failed', { error: err.message }) }
  }
  next()
})

// ── Routes protégées ─────────────────────────────────────────────────────────
app.use('/api/promotions',  require('./routes/promotions'))
app.use('/api/students',    require('./routes/students'))
app.use('/api/messages/scheduled', require('./routes/scheduled'))
app.use('/api/messages',    require('./routes/messages'))
app.use('/api/assignments', require('./routes/assignments'))
app.use('/api/depots',      require('./routes/depots'))
app.use('/api/groups',      require('./routes/groups'))
app.use('/api/resources',   require('./routes/resources'))
app.use('/api/documents',   require('./routes/documents'))
app.use('/api/teachers',    require('./routes/teachers'))
app.use('/api/rubrics',     require('./routes/rubrics'))
app.use('/api/admin',       require('./routes/admin/index'))
app.use('/api/live',        require('./routes/live'))
app.use('/api/kanban',          require('./routes/kanban'))
app.use('/api/teacher-notes',   require('./routes/teacher-notes'))
app.use('/api/engagement',      require('./routes/engagement'))
app.use('/api/signatures',      require('./routes/signatures'))
app.use('/api/projects',        require('./routes/projects'))
app.use('/api/lumen',           require('./routes/lumen'))
app.use('/api/cahiers',         require('./routes/cahiers'))
app.use('/api/live-v2',         require('./routes/live-unified'))
app.use('/api/bookings',        require('./routes/bookings'))
app.use('/api/calendar',        require('./routes/calendar'))
app.use('/api/calendar-subscriptions', require('./routes/calendarSubscriptions'))
app.use('/api/typerace',        require('./routes/typerace'))
app.use('/api/games',           require('./routes/games'))
app.use('/api/bookmarks',       require('./routes/bookmarks'))
app.use('/api',                 require('./routes/statuses'))
app.use('/api/link-preview',    require('./routes/linkPreview'))

// ── Fichiers statiques & SPA ──────────────────────────────────────────────────
const path = require('path')
const fs   = require('fs')

// Fichiers uploadés - auth JWT requise (header Authorization uniquement)
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'uploads')
  : path.join(__dirname, '../uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
app.use('/uploads', (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ ok: false, error: 'Non authentifié' })
  let user
  try {
    user = jwt.verify(token, SECRET, { algorithms: ['HS256'] })
  } catch {
    return res.status(401).json({ ok: false, error: 'Token invalide' })
  }

  // Scope check : avant de servir le fichier, on verifie via la table
  // `uploads` que l'utilisateur peut y acceder. Pour les fichiers legacy
  // (avant la migration v92, donc pas de row), fallback "tout JWT valide
  // passe" pour ne pas casser les URLs deja stockees dans messages/depots.
  // Apres deployment + transition, on pourra durcir.
  try {
    const filename = decodeURIComponent(req.path.replace(/^\/+/, '').split('/')[0] || '')
    if (filename) {
      const { canAccessUpload } = require('./db/models/uploads')
      if (!canAccessUpload(user, filename)) {
        return res.status(403).json({ ok: false, error: 'Accès refusé.' })
      }
    }
  } catch (err) {
    log.warn('uploads_scope_check_failed', { error: err.message, path: req.path })
    // En cas d'erreur de check : fail closed sauf en dev pour eviter les
    // surprises au pilote.
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ ok: false, error: 'Erreur lors de la verification.' })
    }
  }
  next()
}, express.static(UPLOAD_DIR, {
  setHeaders: (res, filePath) => {
    // Forcer le téléchargement sauf pour les images (affichage inline autorisé)
    const ext = path.extname(filePath).toLowerCase()
    const inlineExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']
    if (!inlineExts.includes(ext)) {
      res.setHeader('Content-Disposition', 'attachment')
    }
  },
}))

// Route upload (auth requise - montée après authMiddleware global /api)
app.use('/api/files', require('./routes/files'))

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  try {
    const { getDb } = require('./db/connection')
    getDb().prepare('SELECT 1').get()

    const mem = process.memoryUsage()
    const data = {
      ok: true,
      version: require('../package.json').version,
      uptime: Math.floor(process.uptime()),
      connections: io?.engine?.clientsCount ?? 0,
      memory: Math.round(mem.heapUsed / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024),
    }

    // Disk usage (Linux only, non-blocking best-effort)
    try {
      const { execSync } = require('child_process')
      const df = execSync("df -B1 / | tail -1", { encoding: 'utf8', timeout: 2000 }).trim().split(/\s+/)
      data.disk = {
        total: Math.round(Number(df[1]) / 1024 / 1024),
        used: Math.round(Number(df[2]) / 1024 / 1024),
        pct: parseInt(df[4]),
      }
    } catch {}

    res.json(data)
  } catch (err) {
    res.status(503).json({ ok: false, error: 'Base de données inaccessible', version: require('../package.json').version })
  }
})

// ── Téléchargements (proxy GitHub Releases, sans exposer l'URL GitHub) ────────
app.use('/download', require('./routes/download'))

// ── Webhook de déploiement (pas d'auth JWT, validé par DEPLOY_SECRET) ─────────
app.use('/webhook/deploy', require('./routes/deploy'))

// ── Page admin monitoring (fichiers statiques sans auth, API protegee par /api/admin) ─
app.use('/admin-monitor', express.static(path.join(__dirname, 'public/admin'), {
  setHeaders: (res) => res.set('Cache-Control', 'no-cache, no-store, must-revalidate'),
}))
app.get('/admin-monitor', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/index.html'))
})

// ── Landing page vitrine (uniquement sur cursus.school, pas app.cursus.school) ─
const LANDING = path.join(__dirname, '../src/landing/index.html')
if (fs.existsSync(LANDING)) {
  app.get('/', (req, res, next) => {
    const host = (req.get('host') || req.headers.host || '').split(':')[0]
    // Servir la landing SEULEMENT pour cursus.school ou www.cursus.school
    // Tout autre hostname (app.cursus.school, localhost, IP) sert le SPA
    if (host === 'cursus.school' || host === 'www.cursus.school') {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      return res.sendFile(LANDING)
    }
    next()
  })
}

// ── SPA web - servie sous /app et en fallback ────────────────────────────────
const WEB_DIST = path.join(__dirname, '../dist-web')
if (fs.existsSync(WEB_DIST)) {
  // Service worker : toujours revalider (le navigateur DOIT checker les mises à jour)
  app.get('/sw.js', (_req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.set('Content-Type', 'application/javascript')
    res.sendFile(path.join(WEB_DIST, 'sw.js'))
  })

  // Assets statiques : les fichiers hashés (JS/CSS) peuvent être cachés longtemps,
  // mais HTML ne doit jamais être caché
  app.use(express.static(WEB_DIST, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      }
    },
  }))

  // SPA fallback : toutes les routes non-API servent index.html (routing Vue)
  app.get('*', (req, res, next) => {
    // Skip API, socket, uploads, health, admin-monitor
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') ||
        req.path.startsWith('/uploads') || req.path === '/health' ||
        req.path === '/admin-monitor') return next()
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.sendFile(path.join(WEB_DIST, 'index.html'))
  })
}

// ── Socket.io (auth, presence, rooms, typing) ────────────────────────────────
require('./socket')(io, queries, SECRET)

// ── Initialisation DB ─────────────────────────────────────────────────────────
queries.init()
log.info('db_initialized')
// La DB est up : on peut maintenant persister les errors dans error_reports.
// Avant ce point, les log.error() partent uniquement sur stderr (capture DB
// no-op tant que enableDbCapture() n'a pas ete appele).
log.enableDbCapture()

// Migration tokens GitHub legacy : chiffre au boot tous les tokens stockes
// en clair (vestige v2.32.x avant le chiffrement AES-GCM). Idempotent.
try {
  const { migrateLumenTokensAtBoot } = require('./db/models/lumen')
  const migrated = migrateLumenTokensAtBoot()
  if (migrated > 0) log.info('lumen_tokens_migrated', { count: migrated })
} catch (err) {
  log.error('lumen_token_migration_failed', { error: err.message })
}

// ── Timer : envoi des annonces planifiees (toutes les 30s) ─────────────────
const _scheduledTimer = require('./services/scheduler')(io, queries)

// ── Backup quotidien SQLite ──────────────────────────────────────────────────
const { startDailyBackup } = require('./services/backup')
const { getDb } = require('./db/connection')
const _backupDir = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups')
const _backup = startDailyBackup(getDb(), _backupDir)

// ── Middleware d'erreur global (masque les détails internes en production) ────
app.use((err, _req, res, _next) => {
  log.error('unhandled_error', { error: err.message, stack: err.stack })
  const message = process.env.NODE_ENV === 'production'
    ? 'Erreur interne du serveur.'
    : err.message
  res.status(err.status || 500).json({ ok: false, error: message })
})

// ── Hocuspocus (Yjs) pour cahiers collaboratifs temps reel ──────────────────
const { attachHocuspocus } = require('./yjs/hocuspocus')
const hocuspocus = attachHocuspocus(server, { jwtSecret: SECRET })
// Expose pour /api/admin/health qui veut le nb de docs Yjs ouverts.
app.set('hocuspocus', hocuspocus)

// ── Démarrage ─────────────────────────────────────────────────────────────────
// Skip le listen() quand le module est require() (ex. tests Vitest qui ont
// besoin de l'app Express sans serveur HTTP attache).
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    log.info('server_started', { port: PORT, env: process.env.NODE_ENV || 'development' })

    // Workers du mode demo (jalon V2). En NODE_ENV=test, ces .start() sont
    // no-op (les tests pilotent via runOnce()).
    try { require('./services/demoBots').start() } catch (err) { log.warn('demo_bots_start_failed', { error: err.message }) }
    try { require('./services/demoReset').start() } catch (err) { log.warn('demo_reset_start_failed', { error: err.message }) }
  })
}

// Expose pour les tests.
module.exports = { app, server, io }

// ── Arrêt gracieux ────────────────────────────────────────────────────────────
async function shutdown() {
  log.info('shutdown_initiated')
  clearInterval(_scheduledTimer)
  _backup.stop()
  // Notifier les clients WebSocket avant l'arret
  io.emit('server:maintenance', { message: 'Le serveur redémarre, reconnexion automatique dans quelques secondes.' })

  // Flush Hocuspocus (force onStoreDocument pour tous les docs ouverts)
  try {
    await Promise.race([
      hocuspocus.destroy(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('hocuspocus_destroy_timeout')), 5_000)),
    ])
  } catch (err) {
    log.warn('hocuspocus_destroy_failed', { error: err.message })
  }

  // Drain period : laisser les requetes en cours se terminer (max 10s)
  server.close(() => {
    try { queries.close() } catch {}
    process.exit(0)
  })

  // Forcer l'arret si drain depasse 10s
  setTimeout(() => {
    log.warn('shutdown_forced', { reason: 'drain timeout 10s' })
    try { queries.close() } catch {}
    process.exit(1)
  }, 10_000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT',  shutdown)

// ── Capture des exceptions non gerees ─────────────────────────────────────
// Sans ces handlers, une uncaughtException ou unhandledRejection :
//   - tue le processus Node (uncaughtException) -> container restart loop
//   - ou pollue stderr sans trace persistante (unhandledRejection)
//
// Avec : on logge via log.error() qui persiste dans error_reports, donc
// l'admin peut voir le contexte du crash via /admin-monitor sans SSH.
// On laisse le process mourir apres une uncaughtException (politique Node
// recommandee : l'etat est potentiellement corrompu) — Docker restart unless
// le fera rebooter. Pour unhandledRejection on continue (suit la deprecation
// Node 15+ qui les transforme en uncaughtException, mais en mode best effort).
process.on('uncaughtException', (err, origin) => {
  log.error('uncaught_exception', {
    error: err?.message ?? String(err),
    stack: err?.stack ?? null,
    origin,
    source: 'uncaught',
    level: 'fatal',
  })
  // Laisse le temps au log d'etre flush avant exit (sinon stderr buffer perdu).
  setTimeout(() => process.exit(1), 200).unref()
})

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason))
  log.error('unhandled_rejection', {
    error: err.message,
    stack: err.stack ?? null,
    source: 'rejection',
    level: 'error',
  })
})
