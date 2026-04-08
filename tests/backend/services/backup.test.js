/**
 * Tests pour le service de backup quotidien SQLite (server/services/backup.js).
 *
 * Ces tests utilisent un fichier DB reel dans un dossier temporaire plutot
 * qu'une base in-memory, parce que VACUUM INTO ecrit un fichier et la rotation
 * manipule des fichiers sur disque. L'objectif est de tester le pipeline complet :
 *   creation -> rotation -> integrite du backup produit.
 */
const fs       = require('fs')
const os       = require('os')
const path     = require('path')
const Database = require('better-sqlite3')
const {
  runBackup,
  startDailyBackup,
  listBackups,
  getBackupHealth,
  STALE_THRESHOLD_MS,
} = require('../../../server/services/backup')

let tmpRoot
let db
let dbPath
let backupDir

beforeEach(() => {
  tmpRoot   = fs.mkdtempSync(path.join(os.tmpdir(), 'cursus-backup-'))
  dbPath    = path.join(tmpRoot, 'cursus.db')
  backupDir = path.join(tmpRoot, 'backups')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT)')
  db.prepare('INSERT INTO t (val) VALUES (?)').run('alpha')
  db.prepare('INSERT INTO t (val) VALUES (?)').run('beta')
})

afterEach(() => {
  try { db.close() } catch {}
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }) } catch {}
})

describe('runBackup', () => {
  it('cree un fichier de backup dans le dossier cible', () => {
    const dest = runBackup(db, backupDir)

    expect(dest).toBeTruthy()
    expect(fs.existsSync(dest)).toBe(true)
    expect(path.basename(dest)).toMatch(/^cursus-.*\.db$/)
  })

  it('cree le dossier de backup s\'il n\'existe pas', () => {
    expect(fs.existsSync(backupDir)).toBe(false)
    runBackup(db, backupDir)
    expect(fs.existsSync(backupDir)).toBe(true)
  })

  it('produit un fichier SQLite valide contenant les memes donnees', () => {
    const dest = runBackup(db, backupDir)

    const backup = new Database(dest, { readonly: true })
    try {
      const rows = backup.prepare('SELECT val FROM t ORDER BY id').all()
      expect(rows).toEqual([{ val: 'alpha' }, { val: 'beta' }])
    } finally {
      backup.close()
    }
  })

  it('retourne null si VACUUM INTO echoue (destination invalide)', () => {
    // On force l'echec en passant un chemin invalide (caractere nul sur POSIX, \\ invalide Windows)
    // via un dossier qui est en realite un fichier deja existant.
    const fakeDir = path.join(tmpRoot, 'not-a-dir')
    fs.writeFileSync(fakeDir, 'this is a file, not a directory')
    const dest = runBackup(db, fakeDir)
    expect(dest).toBeNull()
  })

  it('ecrit des backups avec des noms uniques (timestamp)', async () => {
    const a = runBackup(db, backupDir)
    // Attendre >1s pour garantir un timestamp distinct (ISO precision seconde)
    await new Promise(r => setTimeout(r, 1100))
    const b = runBackup(db, backupDir)
    expect(a).not.toBe(b)
    expect(fs.existsSync(a)).toBe(true)
    expect(fs.existsSync(b)).toBe(true)
  })
})

describe('rotation des backups', () => {
  it('conserve au maximum 7 backups et supprime les plus anciens', () => {
    // Cree 10 fichiers de backup factices avec noms ordonnables
    for (let i = 0; i < 10; i++) {
      const stamp = `2026-01-${String(i + 1).padStart(2, '0')}T00-00-00`
      fs.mkdirSync(backupDir, { recursive: true })
      fs.writeFileSync(path.join(backupDir, `cursus-${stamp}.db`), 'fake')
    }
    // Un appel runBackup doit declencher la rotation
    runBackup(db, backupDir)

    const remaining = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('cursus-') && f.endsWith('.db'))
      .sort()

    expect(remaining.length).toBe(7)
    // Les plus anciens (01, 02, 03, 04) doivent avoir ete supprimes
    expect(remaining.some(f => f.includes('2026-01-01'))).toBe(false)
    expect(remaining.some(f => f.includes('2026-01-04'))).toBe(false)
    // Les recents doivent etre la
    expect(remaining.some(f => f.includes('2026-01-10'))).toBe(true)
  })

  it('n\'affecte pas les fichiers qui ne matchent pas le pattern', () => {
    fs.mkdirSync(backupDir, { recursive: true })
    fs.writeFileSync(path.join(backupDir, 'readme.txt'), 'doc')
    fs.writeFileSync(path.join(backupDir, 'other.db'),   'garbage')
    // Remplir avec 8 backups pour forcer une rotation
    for (let i = 0; i < 8; i++) {
      const stamp = `2026-02-${String(i + 1).padStart(2, '0')}T00-00-00`
      fs.writeFileSync(path.join(backupDir, `cursus-${stamp}.db`), 'fake')
    }

    runBackup(db, backupDir)

    expect(fs.existsSync(path.join(backupDir, 'readme.txt'))).toBe(true)
    expect(fs.existsSync(path.join(backupDir, 'other.db'))).toBe(true)
  })
})

