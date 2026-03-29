
const { setupTestDb, teardownTestDb } = require('../helpers/setup')

let promotions

beforeAll(() => {
  setupTestDb()
  promotions = require('../../../server/db/models/promotions')
})
afterAll(() => teardownTestDb())

describe('promotions model', () => {
  it('getPromotions returns seeded promos', () => {
    const promos = promotions.getPromotions()
    expect(promos.length).toBeGreaterThan(0)
    expect(promos[0].name).toBe('Promo Test')
  })

  it('createPromotion creates a promo with default channels', () => {
    const id = promotions.createPromotion({ name: 'Promo 2', color: '#FF0000' })
    expect(Number(id)).toBeGreaterThan(0)

    const channels = promotions.getChannels(Number(id))
    expect(channels.length).toBe(2) // annonces + general
    const names = channels.map((c) => c.name)
    expect(names).toContain('annonces')
    expect(names).toContain('general')
  })

  it('getChannels returns channels for a promo', () => {
    const channels = promotions.getChannels(1)
    expect(channels.length).toBe(2)
  })

  it('createChannel adds a new channel', () => {
    const id = promotions.createChannel({
      promoId: 1,
      name: 'test-channel',
      type: 'chat',
      isPrivate: false,
      members: null,
      category: null,
    })
    expect(Number(id)).toBeGreaterThan(0)

    const channels = promotions.getChannels(1)
    expect(channels.find((c) => c.name === 'test-channel')).toBeDefined()
  })

  it('renameChannel changes the channel name', () => {
    const channels = promotions.getChannels(1)
    const ch = channels.find((c) => c.name === 'test-channel')
    promotions.renameChannel(ch.id, 'renamed-channel')

    const updated = promotions.getChannels(1)
    expect(updated.find((c) => c.name === 'renamed-channel')).toBeDefined()
    expect(updated.find((c) => c.name === 'test-channel')).toBeUndefined()
  })

  it('deleteChannel removes the channel', () => {
    const channels = promotions.getChannels(1)
    const ch = channels.find((c) => c.name === 'renamed-channel')
    promotions.deleteChannel(ch.id)

    const after = promotions.getChannels(1)
    expect(after.find((c) => c.name === 'renamed-channel')).toBeUndefined()
  })

  it('deletePromotion removes the promo', () => {
    const promos = promotions.getPromotions()
    const promo2 = promos.find((p) => p.name === 'Promo 2')
    promotions.deletePromotion(promo2.id)

    const after = promotions.getPromotions()
    expect(after.find((p) => p.name === 'Promo 2')).toBeUndefined()
  })
})

// ─── archiveChannel / restoreChannel — epic canaux-ameliorations #84 ─────────
describe('archiveChannel / restoreChannel', () => {
  let chId

  beforeAll(() => {
    chId = promotions.createChannel({
      promoId: 1,
      name: 'canal-archive-model',
      type: 'chat',
      isPrivate: false,
      members: null,
      category: null,
    })
    chId = Number(chId)
  })

  it('archiveChannel positionne archived = 1', () => {
    promotions.archiveChannel(chId)
    const { getDb } = require('../../../server/db/connection')
    const row = getDb().prepare('SELECT archived FROM channels WHERE id = ?').get(chId)
    expect(row.archived).toBe(1)
  })

  it('getChannels exclut les canaux archives', () => {
    const channels = promotions.getChannels(1)
    const found = channels.find((c) => c.id === chId)
    expect(found).toBeUndefined()
  })

  it('restoreChannel positionne archived = 0', () => {
    promotions.restoreChannel(chId)
    const { getDb } = require('../../../server/db/connection')
    const row = getDb().prepare('SELECT archived FROM channels WHERE id = ?').get(chId)
    expect(row.archived).toBe(0)
  })

  it('getChannels inclut a nouveau le canal restaure', () => {
    const channels = promotions.getChannels(1)
    const found = channels.find((c) => c.id === chId)
    expect(found).toBeDefined()
    expect(found.name).toBe('canal-archive-model')
  })

  it('getArchivedChannels retourne uniquement les archives', () => {
    // Archiver notre canal de test
    promotions.archiveChannel(chId)

    // Creer un deuxieme canal archive direct via DB pour s'assurer qu'il y en a au moins un
    const archived = promotions.getArchivedChannels(1)
    expect(Array.isArray(archived)).toBe(true)
    expect(archived.length).toBeGreaterThan(0)
    const allArchived = archived.every((c) => c.archived === 1)
    expect(allArchived).toBe(true)
  })

  it('getArchivedChannels ne retourne pas les canaux actifs', () => {
    const archived = promotions.getArchivedChannels(1)
    const names = archived.map((c) => c.name)
    // 'general' et 'annonces' sont des canaux actifs (archived=0)
    expect(names).not.toContain('general')
    expect(names).not.toContain('annonces')
  })
})
