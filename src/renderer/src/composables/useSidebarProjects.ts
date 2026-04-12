/**
 * Gestion des projets dans la sidebar : groupes de canaux par catégorie, projets personnalisés.
 * Used by AppSidebar.vue
 */
import { ref, computed, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import { STORAGE_KEYS, PROJECT_COLORS } from '@/constants'
import { NO_CAT } from './useSidebarData'
import type { Channel } from '@/types'
import type { ProjectMeta } from '@/components/modals/NewProjectModal.vue'

export interface DashboardProjectGroup {
  key: string
  label: string
  channels: Channel[]
}

export function useSidebarProjects(visibleChannels: Ref<Channel[]>) {
  const appStore     = useAppStore()
  const travauxStore = useTravauxStore()
  const router       = useRouter()

  const user = computed(() => appStore.currentUser)

  const dbProjects     = ref<string[]>([])
  const customProjects = ref<string[]>([])

  /** Which project is currently being edited inline (null = none) */
  const editingProject = ref<string | null>(null)

  function loadCustomProjects() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_PROJECTS)
      customProjects.value = raw ? JSON.parse(raw) : []
    } catch { customProjects.value = [] }
  }

  async function loadDbProjects() {
    const promoId = appStore.activePromoId ?? user.value?.promo_id
    if (!promoId) return
    const res = await window.api.getTravailCategories(promoId)
    dbProjects.value = res?.ok ? res.data : []
  }

  const allProjects = computed(() => {
    const set = new Set([...dbProjects.value, ...customProjects.value])
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  })

  const projectStats = computed((): Record<string, { depots: number; expected: number }> => {
    const map: Record<string, { depots: number; expected: number }> = {}
    for (const t of travauxStore.ganttData) {
      const cat = t.category?.trim()
      if (!cat || !t.published) continue
      if (!map[cat]) map[cat] = { depots: 0, expected: 0 }
      map[cat].depots   += t.depots_count  ?? 0
      map[cat].expected += t.students_total ?? 0
    }
    return map
  })

  function onProjectCreated(name: string) {
    loadCustomProjects()
    appStore.activeProject = name
    router.push('/devoirs')
  }

  function selectProject(name: string | null) {
    appStore.activeProject = name
    router.push('/devoirs')
  }

  // ── Métadonnées projet ────────────────────────────────────────────────────

  function _promoId(): number | null {
    return appStore.activePromoId ?? user.value?.promo_id ?? null
  }

  function _loadMetas(): ProjectMeta[] {
    const pid = _promoId()
    if (!pid) return []
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.projectsMeta(pid))
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  }

  function _saveMetas(metas: ProjectMeta[]) {
    const pid = _promoId()
    if (!pid) return
    localStorage.setItem(STORAGE_KEYS.projectsMeta(pid), JSON.stringify(metas))
  }

  /** Read metadata for a given project key */
  function getProjectMeta(key: string): ProjectMeta | null {
    return _loadMetas().find(m => m.name === key) ?? null
  }

  /** Write (create or update) metadata for a given project key */
  function saveProjectMeta(key: string, meta: ProjectMeta) {
    const metas = _loadMetas()
    const idx = metas.findIndex(m => m.name === key)
    if (idx >= 0) metas[idx] = meta
    else metas.push(meta)
    _saveMetas(metas)
  }

  /** Delete a custom project (from custom list + metadata) */
  function deleteProject(key: string) {
    // Remove from custom projects list
    const raw = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_PROJECTS) ?? '[]') as string[] } catch { return [] } })()
    const filtered = raw.filter(p => p !== key)
    localStorage.setItem(STORAGE_KEYS.CUSTOM_PROJECTS, JSON.stringify(filtered))

    // Remove metadata
    const metas = _loadMetas().filter(m => m.name !== key)
    _saveMetas(metas)

    // Reload
    loadCustomProjects()
    if (appStore.activeProject === key) appStore.activeProject = null
    if (editingProject.value === key) editingProject.value = null
  }

  /** Get a project's color: from meta, or auto-assigned based on index */
  function getProjectColor(key: string): string {
    const meta = getProjectMeta(key)
    if (meta?.color) return meta.color
    // Auto-assign a stable color based on position in allProjects
    const idx = allProjects.value.indexOf(key)
    return PROJECT_COLORS[((idx >= 0 ? idx : 0) % PROJECT_COLORS.length)]
  }

  const dashboardProjectGroups = computed((): DashboardProjectGroup[] => {
    const all = [...allProjects.value]
    const groups: DashboardProjectGroup[] = []

    for (const proj of all) {
      const chs = visibleChannels.value.filter(ch => ch.category?.trim() === proj)
      if (chs.length) groups.push({ key: proj, label: parseCategoryIcon(proj).label, channels: chs })
    }

    const uncategorized = visibleChannels.value.filter(ch => !ch.category?.trim())
    if (uncategorized.length) {
      groups.push({ key: NO_CAT, label: 'Autres canaux', channels: uncategorized })
    }
    return groups
  })

  // ── Progression temporelle (v2.99) ─────────────────────────────────────

  /** Pourcentage d'avancement temporel (0-100) ou null si pas de dates. */
  function projectTimePct(key: string): number | null {
    const meta = getProjectMeta(key)
    if (!meta?.startDate || !meta?.endDate) return null
    if (meta.wholeYear) return null
    const start = new Date(meta.startDate).getTime()
    const end   = new Date(meta.endDate).getTime()
    if (end <= start) return null
    const now = Date.now()
    if (now <= start) return 0
    if (now >= end) return 100
    return Math.round(((now - start) / (end - start)) * 100)
  }

  /** True si la date de fin du projet est depassee. */
  function isProjectDone(key: string): boolean {
    const meta = getProjectMeta(key)
    if (!meta?.endDate || meta.wholeYear) return false
    return Date.now() > new Date(meta.endDate).getTime()
  }

  return {
    dbProjects,
    customProjects,
    loadCustomProjects,
    loadDbProjects,
    allProjects,
    projectStats,
    onProjectCreated,
    selectProject,
    dashboardProjectGroups,
    editingProject,
    getProjectMeta,
    saveProjectMeta,
    deleteProject,
    getProjectColor,
    projectTimePct,
    isProjectDone,
  }
}
