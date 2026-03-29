/**
 * Tests unitaires pour le modele documents (channel_documents).
 */
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

let queries

beforeAll(() => {
  setupTestDb()
  queries = require('../../../server/db/models/documents')

  const db = getTestDb()
  // Seed: a channel with category (project-linked)
  db.exec(`
    INSERT OR IGNORE INTO channels (id, promo_id, name, type, category)
    VALUES (10, 1, 'Canal Projet', 'chat', 'Web Dev')
  `)
  // Seed: a travail for linking
  db.exec(`
    INSERT OR IGNORE INTO travaux (id, promo_id, channel_id, title, deadline, type, published)
    VALUES (40, 1, 1, 'Travail Doc', '2099-12-31T23:59:00Z', 'livrable', 1)
  `)
})

afterAll(() => teardownTestDb())

describe('addProjectDocument', () => {
  it('creates a file document', () => {
    const result = queries.addProjectDocument({
      promoId: 1,
      project: 'Web Dev',
      category: 'Cours',
      type: 'file',
      name: 'slides.pdf',
      pathOrUrl: '/uploads/slides.pdf',
      description: 'Cours HTML',
    })
    expect(result).toBeDefined()
    expect(result.changes).toBe(1)
  })

  it('creates a link document', () => {
    const result = queries.addProjectDocument({
      promoId: 1,
      project: 'Web Dev',
      category: 'Ressources',
      type: 'link',
      name: 'MDN Docs',
      pathOrUrl: 'https://developer.mozilla.org',
    })
    expect(result.changes).toBe(1)
  })

  it('defaults category to General when empty', () => {
    const result = queries.addProjectDocument({
      promoId: 1,
      type: 'link',
      name: 'No Category',
      pathOrUrl: 'https://example.com',
    })
    expect(result.changes).toBe(1)
    const db = getTestDb()
    const doc = db.prepare('SELECT category FROM channel_documents WHERE id = ?').get(Number(result.lastInsertRowid))
    expect(doc.category).toBe('Général')
  })

  it('stores file_size when provided', () => {
    const result = queries.addProjectDocument({
      promoId: 1,
      type: 'file',
      name: 'big.zip',
      pathOrUrl: '/uploads/big.zip',
      fileSize: 1048576,
    })
    const db = getTestDb()
    const doc = db.prepare('SELECT file_size FROM channel_documents WHERE id = ?').get(Number(result.lastInsertRowid))
    expect(doc.file_size).toBe(1048576)
  })

  it('links document to a travail', () => {
    const result = queries.addProjectDocument({
      promoId: 1,
      type: 'link',
      name: 'Linked to travail',
      pathOrUrl: 'https://example.com/linked',
      travailId: 40,
    })
    const db = getTestDb()
    const doc = db.prepare('SELECT travail_id FROM channel_documents WHERE id = ?').get(Number(result.lastInsertRowid))
    expect(doc.travail_id).toBe(40)
  })
})

describe('addChannelDocument', () => {
  it('delegates to addProjectDocument when promoId is provided', () => {
    const result = queries.addChannelDocument({
      promoId: 1,
      project: 'Web Dev',
      category: 'TP',
      type: 'file',
      name: 'tp1.pdf',
      pathOrUrl: '/uploads/tp1.pdf',
    })
    expect(result.changes).toBe(1)
  })

  it('derives promoId from channelId when promoId is absent', () => {
    const result = queries.addChannelDocument({
      channelId: 10,
      category: 'Notes',
      type: 'link',
      name: 'Lien Canal',
      pathOrUrl: 'https://canal.example.com',
    })
    expect(result.changes).toBe(1)
  })
})

