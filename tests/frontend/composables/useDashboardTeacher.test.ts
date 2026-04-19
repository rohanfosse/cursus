import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ── Mocks ────────────────────────────────────────────────────────────────────
const showToast = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast }),
}))

vi.mock('@/composables/useApi', () => ({
  useApi: () => ({ api: vi.fn().mockResolvedValue(null) }),
}))

vi.mock('@/composables/useConfirm', () => ({
  useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
}))

vi.mock('@/constants', () => ({
  STORAGE_KEYS: { SESSION: 's', NAV_STATE: 'n', PREFS: 'p', MUTED_DMS: 'm' },
  NOTIFICATION_HISTORY_LIMIT: 50,
  MAX_MESSAGE_LENGTH: 5000,
  MESSAGE_PAGE_SIZE: 50,
  GROUP_THRESHOLD_MS: 300000,
  TYPING_TIMEOUT_MS: 3000,
}))

const localStorageMock = {
  getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(),
  clear: vi.fn(), length: 0, key: vi.fn(() => null),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

;(window as unknown as { api: Record<string, unknown> }).api = {
  setToken: vi.fn(),
  onSocketStateChange: vi.fn(() => () => {}),
  onNewMessage: vi.fn(() => () => {}),
  onPresenceUpdate: vi.fn(() => () => {}),
  getPromotions: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  getAllStudents: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  getGanttData: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  getTeacherSchedule: vi.fn().mockResolvedValue({ ok: true, data: { aNoter: [], brouillons: [] } }),
  getTeacherReminders: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  getTeacherChannels: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  renamePromotion: vi.fn().mockResolvedValue({ ok: true }),
  deletePromotion: vi.fn().mockResolvedValue({ ok: true }),
  toggleReminderDone: vi.fn().mockResolvedValue({ ok: true }),
}

import { useDashboardTeacher, type GanttRow, type Reminder } from '@/composables/useDashboardTeacher'
import { useAppStore } from '@/stores/app'

function makeGanttRow(overrides: Partial<GanttRow> = {}): GanttRow {
  return {
    id: 1, title: 'TP1', deadline: '2030-06-01', start_date: null,
    type: 'livrable', published: 1, category: 'Web', channel_name: 'general',
    promo_name: 'Promo A', promo_color: '#4A90D9', depots_count: 5, students_total: 30,
    ...overrides,
  }
}

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 1, promo_tag: 'P1', date: new Date().toISOString().slice(0, 10),
    title: 'Rappel', description: '', bloc: null, done: 0,
    ...overrides,
  }
}

