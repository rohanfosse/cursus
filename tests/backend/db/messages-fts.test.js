/**
 * Tests pour la recherche FTS5 sur messages (v2.266).
 *
 * Verifie que :
 *  - L'index FTS5 est cree par la migration v86
 *  - Les triggers AFTER INSERT/UPDATE/DELETE maintiennent l'index sync
 *  - searchMessages utilise FTS5 et ranke par BM25
 *  - Les accents sont normalises (recherche "regle" trouve "regle" ET "règle")
 *  - Le prefix-matching fonctionne ("algo" trouve "algorithme")
 *  - Les DMs ne sont pas indexes (confidentialite)
 *  - Le fallback LIKE marche pour les queries < 2 chars
 */

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!!'

const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

let queries

beforeAll(() => {
  setupTestDb()
  queries = require('../../../server/db/models/messages')
})
afterAll(() => teardownTestDb())

beforeEach(() => {
  // Clean : on vide messages — les triggers AFTER DELETE retirent
  // automatiquement les rows de messages_fts (content='messages').
  // Tenter de DELETE FROM messages_fts directement casse l'index FTS5
  // ("database disk image is malformed").
  const db = getTestDb()
  db.exec(`DELETE FROM messages;`)
})

function insertMessage({ channelId = 1, content, authorName = 'Test', authorId = 1, dmStudentId = null }) {
  return queries.sendMessage({
    channelId, dmStudentId,
    authorName, authorId, authorType: 'student',
    content,
  })
}

