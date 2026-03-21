/**
 * Gestion des projets dans la sidebar : groupes de canaux par catégorie, projets personnalisés.
 * Used by AppSidebar.vue
 */
import { ref, computed, type Ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import { STORAGE_KEYS } from '@/constants'
import { NO_CAT } from './useSidebarData'
import type { Channel } from '@/types'

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
  }
}
