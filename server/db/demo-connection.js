/**
 * Connexion DB demo (mode invite, sandbox).
 *
 * Base SQLite distincte de la prod, schema minimal pour le MVP du mode
 * demo : promotions, channels, students, teachers, messages, assignments.
 * Stockee dans `data/cursus_demo.sqlite`, recreee from scratch a chaque
 * demarrage du serveur (les donnees demo sont volatiles by design — reset
 * nightly est ajoute en V2 du mode demo).
 *
 * Isolation par `tenant_id` (UUID) sur toutes les tables transactionnelles :
 * chaque session demo cree un nouveau tenant et y duplique le seed initial,
 * personne ne voit les actions de personne d'autre.
 *
 * Cf. .claude/specs/deep-interview-demo-mode.md (jalon MVP).
 */
const Database = require('better-sqlite3')
const path     = require('path')
const fs       = require('fs')

let demoDb = null

function resolveDemoDbPath() {
  if (process.env.DEMO_DB_PATH) return process.env.DEMO_DB_PATH
  // Memoire en CI / tests, fichier sinon. En memoire : reset auto a chaque
  // restart serveur, parfait pour la nature ephemere de la demo.
  if (process.env.NODE_ENV === 'test') return ':memory:'
  return path.join(__dirname, '../../data/cursus_demo.sqlite')
}

function ensureDirExists(dbPath) {
  if (dbPath === ':memory:') return
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS demo_promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366F1',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_demo_promotions_tenant ON demo_promotions(tenant_id);

  CREATE TABLE IF NOT EXISTS demo_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    promo_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'chat',
    description TEXT,
    category TEXT,
    is_private INTEGER DEFAULT 0,
    archived INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_demo_channels_tenant ON demo_channels(tenant_id);

  CREATE TABLE IF NOT EXISTS demo_students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    promo_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_initials TEXT,
    photo_data TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_demo_students_tenant ON demo_students(tenant_id);

  CREATE TABLE IF NOT EXISTS demo_teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'teacher',
    photo_data TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_demo_teachers_tenant ON demo_teachers(tenant_id);

  CREATE TABLE IF NOT EXISTS demo_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    channel_id INTEGER,
    dm_student_id INTEGER,
    author_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,
    author_type TEXT NOT NULL,
    author_initials TEXT,
    author_photo TEXT,
    content TEXT NOT NULL,
    reactions TEXT,
    is_pinned INTEGER DEFAULT 0,
    edited INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_demo_messages_tenant ON demo_messages(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_demo_messages_channel ON demo_messages(tenant_id, channel_id);

  CREATE TABLE IF NOT EXISTS demo_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    channel_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'livrable',
    deadline TEXT,
    is_published INTEGER DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_demo_assignments_tenant ON demo_assignments(tenant_id);

  CREATE TABLE IF NOT EXISTS demo_sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_demo_sessions_expires ON demo_sessions(expires_at);
`

function getDemoDb() {
  if (demoDb) return demoDb

  const dbPath = resolveDemoDbPath()
  ensureDirExists(dbPath)

  demoDb = new Database(dbPath)
  demoDb.pragma('journal_mode = WAL')
  demoDb.pragma('foreign_keys = ON')

  // Cree le schema si necessaire (idempotent grace aux IF NOT EXISTS).
  demoDb.exec(SCHEMA)

  return demoDb
}

/**
 * Purge les sessions demo expirees + leurs donnees associees.
 * Appele au demarrage et periodiquement (toutes les heures).
 */
function purgeExpiredSessions() {
  const db = getDemoDb()
  const expired = db.prepare(
    `SELECT tenant_id FROM demo_sessions WHERE expires_at < datetime('now')`
  ).all()

  if (!expired.length) return 0

  const tenants = expired.map(r => r.tenant_id)
  const placeholders = tenants.map(() => '?').join(',')
  const tables = [
    'demo_promotions', 'demo_channels', 'demo_students', 'demo_teachers',
    'demo_messages', 'demo_assignments', 'demo_sessions',
  ]
  const txn = db.transaction(() => {
    for (const t of tables) {
      db.prepare(`DELETE FROM ${t} WHERE tenant_id IN (${placeholders})`).run(...tenants)
    }
  })
  txn()
  return tenants.length
}

function closeDemoDb() {
  if (demoDb) {
    try { demoDb.close() } catch { /* ignore */ }
    demoDb = null
  }
}

module.exports = { getDemoDb, purgeExpiredSessions, closeDemoDb }
