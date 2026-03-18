// ─── Serveur Express + Socket.io — CeSlack ────────────────────────────────────
require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const express    = require('express')
const http       = require('http')
const { Server } = require('socket.io')
const cors       = require('cors')
const jwt        = require('jsonwebtoken')
const queries    = require('../src/db/index')

const PORT   = process.env.PORT       ?? 3001
const SECRET = process.env.JWT_SECRET ?? 'changeme-dev-secret'
const ORIGIN = process.env.CORS_ORIGIN ?? '*'

const app    = express()
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

// ── Fichiers uploadés — servis sans auth (UUID suffisamment sécurisé) ─────────
const path     = require('path')
const fs       = require('fs')
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'uploads')
  : path.join(__dirname, '../uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })
app.use('/uploads', express.static(UPLOAD_DIR))

// ── Route upload (nécessite auth — montée APRÈS authMiddleware global) ─────────
app.use('/api/files', require('./routes/files'))

// ── Web app (SPA statique) ────────────────────────────────────────────────────
const path = require('path')
const WEB_DIST = path.join(__dirname, '../dist-web')
const fs = require('fs')
if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST))
  // Fallback SPA — toutes les routes non-API renvoient index.html
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(WEB_DIST, 'index.html'))
  })
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, version: '2.0.0' }))

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

io.on('connection', (socket) => {
  const name = socket.user?.name ?? socket.id
  console.log(`[WS] + ${name}`)

  // Rejoindre la salle de la promo pour les broadcasts ciblés
  if (socket.user?.promo_id) socket.join(`promo:${socket.user.promo_id}`)
  socket.join('all')

  socket.on('disconnect', () => console.log(`[WS] - ${name}`))
})

// ── Initialisation DB ─────────────────────────────────────────────────────────
queries.init()
console.log('[DB] Base de données initialisée')

// ── Démarrage ─────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`[CeSlack] Serveur démarré → http://localhost:${PORT}`)
})

// ── Arrêt gracieux ────────────────────────────────────────────────────────────
function shutdown() {
  console.log('[CeSlack] Arrêt en cours...')
  server.close(() => {
    try { queries.close() } catch {}
    process.exit(0)
  })
}
process.on('SIGTERM', shutdown)
process.on('SIGINT',  shutdown)
