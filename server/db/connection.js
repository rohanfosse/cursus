const Database = require('better-sqlite3');
const path     = require('path');

let db;

function resolveDbPath() {
  // 1. Variable d'environnement (mode serveur Hostinger)
  if (process.env.DB_PATH) return process.env.DB_PATH
  // 2. Contexte Electron
  try {
    const { app } = require('electron')
    return path.join(app.getPath('userData'), 'cesi-classroom.db')
  } catch {
    // 3. Fallback développement (racine du projet)
    return path.join(__dirname, '../../cesi-classroom.db')
  }
}

function getDb() {
  if (!db) {
    const DB_PATH = resolveDbPath();
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
