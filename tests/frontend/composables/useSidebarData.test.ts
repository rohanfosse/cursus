/**
 * Tests pour useSidebarData — logique de groupement canaux + filtrage.
 * On teste les computeds en injectant des donnees dans les refs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock stores + window.api
vi.mock('@/stores/app', () => ({
  useAppStore: vi.fn(() => ({
    currentUser: { id: 1, name: 'Test', type: 'student', promo_id: 1, promo_name: 'Promo A' },
    activePromoId: 1,
    isStaff: false,
    isTeacher: false,
    taChannelIds: [],
  })),
}))

vi.stubGlobal('window', {
  api: {
    getPromotions: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    getChannels: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    getStudents: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    getAllStudents: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    getTeachers: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  },
})

vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
})

import { useSidebarData, NO_CAT } from '@/composables/useSidebarData'
import type { Channel } from '@/types'

function makeChannel(overrides: Partial<Channel> & { id: number; name: string }): Channel {
  return {
    promo_id: 1,
    type: 'chat',
    is_private: false,
    category: null,
    description: null,
    members: [],
    archived: 0,
    ...overrides,
  } as Channel
}

describe('useSidebarData', () => {
  let sidebar: ReturnType<typeof useSidebarData>

  beforeEach(() => {
    sidebar = useSidebarData()
  })

  describe('channelGroups', () => {
    it('groups channels by category', () => {
      sidebar.channels.value = [
        makeChannel({ id: 1, name: 'general', category: 'Info' }),
        makeChannel({ id: 2, name: 'annonces', category: 'Info' }),
        makeChannel({ id: 3, name: 'projet', category: 'Projet Web' }),
      ]
      const groups = sidebar.channelGroups.value
      expect(groups.length).toBe(2)
      expect(groups.find(g => g.key === 'Info')?.channels.length).toBe(2)
      expect(groups.find(g => g.key === 'Projet Web')?.channels.length).toBe(1)
    })

    it('puts uncategorized channels in NO_CAT group', () => {
      sidebar.channels.value = [
        makeChannel({ id: 1, name: 'general', category: null }),
        makeChannel({ id: 2, name: 'random', category: '' }),
      ]
      const groups = sidebar.channelGroups.value
      expect(groups.length).toBe(1)
      expect(groups[0].key).toBe(NO_CAT)
      expect(groups[0].channels.length).toBe(2)
    })

    it('labels NO_CAT as "Autres" when other categories exist', () => {
      sidebar.channels.value = [
        makeChannel({ id: 1, name: 'general', category: null }),
        makeChannel({ id: 2, name: 'cours', category: 'Cours' }),
      ]
      const groups = sidebar.channelGroups.value
      const noCat = groups.find(g => g.key === NO_CAT)
      expect(noCat?.label).toBe('Autres')
    })

    it('labels NO_CAT as "Canaux" when it is the only group', () => {
      sidebar.channels.value = [
        makeChannel({ id: 1, name: 'general', category: null }),
      ]
      const groups = sidebar.channelGroups.value
      expect(groups[0].label).toBe('Canaux')
    })

    it('returns empty for no channels', () => {
      sidebar.channels.value = []
      expect(sidebar.channelGroups.value).toEqual([])
    })
  })

  describe('visibleChannels', () => {
    it('shows all channels for student (non-private)', () => {
      sidebar.channels.value = [
        makeChannel({ id: 1, name: 'general', is_private: false }),
        makeChannel({ id: 2, name: 'secret', is_private: true, members: [1] }),
        makeChannel({ id: 3, name: 'other-private', is_private: true, members: [99] }),
      ]
      const visible = sidebar.visibleChannels.value
      expect(visible.length).toBe(2) // general + secret (user id=1 is member)
    })

    it('handles members as JSON string', () => {
      sidebar.channels.value = [
        makeChannel({ id: 1, name: 'private', is_private: true, members: '[1, 2, 3]' as unknown as number[] }),
      ]
      const visible = sidebar.visibleChannels.value
      expect(visible.length).toBe(1)
    })

    it('handles corrupted members JSON gracefully', () => {
      sidebar.channels.value = [
        makeChannel({ id: 1, name: 'broken', is_private: true, members: 'not json' as unknown as number[] }),
      ]
      const visible = sidebar.visibleChannels.value
      expect(visible.length).toBe(0)
    })
  })

  describe('activePromoName', () => {
    it('returns promo name from promotions list', () => {
      sidebar.promotions.value = [
        { id: 1, name: 'Promo A', color: '#fff' },
        { id: 2, name: 'Promo B', color: '#000' },
      ]
      expect(sidebar.activePromoName.value).toBe('Promo A')
    })

    it('falls back to user promo_name', () => {
      sidebar.promotions.value = []
      expect(sidebar.activePromoName.value).toBe('Promo A') // from mock currentUser
    })
  })

  describe('NO_CAT constant', () => {
    it('is a string', () => {
      expect(typeof NO_CAT).toBe('string')
      expect(NO_CAT).toBe('__no_category__')
    })
  })
})
