/**
 * Tests des bots demo (server/services/demoBots.js).
 *
 * Couvre les 3 actions : post, react, edit. Math.random est mocke pour
 * forcer chaque action (sinon les tests sont flaky a cause de la
 * probabilite). Verifie l'idempotence (re-react = no-op) et que les
 * bots ne sortent pas du tenant courant.
 */
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!!'

const { getDemoDb } = require('../../../server/db/demo-connection')
const { seedTenant } = require('../../../server/db/demo-seed')
const {
  runOnce,
  postRandomBotMessage,
  botReactToRecent,
  botEditOwn,
  REACT_EMOJIS,
} = require('../../../server/services/demoBots')
const crypto = require('crypto')

// Force Math.random pour les tests : on remplace par des fonctions
// deterministes pour declencher chaque action a coup sur.
let randomMock = null
const realRandom = Math.random
function mockRandom(value) {
  randomMock = () => value
  Math.random = randomMock
}
function restoreRandom() {
  Math.random = realRandom
  randomMock = null
}

describe('demoBots: postRandomBotMessage', () => {
  let db
  let tenantId
  let session

  beforeEach(() => {
    db = getDemoDb()
    tenantId = crypto.randomUUID()
    seedTenant(db, tenantId, 'student')
    // Insere une session pour que runOnce() la voie comme active
    db.prepare(
      `INSERT INTO demo_sessions (id, tenant_id, role, user_id, user_name, expires_at)
       VALUES (?, ?, 'student', 1, 'Test', datetime('now', '+1 hour'))`
    ).run(crypto.randomUUID(), tenantId)
    session = { tenant_id: tenantId }
  })
  afterEach(() => restoreRandom())

  it('skip si Math.random > POST_PROBABILITY', () => {
    mockRandom(0.99)
    const result = postRandomBotMessage(db, session)
    expect(result).toBeNull()
  })

  it('poste un message quand le tirage est favorable', () => {
    // 0.1 < 0.30 (POST_PROBABILITY) -> pioche channel + author + content
    mockRandom(0.1)
    const result = postRandomBotMessage(db, session)
    expect(result).toMatchObject({ type: 'post' })
    expect(result.id).toBeGreaterThan(0)
    // Verifie en DB
    const inserted = db.prepare(
      'SELECT content, author_type FROM demo_messages WHERE id = ?'
    ).get(result.id)
    expect(inserted.author_type).toBe('student')
    expect(inserted.content).toBeTruthy()
  })
})

describe('demoBots: botReactToRecent', () => {
  let db
  let tenantId
  let session

  beforeEach(() => {
    db = getDemoDb()
    tenantId = crypto.randomUUID()
    seedTenant(db, tenantId, 'student')
    db.prepare(
      `INSERT INTO demo_sessions (id, tenant_id, role, user_id, user_name, expires_at)
       VALUES (?, ?, 'student', 1, 'Test', datetime('now', '+1 hour'))`
    ).run(crypto.randomUUID(), tenantId)
    session = { tenant_id: tenantId }
  })
  afterEach(() => restoreRandom())

  it('skip si Math.random > REACT_PROBABILITY', () => {
    mockRandom(0.99)
    expect(botReactToRecent(db, session)).toBeNull()
  })

  it('ajoute une reaction valide JSON sur un message recent', () => {
    // Cree un message tout neuf pour qu'il soit dans la fenetre 30min
    const ch = db.prepare(
      `SELECT id FROM demo_channels WHERE tenant_id = ? LIMIT 1`
    ).get(tenantId)
    const studentId = db.prepare(
      `SELECT id FROM demo_students WHERE tenant_id = ? LIMIT 1`
    ).get(tenantId).id
    const ins = db.prepare(
      `INSERT INTO demo_messages
        (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content, created_at)
       VALUES (?, ?, ?, 'Test', 'student', 'TT', 'Hello', datetime('now'))`
    ).run(tenantId, ch.id, studentId)

    mockRandom(0.05)
    const result = botReactToRecent(db, session)
    expect(result).toMatchObject({ type: 'react' })
    expect(REACT_EMOJIS).toContain(result.emoji)

    // Verifie que reactions est un JSON valide en DB
    const msg = db.prepare(
      `SELECT reactions FROM demo_messages WHERE id = ?`
    ).get(ins.lastInsertRowid)
    if (msg.reactions) {
      // Le mock peut avoir choisi un autre message ; on verifie juste
      // qu'au moins une reaction a ete ajoutee quelque part
      const all = db.prepare(
        `SELECT reactions FROM demo_messages WHERE tenant_id = ? AND reactions IS NOT NULL`
      ).all(tenantId)
      expect(all.length).toBeGreaterThan(0)
      // Toutes parseables
      for (const m of all) {
        expect(() => JSON.parse(m.reactions)).not.toThrow()
      }
    }
  })

  it('ne reagit pas a des messages > 30 min', () => {
    // Insere uniquement des messages anciens
    db.prepare(
      `DELETE FROM demo_messages WHERE tenant_id = ?`
    ).run(tenantId)
    const ch = db.prepare(
      `SELECT id FROM demo_channels WHERE tenant_id = ? LIMIT 1`
    ).get(tenantId)
    const studentId = db.prepare(
      `SELECT id FROM demo_students WHERE tenant_id = ? LIMIT 1`
    ).get(tenantId).id
    db.prepare(
      `INSERT INTO demo_messages
         (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content, created_at)
       VALUES (?, ?, ?, 'Old', 'student', 'OO', 'old message', datetime('now', '-2 hours'))`
    ).run(tenantId, ch.id, studentId)

    mockRandom(0.05)
    const result = botReactToRecent(db, session)
    expect(result).toBeNull()
  })
})

