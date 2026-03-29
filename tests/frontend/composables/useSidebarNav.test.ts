import { describe, it, expect } from 'vitest'
import type { Channel } from '@/types'

// ─── Mocks minimaux requis par le module ────────────────────────────────────

import { vi } from 'vitest'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute:  () => ({ name: 'messages' }),
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    activeChannelId:   null,
    activeDmStudentId: null,
    activeProject:     null,
    openChannel:       vi.fn(),
  }),
}))

vi.mock('@/constants', () => ({
  STORAGE_KEYS: {
    SESSION:   'cc_session',
    NAV_STATE: 'cc_nav_state',
    PREFS:     'cc_prefs',
    MUTED_DMS: 'cc_muted_dms',
  },
  NOTIFICATION_HISTORY_LIMIT: 50,
}))

// L'import doit etre apres les mocks
import { channelMemberCount } from '../../../src/renderer/src/composables/useSidebarNav'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id:         1,
    name:       'general',
    promo_id:   1,
    type:       'chat',
    is_private: false,
    members:    undefined,
    ...overrides,
  }
}

// ─── Tests channelMemberCount ────────────────────────────────────────────────

describe('channelMemberCount', () => {
  it('retourne null pour un canal public (is_private=false)', () => {
    const ch = makeChannel({ is_private: false, members: [1, 2, 3] })
    expect(channelMemberCount(ch)).toBeNull()
  })

  it('retourne null pour un canal public (is_private=0)', () => {
    const ch = makeChannel({ is_private: 0, members: [1, 2] })
    expect(channelMemberCount(ch)).toBeNull()
  })

  it('retourne le nombre de membres pour un canal prive avec membres', () => {
    const ch = makeChannel({ is_private: true, members: [1, 2, 3] })
    expect(channelMemberCount(ch)).toBe(3)
  })

  it('retourne null pour un canal prive avec membres vide (tableau vide)', () => {
    const ch = makeChannel({ is_private: true, members: [] })
    expect(channelMemberCount(ch)).toBeNull()
  })

  it('retourne null pour un canal prive sans champ members (undefined)', () => {
    const ch = makeChannel({ is_private: true, members: undefined })
    expect(channelMemberCount(ch)).toBeNull()
  })

  it('retourne null pour un canal prive avec members=null', () => {
    // cast pour tester la robustesse
    const ch = makeChannel({ is_private: true, members: null as unknown as number[] })
    expect(channelMemberCount(ch)).toBeNull()
  })

  it('retourne 1 pour un canal prive avec un seul membre', () => {
    const ch = makeChannel({ is_private: true, members: [42] })
    expect(channelMemberCount(ch)).toBe(1)
  })

  it('retourne null pour un canal prive (is_private=1) sans membres', () => {
    const ch = makeChannel({ is_private: 1, members: undefined })
    expect(channelMemberCount(ch)).toBeNull()
  })
})
