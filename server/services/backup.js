/**
 * Sauvegarde quotidienne de la base SQLite.
 * Utilise l'API VACUUM INTO (SQLite 3.27+) pour copier le fichier en etat propre.
 * Garde les 7 derniers backups, supprime les plus anciens.
 */
const path = require('path')
const fs   = require('fs')
const log  = require('../utils/logger')

const MAX_BACKUPS = 7
const BACKUP_PREFIX = 'cursus-'
const BACKUP_EXT    = '.db'

// Un backup est considere "stale" s'il a plus de 48h. Au-dela, on alerte.
const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000

/**
 * Liste les backups presents dans le dossier, tries du plus ancien au plus recent.
 * Retourne un tableau vide si le dossier n'existe pas.
 * @param {string} backupDir
 * @returns {Array<{filename:string,path:string,size:number,mtime:Date}>}
 */
function listBackups(backupDir) {
  if (!fs.existsSync(backupDir)) return []
  return fs.readdirSync(backupDir)
    .filter(f => f.startsWith(BACKUP_PREFIX) && f.endsWith(BACKUP_EXT))
    .map(f => {
      const p = path.join(backupDir, f)
      const stat = fs.statSync(p)
      return { filename: f, path: p, size: stat.size, mtime: stat.mtime }
    })
    .sort((a, b) => a.filename.localeCompare(b.filename))
}

/**
 * Evalue la sante du systeme de backup pour le monitoring.
 * @param {string} backupDir
 * @returns {{
 *   health: 'ok' | 'stale' | 'missing',
 *   count: number,
 *   latest: { filename:string, size:number, age_ms:number } | null,
 *   staleThresholdMs: number,
 * }}
 */
function getBackupHealth(backupDir) {
  const backups = listBackups(backupDir)
  if (!backups.length) {
    return { health: 'missing', count: 0, latest: null, staleThresholdMs: STALE_THRESHOLD_MS }
  }
  const latest = backups[backups.length - 1]
  const ageMs = Date.now() - latest.mtime.getTime()
  const health = ageMs > STALE_THRESHOLD_MS ? 'stale' : 'ok'
  return {
    health,
    count: backups.length,
    latest: { filename: latest.filename, size: latest.size, age_ms: ageMs },
    staleThresholdMs: STALE_THRESHOLD_MS,
  }
}

function runBackup(db, backupDir) {
  try {
    fs.mkdirSync(backupDir, { recursive: true })

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const dest  = path.join(backupDir, `cursus-${stamp}.db`)

    db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`)
    log.info('backup_success', { dest })

    // Rotation : garder les MAX_BACKUPS plus recents
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('cursus-') && f.endsWith('.db'))
      .sort()

    while (files.length > MAX_BACKUPS) {
      const old = files.shift()
      try {
        fs.unlinkSync(path.join(backupDir, old))
        log.info('backup_rotated', { removed: old })
      } catch { /* ignore */ }
    }

    return dest
  } catch (err) {
    log.error('backup_failed', { error: err.message })
    return null
  }
}

/**
 * Demarre le backup quotidien (toutes les 24h).
 * @param {object} db - Instance better-sqlite3
 * @param {string} backupDir - Repertoire de destination
 * @returns {NodeJS.Timer} Timer pour cleanup
 */
function startDailyBackup(db, backupDir) {
  // Premier backup 5 min apres le demarrage
  const initialTimeout = setTimeout(() => runBackup(db, backupDir), 5 * 60_000)

  // Ensuite toutes les 24h
  const interval = setInterval(() => runBackup(db, backupDir), 24 * 60 * 60_000)

  // Retourne un objet cleanup
  return {
    stop() {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    },
    runNow() {
      return runBackup(db, backupDir)
    },
  }
}

module.exports = { runBackup, startDailyBackup, listBackups, getBackupHealth, MAX_BACKUPS, STALE_THRESHOLD_MS }
