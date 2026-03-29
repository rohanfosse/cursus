import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { User } from '@/types'

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@/composables/useApi', () => ({
  useApi: () => ({ api: vi.fn().mockResolvedValue(null) }),
}))

vi.mock('@/utils/permissions', () => ({
  hasRole: (userRole: string | undefined, required: string) => {
    const levels: Record<string, number> = { student: 0, ta: 1, teacher: 2, admin: 3 }
    return (levels[userRole ?? ''] ?? -1) >= (levels[required] ?? Infinity)
  },
}))

vi.mock('@/constants', () => ({
  STORAGE_KEYS: {
    SESSION: 'cc_session',
    NAV_STATE: 'cc_nav_state',
    PREFS: 'cc_prefs',
    MUTED_DMS: 'cc_muted_dms',
  },
  NOTIFICATION_HISTORY_LIMIT: 50,
}))

const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k] }),
  length: 0,
  key: vi.fn(() => null),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

const setTokenMock = vi.fn()
const onSocketStateChangeMock = vi.fn(() => () => {})
const onNewMessageMock = vi.fn(() => () => {})
const onPresenceUpdateMock = vi.fn(() => () => {})
const getTeacherChannelsMock = vi.fn().mockResolvedValue({ ok: true, data: [] })

;(window as unknown as { api: Record<string, unknown> }).api = {
  setToken: setTokenMock,
  onSocketStateChange: onSocketStateChangeMock,
  onNewMessage: onNewMessageMock,
  onPresenceUpdate: onPresenceUpdateMock,
  getTeacherChannels: getTeacherChannelsMock,
}

import { useAppStore } from '@/stores/app'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    name: 'Jean Dupont',
    avatar_initials: 'JD',
    photo_data: null,
    type: 'student',
    promo_id: 7,
    promo_name: 'Promo A',
    must_change_password: 0,
    ...overrides,
  }
}

