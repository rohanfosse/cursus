/**
 * Tests unitaires pour le modèle assignments (travaux/devoirs).
 */
const { setupTestDb, teardownTestDb } = require('../helpers/setup')

let queries

beforeAll(() => {
  setupTestDb()
  queries = require('../../../server/db/models/assignments')
})

afterAll(() => teardownTestDb())

describe('createTravail', () => {
  it('creates a devoir with required fields', () => {
    const result = queries.createTravail({
      title: 'CCTL Module 1',
      description: 'Session Initiale\nDurée : 20 min',
      type: 'cctl',
      channelId: 1,
      promoId: 1,
      deadline: '2026-04-15T10:00:00Z',
      published: true,
    })
    expect(result).toBeDefined()
    expect(result.changes).toBe(1)
    expect(Number(result.lastInsertRowid)).toBeGreaterThan(0)
  })

  it('creates a livrable with all fields', () => {
    const result = queries.createTravail({
      title: 'Rapport Final',
      description: 'Rapport de projet',
      type: 'livrable',
      channelId: 1,
      promoId: 1,
      deadline: '2026-05-01T23:59:00Z',
      startDate: '2026-03-01T00:00:00Z',
      category: 'monitor Développement Web',
      published: false,
      room: null,
      aavs: 'Compétence 1\nCompétence 2',
      requiresSubmission: true,
    })
    expect(result).toBeDefined()
    expect(result.changes).toBe(1)
  })

  it('creates a soutenance without submission', () => {
    const result = queries.createTravail({
      title: 'Soutenance Projet',
      type: 'soutenance',
      channelId: 1,
      promoId: 1,
      deadline: '2026-06-15T14:00:00Z',
      published: true,
      room: 'B204',
      requiresSubmission: false,
    })
    expect(result).toBeDefined()
    expect(result.changes).toBe(1)
  })

  it('retrieves created devoir by id', () => {
    const result = queries.createTravail({
      title: 'Test Retrieval',
      type: 'autre',
      channelId: 1,
      promoId: 1,
      deadline: '2026-04-20T10:00:00Z',
      published: true,
    })
    const id = Number(result.lastInsertRowid)
    const devoir = queries.getTravailById(id)
    expect(devoir).toBeDefined()
    expect(devoir.title).toBe('Test Retrieval')
    expect(devoir.type).toBe('autre')
  })
})

describe('getTravaux', () => {
  it('returns travaux for a channel', () => {
    const result = queries.getTravaux(1)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns empty array for non-existent channel', () => {
    const result = queries.getTravaux(9999)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
  })
})

describe('updateTravailPublished', () => {
  it('publishes a draft', () => {
    const result = queries.createTravail({
      title: 'Draft Test',
      type: 'livrable',
      channelId: 1,
      promoId: 1,
      deadline: '2026-05-01T00:00:00Z',
      published: false,
    })
    const id = Number(result.lastInsertRowid)
    queries.updateTravailPublished({ travailId: id, published: true })
    const devoir = queries.getTravailById(id)
    expect(devoir.is_published).toBe(1)
  })

  it('unpublishes a devoir', () => {
    const result = queries.createTravail({
      title: 'Unpublish Test',
      type: 'cctl',
      channelId: 1,
      promoId: 1,
      deadline: '2026-05-01T00:00:00Z',
      published: true,
    })
    const id = Number(result.lastInsertRowid)
    queries.updateTravailPublished({ travailId: id, published: false })
    const devoir = queries.getTravailById(id)
    expect(devoir.is_published).toBe(0)
  })
})

describe('deleteTravail', () => {
  it('deletes a devoir', () => {
    const result = queries.createTravail({
      title: 'Delete Me',
      type: 'autre',
      channelId: 1,
      promoId: 1,
      deadline: '2026-05-01T00:00:00Z',
      published: false,
    })
    const id = Number(result.lastInsertRowid)
    queries.deleteTravail(id)
    const devoir = queries.getTravailById(id)
    expect(devoir).toBeUndefined()
  })
})
