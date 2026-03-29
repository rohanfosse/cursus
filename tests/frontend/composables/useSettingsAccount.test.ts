import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const showToastMock = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: showToastMock }),
}))

vi.mock('@/composables/useConfirm', () => ({
  useConfirm: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}))

vi.mock('@/composables/useApi', () => ({
  useApi: () => ({ api: vi.fn().mockResolvedValue(null) }),
}))

const routerReplaceMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
}))

vi.mock('@/utils/format', () => ({
  avatarColor: (name: string) => '#abc',
}))

vi.mock('@/utils/permissions', () => ({
  hasRole: () => false,
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

const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

const openImageDialogMock = vi.fn()
const updateStudentPhotoMock = vi.fn()
const updateTeacherPhotoMock = vi.fn()

;(window as unknown as { api: Record<string, unknown> }).api = {
  openImageDialog: openImageDialogMock,
  updateStudentPhoto: updateStudentPhotoMock,
  updateTeacherPhoto: updateTeacherPhotoMock,
  exportPersonalData: vi.fn(),
  resetAndSeed: vi.fn(),
  setToken: vi.fn(),
  onSocketStateChange: vi.fn(() => () => {}),
  onNewMessage: vi.fn(() => () => {}),
  onPresenceUpdate: vi.fn(() => () => {}),
  getTeacherChannels: vi.fn().mockResolvedValue({ ok: true, data: [] }),
}

import { useSettingsAccount } from '@/composables/useSettingsAccount'
import { useAppStore } from '@/stores/app'
import { Shield, BookOpen, GraduationCap, User } from 'lucide-vue-next'

describe('useSettingsAccount', () => {
  const emitMock = vi.fn()

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  function setupUser(type: 'student' | 'teacher' | 'admin' | 'ta' = 'student', id = 1) {
    const appStore = useAppStore()
    appStore.currentUser = {
      id,
      name: 'Jean Dupont',
      avatar_initials: 'JD',
      photo_data: null,
      type,
      promo_id: 7,
      promo_name: 'Promo A',
    }
  }

  it('pickPhoto sets pendingPhoto when dialog returns data', async () => {
    setupUser()
    openImageDialogMock.mockResolvedValue({ ok: true, data: 'base64data' })

    const { pickPhoto, pendingPhoto, photoChanged } = useSettingsAccount(emitMock)
    await pickPhoto()
    expect(pendingPhoto.value).toBe('base64data')
    expect(photoChanged.value).toBe(true)
  })

  it('pickPhoto does nothing when dialog cancelled', async () => {
    setupUser()
    openImageDialogMock.mockResolvedValue({ ok: false })

    const { pickPhoto, pendingPhoto, photoChanged } = useSettingsAccount(emitMock)
    await pickPhoto()
    expect(pendingPhoto.value).toBeNull()
    expect(photoChanged.value).toBe(false)
  })

  it('removePhoto clears pendingPhoto and marks changed', () => {
    setupUser()
    const { removePhoto, pendingPhoto, photoChanged } = useSettingsAccount(emitMock)
    removePhoto()
    expect(pendingPhoto.value).toBeNull()
    expect(photoChanged.value).toBe(true)
  })

  it('savePhoto updates student photo for positive id', () => {
    setupUser('student', 5)
    const { savePhoto, pendingPhoto, photoChanged } = useSettingsAccount(emitMock)
    pendingPhoto.value = 'newphoto'
    photoChanged.value = true

    savePhoto()
    expect(updateStudentPhotoMock).toHaveBeenCalledWith({ studentId: 5, photoData: 'newphoto' })
    expect(photoChanged.value).toBe(false)
    expect(showToastMock).toHaveBeenCalled()
  })

  it('savePhoto updates teacher photo for negative id', () => {
    setupUser('teacher', -3)
    const { savePhoto, pendingPhoto } = useSettingsAccount(emitMock)
    pendingPhoto.value = 'teacherphoto'

    savePhoto()
    expect(updateTeacherPhotoMock).toHaveBeenCalledWith({ teacherId: -3, photoData: 'teacherphoto' })
  })

  it('resetPhoto syncs from store', () => {
    setupUser()
    const appStore = useAppStore()
    appStore.currentUser!.photo_data = 'stored_photo'

    const { resetPhoto, pendingPhoto, photoChanged } = useSettingsAccount(emitMock)
    pendingPhoto.value = 'different'
    photoChanged.value = true

    resetPhoto()
    expect(pendingPhoto.value).toBe('stored_photo')
    expect(photoChanged.value).toBe(false)
  })

  it('roleLabel returns correct label for each user type', () => {
    const cases: Array<[Parameters<typeof setupUser>[0], string]> = [
      ['admin', 'Admin'],
      ['teacher', 'Pilote'],
      ['ta', 'Intervenant'],
      ['student', 'Étudiant'],
    ]
    for (const [type, expected] of cases) {
      setupUser(type)
      const { roleLabel } = useSettingsAccount(emitMock)
      expect(roleLabel.value).toBe(expected)
    }
  })

  it('handleLogout emits close, logs out, and navigates', () => {
    setupUser()
    const appStore = useAppStore()

    const { handleLogout } = useSettingsAccount(emitMock)
    handleLogout()

    expect(emitMock).toHaveBeenCalledWith('update:modelValue', false)
    expect(appStore.currentUser).toBeNull()
    expect(routerReplaceMock).toHaveBeenCalledWith('/')
    expect(showToastMock).toHaveBeenCalled()
  })

  it('avatarBg uses accent for admin/teacher, avatarColor for students', () => {
    setupUser('student')
    const { avatarBg } = useSettingsAccount(emitMock)
    expect(avatarBg.value).toBe('#abc') // mocked avatarColor

    setupUser('admin')
    const { avatarBg: adminBg } = useSettingsAccount(emitMock)
    expect(adminBg.value).toBe('var(--accent)')
  })

  // ── Role icon tests ─────────────────────────────────────────────────────────

  it('roleIcon returns Shield for admin', () => {
    setupUser('admin')
    const { roleIcon } = useSettingsAccount(emitMock)
    expect(roleIcon.value).toBeDefined()
    expect(roleIcon.value).toBe(Shield)
  })

  it('roleIcon returns BookOpen for teacher', () => {
    setupUser('teacher')
    const { roleIcon } = useSettingsAccount(emitMock)
    expect(roleIcon.value).toBe(BookOpen)
  })

  it('roleIcon returns GraduationCap for ta', () => {
    setupUser('ta')
    const { roleIcon } = useSettingsAccount(emitMock)
    expect(roleIcon.value).toBe(GraduationCap)
  })

  it('roleIcon returns User for student', () => {
    setupUser('student')
    const { roleIcon } = useSettingsAccount(emitMock)
    expect(roleIcon.value).toBe(User)
  })

  // ── Role label edge cases ──────────────────────────────────────────────────

  it('roleLabel defaults to Etudiant when no user is set', () => {
    // No user set — currentUser is null
    const { roleLabel } = useSettingsAccount(emitMock)
    expect(roleLabel.value).toBe('Étudiant')
  })
})
