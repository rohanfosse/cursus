/**
 * Tests pour useStudentBadges — systeme de badges gamification etudiants.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('@/composables/useApi', () => ({
  useApi: () => ({ api: vi.fn().mockResolvedValue(null) }),
}))

vi.mock('@/composables/useOfflineCache', () => ({
  cacheData: vi.fn(),
  loadCached: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/utils/date', () => ({
  deadlineClass: vi.fn(() => 'deadline-ok'),
}))

const localStorageMock = {
  getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(),
  clear: vi.fn(), length: 0, key: vi.fn(() => null),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

;(window as unknown as { api: Record<string, unknown> }).api = {
  setToken: vi.fn(),
  getStudentTravaux: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}

import { useStudentBadges } from '@/composables/useStudentBadges'
import { useTravauxStore } from '@/stores/travaux'

interface MockDevoir {
  id: number
  title: string
  deadline: string
  depot_id: number | null
  note: string | null
  requires_submission: number
}

function makeDevoir(overrides: Partial<MockDevoir> = {}): MockDevoir {
  return {
    id: 1,
    title: 'TP1',
    deadline: '2030-06-01',
    depot_id: null,
    note: null,
    requires_submission: 1,
    ...overrides,
  }
}

describe('useStudentBadges', () => {
  let travauxStore: ReturnType<typeof useTravauxStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    travauxStore = useTravauxStore()
    travauxStore.devoirs = []
  })

  // ── Badge count helpers ───────────────────────────────────────────────────
  it('returns 8 badges total', () => {
    const { badges, totalCount } = useStudentBadges()
    expect(badges.value.length).toBe(8)
    expect(totalCount.value).toBe(8)
  })

  it('earnedCount is 0 when no devoirs', () => {
    const { earnedCount } = useStudentBadges()
    expect(earnedCount.value).toBe(0)
  })

  // ── first-submit ──────────────────────────────────────────────────────────
  it('earns first-submit with 1 submitted devoir', () => {
    travauxStore.devoirs = [makeDevoir({ id: 1, depot_id: 10 })] as never[]
    const { badges } = useStudentBadges()
    const badge = badges.value.find(b => b.id === 'first-submit')
    expect(badge?.earned).toBe(true)
  })

  it('does not earn first-submit with 0 submissions', () => {
    travauxStore.devoirs = [makeDevoir({ id: 1, depot_id: null })] as never[]
    const { badges } = useStudentBadges()
    const badge = badges.value.find(b => b.id === 'first-submit')
    expect(badge?.earned).toBe(false)
  })

  // ── five-submits ──────────────────────────────────────────────────────────
  it('earns five-submits with 5 submitted devoirs', () => {
    travauxStore.devoirs = Array.from({ length: 5 }, (_, i) =>
      makeDevoir({ id: i + 1, depot_id: i + 100 }),
    ) as never[]
    const { badges } = useStudentBadges()
    expect(badges.value.find(b => b.id === 'five-submits')?.earned).toBe(true)
  })

  it('does not earn five-submits with 4 submissions', () => {
    travauxStore.devoirs = Array.from({ length: 4 }, (_, i) =>
      makeDevoir({ id: i + 1, depot_id: i + 100 }),
    ) as never[]
    const { badges } = useStudentBadges()
    expect(badges.value.find(b => b.id === 'five-submits')?.earned).toBe(false)
  })

  // ── ten-submits ───────────────────────────────────────────────────────────
  it('earns ten-submits with 10 submitted devoirs', () => {
    travauxStore.devoirs = Array.from({ length: 10 }, (_, i) =>
      makeDevoir({ id: i + 1, depot_id: i + 100 }),
    ) as never[]
    const { badges } = useStudentBadges()
    expect(badges.value.find(b => b.id === 'ten-submits')?.earned).toBe(true)
  })

  // ── all-submitted (zero retard) ───────────────────────────────────────────
  it('earns all-submitted when all devoirs have depot or no submission required', () => {
    travauxStore.devoirs = [
      makeDevoir({ id: 1, depot_id: 10 }),
      makeDevoir({ id: 2, depot_id: null, requires_submission: 0 }),
    ] as never[]
    const { badges } = useStudentBadges()
    expect(badges.value.find(b => b.id === 'all-submitted')?.earned).toBe(true)
  })

  it('does not earn all-submitted when a required devoir is missing depot', () => {
    travauxStore.devoirs = [
      makeDevoir({ id: 1, depot_id: 10 }),
      makeDevoir({ id: 2, depot_id: null, requires_submission: 1 }),
    ] as never[]
    const { badges } = useStudentBadges()
    expect(badges.value.find(b => b.id === 'all-submitted')?.earned).toBe(false)
  })

  it('does not earn all-submitted when devoirs is empty', () => {
    travauxStore.devoirs = []
    const { badges } = useStudentBadges()
    expect(badges.value.find(b => b.id === 'all-submitted')?.earned).toBe(false)
  })

  // ── first-a ───────────────────────────────────────────────────────────────
  it('earns first-a with one A grade', () => {
    travauxStore.devoirs = [makeDevoir({ id: 1, depot_id: 10, note: 'A' })] as never[]
    const { badges } = useStudentBadges()
    expect(badges.value.find(b => b.id === 'first-a')?.earned).toBe(true)
  })

  it('first-a is case-insensitive (lowercase a)', () => {
    travauxStore.devoirs = [makeDevoir({ id: 1, depot_id: 10, note: 'a' })] as never[]
    const { badges } = useStudentBadges()
    expect(badges.value.find(b => b.id === 'first-a')?.earned).toBe(true)
  })

  // ── three-a ───────────────────────────────────────────────────────────────
  it('earns three-a with 3 A grades', () => {
    travauxStore.devoirs = Array.from({ length: 3 }, (_, i) =>
      makeDevoir({ id: i + 1, depot_id: i + 100, note: 'A' }),
    ) as never[]
    const { badges } = useStudentBadges()
    expect(badges.value.find(b => b.id === 'three-a')?.earned).toBe(true)
  })

  it('does not earn three-a with 2 A grades', () => {
    travauxStore.devoirs = [
      makeDevoir({ id: 1, depot_id: 10, note: 'A' }),
      makeDevoir({ id: 2, depot_id: 11, note: 'A' }),
      makeDevoir({ id: 3, depot_id: 12, note: 'B' }),
    ] as never[]
    const { badges } = useStudentBadges()
    expect(badges.value.find(b => b.id === 'three-a')?.earned).toBe(false)
  })

  // ── graded ────────────────────────────────────────────────────────────────
  it('earns graded with one graded devoir (non-NA)', () => {
    travauxStore.devoirs = [makeDevoir({ id: 1, depot_id: 10, note: 'B' })] as never[]
    const { badges } = useStudentBadges()
    expect(badges.value.find(b => b.id === 'graded')?.earned).toBe(true)
  })

  it('does not earn graded when only NA notes', () => {
    travauxStore.devoirs = [makeDevoir({ id: 1, depot_id: 10, note: 'NA' })] as never[]
    const { badges } = useStudentBadges()
    expect(badges.value.find(b => b.id === 'graded')?.earned).toBe(false)
  })

  // ── half-done ─────────────────────────────────────────────────────────────
  it('earns half-done when half of devoirs are submitted', () => {
    travauxStore.devoirs = [
      makeDevoir({ id: 1, depot_id: 10 }),
      makeDevoir({ id: 2, depot_id: null }),
    ] as never[]
    const { badges } = useStudentBadges()
    expect(badges.value.find(b => b.id === 'half-done')?.earned).toBe(true)
  })

  it('does not earn half-done when less than half submitted', () => {
    travauxStore.devoirs = [
      makeDevoir({ id: 1, depot_id: 10 }),
      makeDevoir({ id: 2, depot_id: null }),
      makeDevoir({ id: 3, depot_id: null }),
    ] as never[]
    const { badges } = useStudentBadges()
    expect(badges.value.find(b => b.id === 'half-done')?.earned).toBe(false)
  })

  // ── Multiple badges at once ───────────────────────────────────────────────
  it('earns multiple badges simultaneously', () => {
    travauxStore.devoirs = Array.from({ length: 5 }, (_, i) =>
      makeDevoir({ id: i + 1, depot_id: i + 100, note: 'A' }),
    ) as never[]
    const { earnedCount } = useStudentBadges()
    // Should earn: first-submit, five-submits, all-submitted, first-a, three-a, graded, half-done
    expect(earnedCount.value).toBeGreaterThanOrEqual(7)
  })
})
