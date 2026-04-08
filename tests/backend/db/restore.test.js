/**
 * Tests pour la restauration automatique de la DB depuis un backup
 * (server/db/connection.js — tryRestoreFromBackup via getDb()).
 *
 * Scenario : DB corrompue -> integrity_check fail -> restore depuis
 * le backup le plus recent -> reouverture reussie avec les donnees du backup.
 *
 * On isole le module connection.js avec vi.resetModules() parce qu'il
 * tient une reference singleton `db` qui doit etre reinitialisee entre tests.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
const fs       = require('fs')
const os       = require('os')
const path     = require('path')
const Database = require('better-sqlite3')

let tmpRoot
let dbPath
let backupDir
let originalEnv

beforeEach(() => {
  vi.resetModules()
  tmpRoot   = fs.mkdtempSync(path.join(os.tmpdir(), 'cursus-restore-'))
  dbPath    = path.join(tmpRoot, 'cursus.db')
  backupDir = path.join(tmpRoot, 'backups')

  originalEnv = { DB_PATH: process.env.DB_PATH, BACKUP_DIR: process.env.BACKUP_DIR }
  process.env.DB_PATH    = dbPath
  process.env.BACKUP_DIR = backupDir
})

afterEach(() => {
  try {
    const connection = require('../../../server/db/connection')
    connection.closeDb()
  } catch {}
  process.env.DB_PATH    = originalEnv.DB_PATH
  process.env.BACKUP_DIR = originalEnv.BACKUP_DIR
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }) } catch {}
})

/**
 * Cree une DB valide avec une table `marker` contenant un tag,
 * puis un backup via VACUUM INTO.
 */
function seedDbAndBackup(markerValue) {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec('CREATE TABLE marker (id INTEGER PRIMARY KEY, val TEXT)')
  db.prepare('INSERT INTO marker (val) VALUES (?)').run(markerValue)

  fs.mkdirSync(backupDir, { recursive: true })
  const backupPath = path.join(backupDir, `cursus-2026-01-01T00-00-00.db`)
  db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`)
  db.close()
  return backupPath
}

/** Corrompt le fichier DB en ecrivant des octets aleatoires par-dessus. */
function corruptDbFile() {
  // Supprimer WAL/SHM pour eviter que SQLite recupere depuis le WAL
  for (const ext of ['-wal', '-shm']) {
    const p = dbPath + ext
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }
  // Remplacer completement le fichier par des donnees invalides
  fs.writeFileSync(dbPath, Buffer.from('NOT A SQLITE DB '.repeat(100)))
}

describe('tryRestoreFromBackup via getDb()', () => {
  it('restaure la DB depuis le backup le plus recent quand le fichier est corrompu', () => {
    seedDbAndBackup('backup-marker')
    corruptDbFile()

    // Re-require connection.js (fresh singleton)
    const connection = require('../../../server/db/connection')
    const db = connection.getDb()

    // Les donnees du backup doivent etre recuperables
    const row = db.prepare('SELECT val FROM marker LIMIT 1').get()
    expect(row).toEqual({ val: 'backup-marker' })

    // Le fichier corrompu doit avoir ete mis de cote
    expect(fs.existsSync(dbPath + '.corrupted')).toBe(true)
  })

  it('choisit le backup le plus recent parmi plusieurs', () => {
    seedDbAndBackup('old')
    // Ecraser le DB original avec une nouvelle version, refaire un backup plus recent
    const db = new Database(dbPath)
    db.exec('DROP TABLE IF EXISTS marker')
    db.exec('CREATE TABLE marker (id INTEGER PRIMARY KEY, val TEXT)')
    db.prepare('INSERT INTO marker (val) VALUES (?)').run('recent')
    const recentBackup = path.join(backupDir, 'cursus-2026-06-15T12-00-00.db')
    db.exec(`VACUUM INTO '${recentBackup.replace(/'/g, "''")}'`)
    db.close()

    corruptDbFile()

    const connection = require('../../../server/db/connection')
    const restored = connection.getDb()
    const row = restored.prepare('SELECT val FROM marker LIMIT 1').get()
    expect(row).toEqual({ val: 'recent' })
  })

  it('ne crash pas en mode degrade quand aucun backup n\'est disponible', () => {
    // Creer une DB, la corrompre, sans jamais creer de backup
    const db = new Database(dbPath)
    db.exec('CREATE TABLE t (id INTEGER)')
    db.close()
    corruptDbFile()

    const connection = require('../../../server/db/connection')
    // Ne doit pas throw meme sans backup
    expect(() => connection.getDb()).not.toThrow()
  })

  it('ne declenche pas de restore si la DB est saine', () => {
    const db = new Database(dbPath)
    db.exec('CREATE TABLE healthy (id INTEGER PRIMARY KEY, tag TEXT)')
    db.prepare('INSERT INTO healthy (tag) VALUES (?)').run('original')
    db.close()

    // Creer un backup distinct avec un marker different pour detecter
    // un restore intempestif
    fs.mkdirSync(backupDir, { recursive: true })
    const bkp = new Database(path.join(backupDir, 'cursus-2020-01-01T00-00-00.db'))
    bkp.exec('CREATE TABLE healthy (id INTEGER PRIMARY KEY, tag TEXT)')
    bkp.prepare('INSERT INTO healthy (tag) VALUES (?)').run('should-not-be-used')
    bkp.close()

    const connection = require('../../../server/db/connection')
    const opened = connection.getDb()
    const row = opened.prepare('SELECT tag FROM healthy LIMIT 1').get()
    expect(row).toEqual({ tag: 'original' })
    expect(fs.existsSync(dbPath + '.corrupted')).toBe(false)
  })
})
