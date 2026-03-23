// ─── Webhook de déploiement - appelé par GitHub Actions ──────────────────────
const router = require('express').Router()
const { execFileSync, exec } = require('child_process')
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

  try {
    execFileSync('git', ['-C', ROOT_DIR, 'fetch', 'origin', 'main'], { timeout: 30_000 })
    execFileSync('git', ['-C', ROOT_DIR, 'reset', '--hard', 'origin/main'], { timeout: 30_000 })
    execFileSync('npm', ['install', '--omit=dev', '--ignore-scripts'], { cwd: ROOT_DIR, timeout: 90_000 })
    console.log('[Deploy] Update OK')
  } catch (err) {
    console.error('[Deploy] Erreur update :', err.message)
    return
  }

  exec('pm2 reload ecosystem.config.js --update-env', { detached: true, timeout: 30_000 }).unref()
  console.log('[Deploy] Reload PM2 planifié...')
})

module.exports = router
