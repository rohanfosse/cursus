/**
 * Tests des bots demo (server/services/demoBots.js).
 *
 * V5 : tests pour la nouvelle API smart-bots (reply au visiteur, react
 * cibles, edits realistes, personnalites). Math.random est mocke pour
 * forcer chaque action (sinon flaky).
 */
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!!'

const { getDemoDb } = require('../../../server/db/demo-connection')
const { seedTenant } = require('../../../server/db/demo-seed')
const {
  runOnce,
  postSpontaneous,
  replyToVisitor,
  reactToVisitor,
  reactToRecent,
  botEditOwn,
  pickEmojiForContent,
  PERSONAS,
  REACT_EMOJIS,
} = require('../../../server/services/demoBots')
const crypto = require('crypto')

// Force Math.random pour les tests : on remplace par une fonction
// deterministe pour declencher chaque action a coup sur.
const realRandom = Math.random
function mockRandom(value) { Math.random = () => value }
function restoreRandom() { Math.random = realRandom }

function createSession(db, tenantId, visitorName = 'Emma Lefevre') {
  db.prepare(
    `INSERT INTO demo_sessions (id, tenant_id, role, user_id, user_name, expires_at)
     VALUES (?, ?, 'student', 1, ?, datetime('now', '+1 hour'))`
  ).run(crypto.randomUUID(), tenantId, visitorName)
  return { tenant_id: tenantId, user_name: visitorName }
}

describe('demoBots: pickEmojiForContent (heuristique contextuelle)', () => {
  it('reagit avec 🙏 quand le message contient "merci"', () => {
    expect(pickEmojiForContent('Merci pour le partage')).toBe('🙏')
  })
  it('reagit avec 🔥 quand il y a du code dans le message', () => {
    expect(pickEmojiForContent('Regarde mon ```js\nfunction()\n```')).toBe('🔥')
  })
  it('reagit avec 🎉 quand "genial"/"top"/"cool"', () => {
    expect(pickEmojiForContent('Genial !')).toBe('🎉')
    expect(pickEmojiForContent('Trop top')).toBe('🎉')
  })
  it('reagit avec 💡 sur une URL externe', () => {
    expect(pickEmojiForContent('https://example.com/lien')).toBe('💡')
  })
  it('reagit avec 🤔 sur une question', () => {
    expect(pickEmojiForContent('Tu sais comment ?')).toBe('🤔')
  })
  it('default tombe sur 👍 ou ❤️', () => {
    mockRandom(0.1)
    expect(pickEmojiForContent('Texte neutre')).toBe('👍')
    mockRandom(0.9)
    expect(pickEmojiForContent('Texte neutre')).toBe('❤️')
    restoreRandom()
  })
})

describe('demoBots: postSpontaneous', () => {
  let db
  let session
  let tenantId

  beforeEach(() => {
    db = getDemoDb()
    tenantId = crypto.randomUUID()
    seedTenant(db, tenantId, 'student')
    session = createSession(db, tenantId)
  })
  afterEach(() => restoreRandom())

  it('insere un message d\'un bot et l\'attribue a une persona connue', () => {
    mockRandom(0.1) // pioche le 1er element de chaque pickRandom
    const result = postSpontaneous(db, session)
    expect(result).toMatchObject({ type: 'post' })
    const inserted = db.prepare(
      'SELECT author_name, content FROM demo_messages WHERE id = ?'
    ).get(result.id)
    // L'auteur doit etre une des personas du fichier
    expect(Object.keys(PERSONAS)).toContain(inserted.author_name)
    expect(inserted.content).toBeTruthy()
  })
})

