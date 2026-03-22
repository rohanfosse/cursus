/**
 * Routes admin — Monitoring système (CPU, RAM, disque, Docker, Git, services)
 * Compatible bare-metal et Docker
 */
const router = require('express').Router()
const os     = require('os')
const fs     = require('fs')
const path   = require('path')
const { execSync } = require('child_process')

const ROOT = path.join(__dirname, '../../..')

const isDocker = fs.existsSync('/.dockerenv') || process.env.DOCKER === '1'

function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim() }
  catch { return null }
}

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

  // ── Infos spécifiques Docker vs bare-metal ──

  let docker = []
  let pm2 = []
  let services = null
  let security = { bannedIPs: 0, certs: [] }
  let connections = null

  if (isDocker) {
    // En Docker : pas de systemctl, certbot, docker ps, pm2, fail2ban
    // On expose les métriques du process Node à la place
  } else {
    // Docker containers (depuis l'hôte)
    const dockerRaw = run('docker ps --format "{{.Names}}\\t{{.Status}}\\t{{.Image}}\\t{{.Ports}}" 2>/dev/null')
    if (dockerRaw) {
      docker = dockerRaw.split('\n').filter(Boolean).map(line => {
        const [name, status, image, ports] = line.split('\t')
        return { name, status, image, ports: ports || '' }
      })
    }

    // Fallback PM2
    const pm2Raw = run('pm2 jlist 2>/dev/null')
    if (pm2Raw && !docker.length) {
      try {
        pm2 = JSON.parse(pm2Raw).map(p => ({
          name: p.name, status: p.pm2_env?.status, cpu: p.monit?.cpu,
          memory: p.monit?.memory, uptime: p.pm2_env?.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : 0,
          restart: p.pm2_env?.restart_time ?? 0, pid: p.pid,
        }))
      } catch {}
    }

    // Services système
    const nginx    = run('systemctl is-active nginx')
    const fail2ban = run('systemctl is-active fail2ban')
    const sshd     = run('systemctl is-active sshd') || run('systemctl is-active ssh')
    const ufw      = run('ufw status | head -1')
    services = { nginx, fail2ban, ssh: sshd, ufw }

    // Fail2ban bans
    const f2bStatus = run('fail2ban-client status sshd 2>/dev/null')
    if (f2bStatus) {
      const match = f2bStatus.match(/Currently banned:\s+(\d+)/)
      if (match) security.bannedIPs = Number(match[1])
    }

    // SSL
    const certRaw = run('certbot certificates 2>/dev/null')
    if (certRaw) {
      const blocks = certRaw.split('Certificate Name:').slice(1)
      security.certs = blocks.map(b => {
        const name   = b.split('\n')[0].trim()
        const expiry = b.match(/Expiry Date:\s*(.+?)\s*\(/)?.[1]
        const valid  = b.includes('VALID')
        return { name, expiry, valid }
      })
    }

    connections = run("ss -s | grep estab | head -1")
  }

  // Git (disponible si .git existe)
  const hasGit = fs.existsSync(path.join(ROOT, '.git'))
  const gitCommit  = hasGit ? run(`git -C "${ROOT}" rev-parse --short HEAD`) : null
  const gitBranch  = hasGit ? run(`git -C "${ROOT}" rev-parse --abbrev-ref HEAD`) : null
  const gitMessage = hasGit ? run(`git -C "${ROOT}" log -1 --pretty=%s`) : null
  const gitDate    = hasGit ? run(`git -C "${ROOT}" log -1 --pretty=%ci`) : null

  const loadAvg = os.loadavg()

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

  // Process Node (utile en Docker)
  const memUsage = process.memoryUsage()
  const processInfo = {
    pid: process.pid,
    uptime: Math.floor(process.uptime()),
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    rss: memUsage.rss,
    external: memUsage.external,
  }

  // Socket.io connections count
  let socketCount = 0
  try {
    const io = req.app.get('io')
    if (io) socketCount = io.engine?.clientsCount ?? 0
  } catch {}

  res.json({
    ok: true,
    data: {
      timestamp: Date.now(),
      isDocker,
      system: { hostname: os.hostname(), platform: os.platform(), arch: os.arch(), nodeVersion: process.version, uptime, loadAvg: loadAvg.map(l => Math.round(l * 100) / 100) },
      cpu: { cores: cpus.length, model: cpus[0]?.model, usage: cpuUsage },
      memory: { total: totalMem, used: totalMem - freeMem, free: freeMem, percent: Math.round(((totalMem - freeMem) / totalMem) * 100) },
      swap, disk,
      docker, pm2,
      git: { commit: gitCommit, branch: gitBranch, message: gitMessage, date: gitDate },
      services,
      security,
      connections,
      db: { size: dbSize },
      logs: { size: logsSize },
      process: processInfo,
      socketConnections: socketCount,
      env: isDocker ? { NODE_ENV: process.env.NODE_ENV, PORT: process.env.PORT, DB_PATH: process.env.DB_PATH } : null,
    },
  })
})

module.exports = router
