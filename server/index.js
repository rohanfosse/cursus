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

// ── Vérification JWT_SECRET en production ───────────────────────────────────
const SECRET = process.env.JWT_SECRET ?? 'changeme-dev-secret'
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('[SECURITY] JWT_SECRET absent ou trop court (min 32 caractères). Arrêt du serveur.')
    process.exit(1)
  }
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

// ── Middleware JWT pour toutes les routes /api/* suivantes ─────────────────────
const authMiddleware = require('./middleware/auth')
app.use('/api', authMiddleware)

// ── Middleware mode lecture seule (bloque POST/PUT/PATCH/DELETE sauf admin) ──
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.path.startsWith('/admin')) return next()
  try {
    const { getAppConfig } = require('./db/models/admin')
    if (getAppConfig('read_only') === '1' && req.user?.type !== 'teacher') {
      return res.status(503).json({ ok: false, error: 'La plateforme est en mode lecture seule.' })
    }
  } catch {}
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
    } catch {}
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
    } catch {}
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

// ── Auto-fermeture des sessions REX async expirées (toutes les 60s) ───────────
setInterval(() => {
  try { queries.autoCloseExpiredAsyncSessions() }
  catch (err) { log.error('rex_autoclose_failed', { error: err.message }) }
}, 60_000)

// ── Fichiers statiques & SPA ──────────────────────────────────────────────────
const path = require('path')
const fs   = require('fs')

// Fichiers uploadés - auth JWT requise (via header ou query param ?token=)
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'uploads')
  : path.join(__dirname, '../uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
app.use('/uploads', (req, res, next) => {
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '')
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
    // Vérifier la connexion DB
    const { getDb } = require('./db/connection')
    getDb().prepare('SELECT 1').get()
    res.json({
      ok: true,
      version: require('../package.json').version,
      uptime: Math.floor(process.uptime()),
      connections: onlineUsers.size,
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    })
  } catch (err) {
    res.status(503).json({ ok: false, error: 'Base de données inaccessible', version: require('../package.json').version })
  }
})

// ── Téléchargements (proxy GitHub Releases, sans exposer l'URL GitHub) ────────
app.use('/download', require('./routes/download'))

// ── Webhook de déploiement (pas d'auth JWT, validé par DEPLOY_SECRET) ─────────
app.use('/webhook/deploy', require('./routes/deploy'))

// ── Page admin monitoring ─────────────────────────────────────────────────────
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

// ── Socket.io - authentification ──────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('Non authentifié'))
  try {
    socket.user = jwt.verify(token, SECRET)
    next()
  } catch {
    next(new Error('Token invalide'))
  }
})

// ── Map userId → Set<socketId> pour envoi ciblé ─────────────────────────────
const userSockets = new Map()  // userId (number) → Set<string>

function userRoom(userId) { return `user:${userId}` }

// ── Présence en ligne ─────────────────────────────────────────────────────────
// userId → { name, role, connectedAt }
const onlineUsers = new Map()

function broadcastPresence() {
  const list = [...onlineUsers.entries()].map(([id, info]) => ({
    id, name: info.name, role: info.role,
  }))
  io.to('all').emit('presence:update', list)
}

