// ─── Routes administration ────────────────────────────────────────────────────
const router  = require('express').Router()
const queries = require('../../src/db/index')
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

  const pm2Raw = run('pm2 jlist 2>/dev/null')
  let pm2 = []
  if (pm2Raw) {
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
      swap, disk, pm2,
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
    const { getDb } = require('../../src/db/connection')
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
    const { getDb } = require('../../src/db/connection')
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
    const { getDb } = require('../../src/db/connection')
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
    const { getDb } = require('../../src/db/connection')
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
    const { getDb } = require('../../src/db/connection')
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
    const { getDb } = require('../../src/db/connection')
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
    const { getDb } = require('../../src/db/connection')
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
    const { getDb } = require('../../src/db/connection')
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

module.exports = router
