/**
 * Navigation sidebar : sections repliables, sélection de canal, routing vers les vues.
 * Used by AppSidebar.vue
 */
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessageSquare, BookOpen, FolderOpen } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import type { Channel } from '@/types'

export function useSidebarNav(emit: (event: 'navigate') => void) {
  const appStore = useAppStore()
  const route    = useRoute()
  const router   = useRouter()

  // ── Sections repliables ─────────────────────────────────────────────────
  const collapsed          = ref<Set<string>>(new Set())
  const collapsedDashboard = ref<Set<string>>(new Set())
  const channelsCollapsed  = ref(false)
  const dmCollapsed        = ref(false)

  function toggleCategory(key: string) {
    const next = new Set(collapsed.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    collapsed.value = next
  }

  function toggleDashboardProject(key: string) {
    const next = new Set(collapsedDashboard.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    collapsedDashboard.value = next
  }

  // ── Raccourci contextuel ────────────────────────────────────────────────
  const sectionShortcut = computed(() => {
    switch (route.name) {
      case 'messages':
        return {
          label:  'Tous les canaux',
          icon:   MessageSquare,
          active: !appStore.activeChannelId && !appStore.activeDmStudentId,
          action: () => {
            appStore.activeChannelId   = null
            appStore.activeDmStudentId = null
            router.push('/messages')
          },
        }
      case 'devoirs':
        return {
          label:  'Tous les devoirs',
          icon:   BookOpen,
          active: !appStore.activeProject,
          action: () => {
            appStore.activeProject = null
            router.push('/devoirs')
          },
        }
      case 'documents':
        return {
          label:  'Tous les documents',
          icon:   FolderOpen,
          active: !appStore.activeChannelId && !appStore.activeProject,
          action: () => {
            appStore.activeChannelId = null
            appStore.activeProject   = null
            router.push('/documents')
          },
        }
      default:
        return null
    }
  })

  // ── Labels contextuels ──────────────────────────────────────────────────
  const sectionLabel = computed(() => {
    if (route.name === 'dashboard') return 'Accueil'
    if (route.name === 'devoirs')   return 'Devoirs'
    if (route.name === 'documents') return 'Documents'
    return 'Messages'
  })

  const channelSectionLabel = computed(() => {
    if (route.name === 'devoirs')   return 'Devoirs par canal'
    if (route.name === 'documents') return 'Docs par canal'
    return 'Canaux'
  })

  const channelActionLabel = computed(() => {
    if (route.name === 'devoirs')   return 'Voir les devoirs de ce canal'
    if (route.name === 'documents') return 'Voir les docs de ce canal'
    return undefined
  })

  // ── Sélection de canal ──────────────────────────────────────────────────
  function selectChannel(ch: Channel) {
    appStore.openChannel(ch.id, ch.promo_id, ch.name, ch.type, ch.description ?? '')
    if (route.name !== 'messages') {
      router.push(`/${route.name as string}`)
    }
    emit('navigate')
  }

  return {
    collapsed,
    collapsedDashboard,
    channelsCollapsed,
    dmCollapsed,
    toggleCategory,
    toggleDashboardProject,
    sectionShortcut,
    sectionLabel,
    channelSectionLabel,
    channelActionLabel,
    selectChannel,
  }
}
