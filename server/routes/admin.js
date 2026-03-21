// ─── Routes administration ────────────────────────────────────────────────────
const router  = require('express').Router()
const queries = require('../db/index')
const os      = require('os')
const fs      = require('fs')
const path    = require('path')
const { execSync } = require('child_process')

const ROOT = path.join(__dirname, '../..')

// ── Middleware : accès réservé aux enseignants ────────────────────────────────
function requireTeacher(req, res, next) {
  if (req.user?.type !== 'teacher')
    return res.status(403).json({ ok: false, error: 'Accès réservé aux enseignants.' })
  next()
}
router.use(requireTeacher)

// ── Helper: exécuter une commande shell en toute sécurité ─────────────────────
function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim() }
  catch { return null }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVEUR — métriques système (existant)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/monitor', (req, res) => {
  const cpus = os.cpus()
  const totalMem = os.totalmem()
  const freeMem  = os.freemem()
  const uptime   = os.uptime()

  const cpuTimes = cpus.reduce((acc, cpu) => {
    acc.user += cpu.times.user; acc.nice += cpu.times.nice
    acc.sys  += cpu.times.sys;  acc.idle += cpu.times.idle; acc.irq += cpu.times.irq
    return acc
  }, { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 })
  const cpuTotal = cpuTimes.user + cpuTimes.nice + cpuTimes.sys + cpuTimes.idle + cpuTimes.irq
  const cpuUsage = Math.round(((cpuTotal - cpuTimes.idle) / cpuTotal) * 100)

  const diskRaw = run('df -B1 / | tail -1')
  let disk = null
  if (diskRaw) {
    const parts = diskRaw.split(/\s+/)
    disk = { total: Number(parts[1]), used: Number(parts[2]), free: Number(parts[3]), percent: parseInt(parts[4]) }
  }

  const swapRaw = run("free -b | grep Swap")
  let swap = null
  if (swapRaw) {
    const parts = swapRaw.split(/\s+/)
    swap = { total: Number(parts[1]), used: Number(parts[2]), free: Number(parts[3]) }
  }

  // Docker containers
  const dockerRaw = run('docker ps --format "{{.Names}}\\t{{.Status}}\\t{{.Image}}\\t{{.Ports}}" 2>/dev/null')
  let docker = []
  if (dockerRaw) {
    docker = dockerRaw.split('\n').filter(Boolean).map(line => {
      const [name, status, image, ports] = line.split('\t')
      return { name, status, image, ports: ports || '' }
    })
  }

  // Fallback PM2 (si Docker n'est pas dispo)
  const pm2Raw = run('pm2 jlist 2>/dev/null')
  let pm2 = []
  if (pm2Raw && !docker.length) {
    try {
      pm2 = JSON.parse(pm2Raw).map(p => ({
        name: p.name, status: p.pm2_env?.status, cpu: p.monit?.cpu,
        memory: p.monit?.memory, uptime: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0,
        restart: p.pm2_env?.restart_time ?? 0, pid: p.pid,
      }))
    } catch {}
  }

  const gitCommit  = run(`git -C "${ROOT}" rev-parse --short HEAD`)
  const gitBranch  = run(`git -C "${ROOT}" rev-parse --abbrev-ref HEAD`)
  const gitMessage = run(`git -C "${ROOT}" log -1 --pretty=%s`)
  const gitDate    = run(`git -C "${ROOT}" log -1 --pretty=%ci`)

  const nginx    = run('systemctl is-active nginx')
  const fail2ban = run('systemctl is-active fail2ban')
  const sshd     = run('systemctl is-active sshd') || run('systemctl is-active ssh')
  const ufw      = run('ufw status | head -1')

  const f2bStatus = run('fail2ban-client status sshd 2>/dev/null')
  let bannedIPs = 0
  if (f2bStatus) {
    const match = f2bStatus.match(/Currently banned:\s+(\d+)/)
    if (match) bannedIPs = Number(match[1])
  }

  const certRaw = run('certbot certificates 2>/dev/null')
  let certs = []
  if (certRaw) {
    const blocks = certRaw.split('Certificate Name:').slice(1)
    certs = blocks.map(b => {
      const name   = b.split('\n')[0].trim()
      const expiry = b.match(/Expiry Date:\s*(.+?)\s*\(/)?.[1]
      const valid  = b.includes('VALID')
      return { name, expiry, valid }
    })
  }

  const loadAvg   = os.loadavg()
  const connCount = run("ss -s | grep estab | head -1")

  const dbPath = process.env.DB_PATH || path.join(ROOT, 'data', 'cursus.db')
  let dbSize = null
  try { dbSize = fs.statSync(dbPath).size } catch {}

  const logsDir = path.join(ROOT, 'logs')
  let logsSize = 0
  try {
    fs.readdirSync(logsDir).forEach(f => {
      try { logsSize += fs.statSync(path.join(logsDir, f)).size } catch {}
    })
  } catch {}

  res.json({
    ok: true,
    data: {
      timestamp: Date.now(),
      system: { hostname: os.hostname(), platform: os.platform(), arch: os.arch(), nodeVersion: process.version, uptime, loadAvg: loadAvg.map(l => Math.round(l * 100) / 100) },
      cpu: { cores: cpus.length, model: cpus[0]?.model, usage: cpuUsage },
      memory: { total: totalMem, used: totalMem - freeMem, free: freeMem, percent: Math.round(((totalMem - freeMem) / totalMem) * 100) },
      swap, disk, docker, pm2,
      git: { commit: gitCommit, branch: gitBranch, message: gitMessage, date: gitDate },
      services: { nginx, fail2ban, ssh: sshd, ufw },
      security: { bannedIPs, certs },
      connections: connCount,
      db: { size: dbSize },
      logs: { size: logsSize },
    },
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTIQUES applicatives
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/stats', (req, res) => {
  try {
    const stats = queries.getAdminStats()
    res.json({ ok: true, data: stats })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// GESTION DES UTILISATEURS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/users', (req, res) => {
  try {
    const { search, promo_id, type, page, limit } = req.query
    const data = queries.getAdminUsers({
      search, promo_id: promo_id ? Number(promo_id) : null,
      type: type || null, page: Number(page) || 1, limit: Number(limit) || 50,
    })
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.get('/users/:id', (req, res) => {
  try {
    const data = queries.getAdminUserDetail(Number(req.params.id))
    if (!data) return res.status(404).json({ ok: false, error: 'Utilisateur introuvable.' })
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.patch('/users/:id', (req, res) => {
  try {
    const { getDb } = require('../db/connection')
    const db = getDb()
    const userId = Number(req.params.id)
    const isTeacher = userId < 0
    const realId = Math.abs(userId)
    const { name, email, promo_id } = req.body

    if (isTeacher) {
      const updates = []
      const params = []
      if (name)  { updates.push('name = ?');  params.push(name.trim()) }
      if (email) { updates.push('email = ?'); params.push(email.trim().toLowerCase()) }
      if (!updates.length) return res.json({ ok: true, data: null })
      params.push(realId)
      db.prepare(`UPDATE teachers SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    } else {
      const updates = []
      const params = []
      if (name)     { updates.push('name = ?');     params.push(name.trim()) }
      if (email)    { updates.push('email = ?');    params.push(email.trim().toLowerCase()) }
      if (promo_id) { updates.push('promo_id = ?'); params.push(Number(promo_id)) }
      if (name) {
        const initials = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
        updates.push('avatar_initials = ?')
        params.push(initials)
      }
      if (!updates.length) return res.json({ ok: true, data: null })
      params.push(realId)
      db.prepare(`UPDATE students SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    }

    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.post('/users/:id/reset-password', (req, res) => {
  try {
    const { getDb } = require('../db/connection')
    const bcrypt = require('bcryptjs')
    const crypto = require('crypto')
    const db = getDb()
    const userId = Number(req.params.id)
    const isTeacher = userId < 0
    const realId = Math.abs(userId)

    const tempPwd = crypto.randomBytes(12).toString('base64url')
    const hashed  = bcrypt.hashSync(tempPwd, 10)
    const table   = isTeacher ? 'teachers' : 'students'

    db.prepare(`UPDATE ${table} SET password = ?, must_change_password = 1 WHERE id = ?`)
      .run(hashed, realId)

    res.json({ ok: true, data: { tempPassword: tempPwd } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.delete('/users/:id', (req, res) => {
  try {
    const { getDb } = require('../db/connection')
    const db = getDb()
    const userId = Number(req.params.id)
    const isTeacher = userId < 0
    const realId = Math.abs(userId)

    if (isTeacher) {
      const t = db.prepare('SELECT role FROM teachers WHERE id = ?').get(realId)
      if (!t) return res.status(404).json({ ok: false, error: 'Utilisateur introuvable.' })
      if (t.role === 'teacher') return res.status(403).json({ ok: false, error: 'Impossible de supprimer un Responsable Pédagogique.' })
      db.prepare('DELETE FROM teachers WHERE id = ?').run(realId)
    } else {
      db.prepare('DELETE FROM students WHERE id = ?').run(realId)
    }

    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// MODÉRATION DE CONTENU
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/messages', (req, res) => {
  try {
    const { search, promo_id, channel_id, author, from, to, page, limit } = req.query
    const data = queries.getAdminMessages({
      search, promo_id: promo_id ? Number(promo_id) : null,
      channel_id: channel_id ? Number(channel_id) : null,
      author, from, to, page: Number(page) || 1, limit: Number(limit) || 50,
    })
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.delete('/messages/:id', (req, res) => {
  try {
    const { getDb } = require('../db/connection')
    const db = getDb()
    const id = Number(req.params.id)
    const msg = db.prepare('SELECT id, content, author_name, channel_id FROM messages WHERE id = ?').get(id)
    if (!msg) return res.status(404).json({ ok: false, error: 'Message introuvable.' })
    db.prepare('DELETE FROM messages WHERE id = ?').run(id)

    // Log audit si la table existe
    try {
      db.prepare(`
        INSERT INTO audit_log (actor_id, actor_name, actor_type, action, target, details, ip)
        VALUES (?, ?, ?, 'message.delete', ?, ?, ?)
      `).run(
        Math.abs(req.user.id), req.user.name, req.user.type,
        `message:${id}`,
        JSON.stringify({ content: msg.content.substring(0, 200), author: msg.author_name, reason: req.body?.reason || '' }),
        req.ip
      )
    } catch {}

    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.get('/channels', (req, res) => {
  try {
    const data = queries.getAdminChannels()
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// JOURNAL D'AUDIT
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/audit', (req, res) => {
  try {
    const { getDb } = require('../db/connection')
    const db = getDb()
    const { action, actor, from, to, page = 1, limit = 100 } = req.query
    const offset = ((Number(page) || 1) - 1) * (Number(limit) || 100)
    const params = []

    let sql = `SELECT * FROM audit_log WHERE 1=1`
    if (action) { sql += ` AND action = ?`;          params.push(action) }
    if (actor)  { sql += ` AND actor_name LIKE ?`;   params.push(`%${actor}%`) }
    if (from)   { sql += ` AND created_at >= ?`;     params.push(from) }
    if (to)     { sql += ` AND created_at <= ?`;     params.push(to) }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) AS total')
    const total = db.prepare(countSql).get(...params).total

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
    params.push(Number(limit) || 100, offset)

    const entries = db.prepare(sql).all(...params)
    res.json({ ok: true, data: { entries, total, page: Number(page) || 1, limit: Number(limit) || 100 } })
  } catch (err) {
    // Table n'existe pas encore (avant migration v18) — renvoyer vide
    res.json({ ok: true, data: { entries: [], total: 0, page: 1, limit: 100 } })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// SÉCURITÉ — tentatives de connexion
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/security', (req, res) => {
  try {
    const { getDb } = require('../db/connection')
    const db = getDb()

    const recentLogins = db.prepare(`
      SELECT * FROM login_attempts ORDER BY created_at DESC LIMIT 50
    `).all()

    const failedByEmail = db.prepare(`
      SELECT email, COUNT(*) AS fail_count
      FROM login_attempts
      WHERE success = 0 AND created_at >= datetime('now', '-1 day')
      GROUP BY email ORDER BY fail_count DESC LIMIT 20
    `).all()

    res.json({ ok: true, data: { recentLogins, failedByEmail } })
  } catch {
    // Table n'existe pas encore — renvoyer vide
    res.json({ ok: true, data: { recentLogins: [], failedByEmail: [] } })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// MAINTENANCE
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/reset-seed', (req, res) => {
  try {
    queries.resetAndSeed()
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.post('/backup', (req, res) => {
  try {
    const { getDb } = require('../db/connection')
    const db = getDb()
    const backupDir = path.join(ROOT, 'backups')
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupDir, `backup-${timestamp}.db`)
    db.backup(backupPath)

    const size = fs.statSync(backupPath).size
    res.json({ ok: true, data: { filename: path.basename(backupPath), size } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.get('/backups', (req, res) => {
  try {
    const backupDir = path.join(ROOT, 'backups')
    if (!fs.existsSync(backupDir)) return res.json({ ok: true, data: [] })

    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const stat = fs.statSync(path.join(backupDir, f))
        return { filename: f, size: stat.size, created: stat.mtime.toISOString() }
      })
      .sort((a, b) => b.created.localeCompare(a.created))

    res.json({ ok: true, data: files })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.delete('/backups/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename) // sanitize
    const filePath = path.join(ROOT, 'backups', filename)
    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: 'Fichier introuvable.' })
    fs.unlinkSync(filePath)
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.get('/db-info', (req, res) => {
  try {
    const { getDb } = require('../db/connection')
    const db = getDb()
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name
    `).all()

    const info = tables.map(t => {
      const count = db.prepare(`SELECT COUNT(*) AS count FROM "${t.name}"`).get().count
      return { name: t.name, rowCount: count }
    })

    res.json({ ok: true, data: info })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.post('/cleanup-logs', (req, res) => {
  try {
    const logsDir = path.join(ROOT, 'logs')
    if (!fs.existsSync(logsDir)) return res.json({ ok: true, data: { deleted: 0 } })

    let deleted = 0
    fs.readdirSync(logsDir).forEach(f => {
      const fp = path.join(logsDir, f)
      try { fs.unlinkSync(fp); deleted++ } catch {}
    })

    res.json({ ok: true, data: { deleted } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.post('/purge', (req, res) => {
  try {
    const { auditDays, loginDays, sessionDays } = req.body
    const data = queries.purgeOldData({
      auditDays: Number(auditDays) || 90,
      loginDays: Number(loginDays) || 30,
      sessionDays: Number(sessionDays) || 30,
    })
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNALEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/reports', (req, res) => {
  try {
    const { status, page, limit } = req.query
    const data = queries.getReports({
      status: status || null, page: Number(page) || 1, limit: Number(limit) || 50,
    })
    data.pendingCount = queries.getPendingReportsCount()
    res.json({ ok: true, data })
  } catch {
    res.json({ ok: true, data: { entries: [], total: 0, page: 1, limit: 50, pendingCount: 0 } })
  }
})

router.post('/reports/:id/resolve', (req, res) => {
  try {
    const { status } = req.body // 'reviewed' or 'dismissed'
    queries.resolveReport(Number(req.params.id), status || 'reviewed', req.user.name)
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// HEATMAP
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/heatmap', (req, res) => {
  try {
    const data = queries.getActivityHeatmap()
    res.json({ ok: true, data })
  } catch {
    res.json({ ok: true, data: [] })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// ANNONCES PLANIFIÉES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/scheduled', (req, res) => {
  try {
    const data = queries.getScheduledMessages()
    res.json({ ok: true, data })
  } catch {
    res.json({ ok: true, data: [] })
  }
})

router.post('/scheduled', (req, res) => {
  try {
    const { channelId, content, sendAt } = req.body
    if (!channelId || !content || !sendAt) {
      return res.status(400).json({ ok: false, error: 'channelId, content et sendAt requis.' })
    }
    queries.createScheduledMessage({
      channelId: Number(channelId),
      authorName: req.user.name,
      authorType: req.user.type,
      content,
      sendAt,
    })
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.delete('/scheduled/:id', (req, res) => {
  try {
    queries.deleteScheduledMessage(Number(req.params.id))
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// SESSIONS ACTIVES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/sessions', (req, res) => {
  try {
    const data = queries.getActiveSessions()
    res.json({ ok: true, data })
  } catch {
    res.json({ ok: true, data: [] })
  }
})

router.delete('/sessions/:id', (req, res) => {
  try {
    queries.revokeSession(Number(req.params.id))
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.post('/sessions/revoke-user', (req, res) => {
  try {
    const { userId } = req.body
    queries.revokeUserSessions(Number(userId))
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// MODE LECTURE SEULE + ARCHIVAGE
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/config', (req, res) => {
  try {
    const readOnly = queries.getAppConfig('read_only')
    res.json({ ok: true, data: { read_only: readOnly === '1' } })
  } catch {
    res.json({ ok: true, data: { read_only: false } })
  }
})

router.post('/config', (req, res) => {
  try {
    const { key, value } = req.body
    const allowed = ['read_only']
    if (!allowed.includes(key)) return res.status(400).json({ ok: false, error: 'Clé non autorisée.' })
    queries.setAppConfig(key, value)
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.post('/promos/:id/archive', (req, res) => {
  try {
    const { archived } = req.body
    queries.togglePromoArchive(Number(req.params.id), archived)
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// DÉPLOIEMENT — Git & PM2
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/git-status', (req, res) => {
  try {
    const commit  = run(`git -C "${ROOT}" rev-parse --short HEAD`)
    const branch  = run(`git -C "${ROOT}" rev-parse --abbrev-ref HEAD`)
    const message = run(`git -C "${ROOT}" log -1 --pretty=%s`)
    const date    = run(`git -C "${ROOT}" log -1 --pretty=%ci`)

    // Vérifier si des mises à jour sont disponibles
    run(`git -C "${ROOT}" fetch --quiet 2>/dev/null`)
    const behind = run(`git -C "${ROOT}" rev-list --count HEAD..@{u}`) || '0'
    const ahead  = run(`git -C "${ROOT}" rev-list --count @{u}..HEAD`) || '0'
    const status  = run(`git -C "${ROOT}" status --porcelain`)

    res.json({ ok: true, data: {
      commit, branch, message, date,
      behind: Number(behind), ahead: Number(ahead),
      dirty: !!status,
      statusText: status || '',
    }})
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.post('/git-pull', (req, res) => {
  try {
    const output = execSync(`git -C "${ROOT}" pull --ff-only 2>&1`, { encoding: 'utf8', timeout: 30000 }).trim()
    res.json({ ok: true, data: { output } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.stderr || err.stdout || err.message })
  }
})

router.post('/docker-rebuild', (req, res) => {
  try {
    const output = execSync(
      'cd /opt/cursus && docker compose build --no-cache 2>&1 && docker compose up -d --force-recreate 2>&1 && docker image prune -f 2>&1',
      { encoding: 'utf8', timeout: 300000 },
    ).trim()
    res.json({ ok: true, data: { output } })
  } catch (err) {
    const msg = (err.stderr || err.stdout || err.message || '').replace(/\x1B\[[0-9;]*m/g, '')
    res.status(500).json({ ok: false, error: msg })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// NGINX — Appliquer la config et recharger
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/server-info', (req, res) => {
  res.json({ ok: true, data: {
    rootDir: ROOT,
    cwd: process.cwd(),
    nodeVersion: process.version,
    platform: os.platform(),
    hostname: os.hostname(),
    nginxConf: fs.existsSync(path.join(ROOT, 'nginx.conf')),
  }})
})

router.post('/nginx-apply', (req, res) => {
  try {
    const confSrc = path.join(ROOT, 'nginx.conf')
    if (!fs.existsSync(confSrc)) {
      return res.status(404).json({ ok: false, error: `nginx.conf introuvable dans ${ROOT}` })
    }

    const steps = []

    // 1. Copier la config
    const cpOut = execSync(`sudo cp "${confSrc}" /etc/nginx/sites-available/cursus 2>&1`, { encoding: 'utf8', timeout: 5000 }).trim()
    steps.push('cp: ' + (cpOut || 'OK'))

    // 2. Activer le site
    const lnOut = execSync('sudo ln -sf /etc/nginx/sites-available/cursus /etc/nginx/sites-enabled/cursus 2>&1', { encoding: 'utf8', timeout: 5000 }).trim()
    steps.push('ln: ' + (lnOut || 'OK'))

    // 3. Tester la config
    const testOut = execSync('sudo nginx -t 2>&1', { encoding: 'utf8', timeout: 5000 }).trim()
    steps.push('test: ' + testOut)

    // 4. Recharger
    const reloadOut = execSync('sudo systemctl reload nginx 2>&1', { encoding: 'utf8', timeout: 5000 }).trim()
    steps.push('reload: ' + (reloadOut || 'OK'))

    res.json({ ok: true, data: { steps } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.stderr || err.stdout || err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK ÉTUDIANTS
// ═══════════════════════════════════════════════════════════════════════════════

// Soumettre un feedback (accessible à tous les utilisateurs connectés)
router.post('/feedback', (req, res) => {
  try {
    const { type, title, description } = req.body
    if (!title?.trim()) return res.status(400).json({ ok: false, error: 'Le titre est requis.' })
    if (!['bug', 'improvement', 'question'].includes(type)) return res.status(400).json({ ok: false, error: 'Type invalide.' })
    const id = queries.createFeedback({
      userId: Math.abs(req.user.id),
      userName: req.user.name,
      userType: req.user.type,
      type, title: title.trim(), description: (description || '').trim(),
    })
    res.json({ ok: true, data: { id } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Lister les feedbacks (admin)
router.get('/feedback', (req, res) => {
  try {
    const { status, type, limit, offset } = req.query
    const data = queries.getFeedbackList({
      status: status || null,
      type: type || null,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    })
    const stats = queries.getFeedbackStats()
    res.json({ ok: true, data: { ...data, stats } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Mes feedbacks (utilisateur connecté)
router.get('/feedback/mine', (req, res) => {
  try {
    const data = queries.getUserFeedback(Math.abs(req.user.id))
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Stats feedback
router.get('/feedback/stats', (req, res) => {
  try {
    const data = queries.getFeedbackStats()
    res.json({ ok: true, data })
  } catch (err) {
    res.json({ ok: true, data: { open: 0, in_progress: 0, resolved: 0, total: 0 } })
  }
})

// Mettre à jour le statut d'un feedback (admin)
router.post('/feedback/:id/status', (req, res) => {
  try {
    const { status, adminReply } = req.body
    if (!['open', 'in_progress', 'resolved', 'wontfix'].includes(status)) {
      return res.status(400).json({ ok: false, error: 'Statut invalide.' })
    }
    queries.updateFeedbackStatus(Number(req.params.id), status, adminReply)
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// IMPORT DONNÉES — Examens, Rappels, Seed complet
// ═══════════════════════════════════════════════════════════════════════════════

// Helper : trouver une promo par nom (exact ou partiel) — NE PAS créer
function findPromo(db, name) {
  // Recherche exacte
  let promo = db.prepare('SELECT id FROM promotions WHERE name = ?').get(name)
  if (promo) return promo.id
  // Recherche partielle (le nom contient le terme ou inversement)
  promo = db.prepare('SELECT id FROM promotions WHERE name LIKE ? OR ? LIKE \'%\' || name || \'%\' ORDER BY id LIMIT 1').get(`%${name}%`, name)
  if (promo) return promo.id
  return null
}

// Helper : trouver ou créer une promo par nom (fallback si introuvable)
function getOrCreatePromo(db, name, color) {
  const existing = findPromo(db, name)
  if (existing) return existing
  const id = db.prepare('INSERT INTO promotions (name, color) VALUES (?, ?)').run(name, color || '#4A90D9').lastInsertRowid
  db.prepare("INSERT INTO channels (promo_id, name, description, type) VALUES (?, 'annonces', 'Informations importantes', 'annonce')").run(id)
  db.prepare("INSERT INTO channels (promo_id, name, description, type) VALUES (?, 'general', 'Canal principal', 'chat')").run(id)
  return id
}

// Helper : trouver ou créer un canal par catégorie dans une promo
function getOrCreateChannel(db, promoId, project) {
  let ch = db.prepare('SELECT id FROM channels WHERE promo_id = ? AND category = ?').get(promoId, project)
  if (ch) return ch.id
  const chName = project.toLowerCase().replace(/[^a-z0-9àâéèêëïîôùûüç]+/g, '-').replace(/^-|-$/g, '')
  return db.prepare("INSERT INTO channels (promo_id, name, description, type, category) VALUES (?, ?, ?, 'chat', ?)").run(
    promoId, chName, 'Canal ' + project, project
  ).lastInsertRowid
}

// Import examens par nom de promo
router.post('/import-examens', (req, res) => {
  try {
    const { promoName, promoTag } = req.body
    if (!promoName || !promoTag) return res.status(400).json({ ok: false, error: 'promoName et promoTag requis.' })

    const path = require('path')
    const fs = require('fs')
    const dataPath = path.join(__dirname, '..', 'data', 'examens-data.json')
    if (!fs.existsSync(dataPath)) return res.status(404).json({ ok: false, error: 'examens-data.json introuvable.' })

    const { getDb } = require('../db/connection')
    const db = getDb()
    const promoId = getOrCreatePromo(db, promoName)

    const examens = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
    const filtered = examens.filter(e => e.promoTag === promoTag)
    if (!filtered.length) return res.json({ ok: true, data: { imported: 0, message: 'Aucun examen pour ' + promoTag } })

    let imported = 0
    const insert = db.prepare(`
      INSERT INTO travaux (promo_id, channel_id, title, description, type, category, deadline, start_date, published, requires_submission, room)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NULL)
    `)

    for (const e of filtered) {
      const channelId = getOrCreateChannel(db, promoId, e.project)
      const deadline = e.date ? e.date + 'T' + (e.hDebut ? e.hDebut.replace('h', ':') : '23:59') + ':00' : null
      if (!deadline) continue
      const existing = db.prepare('SELECT id FROM travaux WHERE channel_id = ? AND title = ? AND deadline LIKE ?').get(channelId, e.title, e.date + '%')
      if (existing) continue
      insert.run(promoId, channelId, e.title, e.description, e.type, e.project, deadline, null)
      imported++
    }

    res.json({ ok: true, data: { imported, total: filtered.length, promoId, message: `${imported} examens importés dans "${promoName}".` } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Seed complet : crée les promos + canaux + importe examens + rappels
router.post('/seed-promos', (req, res) => {
  try {
    const path = require('path')
    const fs = require('fs')
    const { getDb } = require('../db/connection')
    const db = getDb()
    const results = []

    // ── Promos à créer ──
    const PROMOS = [
      { name: 'CPI A2 Informatique', tag: 'CPIA2', color: '#4A90D9', blocs: [
        'Systèmes embarqués', 'Conception et programmation objet', 'Réseaux et Système', 'Développement web'
      ]},
      { name: 'FISA Informatique A4', tag: 'FISA4', color: '#7B5EA7', blocs: [
        'Big data', 'IoT', 'Intelligence Artificielle', 'Développement web avancé', 'Anglais'
      ]},
    ]

    for (const p of PROMOS) {
      const existingId = findPromo(db, p.name)
      const promoId = existingId || getOrCreatePromo(db, p.name, p.color)
      results.push(existingId
        ? `Promo "${p.name}" trouvée → ID ${promoId} (existante)`
        : `Promo "${p.name}" créée → ID ${promoId}`)

      // Créer les canaux par bloc
      for (const bloc of p.blocs) {
        getOrCreateChannel(db, promoId, bloc)
      }
      results.push(`  ${p.blocs.length} canaux de projet créés`)

      // Import examens
      const examPath = path.join(__dirname, '..', 'data', 'examens-data.json')
      if (fs.existsSync(examPath)) {
        const examens = JSON.parse(fs.readFileSync(examPath, 'utf8'))
        const filtered = examens.filter(e => e.promoTag === p.tag)
        let exImported = 0
        const insert = db.prepare(`
          INSERT INTO travaux (channel_id, title, description, type, category, deadline, start_date, published, requires_submission, room)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, NULL)
        `)
        for (const e of filtered) {
          const channelId = getOrCreateChannel(db, promoId, e.project)
          const deadline = e.date ? e.date + 'T' + (e.hDebut ? e.hDebut.replace('h', ':') : '23:59') + ':00' : null
          if (!deadline) continue
          const existing = db.prepare('SELECT id FROM travaux WHERE channel_id = ? AND title = ? AND deadline LIKE ?').get(channelId, e.title, e.date + '%')
          if (existing) continue
          insert.run(promoId, channelId, e.title, e.description, e.type, e.project, deadline, null)
          exImported++
        }
        results.push(`  ${exImported} examens importés`)
      }
    }

    // Import rappels
    const rappelsPath = path.join(__dirname, '..', 'data', 'rappels-data.json')
    if (fs.existsSync(rappelsPath)) {
      const rappels = JSON.parse(fs.readFileSync(rappelsPath, 'utf8'))
      db.prepare('DELETE FROM teacher_reminders').run()
      const insertR = db.prepare('INSERT INTO teacher_reminders (promo_tag, date, title, description, bloc) VALUES (?, ?, ?, ?, ?)')
      for (const r of rappels) insertR.run(r.promoTag, r.date, r.title, r.description, r.bloc)
      results.push(`${rappels.length} rappels prof importés`)
    }

    // Lister les promos
    const allPromos = db.prepare('SELECT id, name FROM promotions').all()

    res.json({ ok: true, data: { steps: results, promos: allPromos } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Lister les promos (pour les selects)
router.get('/promos-list', (req, res) => {
  try {
    const { getDb } = require('../db/connection')
    const promos = getDb().prepare('SELECT id, name, color FROM promotions ORDER BY name').all()
    res.json({ ok: true, data: promos })
  } catch { res.json({ ok: true, data: [] }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
// RAPPELS PROF (ÉCHÉANCIER SCOLARITÉ)
// ═══════════════════════════════════════════════════════════════════════════════

// Importer les rappels depuis le JSON
router.post('/import-rappels', (req, res) => {
  try {
    const path = require('path')
    const fs = require('fs')
    const dataPath = path.join(__dirname, '..', 'data', 'rappels-data.json')
    if (!fs.existsSync(dataPath)) return res.status(404).json({ ok: false, error: 'rappels-data.json introuvable.' })

    const rappels = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
    const { getDb } = require('../db/connection')
    const db = getDb()

    let imported = 0
    const insert = db.prepare('INSERT INTO teacher_reminders (promo_tag, date, title, description, bloc) VALUES (?, ?, ?, ?, ?)')

    // Supprimer les anciens rappels avant import
    db.prepare('DELETE FROM teacher_reminders').run()

    for (const r of rappels) {
      insert.run(r.promoTag, r.date, r.title, r.description, r.bloc)
      imported++
    }

    res.json({ ok: true, data: { imported, message: `${imported} rappels importés.` } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Lister les rappels (pour le dashboard prof)
router.get('/rappels', (req, res) => {
  try {
    const { getDb } = require('../db/connection')
    const db = getDb()
    const rappels = db.prepare('SELECT * FROM teacher_reminders ORDER BY date ASC').all()
    res.json({ ok: true, data: rappels })
  } catch (err) {
    res.json({ ok: true, data: [] })
  }
})

// Marquer un rappel comme fait
router.post('/rappels/:id/done', (req, res) => {
  try {
    const { done } = req.body
    const { getDb } = require('../db/connection')
    getDb().prepare('UPDATE teacher_reminders SET done = ? WHERE id = ?').run(done ? 1 : 0, Number(req.params.id))
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

module.exports = router