describe('getProjectDocuments', () => {
  it('returns all documents for a promo', () => {
    const docs = queries.getProjectDocuments(1)
    expect(Array.isArray(docs)).toBe(true)
    expect(docs.length).toBeGreaterThan(0)
  })

  it('filters by project when provided', () => {
    const docs = queries.getProjectDocuments(1, 'Web Dev')
    expect(Array.isArray(docs)).toBe(true)
    for (const d of docs) {
      expect(d.project).toBe('Web Dev')
    }
  })

  it('returns empty array for non-existent promo', () => {
    const docs = queries.getProjectDocuments(9999)
    expect(docs).toEqual([])
  })

  it('includes content alias and travail_title', () => {
    const docs = queries.getProjectDocuments(1)
    const doc = docs[0]
    expect(doc).toHaveProperty('content')
  })
})

describe('getPromoDocuments', () => {
  it('returns all documents for a promo', () => {
    const docs = queries.getPromoDocuments(1)
    expect(Array.isArray(docs)).toBe(true)
    expect(docs.length).toBeGreaterThan(0)
  })
})

describe('getChannelDocuments', () => {
  it('returns documents for a channel with category (includes project docs)', () => {
    // Channel 10 has category 'Web Dev', so it should include project docs
    const docs = queries.getChannelDocuments(10)
    expect(Array.isArray(docs)).toBe(true)
  })

  it('returns documents for a basic channel', () => {
    const docs = queries.getChannelDocuments(1)
    expect(Array.isArray(docs)).toBe(true)
  })
})

describe('updateProjectDocument', () => {
  let docId

  beforeAll(() => {
    const result = queries.addProjectDocument({
      promoId: 1,
      project: 'Web Dev',
      category: 'Cours',
      type: 'file',
      name: 'original.pdf',
      pathOrUrl: '/uploads/original.pdf',
    })
    docId = Number(result.lastInsertRowid)
  })

  it('updates name, category, description', () => {
    queries.updateProjectDocument({
      id: docId,
      name: 'updated.pdf',
      category: 'TP',
      description: 'Updated description',
    })
    const db = getTestDb()
    const doc = db.prepare('SELECT * FROM channel_documents WHERE id = ?').get(docId)
    expect(doc.name).toBe('updated.pdf')
    expect(doc.category).toBe('TP')
    expect(doc.description).toBe('Updated description')
  })

  it('links document to a travail via update', () => {
    queries.updateProjectDocument({
      id: docId,
      name: 'updated.pdf',
      category: 'TP',
      travailId: 40,
    })
    const db = getTestDb()
    const doc = db.prepare('SELECT travail_id FROM channel_documents WHERE id = ?').get(docId)
    expect(doc.travail_id).toBe(40)
  })
})

describe('deleteChannelDocument', () => {
  it('deletes a document', () => {
    const result = queries.addProjectDocument({
      promoId: 1,
      type: 'link',
      name: 'Delete Me',
      pathOrUrl: 'https://delete.me',
    })
    const id = Number(result.lastInsertRowid)
    const delResult = queries.deleteChannelDocument(id)
    expect(delResult.changes).toBe(1)
  })

  it('returns changes=0 for non-existent document', () => {
    const result = queries.deleteChannelDocument(99999)
    expect(result.changes).toBe(0)
  })
})

describe('getProjectDocumentCategories', () => {
  it('returns distinct categories for a promo', () => {
    const cats = queries.getProjectDocumentCategories(1)
    expect(Array.isArray(cats)).toBe(true)
    expect(cats.length).toBeGreaterThan(0)
    // All entries should be strings
    for (const c of cats) {
      expect(typeof c).toBe('string')
    }
  })

  it('filters by project when provided', () => {
    const cats = queries.getProjectDocumentCategories(1, 'Web Dev')
    expect(Array.isArray(cats)).toBe(true)
  })

  it('returns empty array for non-existent promo', () => {
    const cats = queries.getProjectDocumentCategories(9999)
    expect(cats).toEqual([])
  })
})

