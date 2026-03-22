/**
 * Routes admin — Déploiement (git status, git pull, docker rebuild, nginx)
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

router.get('/deploy-info', (req, res) => {
  res.json({ ok: true, data: { isDocker, hasGit: fs.existsSync(path.join(ROOT, '.git')) } })
})

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

module.exports = router
