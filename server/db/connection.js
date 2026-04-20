const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

let db;

/** Renomme l'ancien fichier cesi-classroom.db en cursus.db si besoin */
function migrateOldDbFile(newPath) {
  const dir = path.dirname(newPath)
  const oldPath = path.join(dir, 'cesi-classroom.db')
  if (!fs.existsSync(newPath) && fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath)
    for (const ext of ['-wal', '-shm']) {
      if (fs.existsSync(oldPath + ext)) fs.renameSync(oldPath + ext, newPath + ext)
    }
  }
}

function resolveDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH
  try {
    const { app } = require('electron')
    return path.join(app.getPath('userData'), 'cursus.db')
  } catch {
    return path.join(__dirname, '../../cursus.db')
  }
}

/**
 * Tente de restaurer la DB depuis le backup le plus recent.
 * Retourne true si la restauration a reussi.
 */
function tryRestoreFromBackup(dbPath) {
  const log = require('../utils/logger')
  const backupDir = process.env.BACKUP_DIR || path.join(path.dirname(dbPath), '..', 'backups')
  try {
    if (!fs.existsSync(backupDir)) return false
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('cursus-') && f.endsWith('.db'))
      .sort()
    if (!backups.length) return false

    const latest = path.join(backupDir, backups[backups.length - 1])
    const corruptedPath = dbPath + '.corrupted'

    // Deplacer le fichier corrompu
    for (const ext of ['', '-wal', '-shm']) {
      if (fs.existsSync(dbPath + ext)) {
        fs.renameSync(dbPath + ext, corruptedPath + ext)
      }
    }

    // Copier le backup
    fs.copyFileSync(latest, dbPath)
    log.warn('db_restored_from_backup', { backup: backups[backups.length - 1], corrupted: corruptedPath })
    return true
  } catch (err) {
    log.error('db_restore_failed', { error: err.message })
    return false
  }
}

/** Applique les pragmas standards sur une instance fraichement ouverte. */
function applyPragmas(instance) {
  instance.pragma('journal_mode = WAL')
  instance.pragma('foreign_keys = ON')
  instance.pragma('busy_timeout = 5000')
  // synchronous=NORMAL est le combo recommande avec WAL : on troque un tiny
  // risque de perte de derniere transaction (en cas de crash OS en pleine
  // ecriture) contre ~2-3x les writes. Safe : la DB reste cohérente, seules
  // les ecritures des dernieres millisecondes sont perdues. WAL garantit
  // l'atomicite.
  instance.pragma('synchronous = NORMAL')
  // cache_size negatif = Ko (here 10 MB). Default = 2 MB, trop petit pour
  // 90j de messages + dashboards prof : on evite le page churn sur les
  // jointures messages/depots/students.
  instance.pragma('cache_size = -10000')
  // mmap_size : 30 MB de pages mappees directement en memoire, evite les
  // read() syscalls pour les hot tables. Safe sur Electron (single process).
  instance.pragma('mmap_size = 30000000')
}

/**
 * Met de cote un fichier DB corrompu en ajoutant le suffixe .corrupted.
 * Idempotent : ne fait rien si le fichier n'existe pas.
 */
function quarantineCorruptedDb(dbPath) {
  for (const ext of ['', '-wal', '-shm']) {
    const src = dbPath + ext
    if (fs.existsSync(src)) {
      try { fs.renameSync(src, dbPath + '.corrupted' + ext) } catch { /* best effort */ }
    }
  }
}

function getDb() {
  if (db) return db
  const DB_PATH = resolveDbPath()
  migrateOldDbFile(DB_PATH)

  // Tentative d'ouverture + integrity_check. Echec possible a plusieurs niveaux :
  //   1. new Database() throw (fichier totalement corrompu, pas un header SQLite)
  //   2. pragma integrity_check retourne une valeur != 'ok' (corruption logique)
  // Dans les deux cas, on tente un restore depuis backup avant de se resigner
  // au mode degrade.
  try {
    db = new Database(DB_PATH)
    applyPragmas(db)
    const result = db.pragma('integrity_check', { simple: true })
    if (result !== 'ok') throw new Error(`integrity_check failed: ${result}`)
    return db
  } catch (err) {
    const log = require('../utils/logger')
    log.error('db_open_failed', { error: err.message, path: DB_PATH })
    if (db) { try { db.close() } catch {} db = null }
  }

  // Tentative de restauration depuis le backup le plus recent
  if (tryRestoreFromBackup(DB_PATH)) {
    db = new Database(DB_PATH)
    applyPragmas(db)
    return db
  }

  // Mode degrade : mettre le fichier corrompu en quarantaine et repartir
  // avec une DB vide. Le code applicatif reappliquera le schema au besoin.
  const log = require('../utils/logger')
  log.error('db_no_backup_available', { path: DB_PATH })
  quarantineCorruptedDb(DB_PATH)
  db = new Database(DB_PATH)
  applyPragmas(db)
  return db
}

function closeDb() {
  if (db) {
    try { db.close() } catch {}
    db = null
  }
}

module.exports = { getDb, closeDb };