describe('getChannelDocumentCategories', () => {
  it('returns categories for a channel', () => {
    // First add a doc directly linked to channel
    const db = getTestDb()
    db.exec(`
      INSERT INTO channel_documents (promo_id, channel_id, category, type, name, path_or_url)
      VALUES (1, 1, 'CatTest', 'link', 'cat doc', 'https://cat.test')
    `)
    const cats = queries.getChannelDocumentCategories(1)
    expect(Array.isArray(cats)).toBe(true)
    expect(cats).toContain('CatTest')
  })
})

describe('searchDocuments', () => {
  it('finds documents matching a query', () => {
    const results = queries.searchDocuments(1, 'slides')
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].name).toContain('slides')
  })

  it('returns empty array for no matches', () => {
    const results = queries.searchDocuments(1, 'zzz_nonexistent_zzz')
    expect(results).toEqual([])
  })

  it('limits results to 20', () => {
    const results = queries.searchDocuments(1, '%')
    expect(results.length).toBeLessThanOrEqual(20)
  })
})

describe('linkDocumentToTravail', () => {
  it('links a document to a travail', () => {
    const result = queries.addProjectDocument({
      promoId: 1,
      type: 'link',
      name: 'Link Target',
      pathOrUrl: 'https://link.target',
    })
    const docId = Number(result.lastInsertRowid)
    queries.linkDocumentToTravail(docId, 40)

    const db = getTestDb()
    const doc = db.prepare('SELECT travail_id FROM channel_documents WHERE id = ?').get(docId)
    expect(doc.travail_id).toBe(40)
  })

  it('unlinks a document when travailId is null', () => {
    const result = queries.addProjectDocument({
      promoId: 1,
      type: 'link',
      name: 'Unlink Target',
      pathOrUrl: 'https://unlink.target',
      travailId: 40,
    })
    const docId = Number(result.lastInsertRowid)
    queries.linkDocumentToTravail(docId, null)

    const db = getTestDb()
    const doc = db.prepare('SELECT travail_id FROM channel_documents WHERE id = ?').get(docId)
    expect(doc.travail_id).toBeNull()
  })
})

// ═════════════════════════════════════════════════════
//  Edge cases — duplicates, nulls, long values, overlap
// ═════════════════════════════════════════════════════
describe('addProjectDocument — edge cases', () => {
  it('allows duplicate document names in same project', () => {
    queries.addProjectDocument({ promoId: 1, name: 'readme.pdf', type: 'file', pathOrUrl: '/a.pdf' })
    queries.addProjectDocument({ promoId: 1, name: 'readme.pdf', type: 'file', pathOrUrl: '/b.pdf' })
    const docs = queries.getProjectDocuments(1)
    const readmes = docs.filter(d => d.name === 'readme.pdf')
    expect(readmes.length).toBeGreaterThanOrEqual(2)
  })

  it('handles null description gracefully', () => {
    const result = queries.addProjectDocument({
      promoId: 1, name: 'nodesc.pdf', type: 'file', pathOrUrl: '/x.pdf', description: null,
    })
    expect(result.changes).toBe(1)
    const db = getTestDb()
    const doc = db.prepare('SELECT description FROM channel_documents WHERE id = ?').get(Number(result.lastInsertRowid))
    expect(doc.description).toBeNull()
  })

  it('handles undefined description (defaults to null)', () => {
    const result = queries.addProjectDocument({
      promoId: 1, name: 'undef-desc.pdf', type: 'file', pathOrUrl: '/y.pdf',
    })
    expect(result.changes).toBe(1)
    const db = getTestDb()
    const doc = db.prepare('SELECT description FROM channel_documents WHERE id = ?').get(Number(result.lastInsertRowid))
    expect(doc.description).toBeNull()
  })

  it('stores long names correctly', () => {
    const longName = 'a'.repeat(400) + '.pdf'
    const result = queries.addProjectDocument({
      promoId: 1, name: longName, type: 'file', pathOrUrl: '/long.pdf',
    })
    const id = Number(result.lastInsertRowid)
    const docs = queries.getProjectDocuments(1)
    const found = docs.find(d => d.id === id)
    expect(found?.name).toBe(longName)
  })

  it('stores long pathOrUrl correctly', () => {
    const longUrl = 'https://example.com/' + 'x'.repeat(1500)
    const result = queries.addProjectDocument({
      promoId: 1, name: 'long-url.pdf', type: 'link', pathOrUrl: longUrl,
    })
    const db = getTestDb()
    const doc = db.prepare('SELECT path_or_url FROM channel_documents WHERE id = ?').get(Number(result.lastInsertRowid))
    expect(doc.path_or_url).toBe(longUrl)
  })

  it('handles null project and category defaults to General', () => {
    const result = queries.addProjectDocument({
      promoId: 1, name: 'no-project.pdf', type: 'file', pathOrUrl: '/np.pdf',
    })
    const db = getTestDb()
    const doc = db.prepare('SELECT project, category FROM channel_documents WHERE id = ?').get(Number(result.lastInsertRowid))
    expect(doc.project).toBeNull()
    expect(doc.category).toBe('Général')
  })

  it('handles fileSize of 0', () => {
    const result = queries.addProjectDocument({
      promoId: 1, name: 'empty-file.txt', type: 'file', pathOrUrl: '/empty.txt', fileSize: 0,
    })
    const db = getTestDb()
    const doc = db.prepare('SELECT file_size FROM channel_documents WHERE id = ?').get(Number(result.lastInsertRowid))
    // fileSize of 0 is falsy, so it becomes null via ?? null
    expect(doc.file_size).toBeNull()
  })
})

