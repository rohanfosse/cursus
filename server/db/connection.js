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
    // Migrer aussi les fichiers WAL/SHM associés
    for (const ext of ['-wal', '-shm']) {
      if (fs.existsSync(oldPath + ext)) fs.renameSync(oldPath + ext, newPath + ext)
    }
  }
}

function resolveDbPath() {
  // 1. Variable d'environnement (mode serveur Hostinger)
  if (process.env.DB_PATH) return process.env.DB_PATH
  // 2. Contexte Electron
  try {
    const { app } = require('electron')
    return path.join(app.getPath('userData'), 'cursus.db')
  } catch {
    // 3. Fallback développement (racine du projet)
    return path.join(__dirname, '../../cursus.db')
  }
}

function getDb() {
  if (!db) {
    const DB_PATH = resolveDbPath();
    migrateOldDbFile(DB_PATH);
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Vérification d'intégrité au premier accès
    try {
      const result = db.pragma('integrity_check', { simple: true })
      if (result !== 'ok') {
        const log = require('../utils/logger')
        log.error('db_integrity_failed', { result, path: DB_PATH })
      }
    } catch { /* mode dégradé — ne pas crasher */ }
  }
  return db;
}

function closeDb() {
  if (db) {
    try { db.close() } catch {}
    db = null
  }
}

module.exports = { getDb, closeDb };
