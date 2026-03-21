// ─── Serveur Express + Socket.io — Cursus ─────────────────────────────────────
require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const express    = require('express')
const http       = require('http')
const { Server } = require('socket.io')
const cors       = require('cors')
const jwt        = require('jsonwebtoken')
const queries    = require('./db/index')

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

// Expose io et secret pour les routes
app.set('io', io)
app.set('jwtSecret', SECRET)

// ── Routes publiques (auth) ───────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'))

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
app.use('/api/admin',       require('./routes/admin'))

// ── Fichiers statiques & SPA ──────────────────────────────────────────────────
const path = require('path')
const fs   = require('fs')

// Fichiers uploadés — servis sans auth (nom UUID suffisamment sécurisé)
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'uploads')
  : path.join(__dirname, '../uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
app.use('/uploads', express.static(UPLOAD_DIR))

// Route upload (auth requise — montée après authMiddleware global /api)
app.use('/api/files', require('./routes/files'))

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  try {
    // Vérifier la connexion DB
    const { getDb } = require('./db/connection')
    getDb().prepare('SELECT 1').get()
    res.json({
      ok: true,
      version: '2.0.0',
      uptime: Math.floor(process.uptime()),
      connections: onlineUsers.size,
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    })
  } catch (err) {
    res.status(503).json({ ok: false, error: 'Base de données inaccessible', version: '2.0.0' })
  }
})

// ── Téléchargements (proxy GitHub Releases, sans exposer l'URL GitHub) ────────
app.use('/download', require('./routes/download'))

// ── Webhook de déploiement (pas d'auth JWT, validé par DEPLOY_SECRET) ─────────
app.use('/webhook/deploy', require('./routes/deploy'))

// ── Page admin monitoring ─────────────────────────────────────────────────────
app.get('/admin-monitor', (_req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.sendFile(path.join(__dirname, 'public/admin-monitor.html'))
})

// ── Landing page vitrine (page d'accueil) ──────────────────────────────────
const LANDING = path.join(__dirname, '../src/landing/index.html')
if (fs.existsSync(LANDING)) {
  app.get('/', (_req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.sendFile(LANDING)
  })
}

// ── SPA web — servie sous /app et en fallback ────────────────────────────────
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

  app.get(/^(?!\/api|\/socket\.io|\/uploads|\/health|\/$).*/, (_req, res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.sendFile(path.join(WEB_DIST, 'index.html'))
  })
}

// ── Socket.io — authentification ──────────────────────────────────────────────
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

  // Rejoindre la salle de la promo pour les broadcasts ciblés
  if (socket.user?.promo_id) socket.join(`promo:${socket.user.promo_id}`)
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

  // Indicateur de frappe
  socket.on('typing', ({ channelId, dmStudentId }) => {
    if (channelId) {
      // Canal — envoyer à la promo du canal
      socket.to('all').emit('typing', { channelId, userName: socket.user?.name })
    } else if (dmStudentId) {
      // DM — envoyer uniquement au destinataire
      socket.to(userRoom(dmStudentId)).emit('typing', { dmStudentId, userName: socket.user?.name })
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
  } catch {}
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