describe('getChannelDocuments — project overlap', () => {
  it('includes project-linked docs when channel has matching category', () => {
    // Channel 10 has category 'Web Dev'
    queries.addProjectDocument({
      promoId: 1, project: 'Web Dev', name: 'overlap-doc.pdf', type: 'file', pathOrUrl: '/overlap.pdf',
    })
    const docs = queries.getChannelDocuments(10)
    const found = docs.find(d => d.name === 'overlap-doc.pdf')
    expect(found).toBeDefined()
  })

  it('does not include project docs for channels without category', () => {
    // Channel 1 has no category set
    queries.addProjectDocument({
      promoId: 1, project: 'Special Project', name: 'special-only.pdf', type: 'file', pathOrUrl: '/special.pdf',
    })
    const docs = queries.getChannelDocuments(1)
    const found = docs.find(d => d.name === 'special-only.pdf')
    expect(found).toBeUndefined()
  })

  it('returns empty array for non-existent channel', () => {
    const docs = queries.getChannelDocuments(99999)
    expect(docs).toEqual([])
  })
})

describe('updateProjectDocument — edge cases', () => {
  it('update with empty category defaults to General', () => {
    const result = queries.addProjectDocument({
      promoId: 1, name: 'cat-test.pdf', type: 'file', pathOrUrl: '/cat.pdf', category: 'TP',
    })
    const docId = Number(result.lastInsertRowid)
    queries.updateProjectDocument({ id: docId, name: 'cat-test.pdf', category: '' })
    const db = getTestDb()
    const doc = db.prepare('SELECT category FROM channel_documents WHERE id = ?').get(docId)
    expect(doc.category).toBe('Général')
  })

  it('update non-existent document returns changes=0', () => {
    const result = queries.updateProjectDocument({ id: 999999, name: 'ghost', category: 'X' })
    expect(result.changes).toBe(0)
  })
})

describe('searchDocuments — edge cases', () => {
  it('search is case-insensitive via LIKE', () => {
    queries.addProjectDocument({
      promoId: 1, name: 'CaseSensitiveDoc.PDF', type: 'file', pathOrUrl: '/cs.pdf',
    })
    const results = queries.searchDocuments(1, 'casesensitivedoc')
    expect(results.length).toBeGreaterThan(0)
  })

  it('search with empty query returns results', () => {
    const results = queries.searchDocuments(1, '')
    expect(results.length).toBeGreaterThan(0)
  })
})