describe('useDashboardTeacher', () => {
  let appStore: ReturnType<typeof useAppStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    appStore = useAppStore()
    appStore.currentUser = { id: -1, name: 'Prof', avatar_initials: 'P', photo_data: null, type: 'teacher', promo_id: null, promo_name: null }
  })

  it('initializes with loading state', () => {
    const dashboard = useDashboardTeacher()
    expect(dashboard.loadingTeacher.value).toBe(true)
    expect(dashboard.aNoterCount.value).toBe(0)
    expect(dashboard.brouillonsCount.value).toBe(0)
    expect(dashboard.promos.value).toEqual([])
  })

  // ── ganttFiltered ─────────────────────────────────────────────────────
  it('ganttFiltered returns all when no active promo', () => {
    const dashboard = useDashboardTeacher()
    dashboard.ganttAll.value = [
      makeGanttRow({ id: 1, promo_name: 'Promo A' }),
      makeGanttRow({ id: 2, promo_name: 'Promo B' }),
    ]
    appStore.activePromoId = null
    expect(dashboard.ganttFiltered.value.length).toBe(2)
  })

  it('ganttFiltered filters by active promo', () => {
    const dashboard = useDashboardTeacher()
    dashboard.promos.value = [{ id: 1, name: 'Promo A', color: '#000', archived: 0 }]
    dashboard.ganttAll.value = [
      makeGanttRow({ id: 1, promo_name: 'Promo A' }),
      makeGanttRow({ id: 2, promo_name: 'Promo B' }),
    ]
    appStore.activePromoId = 1
    expect(dashboard.ganttFiltered.value.length).toBe(1)
    expect(dashboard.ganttFiltered.value[0].promo_name).toBe('Promo A')
  })

  // ── urgentsCount ──────────────────────────────────────────────────────
  it('urgentsCount counts published devoirs due this week', () => {
    const dashboard = useDashboardTeacher()
    const now = new Date()
    const inThreeDays = new Date(now.getTime() + 3 * 86_400_000).toISOString()
    const inTwoWeeks = new Date(now.getTime() + 14 * 86_400_000).toISOString()
    dashboard.ganttAll.value = [
      makeGanttRow({ id: 1, deadline: inThreeDays, published: 1 }),
      makeGanttRow({ id: 2, deadline: inTwoWeeks, published: 1 }),
      makeGanttRow({ id: 3, deadline: inThreeDays, published: 0 }), // unpublished
    ]
    expect(dashboard.urgentsCount.value).toBe(1)
  })

  // ── projectCards ──────────────────────────────────────────────────────
  it('projectCards groups by category', () => {
    const dashboard = useDashboardTeacher()
    dashboard.ganttAll.value = [
      makeGanttRow({ id: 1, category: 'Web', depots_count: 5, students_total: 30 }),
      makeGanttRow({ id: 2, category: 'Web', depots_count: 10, students_total: 30 }),
      makeGanttRow({ id: 3, category: 'Data', depots_count: 3, students_total: 25 }),
    ]
    const cards = dashboard.projectCards.value
    expect(cards.length).toBe(2)
    const webCard = cards.find(c => c.key === 'Web')
    expect(webCard).toBeDefined()
    expect(webCard!.total).toBe(2)
    expect(webCard!.depots).toBe(15)
  })

  it('projectCards ignores items without category', () => {
    const dashboard = useDashboardTeacher()
    dashboard.ganttAll.value = [
      makeGanttRow({ id: 1, category: null }),
      makeGanttRow({ id: 2, category: '' }),
      makeGanttRow({ id: 3, category: 'Web' }),
    ]
    expect(dashboard.projectCards.value.length).toBe(1)
  })

  // ── thisWeekReminders ─────────────────────────────────────────────────
  it('thisWeekReminders includes overdue undone reminders', () => {
    const dashboard = useDashboardTeacher()
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    dashboard.allReminders.value = [
      makeReminder({ id: 1, date: yesterday, done: 0 }),
    ]
    const reminders = dashboard.thisWeekReminders.value
    expect(reminders.length).toBe(1)
    expect(reminders[0].isOverdue).toBe(true)
  })

  it('thisWeekReminders sorts done after undone', () => {
    const dashboard = useDashboardTeacher()
    // Utilise la date locale du midi (12:00) pour eviter les bugs de
    // boundary lorsque le test tourne a minuit (toISOString = UTC, local
    // peut etre la veille ou le lendemain).
    const now = new Date()
    const localNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)
    const today = localNoon.toISOString().slice(0, 10)
    dashboard.allReminders.value = [
      makeReminder({ id: 1, date: today, done: 1 }),
      makeReminder({ id: 2, date: today, done: 0 }),
    ]
    const reminders = dashboard.thisWeekReminders.value
    expect(reminders[0].done).toBe(0) // undone first
    expect(reminders[1].done).toBe(1)
  })

  // ── studentsForPromo ──────────────────────────────────────────────────
  it('studentsForPromo filters by active promo', () => {
    const dashboard = useDashboardTeacher()
    dashboard.promos.value = [{ id: 1, name: 'Promo A', color: '#000', archived: 0 }]
    dashboard.allStudents.value = [
      { id: 1, promo_id: 1 },
      { id: 2, promo_id: 2 },
    ]
    appStore.activePromoId = 1
    expect(dashboard.studentsForPromo.value.length).toBe(1)
    expect(dashboard.totalStudents.value).toBe(1)
  })
})
