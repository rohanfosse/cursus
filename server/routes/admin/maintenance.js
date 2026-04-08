/**
 * Routes admin - Maintenance (nettoyage, backups, purge, seed reset, infos DB)
 */
const router  = require('express').Router()
const queries = require('../../db/index')
const fs      = require('fs')
const path    = require('path')

const ROOT = path.join(__dirname, '../../..')

router.post('/reset-seed', (req, res) => {
  try {
    if (req.body?.confirm !== 'RESET') {
      return res.status(400).json({ ok: false, error: 'Confirmation requise. Envoyez { "confirm": "RESET" } pour confirmer cette opération destructrice.' })
    }
    queries.resetAndSeed()
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

/**
 * Repertoire de backup par defaut. Surchargeable via la variable d'environnement
 * BACKUP_DIR pour correspondre au service de backup quotidien (server/services/backup.js).
 */
function getBackupDir() {
  return process.env.BACKUP_DIR || path.join(ROOT, 'backups')
}

// ── POST /maintenance/backup : declenche un backup on-demand ─────────────────
// Delegue au service unifie pour garantir le meme pattern de nommage
// (cursus-TIMESTAMP.db) que le backup quotidien automatique, et pour
// beneficier de la rotation. Les backups on-demand sont donc visibles
// par le restore automatique au prochain demarrage.
router.post('/backup', (req, res) => {
  try {
    const { getDb } = require('../../db/connection')
    const { runBackup } = require('../../services/backup')
    const dest = runBackup(getDb(), getBackupDir())
    if (!dest) return res.status(500).json({ ok: false, error: 'Backup failed. Voir les logs serveur.' })
    const size = fs.statSync(dest).size
    res.json({ ok: true, data: { filename: path.basename(dest), size } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── GET /maintenance/backups : liste les backups (service-compatible) ────────
router.get('/backups', (req, res) => {
  try {
    const { listBackups } = require('../../services/backup')
    const list = listBackups(getBackupDir())
      .map(b => ({ filename: b.filename, size: b.size, created: b.mtime.toISOString() }))
      .reverse() // plus recent en premier pour l'UI admin
    res.json({ ok: true, data: list })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── GET /maintenance/backup-health : monitoring ──────────────────────────────
// Expose l'etat du systeme de backup pour le panel admin et les checks externes.
// Retourne { health: 'ok'|'stale'|'missing', count, latest, staleThresholdMs }.
router.get('/backup-health', (req, res) => {
  try {
    const { getBackupHealth } = require('../../services/backup')
    res.json({ ok: true, data: getBackupHealth(getBackupDir()) })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── DELETE /maintenance/backups/:filename : suppression manuelle ─────────────
router.delete('/backups/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename) // anti path-traversal
    // Securite : refuser tout ce qui ne matche pas le pattern cursus-*.db
    if (!/^cursus-[\w\-T]+\.db$/.test(filename)) {
      return res.status(400).json({ ok: false, error: 'Nom de fichier invalide.' })
    }
    const filePath = path.join(getBackupDir(), filename)
    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: 'Fichier introuvable.' })
    fs.unlinkSync(filePath)
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.get('/db-info', (req, res) => {
  try {
    const { getDb } = require('../../db/connection')
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
    const clamp = (v, min, max, def) => { const n = Number(v); return (isNaN(n) || n < min) ? def : Math.min(n, max) }
    const data = queries.purgeOldData({
      auditDays:   clamp(auditDays, 7, 365, 90),
      loginDays:   clamp(loginDays, 7, 365, 30),
      sessionDays: clamp(sessionDays, 7, 365, 30),
    })
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

module.exports = router
