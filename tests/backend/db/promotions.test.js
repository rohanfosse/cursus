
const { setupTestDb, teardownTestDb } = require('../helpers/setup')

let promotions

beforeAll(() => {
  setupTestDb()
  promotions = require('../../../src/db/models/promotions')
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
