// ─── Serveur Express + Socket.io - Cursus ─────────────────────────────────────
require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const express    = require('express')
const http       = require('http')
const { Server } = require('socket.io')
const cors       = require('cors')
const jwt        = require('jsonwebtoken')
const queries    = require('./db/index')
const log        = require('./utils/logger')

const PORT   = process.env.PORT       ?? 3001
const ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

// ── Vérifications de sécurité au démarrage ──────────────────────────────────
const SECRET = process.env.JWT_SECRET ?? 'changeme-dev-secret'
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('[SECURITY] JWT_SECRET absent ou trop court (min 32 caractères). Arrêt du serveur.')
    process.exit(1)
  }
  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') {
    log.warn('cors_wildcard', { msg: 'CORS_ORIGIN non défini ou wildcard (*) — utilisation du domaine par défaut.' })
  }
  if (!process.env.DEPLOY_SECRET || process.env.DEPLOY_SECRET.length < 16) {
    log.warn('deploy_secret_missing', { msg: 'DEPLOY_SECRET absent ou trop court — webhook de déploiement désactivé.' })
  }
} else if (!process.env.JWT_SECRET) {
  log.warn('jwt_secret_default', { msg: 'JWT_SECRET non défini — secret par défaut utilisé. Ne pas utiliser en dehors du développement local.' })
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
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' wss: ws:; frame-ancestors 'self'")
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
// Limite générale : 300 req/min par IP
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }))
// Limite stricte sur l'auth : 20 req/min par IP
const authLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false })

// Expose io et secret pour les routes
app.set('io', io)
app.set('jwtSecret', SECRET)

// ── Routes publiques (auth) ───────────────────────────────────────────────────
app.use('/api/auth', authLimiter, require('./routes/auth'))

// ── Error reporting (sans auth — le frontend peut reporter avant login) ─────
app.use('/api/report-error', require('./routes/error-report'))

// ── Middleware JWT pour toutes les routes /api/* suivantes ─────────────────────
const authMiddleware = require('./middleware/auth')
app.use('/api', authMiddleware)

// ── Rate limit par utilisateur sur les mutations (POST/PUT/PATCH/DELETE) ──────
const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ? String(req.user.id) : req.ip,
  skip: (req) => req.method === 'GET',
  message: { ok: false, error: 'Trop de requêtes. Réessayez dans une minute.' },
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
app.use('/api/rex',         require('./routes/rex'))
app.use('/api/kanban',          require('./routes/kanban'))
app.use('/api/teacher-notes',   require('./routes/teacher-notes'))
app.use('/api/engagement',      require('./routes/engagement'))
app.use('/api/signatures',      require('./routes/signatures'))
app.use('/api/projects',        require('./routes/projects'))

// ── Auto-fermeture des sessions REX async expirées (toutes les 60s) ───────────
setInterval(() => {
  try { queries.autoCloseExpiredAsyncSessions() }
  catch (err) { log.error('rex_autoclose_failed', { error: err.message }) }
}, 60_000)

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
  try {
    jwt.verify(token, SECRET)
    next()
  } catch {
    return res.status(401).json({ ok: false, error: 'Token invalide' })
  }
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
      connections: onlineUsers.size,
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

// ── Démarrage ─────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  log.info('server_started', { port: PORT, env: process.env.NODE_ENV || 'development' })
})

// ── Arrêt gracieux ────────────────────────────────────────────────────────────
function shutdown() {
  log.info('shutdown_initiated')
  clearInterval(_scheduledTimer)
  _backup.stop()
  server.close(() => {
    try { queries.close() } catch {}
    process.exit(0)
  })
}
process.on('SIGTERM', shutdown)
process.on('SIGINT',  shutdown)
