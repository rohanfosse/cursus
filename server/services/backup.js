/**
 * Sauvegarde quotidienne de la base SQLite.
 * Utilise l'API VACUUM INTO (SQLite 3.27+) pour copier le fichier en etat propre.
 * Garde les 7 derniers backups, supprime les plus anciens.
 */
const path = require('path')
const fs   = require('fs')
const log  = require('../utils/logger')

const MAX_BACKUPS = 7

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

module.exports = { runBackup, startDailyBackup }