describe('messages_fts: migration et triggers', () => {
  it('la table virtuelle messages_fts existe apres migration', () => {
    const db = getTestDb()
    const row = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='messages_fts'`
    ).get()
    expect(row).toBeTruthy()
  })

  it('AFTER INSERT trigger ajoute le message dans l index', () => {
    const db = getTestDb()
    const r = insertMessage({ content: 'Le tri rapide est en O(n log n)' })
    const id = Number(r.lastInsertRowid)
    const indexed = db.prepare(
      `SELECT rowid, content FROM messages_fts WHERE rowid = ?`
    ).get(id)
    expect(indexed).toBeDefined()
    expect(indexed.content).toContain('tri rapide')
  })

  it('AFTER DELETE trigger retire le message de l index', () => {
    const db = getTestDb()
    const r = insertMessage({ content: 'Message a supprimer' })
    const id = Number(r.lastInsertRowid)
    db.prepare(`DELETE FROM messages WHERE id = ?`).run(id)
    const indexed = db.prepare(
      `SELECT rowid FROM messages_fts WHERE rowid = ?`
    ).get(id)
    expect(indexed).toBeUndefined()
  })

  it('les DMs ne sont PAS indexes (confidentialite)', () => {
    const db = getTestDb()
    // Insert direct pour bypasser le chiffrement et garder le test simple
    db.prepare(
      `INSERT INTO messages (channel_id, dm_student_id, author_name, author_id, author_type, content)
       VALUES (NULL, 1, 'A', 1, 'student', 'Message DM prive')`
    ).run()
    const all = db.prepare(`SELECT COUNT(*) c FROM messages_fts`).get()
    expect(all.c).toBe(0)
  })

  it('soft-delete (deleted_at) retire le message de l index via trigger UPDATE', () => {
    const db = getTestDb()
    const r = insertMessage({ content: 'Bientot supprime' })
    const id = Number(r.lastInsertRowid)
    db.prepare(`UPDATE messages SET deleted_at = datetime('now') WHERE id = ?`).run(id)
    const indexed = db.prepare(`SELECT rowid FROM messages_fts WHERE rowid = ?`).get(id)
    expect(indexed).toBeUndefined()
  })
})

describe('searchMessages: FTS5 + BM25', () => {
  it('trouve un message par mot exact', () => {
    insertMessage({ content: 'Implementer le tri rapide en JavaScript' })
    insertMessage({ content: 'Reunion lundi 14h en B204' })
    const r = queries.searchMessages(1, 'tri')
    expect(r.length).toBe(1)
    expect(r[0].content).toContain('tri rapide')
  })

  it('prefix-matching : "algo" trouve "algorithme"', () => {
    insertMessage({ content: 'Cours algorithme avance' })
    insertMessage({ content: 'Reunion B204' })
    const r = queries.searchMessages(1, 'algo')
    expect(r.length).toBe(1)
    expect(r[0].content).toContain('algorithme')
  })

  it('matche les accents normalises (unicode61 + remove_diacritics)', () => {
    insertMessage({ content: 'La règle des trois est valable' })
    insertMessage({ content: 'Reunion en B204' })
    // Recherche "regle" sans accent doit trouver "règle"
    const r = queries.searchMessages(1, 'regle')
    expect(r.length).toBe(1)
    expect(r[0].content).toContain('règle')
  })

  it('ranke par BM25 : meilleur score en premier', () => {
    insertMessage({ content: 'algorithme algorithme algorithme' }) // freq forte
    insertMessage({ content: 'algorithme et tri' })                // freq moyenne
    insertMessage({ content: 'reunion sur algorithme et tri rapide complexite' }) // dilue
    const r = queries.searchMessages(1, 'algorithme')
    // Le premier doit etre celui avec la freq relative la plus haute
    expect(r[0].content).toContain('algorithme algorithme algorithme')
  })

  it('limite a 200 resultats max', () => {
    for (let i = 0; i < 250; i++) {
      insertMessage({ content: `Message numero ${i} avec algorithme` })
    }
    const r = queries.searchMessages(1, 'algorithme')
    expect(r.length).toBeLessThanOrEqual(200)
  })

  it('retourne [] pour query vide', () => {
    insertMessage({ content: 'test' })
    expect(queries.searchMessages(1, '')).toEqual([])
    expect(queries.searchMessages(1, '   ')).toEqual([])
  })

  it('fallback LIKE pour query 1-char (FTS rejette les tokens courts)', () => {
    insertMessage({ content: 'Bonjour a tous, voici le cours' })
    // Query "a" : trop courte pour FTS, doit tomber en LIKE
    const r = queries.searchMessages(1, 'a')
    // Doit trouver le message via LIKE (contient "a")
    expect(r.length).toBeGreaterThanOrEqual(1)
  })

  it('isole par channel_id (pas de fuite cross-channel)', () => {
    insertMessage({ channelId: 1, content: 'Channel 1 algorithme' })
    insertMessage({ channelId: 2, content: 'Channel 2 algorithme' })
    const r1 = queries.searchMessages(1, 'algorithme')
    expect(r1.length).toBe(1)
    expect(r1[0].channel_id).toBe(1)
  })

  it('multi-mots : "tri rapide" trouve les deux termes', () => {
    insertMessage({ content: 'Le tri rapide en O(n log n)' })
    insertMessage({ content: 'Le tri par insertion est lent' })
    insertMessage({ content: 'Algorithme rapide pour les recherches' })
    const r = queries.searchMessages(1, 'tri rapide')
    // Le 1er doit etre "Le tri rapide..." (contient les 2 termes)
    expect(r[0].content).toContain('tri rapide')
  })
})

describe('searchMessages: securite (caracteres speciaux)', () => {
  it('ne casse pas avec des caracteres SQL/FTS speciaux', () => {
    insertMessage({ content: 'Test du module' })
    // Tous ces caracteres doivent etre sanitizes par buildFtsQuery
    expect(() => queries.searchMessages(1, "'; DROP TABLE")).not.toThrow()
    expect(() => queries.searchMessages(1, '"unbalanced')).not.toThrow()
    expect(() => queries.searchMessages(1, '(test)')).not.toThrow()
    expect(() => queries.searchMessages(1, 'AND OR NOT')).not.toThrow()
  })
})