describe('listBackups', () => {
  it('retourne un tableau vide si le dossier n\'existe pas', () => {
    expect(listBackups(backupDir)).toEqual([])
  })

  it('liste uniquement les fichiers cursus-*.db tries par nom', () => {
    fs.mkdirSync(backupDir, { recursive: true })
    fs.writeFileSync(path.join(backupDir, 'cursus-2026-01-03T00-00-00.db'), 'c')
    fs.writeFileSync(path.join(backupDir, 'cursus-2026-01-01T00-00-00.db'), 'a')
    fs.writeFileSync(path.join(backupDir, 'cursus-2026-01-02T00-00-00.db'), 'b')
    fs.writeFileSync(path.join(backupDir, 'other-file.db'), 'x')
    fs.writeFileSync(path.join(backupDir, 'cursus-notes.txt'), 'y')

    const list = listBackups(backupDir)
    expect(list.map(b => b.filename)).toEqual([
      'cursus-2026-01-01T00-00-00.db',
      'cursus-2026-01-02T00-00-00.db',
      'cursus-2026-01-03T00-00-00.db',
    ])
    expect(list[0].size).toBe(1)
    expect(list[0].mtime).toBeInstanceOf(Date)
  })
})

describe('getBackupHealth', () => {
  it('health=missing quand aucun backup', () => {
    const h = getBackupHealth(backupDir)
    expect(h.health).toBe('missing')
    expect(h.count).toBe(0)
    expect(h.latest).toBeNull()
  })

  it('health=ok quand le dernier backup est recent', () => {
    runBackup(db, backupDir)
    const h = getBackupHealth(backupDir)
    expect(h.health).toBe('ok')
    expect(h.count).toBe(1)
    expect(h.latest).toBeTruthy()
    expect(h.latest.age_ms).toBeLessThan(5000)
    expect(h.latest.size).toBeGreaterThan(0)
  })

  it('health=stale quand le dernier backup est trop vieux', () => {
    fs.mkdirSync(backupDir, { recursive: true })
    const oldFile = path.join(backupDir, 'cursus-2020-01-01T00-00-00.db')
    fs.writeFileSync(oldFile, 'old')
    // Forcer mtime dans le passe lointain (> 48h)
    const past = new Date(Date.now() - (STALE_THRESHOLD_MS + 60_000))
    fs.utimesSync(oldFile, past, past)

    const h = getBackupHealth(backupDir)
    expect(h.health).toBe('stale')
    expect(h.count).toBe(1)
    expect(h.latest.age_ms).toBeGreaterThan(STALE_THRESHOLD_MS)
  })
})

describe('startDailyBackup', () => {
  it('expose stop() et runNow()', () => {
    const handle = startDailyBackup(db, backupDir)
    try {
      expect(typeof handle.stop).toBe('function')
      expect(typeof handle.runNow).toBe('function')
    } finally {
      handle.stop()
    }
  })

  it('runNow() declenche un backup immediat', () => {
    const handle = startDailyBackup(db, backupDir)
    try {
      const dest = handle.runNow()
      expect(dest).toBeTruthy()
      expect(fs.existsSync(dest)).toBe(true)
    } finally {
      handle.stop()
    }
  })

  it('stop() nettoie les timers sans leak', () => {
    const handle = startDailyBackup(db, backupDir)
    // stop() ne doit pas lever
    expect(() => handle.stop()).not.toThrow()
    // stop() idempotent
    expect(() => handle.stop()).not.toThrow()
  })
})
