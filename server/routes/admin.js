// ─── Routes administration ────────────────────────────────────────────────────
const router  = require('express').Router()
const queries = require('../../src/db/index')
const os      = require('os')
const fs      = require('fs')
const path    = require('path')
const { execSync } = require('child_process')

// POST /api/admin/reset-seed
router.post('/reset-seed', (req, res) => {
  try {
    queries.resetAndSeed()
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── Helper: exécuter une commande shell en toute sécurité ─────────────────────
function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim() }
  catch { return null }
}

// GET /api/admin/monitor — métriques système complètes
router.get('/monitor', (req, res) => {
  if (req.user?.type !== 'teacher') {
    return res.status(403).json({ ok: false, error: 'Accès réservé aux enseignants.' })
  }

  const cpus = os.cpus()
  const totalMem = os.totalmem()
  const freeMem  = os.freemem()
  const uptime   = os.uptime()

  // CPU usage (average across cores)
  const cpuTimes = cpus.reduce((acc, cpu) => {
    acc.user   += cpu.times.user
    acc.nice   += cpu.times.nice
    acc.sys    += cpu.times.sys
    acc.idle   += cpu.times.idle
    acc.irq    += cpu.times.irq
    return acc
  }, { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 })
  const cpuTotal = cpuTimes.user + cpuTimes.nice + cpuTimes.sys + cpuTimes.idle + cpuTimes.irq
  const cpuUsage = Math.round(((cpuTotal - cpuTimes.idle) / cpuTotal) * 100)

  // Disk usage
  const diskRaw = run('df -B1 / | tail -1')
  let disk = null
  if (diskRaw) {
    const parts = diskRaw.split(/\s+/)
    disk = {
      total:   Number(parts[1]),
      used:    Number(parts[2]),
      free:    Number(parts[3]),
      percent: parseInt(parts[4]),
    }
  }

  // Swap
  const swapRaw = run("free -b | grep Swap")
  let swap = null
  if (swapRaw) {
    const parts = swapRaw.split(/\s+/)
    swap = { total: Number(parts[1]), used: Number(parts[2]), free: Number(parts[3]) }
  }

  // PM2 processes
  const pm2Raw = run('pm2 jlist 2>/dev/null')
  let pm2 = []
  if (pm2Raw) {
    try {
      pm2 = JSON.parse(pm2Raw).map(p => ({
        name:    p.name,
        status:  p.pm2_env?.status,
        cpu:     p.monit?.cpu,
        memory:  p.monit?.memory,
        uptime:  p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0,
        restart: p.pm2_env?.restart_time ?? 0,
        pid:     p.pid,
      }))
    } catch {}
  }

  // Git info
  const ROOT = path.join(__dirname, '../..')
  const gitCommit  = run(`git -C ${ROOT} rev-parse --short HEAD`)
  const gitBranch  = run(`git -C ${ROOT} rev-parse --abbrev-ref HEAD`)
  const gitMessage = run(`git -C ${ROOT} log -1 --pretty=%s`)
  const gitDate    = run(`git -C ${ROOT} log -1 --pretty=%ci`)

  // Services status
  const nginx    = run('systemctl is-active nginx')
  const fail2ban = run('systemctl is-active fail2ban')
  const sshd     = run('systemctl is-active sshd') || run('systemctl is-active ssh')
  const ufw      = run('ufw status | head -1')

  // Fail2ban banned IPs
  const f2bStatus = run('fail2ban-client status sshd 2>/dev/null')
  let bannedIPs = 0
  if (f2bStatus) {
    const match = f2bStatus.match(/Currently banned:\s+(\d+)/)
    if (match) bannedIPs = Number(match[1])
  }

  // SSL certificates
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

  // Load average
  const loadAvg = os.loadavg()

  // Network connections count
  const connCount = run("ss -s | grep estab | head -1")

  // DB size
  const dbPath = path.join(ROOT, 'data', 'cursus.db')
  let dbSize = null
  try { dbSize = fs.statSync(dbPath).size } catch {}

  // Logs size
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
      system: {
        hostname:  os.hostname(),
        platform:  os.platform(),
        arch:      os.arch(),
        nodeVersion: process.version,
        uptime,
        loadAvg: loadAvg.map(l => Math.round(l * 100) / 100),
      },
      cpu: { cores: cpus.length, model: cpus[0]?.model, usage: cpuUsage },
      memory: {
        total: totalMem,
        used:  totalMem - freeMem,
        free:  freeMem,
        percent: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      swap,
      disk,
      pm2,
      git: { commit: gitCommit, branch: gitBranch, message: gitMessage, date: gitDate },
      services: { nginx, fail2ban, ssh: sshd, ufw },
      security: { bannedIPs, certs },
      connections: connCount,
      db: { size: dbSize },
      logs: { size: logsSize },
    },
  })
})

module.exports = router