describe('demoBots: replyToVisitor', () => {
  let db
  let session
  let tenantId
  const visitorName = 'Emma Lefevre'

  beforeEach(() => {
    db = getDemoDb()
    tenantId = crypto.randomUUID()
    seedTenant(db, tenantId, 'student')
    session = createSession(db, tenantId, visitorName)
  })
  afterEach(() => restoreRandom())

  it('repond a un message recent du visiteur avec @mention', () => {
    // Le visiteur post un message
    const ch = db.prepare('SELECT id FROM demo_channels WHERE tenant_id = ? LIMIT 1').get(tenantId)
    const visitorRow = db.prepare('SELECT id FROM demo_students WHERE tenant_id = ? LIMIT 1').get(tenantId)
    db.prepare(
      `INSERT INTO demo_messages
        (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content, created_at)
       VALUES (?, ?, ?, ?, 'student', 'EL', 'Bonjour tout le monde', datetime('now'))`
    ).run(tenantId, ch.id, visitorRow.id, visitorName)

    mockRandom(0.1)
    const result = replyToVisitor(db, session, visitorName)
    expect(result).toMatchObject({ type: 'reply' })
    const reply = db.prepare('SELECT content, author_name FROM demo_messages WHERE id = ?').get(result.id)
    // La reply doit mentionner le prenom (Emma)
    expect(reply.content.toLowerCase()).toContain('emma')
    // L'auteur doit etre un bot, pas le visiteur lui-meme
    expect(reply.author_name).not.toBe(visitorName)
  })

  it('ne re-repond pas si le visiteur a deja recu une reply', () => {
    const ch = db.prepare('SELECT id FROM demo_channels WHERE tenant_id = ? LIMIT 1').get(tenantId)
    const visitorRow = db.prepare('SELECT id FROM demo_students WHERE tenant_id = ? LIMIT 1').get(tenantId)
    db.prepare(
      `INSERT INTO demo_messages
        (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content, created_at)
       VALUES (?, ?, ?, ?, 'student', 'EL', 'Salut', datetime('now'))`
    ).run(tenantId, ch.id, visitorRow.id, visitorName)

    mockRandom(0.1)
    const first = replyToVisitor(db, session, visitorName)
    expect(first).not.toBeNull()
    // Deuxieme tentative immediate -> deja replied, retourne null
    const second = replyToVisitor(db, session, visitorName)
    expect(second).toBeNull()
  })

  it('skip si le visiteur n\'a rien poste recemment', () => {
    mockRandom(0.1)
    const result = replyToVisitor(db, session, visitorName)
    expect(result).toBeNull()
  })

  it('matche le template "merci" sur un message contenant ce mot', () => {
    const ch = db.prepare('SELECT id FROM demo_channels WHERE tenant_id = ? LIMIT 1').get(tenantId)
    const visitorRow = db.prepare('SELECT id FROM demo_students WHERE tenant_id = ? LIMIT 1').get(tenantId)
    db.prepare(
      `INSERT INTO demo_messages
        (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content, created_at)
       VALUES (?, ?, ?, ?, 'student', 'EL', ?, datetime('now'))`
    ).run(tenantId, ch.id, visitorRow.id, visitorName, "Merci pour l'aide !")

    mockRandom(0.1)
    const result = replyToVisitor(db, session, visitorName)
    expect(result).not.toBeNull()
    const reply = db.prepare('SELECT content FROM demo_messages WHERE id = ?').get(result.id)
    // Reponse "de rien" / "avec plaisir" / "pas de souci" du template merci
    expect(reply.content.toLowerCase()).toMatch(/rien|plaisir|souci/)
  })
})

describe('demoBots: reactToVisitor', () => {
  let db
  let session
  let tenantId
  const visitorName = 'Emma Lefevre'

  beforeEach(() => {
    db = getDemoDb()
    tenantId = crypto.randomUUID()
    seedTenant(db, tenantId, 'student')
    session = createSession(db, tenantId, visitorName)
  })
  afterEach(() => restoreRandom())

  it('ajoute une reaction emoji sur le dernier message du visiteur', () => {
    const ch = db.prepare('SELECT id FROM demo_channels WHERE tenant_id = ? LIMIT 1').get(tenantId)
    const visitorRow = db.prepare('SELECT id FROM demo_students WHERE tenant_id = ? LIMIT 1').get(tenantId)
    const ins = db.prepare(
      `INSERT INTO demo_messages
        (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content, created_at)
       VALUES (?, ?, ?, ?, 'student', 'EL', 'Hello !', datetime('now'))`
    ).run(tenantId, ch.id, visitorRow.id, visitorName)

    mockRandom(0.1)
    const result = reactToVisitor(db, session, visitorName)
    expect(result).toMatchObject({ type: 'react-visitor' })
    expect(REACT_EMOJIS).toContain(result.emoji)

    const after = db.prepare('SELECT reactions FROM demo_messages WHERE id = ?').get(ins.lastInsertRowid)
    const parsed = JSON.parse(after.reactions)
    expect(parsed[result.emoji]).toContain(result.reactorId)
  })
})