describe('app store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  // ── Initial state ──────────────────────────────────────────────────────────

  it('has null currentUser initially', () => {
    const s = useAppStore()
    expect(s.currentUser).toBeNull()
    expect(s.activeChannelId).toBeNull()
    expect(s.activeDmStudentId).toBeNull()
  })

  // ── Computed roles ─────────────────────────────────────────────────────────

  it('isStudent is true for student user', () => {
    const s = useAppStore()
    s.currentUser = makeUser({ type: 'student' })
    expect(s.isStudent).toBe(true)
    expect(s.isTeacher).toBe(false)
    expect(s.isAdmin).toBe(false)
  })

  it('isTeacher is true for teacher user', () => {
    const s = useAppStore()
    s.currentUser = makeUser({ type: 'teacher' })
    expect(s.isTeacher).toBe(true)
  })

  it('isAdmin is true for admin user', () => {
    const s = useAppStore()
    s.currentUser = makeUser({ type: 'admin' })
    expect(s.isAdmin).toBe(true)
  })

  it('isReadonly is true for students in annonce channels', () => {
    const s = useAppStore()
    s.currentUser = makeUser({ type: 'student' })
    s.activeChannelType = 'annonce'
    expect(s.isReadonly).toBe(true)
  })

  it('isReadonly is false for teachers in annonce channels', () => {
    const s = useAppStore()
    s.currentUser = makeUser({ type: 'teacher' })
    s.activeChannelType = 'annonce'
    expect(s.isReadonly).toBe(false)
  })

  // ── Login / Logout ─────────────────────────────────────────────────────────

  it('login sets currentUser and persists to localStorage', () => {
    const s = useAppStore()
    const user = makeUser()
    s.login(user)
    expect(s.currentUser).toEqual(user)
    expect(localStorageMock.setItem).toHaveBeenCalledWith('cc_session', JSON.stringify(user))
  })

  it('logout clears currentUser and removes session', () => {
    const s = useAppStore()
    s.login(makeUser())
    s.logout()
    expect(s.currentUser).toBeNull()
    expect(s.activeChannelId).toBeNull()
    expect(s.activeDmStudentId).toBeNull()
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('cc_session')
  })

  // ── restoreSession ─────────────────────────────────────────────────────────

  it('restoreSession returns true and sets user when session exists', () => {
    const user = makeUser()
    store['cc_session'] = JSON.stringify(user)
    const s = useAppStore()
    const ok = s.restoreSession()
    expect(ok).toBe(true)
    expect(s.currentUser).toEqual(user)
  })

  it('restoreSession returns false when no session', () => {
    const s = useAppStore()
    const ok = s.restoreSession()
    expect(ok).toBe(false)
  })

  it('restoreSession handles corrupt session gracefully', () => {
    store['cc_session'] = '{corrupt!!!'
    const s = useAppStore()
    const ok = s.restoreSession()
    expect(ok).toBe(false)
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('cc_session')
  })

  // ── Navigation ─────────────────────────────────────────────────────────────

  it('openChannel sets active channel and clears DM', () => {
    const s = useAppStore()
    s.openChannel(5, 7, 'general', 'chat', 'A description')
    expect(s.activeChannelId).toBe(5)
    expect(s.activePromoId).toBe(7)
    expect(s.activeChannelName).toBe('general')
    expect(s.activeChannelDescription).toBe('A description')
    expect(s.activeDmStudentId).toBeNull()
    expect(s.activeDmPeerId).toBeNull()
  })

  it('openDm sets DM state and clears channel (student-to-student min/max)', () => {
    const s = useAppStore()
    s.currentUser = makeUser({ id: 1 })
    s.openDm(42, 7, 'Alice')
    // Student-to-student: box = min(1,42), peer = max(1,42)
    expect(s.activeDmStudentId).toBe(1)
    expect(s.activeDmPeerId).toBe(42)
    expect(s.activeChannelId).toBeNull()
    expect(s.activeChannelName).toBe('Alice')
  })

  it('openDm student-to-teacher keeps student as box owner', () => {
    const s = useAppStore()
    s.currentUser = makeUser({ id: 5 })
    s.openDm(-1, 7, 'Prof Martin')
    expect(s.activeDmStudentId).toBe(5)
    expect(s.activeDmPeerId).toBe(-1)
    expect(s.activeChannelName).toBe('Prof Martin')
  })

  // ── Unread ─────────────────────────────────────────────────────────────────

  it('markRead clears unread and mention for a channel', () => {
    const s = useAppStore()
    s.unread = { 5: 3, 10: 1 }
    s.mentionChannels = { 5: 2 }
    s.markRead(5)
    expect(s.unread[5]).toBeUndefined()
    expect(s.mentionChannels[5]).toBeUndefined()
    expect(s.unread[10]).toBe(1)
  })

  it('markAllRead clears all unread, mentions, and DM unread', () => {
    const s = useAppStore()
    s.unread = { 5: 3 }
    s.mentionChannels = { 5: 2 }
    s.unreadDms = { Alice: 1 }
    s.markAllRead()
    expect(s.unread).toEqual({})
    expect(s.mentionChannels).toEqual({})
    expect(s.unreadDms).toEqual({})
  })

  // ── Simulation ─────────────────────────────────────────────────────────────

  it('startSimulation saves teacher and switches to student', () => {
    const s = useAppStore()
    const teacher = makeUser({ id: -1, type: 'teacher' })
    const student = makeUser({ id: 10, type: 'student', promo_id: 5 })
    s.currentUser = teacher
    s.activeChannelId = 99
    s.startSimulation(student)
    expect(s.currentUser).toEqual(student)
    expect(s.isSimulating).toBe(true)
    expect(s.activeChannelId).toBeNull()
    expect(s.activePromoId).toBe(5)
  })

  it('stopSimulation restores teacher user', () => {
    const s = useAppStore()
    const teacher = makeUser({ id: -1, type: 'teacher' })
    s.currentUser = teacher
    s.startSimulation(makeUser({ id: 10, type: 'student', promo_id: 5 }))
    s.stopSimulation()
    expect(s.currentUser).toEqual(teacher)
    expect(s.isSimulating).toBe(false)
  })

  // ── clearMustChangePassword ────────────────────────────────────────────────

  it('clearMustChangePassword sets flag to 0', () => {
    const s = useAppStore()
    s.login(makeUser({ must_change_password: 1 }))
    s.clearMustChangePassword()
    expect(s.currentUser!.must_change_password).toBe(0)
  })

  // ── DM mute ────────────────────────────────────────────────────────────────

  it('muteDm / unmuteDm / isDmMuted work together', () => {
    const s = useAppStore()
    expect(s.isDmMuted('Alice')).toBe(false)
    s.muteDm('Alice')
    expect(s.isDmMuted('Alice')).toBe(true)
    s.unmuteDm('Alice')
    expect(s.isDmMuted('Alice')).toBe(false)
  })

  // ── addNotification ────────────────────────────────────────────────────────

  it('addNotification adds entry to history', () => {
    const s = useAppStore()
    s.addNotification({
      category: 'message',
      title: 'Test',
      preview: 'Hello',
      silent: true,
    })
    expect(s.notificationHistory.length).toBe(1)
    expect(s.notificationHistory[0].title).toBe('Test')
    expect(s.notificationHistory[0].read).toBe(false)
  })

  // ── Presence ───────────────────────────────────────────────────────────────

  it('isUserOnline checks the onlineUsers list', () => {
    const s = useAppStore()
    s.onlineUsers = [{ id: 1, name: 'Jean Dupont', role: 'student' }]
    expect(s.isUserOnline('Jean Dupont')).toBe(true)
    expect(s.isUserOnline('Alice')).toBe(false)
  })

  // ── activeChannelArchived — epic canaux-ameliorations #84 ──────────────────

  it('openChannel positionne activeChannelArchived a true quand archived=true', () => {
    const s = useAppStore()
    s.openChannel(5, 7, 'canal-gele', 'chat', 'Description', true)
    expect(s.activeChannelArchived).toBe(true)
  })

  it('openChannel positionne activeChannelArchived a false pour un canal actif', () => {
    const s = useAppStore()
    s.openChannel(5, 7, 'canal-actif', 'chat', 'Description', false)
    expect(s.activeChannelArchived).toBe(false)
  })

  it('isReadonly est true quand le canal est archive', () => {
    const s = useAppStore()
    s.currentUser = makeUser({ type: 'student' })
    s.openChannel(5, 7, 'canal-gele', 'chat', '', true)
    expect(s.isReadonly).toBe(true)
  })

  it('isReadonly est true pour un canal archive meme pour le prof', () => {
    const s = useAppStore()
    s.currentUser = makeUser({ type: 'teacher' })
    s.openChannel(5, 7, 'canal-gele', 'chat', '', true)
    expect(s.isReadonly).toBe(true)
  })

  it('isReadonly reste false pour un canal chat actif (etudiant)', () => {
    const s = useAppStore()
    s.currentUser = makeUser({ type: 'student' })
    s.openChannel(5, 7, 'general', 'chat', '', false)
    expect(s.isReadonly).toBe(false)
  })

  it('startSimulation reinitialise activeChannelArchived a false', () => {
    const s = useAppStore()
    const teacher = makeUser({ id: -1, type: 'teacher' })
    const student = makeUser({ id: 10, type: 'student', promo_id: 5 })
    s.currentUser = teacher
    // Simuler un canal archive ouvert avant la simulation
    s.openChannel(5, 7, 'canal-gele', 'chat', '', true)
    expect(s.activeChannelArchived).toBe(true)
    s.startSimulation(student)
    expect(s.activeChannelArchived).toBe(false)
  })

  it('stopSimulation reinitialise activeChannelArchived a false', () => {
    const s = useAppStore()
    const teacher = makeUser({ id: -1, type: 'teacher' })
    s.currentUser = teacher
    s.startSimulation(makeUser({ id: 10, type: 'student', promo_id: 5 }))
    // Forcer archived a true via openChannel
    s.openChannel(3, 5, 'canal-gele', 'chat', '', true)
    expect(s.activeChannelArchived).toBe(true)
    s.stopSimulation()
    expect(s.activeChannelArchived).toBe(false)
  })
})
