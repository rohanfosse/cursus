// ─── Webhook de déploiement — appelé par GitHub Actions ──────────────────────
const router = require('express').Router()
const { exec } = require('child_process')
const path    = require('path')

const DEPLOY_SECRET = process.env.DEPLOY_SECRET
const ROOT_DIR      = path.join(__dirname, '../..')

router.post('/', (req, res) => {
  const secret = req.headers['x-deploy-secret']
  if (!DEPLOY_SECRET || secret !== DEPLOY_SECRET) {
    console.warn('[Deploy] Tentative non autorisée depuis', req.ip)
    return res.status(403).json({ ok: false, error: 'Unauthorized' })
  }

  console.log('[Deploy] Déploiement déclenché par webhook...')
  res.json({ ok: true, message: 'Déploiement en cours...' })

  // 1. git pull + npm install (synchrone, dans ce processus)
  const updateCmd = [
    `cd ${ROOT_DIR}`,
    'git fetch origin main',
    'git reset --hard origin/main',
    'npm install --omit=dev --ignore-scripts 2>&1 | tail -3',
  ].join(' && ')

  exec(updateCmd, { timeout: 120_000 }, (err, stdout, stderr) => {
    if (err) {
      console.error('[Deploy] Erreur update :', err.message)
      console.error('[Deploy] Stderr :', stderr?.slice(0, 500))
      return
    }
    console.log('[Deploy] Update OK :', stdout?.slice(-200) || 'OK')

    // 2. Reload PM2 en tâche de fond détachée (évite le suicide de processus)
    exec(`sleep 1 && pm2 reload ecosystem.config.js --update-env`, {
      detached: true,
      timeout: 30_000,
    }).unref()
    console.log('[Deploy] Reload PM2 planifié...')
  })
})

module.exports = router