describe('demoBots: reactToRecent (smart contextuel)', () => {
  let db
  let session
  let tenantId

  beforeEach(() => {
    db = getDemoDb()
    tenantId = crypto.randomUUID()
    seedTenant(db, tenantId, 'student')
    session = createSession(db, tenantId)
  })
  afterEach(() => restoreRandom())

  it('reagit avec un emoji contextuel (heuristique pickEmojiForContent)', () => {
    // Tous les messages seedees du tenant sont recents (created_at relatif a now)
    mockRandom(0.05)
    const result = reactToRecent(db, session, 'Emma Lefevre')
    if (result) {
      expect(REACT_EMOJIS).toContain(result.emoji)
    }
    // Toutes les reactions doivent etre des JSON valides
    const all = db.prepare(
      `SELECT reactions FROM demo_messages WHERE tenant_id = ? AND reactions IS NOT NULL`
    ).all(tenantId)
    for (const m of all) {
      expect(() => JSON.parse(m.reactions)).not.toThrow()
    }
  })

  it('exclut les messages du visiteur (pour eviter double avec reactToVisitor)', () => {
    // Cree un message du visiteur
    const ch = db.prepare('SELECT id FROM demo_channels WHERE tenant_id = ? LIMIT 1').get(tenantId)
    const visitorRow = db.prepare('SELECT id FROM demo_students WHERE tenant_id = ? LIMIT 1').get(tenantId)
    const visitorMsg = db.prepare(
      `INSERT INTO demo_messages
        (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content, created_at)
       VALUES (?, ?, ?, 'Visitor Test', 'student', 'VT', 'visitor msg', datetime('now'))`
    ).run(tenantId, ch.id, visitorRow.id)

    mockRandom(0.05)
    // 30 iterations pour stat-prouver que la cible n'est jamais le visiteur
    for (let i = 0; i < 30; i++) reactToRecent(db, session, 'Visitor Test')
    const visitorMsgReactions = db.prepare(
      `SELECT reactions FROM demo_messages WHERE id = ?`
    ).get(visitorMsg.lastInsertRowid).reactions
    expect(visitorMsgReactions).toBeNull()
  })
})

describe('demoBots: botEditOwn (vraies corrections)', () => {
  let db
  let session
  let tenantId

  beforeEach(() => {
    db = getDemoDb()
    tenantId = crypto.randomUUID()
    seedTenant(db, tenantId, 'student')
    session = createSession(db, tenantId)
  })
  afterEach(() => restoreRandom())

  it('applique un EDIT_PATTERN si le contenu matche', () => {
    const ch = db.prepare('SELECT id FROM demo_channels WHERE tenant_id = ? LIMIT 1').get(tenantId)
    const student = db.prepare('SELECT id, name, avatar_initials FROM demo_students WHERE tenant_id = ? LIMIT 1').get(tenantId)
    const ins = db.prepare(
      `INSERT INTO demo_messages
         (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content, created_at)
       VALUES (?, ?, ?, ?, 'student', ?, 'Du cou je teste vraimt', datetime('now', '-1 minute'))`
    ).run(tenantId, ch.id, student.id, student.name, student.avatar_initials)

    mockRandom(0.01)
    const result = botEditOwn(db, session)
    expect(result).toMatchObject({ type: 'edit' })
    const updated = db.prepare('SELECT content, edited FROM demo_messages WHERE id = ?').get(ins.lastInsertRowid)
    expect(updated.edited).toBe(1)
    // "du cou" -> "du coup" OU "vraimt" -> "vraiment"
    expect(updated.content).toMatch(/du coup|vraiment|edit/)
  })

  it('skip si pas de candidat (tous trop vieux ou deja edited)', () => {
    db.prepare(`UPDATE demo_messages SET edited = 1 WHERE tenant_id = ?`).run(tenantId)
    mockRandom(0.01)
    expect(botEditOwn(db, session)).toBeNull()
  })
})

describe('demoBots: runOnce (integration)', () => {
  it('renvoie des compteurs structures', () => {
    const db = getDemoDb()
    const tenantId = crypto.randomUUID()
    seedTenant(db, tenantId, 'student')
    createSession(db, tenantId)

    mockRandom(0.01)
    const stats = runOnce()
    restoreRandom()

    expect(stats.sessions).toBeGreaterThanOrEqual(1)
    expect(typeof stats.posted).toBe('number')
    expect(typeof stats.replied).toBe('number')
    expect(typeof stats.reactedVisitor).toBe('number')
    expect(typeof stats.reacted).toBe('number')
    expect(typeof stats.edited).toBe('number')
  })

  it('priorise reply au visiteur quand il a poste recemment', () => {
    const db = getDemoDb()
    const tenantId = crypto.randomUUID()
    const visitorName = 'Visitor Replied'
    seedTenant(db, tenantId, 'student')
    createSession(db, tenantId, visitorName)

    // Visiteur post un message
    const ch = db.prepare('SELECT id FROM demo_channels WHERE tenant_id = ? LIMIT 1').get(tenantId)
    const studentId = db.prepare('SELECT id FROM demo_students WHERE tenant_id = ? LIMIT 1').get(tenantId).id
    db.prepare(
      `INSERT INTO demo_messages
        (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content, created_at)
       VALUES (?, ?, ?, ?, 'student', 'VT', 'Salut tout le monde', datetime('now'))`
    ).run(tenantId, ch.id, studentId, visitorName)

    mockRandom(0.01) // toutes les actions s'enclenchent
    const stats = runOnce()
    restoreRandom()

    // replied OU reactedVisitor doit etre > 0 (au moins une reaction au visiteur)
    expect(stats.replied + stats.reactedVisitor).toBeGreaterThanOrEqual(1)
  })
})
