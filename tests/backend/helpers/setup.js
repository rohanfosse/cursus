// ─── Test database harness ───────────────────────────────────────────────────
// Creates an in-memory SQLite database and patches getDb() to use it.
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')

let testDb = null

function setupTestDb() {
  testDb = new Database(':memory:')
  testDb.pragma('journal_mode = WAL')
  testDb.pragma('foreign_keys = ON')

  // Patch the connection module to return our in-memory DB
  const connection = require('../../../src/db/connection')
  connection.getDb = () => testDb
  connection.closeDb = () => {
    if (testDb) { testDb.close(); testDb = null }
  }

  // Run the schema (will use our patched getDb)
  const { initSchema } = require('../../../src/db/schema')
  initSchema()

  // Seed minimal test data (schema migration v12 already inserts default teachers)
  const hash = bcrypt.hashSync('Test1234!', 10)
  testDb.exec(`
    INSERT OR IGNORE INTO promotions (id, name, color) VALUES (1, 'Promo Test', '#4A90D9');
    INSERT OR IGNORE INTO channels (id, promo_id, name, type) VALUES (1, 1, 'general', 'chat');
    INSERT OR IGNORE INTO channels (id, promo_id, name, type) VALUES (2, 1, 'annonces', 'annonce');
  `)
  testDb.prepare(
    `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
     VALUES (1, 1, 'Jean Dupont', 'jean@test.fr', 'JD', ?, 0)`
  ).run(hash)
  // Update existing teacher password (created by schema migration v12) to known hash
  testDb.prepare(`UPDATE teachers SET password = ?, must_change_password = 0 WHERE id = 1`).run(hash)
  testDb.prepare(`UPDATE teachers SET name = 'Prof Test', email = 'prof@test.fr' WHERE id = 1`).run()

  return testDb
}

function teardownTestDb() {
  if (testDb) {
    try { testDb.close() } catch {}
    testDb = null
  }
}

function getTestDb() {
  return testDb
}

module.exports = { setupTestDb, teardownTestDb, getTestDb }
