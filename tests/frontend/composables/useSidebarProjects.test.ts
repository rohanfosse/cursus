/**
 * Tests pour useSidebarProjects — projets sidebar, metadata, couleurs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const routerPushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock }),
}))

vi.mock('@/utils/categoryIcon', () => ({
  parseCategoryIcon: (s: string) => ({ icon: null, label: s }),
}))

vi.mock('@/constants', () => ({
  STORAGE_KEYS: {
    CUSTOM_PROJECTS: 'cc_custom_projects',
    projectsMeta: (pid: number) => `cc_projects_${pid}`,
  },
  PROJECT_COLORS: ['#ff0000', '#00ff00', '#0000ff'],
}))

vi.mock('./useSidebarData', () => ({
  NO_CAT: '__no_category__',
}))

const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { localStorageMock.store[key] = val }),
  removeItem: vi.fn((key: string) => { delete localStorageMock.store[key] }),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

;(globalThis as Record<string, unknown>).window = {
  api: {
    getTravailCategories: vi.fn(),
  },
}

import { useSidebarProjects } from '../../../src/renderer/src/composables/useSidebarProjects'
import { useAppStore } from '../../../src/renderer/src/stores/app'

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useSidebarProjects', () => {
  let appStore: ReturnType<typeof useAppStore>
  const visibleChannels = ref<{ id: number; name: string; category: string | null }[]>([])

  beforeEach(() => {
    setActivePinia(createPinia())
    appStore = useAppStore()
    appStore.currentUser = { id: 1, name: 'Prof', type: 'teacher', promo_id: 1 } as never
    appStore.activePromoId = 1
    vi.clearAllMocks()
    localStorageMock.store = {}
    visibleChannels.value = []
  })

  // ── loadCustomProjects ──────────────────────────────────────────────────

  describe('loadCustomProjects', () => {
    it('loads custom projects from localStorage', () => {
      localStorageMock.store['cc_custom_projects'] = JSON.stringify(['ProjectA', 'ProjectB'])
      const { loadCustomProjects, customProjects } = useSidebarProjects(visibleChannels as never)
      loadCustomProjects()
      expect(customProjects.value).toEqual(['ProjectA', 'ProjectB'])
    })

    it('defaults to empty array on missing key', () => {
      const { loadCustomProjects, customProjects } = useSidebarProjects(visibleChannels as never)
      loadCustomProjects()
      expect(customProjects.value).toEqual([])
    })

    it('defaults to empty array on corrupt JSON', () => {
      localStorageMock.store['cc_custom_projects'] = '{broken'
      const { loadCustomProjects, customProjects } = useSidebarProjects(visibleChannels as never)
      loadCustomProjects()
      expect(customProjects.value).toEqual([])
    })
  })

  // ── loadDbProjects ──────────────────────────────────────────────────────

  describe('loadDbProjects', () => {
    it('fetches categories from window.api', async () => {
      ;(window.api as Record<string, unknown>).getTravailCategories = vi.fn().mockResolvedValue({ ok: true, data: ['Cat1', 'Cat2'] })
      const { loadDbProjects, dbProjects } = useSidebarProjects(visibleChannels as never)
      await loadDbProjects()
      expect(dbProjects.value).toEqual(['Cat1', 'Cat2'])
    })

    it('sets empty array if api fails', async () => {
      ;(window.api as Record<string, unknown>).getTravailCategories = vi.fn().mockResolvedValue({ ok: false })
      const { loadDbProjects, dbProjects } = useSidebarProjects(visibleChannels as never)
      await loadDbProjects()
      expect(dbProjects.value).toEqual([])
    })

    it('does nothing without promo id', async () => {
      appStore.activePromoId = null as never
      appStore.currentUser = { id: 1, name: 'Prof', type: 'teacher', promo_id: undefined } as never
      const { loadDbProjects } = useSidebarProjects(visibleChannels as never)
      await loadDbProjects()
      expect((window.api as { getTravailCategories: ReturnType<typeof vi.fn> }).getTravailCategories).not.toHaveBeenCalled()
    })
  })

  // ── allProjects ─────────────────────────────────────────────────────────

  describe('allProjects', () => {
    it('merges and deduplicates db + custom projects, sorted', () => {
      const { dbProjects, customProjects, allProjects, loadCustomProjects } = useSidebarProjects(visibleChannels as never)
      dbProjects.value = ['Zeta', 'Alpha']
      customProjects.value = ['Alpha', 'Beta']
      expect(allProjects.value).toEqual(['Alpha', 'Beta', 'Zeta'])
    })
  })

  // ── onProjectCreated / selectProject ─────────────────────────────────────

  describe('navigation', () => {
    it('onProjectCreated sets active project and navigates', () => {
      localStorageMock.store['cc_custom_projects'] = JSON.stringify(['NewProj'])
      const { onProjectCreated } = useSidebarProjects(visibleChannels as never)
      onProjectCreated('NewProj')
      expect(appStore.activeProject).toBe('NewProj')
      expect(routerPushMock).toHaveBeenCalledWith('/devoirs')
    })

    it('selectProject sets project and navigates', () => {
      const { selectProject } = useSidebarProjects(visibleChannels as never)
      selectProject('MyProject')
      expect(appStore.activeProject).toBe('MyProject')
      expect(routerPushMock).toHaveBeenCalledWith('/devoirs')
    })

    it('selectProject accepts null', () => {
      const { selectProject } = useSidebarProjects(visibleChannels as never)
      selectProject(null)
      expect(appStore.activeProject).toBeNull()
    })
  })

  // ── Project meta ─────────────────────────────────────────────────────────

  describe('project metadata', () => {
    it('getProjectMeta returns null when no meta exists', () => {
      const { getProjectMeta } = useSidebarProjects(visibleChannels as never)
      expect(getProjectMeta('unknown')).toBeNull()
    })

    it('saveProjectMeta persists and getProjectMeta retrieves', () => {
      const { saveProjectMeta, getProjectMeta } = useSidebarProjects(visibleChannels as never)
      const meta = { name: 'Proj1', color: '#ff0000' }
      saveProjectMeta('Proj1', meta as never)
      const loaded = getProjectMeta('Proj1')
      expect(loaded).toEqual(meta)
    })

    it('saveProjectMeta updates existing meta', () => {
      const { saveProjectMeta, getProjectMeta } = useSidebarProjects(visibleChannels as never)
      saveProjectMeta('Proj1', { name: 'Proj1', color: '#ff0000' } as never)
      saveProjectMeta('Proj1', { name: 'Proj1', color: '#00ff00' } as never)
      expect(getProjectMeta('Proj1')!.color).toBe('#00ff00')
    })
  })

  // ── deleteProject ─────────────────────────────────────────────────────────

  describe('deleteProject', () => {
    it('removes project from custom list and metadata', () => {
      localStorageMock.store['cc_custom_projects'] = JSON.stringify(['A', 'B'])
      localStorageMock.store['cc_projects_1'] = JSON.stringify([{ name: 'A', color: '#000' }])
      const { deleteProject, loadCustomProjects, customProjects } = useSidebarProjects(visibleChannels as never)
      loadCustomProjects()
      deleteProject('A')
      const stored = JSON.parse(localStorageMock.store['cc_custom_projects'])
      expect(stored).toEqual(['B'])
    })

    it('clears active project if deleted project was active', () => {
      localStorageMock.store['cc_custom_projects'] = JSON.stringify(['Active'])
      appStore.activeProject = 'Active' as never
      const { deleteProject, loadCustomProjects } = useSidebarProjects(visibleChannels as never)
      loadCustomProjects()
      deleteProject('Active')
      expect(appStore.activeProject).toBeNull()
    })
  })

  // ── getProjectColor ───────────────────────────────────────────────────────

  describe('getProjectColor', () => {
    it('returns meta color if defined', () => {
      const { saveProjectMeta, getProjectColor } = useSidebarProjects(visibleChannels as never)
      saveProjectMeta('Proj1', { name: 'Proj1', color: '#abcdef' } as never)
      expect(getProjectColor('Proj1')).toBe('#abcdef')
    })

    it('returns auto-assigned color based on index', () => {
      const { dbProjects, getProjectColor } = useSidebarProjects(visibleChannels as never)
      dbProjects.value = ['Alpha', 'Beta']
      // Alpha is index 0 -> PROJECT_COLORS[0]
      expect(getProjectColor('Alpha')).toBe('#ff0000')
      expect(getProjectColor('Beta')).toBe('#00ff00')
    })

    it('returns first color for unknown project', () => {
      const { getProjectColor } = useSidebarProjects(visibleChannels as never)
      expect(getProjectColor('unknown')).toBe('#ff0000')
    })
  })

  // ── dashboardProjectGroups ────────────────────────────────────────────────

  describe('dashboardProjectGroups', () => {
    it('groups channels by category matching projects', () => {
      const { dbProjects, dashboardProjectGroups } = useSidebarProjects(visibleChannels as never)
      dbProjects.value = ['Math']
      visibleChannels.value = [
        { id: 1, name: 'ch1', category: 'Math' },
        { id: 2, name: 'ch2', category: null },
      ] as never
      const groups = dashboardProjectGroups.value
      expect(groups.length).toBe(2) // Math + uncategorized
      expect(groups[0].key).toBe('Math')
      expect(groups[0].channels.length).toBe(1)
      expect(groups[1].key).toBe('__no_category__')
    })

    it('returns empty when no channels', () => {
      const { dashboardProjectGroups } = useSidebarProjects(visibleChannels as never)
      expect(dashboardProjectGroups.value).toEqual([])
    })
  })
})