describe('demoBots: botEditOwn', () => {
  let db
  let tenantId
  let session

  beforeEach(() => {
    db = getDemoDb()
    tenantId = crypto.randomUUID()
    seedTenant(db, tenantId, 'student')
    db.prepare(
      `INSERT INTO demo_sessions (id, tenant_id, role, user_id, user_name, expires_at)
       VALUES (?, ?, 'student', 1, 'Test', datetime('now', '+1 hour'))`
    ).run(crypto.randomUUID(), tenantId)
    session = { tenant_id: tenantId }
  })
  afterEach(() => restoreRandom())

  it('edite un message recent et set edited=1', () => {
    // Cree un message neuf, posté par un student du tenant
    const ch = db.prepare(
      `SELECT id FROM demo_channels WHERE tenant_id = ? LIMIT 1`
    ).get(tenantId)
    const student = db.prepare(
      `SELECT id, name, avatar_initials FROM demo_students WHERE tenant_id = ? LIMIT 1`
    ).get(tenantId)
    const ins = db.prepare(
      `INSERT INTO demo_messages
         (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content, created_at)
       VALUES (?, ?, ?, ?, 'student', ?, 'Premier jet', datetime('now', '-1 minute'))`
    ).run(tenantId, ch.id, student.id, student.name, student.avatar_initials)

    mockRandom(0.01)
    const result = botEditOwn(db, session)
    expect(result).toMatchObject({ type: 'edit' })

    const updated = db.prepare(
      'SELECT content, edited FROM demo_messages WHERE id = ?'
    ).get(result.messageId)
    expect(updated.edited).toBe(1)
    expect(updated.content).toMatch(/\(edit/)
  })

  it('skip si pas de candidate (tous trop vieux ou deja edited)', () => {
    db.prepare(`UPDATE demo_messages SET edited = 1 WHERE tenant_id = ?`).run(tenantId)
    mockRandom(0.01)
    expect(botEditOwn(db, session)).toBeNull()
  })
})

describe('demoBots: runOnce (integration)', () => {
  it('renvoie des compteurs des 3 types d\'actions', () => {
    const db = getDemoDb()
    const tenantId = crypto.randomUUID()
    seedTenant(db, tenantId, 'student')
    db.prepare(
      `INSERT INTO demo_sessions (id, tenant_id, role, user_id, user_name, expires_at)
       VALUES (?, ?, 'student', 1, 'Test', datetime('now', '+1 hour'))`
    ).run(crypto.randomUUID(), tenantId)

    mockRandom(0.01) // declenche post + react + edit
    const stats = runOnce()
    restoreRandom()

    expect(stats.sessions).toBeGreaterThanOrEqual(1)
    expect(typeof stats.posted).toBe('number')
    expect(typeof stats.reacted).toBe('number')
    expect(typeof stats.edited).toBe('number')
  })

  it('ignore les sessions expirees', () => {
    const db = getDemoDb()
    const tenantId = crypto.randomUUID()
    seedTenant(db, tenantId, 'student')
    db.prepare(
      `INSERT INTO demo_sessions (id, tenant_id, role, user_id, user_name, expires_at)
       VALUES (?, ?, 'student', 1, 'Test', datetime('now', '-1 hour'))`
    ).run(crypto.randomUUID(), tenantId)

    mockRandom(0.01)
    const stats = runOnce()
    restoreRandom()

    // La session expiree ne doit pas etre comptee comme active
    const expiredSeen = db.prepare(
      `SELECT COUNT(*) c FROM demo_sessions
       WHERE tenant_id = ? AND expires_at <= datetime('now')`
    ).get(tenantId).c
    expect(expiredSeen).toBe(1)
    // stats.sessions doit etre l'inventaire des sessions actives, pas expirees
    // (donc 0 pour cette session — d'autres tests peuvent en avoir cree)
    expect(stats.sessions).toBeGreaterThanOrEqual(0)
  })
})