io.on('connection', (socket) => {
  const name = socket.user?.name ?? socket.id
  const userId = socket.user?.id
  const role = socket.user?.role ?? 'student'
  console.log(`[WS] + ${name}`)

  // Rejoindre les salles promo pour les broadcasts cibles
  if (socket.user?.promo_id) {
    socket.join(`promo:${socket.user.promo_id}`)
  } else if (socket.user?.type === 'teacher' || socket.user?.type === 'ta') {
    // Les profs/intervenants rejoignent TOUTES les promos pour recevoir les messages
    try {
      const promos = queries.getPromotions?.() ?? []
      for (const p of promos) socket.join(`promo:${p.id}`)
    } catch { /* pas critique */ }
  }
  socket.join('all')

  // Salle personnelle pour envoi ciblé (DMs, typing DM)
  if (userId != null) {
    socket.join(userRoom(userId))
    if (!userSockets.has(userId)) userSockets.set(userId, new Set())
    userSockets.get(userId).add(socket.id)

    // Tracker la présence
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, { name, role, connectedAt: Date.now() })
    }
    broadcastPresence()
  }

  // Envoyer la liste actuelle au nouveau connecté
  socket.emit('presence:update', [...onlineUsers.entries()].map(([id, info]) => ({
    id, name: info.name, role: info.role,
  })))

  // Live quiz : rejoindre/quitter une salle de session
  socket.on('live:join', ({ promoId }) => {
    if (promoId) socket.join(`live:${promoId}`)
  })
  socket.on('live:leave', ({ promoId }) => {
    if (promoId) socket.leave(`live:${promoId}`)
  })

  // REX : rejoindre/quitter une salle de session
  socket.on('rex:join', ({ promoId }) => {
    if (promoId) socket.join(`rex:${promoId}`)
  })
  socket.on('rex:leave', ({ promoId }) => {
    if (promoId) socket.leave(`rex:${promoId}`)
  })

  // Indicateur de frappe
  socket.on('typing', ({ channelId, dmStudentId, dmPeerId }) => {
    if (channelId) {
      // Canal - envoyer à la promo du canal
      socket.to('all').emit('typing', { channelId, userName: socket.user?.name })
    } else if (dmStudentId) {
      // DM - envoyer aux deux participants (IDs négatifs pour profs, positifs pour étudiants)
      socket.to(userRoom(dmStudentId)).emit('typing', { dmStudentId, userName: socket.user?.name })
      const peer = dmPeerId ?? socket.user?.id
      if (peer && peer !== dmStudentId) {
        socket.to(userRoom(peer)).emit('typing', { dmStudentId, userName: socket.user?.name })
      }
    }
  })

  socket.on('disconnect', () => {
    console.log(`[WS] - ${name}`)
    if (userId != null && userSockets.has(userId)) {
      userSockets.get(userId).delete(socket.id)
      if (userSockets.get(userId).size === 0) {
        userSockets.delete(userId)
        onlineUsers.delete(userId)
        broadcastPresence()
      }
    }
  })
})

// ── Initialisation DB ─────────────────────────────────────────────────────────
queries.init()
console.log('[DB] Base de données initialisée')

// ── Timer : envoi des annonces planifiées (toutes les 30s) ─────────────────
const _scheduledTimer = setInterval(() => {
  try {
    const { getDueScheduledMessages, markScheduledSent } = require('./db/models/admin')
    const due = getDueScheduledMessages()
    for (const sm of due) {
      try {
        queries.sendMessage({
          channelId: sm.channel_id, authorName: sm.author_name,
          authorType: sm.author_type, content: sm.content,
        })
        markScheduledSent(sm.id)
        // Envoi ciblé à la promo du canal
        const { getDb } = require('./db/connection')
        const ch = getDb().prepare('SELECT promo_id FROM channels WHERE id = ?').get(sm.channel_id)
        if (ch) io.to(`promo:${ch.promo_id}`).emit('msg:new', {
          channelId: sm.channel_id, authorName: sm.author_name,
          promoId: ch.promo_id,
          preview: sm.content.replace(/[*_`>#[\]!]/g, '').slice(0, 80),
        })
        console.log(`[Scheduled] Message #${sm.id} envoyé dans canal ${sm.channel_id}`)
      } catch (err) {
        console.error(`[Scheduled] Erreur envoi #${sm.id}:`, err.message)
      }
    }
  } catch (err) { log.error('scheduled_messages_failed', { error: err.message }) }
}, 30000)

// ── Démarrage ─────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`[Cursus] Serveur démarré → http://localhost:${PORT}`)
})

// ── Arrêt gracieux ────────────────────────────────────────────────────────────
function shutdown() {
  console.log('[Cursus] Arrêt en cours...')
  clearInterval(_scheduledTimer)
  server.close(() => {
    try { queries.close() } catch {}
    process.exit(0)
  })
}
process.on('SIGTERM', shutdown)
process.on('SIGINT',  shutdown)
