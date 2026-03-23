// ─── Webhook de deploiement - appele par GitHub Actions ──────────────────────
const router = require('express').Router()
const { exec } = require('child_process')

const DEPLOY_SECRET = process.env.DEPLOY_SECRET
const COMPOSE_DIR   = process.env.COMPOSE_DIR ?? '/opt/cursus'

router.post('/', (req, res) => {
  const secret = req.headers['x-deploy-secret']
  if (!DEPLOY_SECRET || secret !== DEPLOY_SECRET) {
    console.warn('[Deploy] Tentative non autorisee depuis', req.ip)
    return res.status(403).json({ ok: false, error: 'Unauthorized' })
  }

  console.log('[Deploy] Deploiement declenche par webhook...')
  res.json({ ok: true, message: 'Deploiement en cours...' })

  const cmd = [
    'git -C /opt/cursus/repo pull origin main',
    'cp -r /opt/cursus/repo/src/landing/. /opt/cursus/landing/',
    'docker compose -f /opt/cursus/docker-compose.yml build --no-cache',
    'docker compose -f /opt/cursus/docker-compose.yml up -d --force-recreate',
    'docker image prune -f',
  ].join(' && ')

  const child = exec(cmd, { cwd: COMPOSE_DIR, timeout: 600_000 })

  child.stdout?.on('data', (data) => process.stdout.write(`[Deploy:out] ${data}`))
  child.stderr?.on('data', (data) => process.stderr.write(`[Deploy:err] ${data}`))
  child.on('close', (code) => {
    if (code === 0) {
      console.log('[Deploy] Deploiement termine avec succes')
    } else {
      console.error(`[Deploy] Deploiement echoue (code ${code})`)
    }
  })
})

module.exports = router
