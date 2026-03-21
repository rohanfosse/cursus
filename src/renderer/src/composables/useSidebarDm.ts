/**
 * Gestion des messages privés dans la sidebar : contacts récents, recherche, navigation.
 * Used by AppSidebar.vue
 */
import { ref, computed, type Ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { DM_RECENT_LIMIT } from '@/constants'
import type { Student } from '@/types'
import type { ContextMenuItem } from '@/components/ui/ContextMenu.vue'

export interface DmContact {
  name: string
  last_message_at: string
  last_message_preview: string
}

interface CtxState { x: number; y: number; items: ContextMenuItem[] }

export function useSidebarDm(
  dmStudents: Ref<Student[]>,
  ctx: Ref<CtxState | null>,
  emit: (event: 'navigate') => void,
) {
  const appStore = useAppStore()
  const router   = useRouter()
  const route    = useRoute()

  const user = computed(() => appStore.currentUser)

  const recentDmContacts  = ref<DmContact[]>([])
  const showAllDmStudents = ref(false)

  async function loadRecentDmContacts() {
    if (!user.value?.id) return
    try {
      const res = await window.api.getRecentDmContacts(user.value.id, DM_RECENT_LIMIT)
      recentDmContacts.value = res?.ok ? res.data : []
    } catch { recentDmContacts.value = [] }
  }

  const dmContactsToShow = computed(() => {
    if (appStore.isStaff) {
      const recentNames = new Set(recentDmContacts.value.map(c => c.name))
      const recentStudents = dmStudents.value.filter(s => recentNames.has(s.name))
      const orderMap = new Map(recentDmContacts.value.map((c, i) => [c.name, i]))
      recentStudents.sort((a, b) => (orderMap.get(a.name) ?? 999) - (orderMap.get(b.name) ?? 999))
      const remaining = dmStudents.value.filter(s => !recentNames.has(s.name))
      return [...recentStudents, ...remaining].slice(0, DM_RECENT_LIMIT)
    }

    const teachers = dmStudents.value.filter(s => s.id < 0)
    const recentNames = new Set(recentDmContacts.value.map(c => c.name))
    for (const name of Object.keys(appStore.unreadDms)) {
      recentNames.add(name)
    }
    const recentStudents = dmStudents.value.filter(s => s.id > 0 && recentNames.has(s.name))
    const orderMap = new Map(recentDmContacts.value.map((c, i) => [c.name, i]))
    recentStudents.sort((a, b) => {
      const ai = orderMap.get(a.name) ?? 999
      const bi = orderMap.get(b.name) ?? 999
      return ai - bi
    })
    return [...teachers, ...recentStudents]
  })

  function getDmPreview(name: string) {
    const c = recentDmContacts.value.find(c => c.name === name)
    return c?.last_message_preview?.substring(0, 40) || ''
  }

  function selectDm(s: Student) {
    appStore.openDm(s.id, s.promo_id, s.name)
    if (route.name !== 'messages') router.push('/messages')
    emit('navigate')
    setTimeout(() => loadRecentDmContacts(), 500)
  }

  function openDmContextMenu(e: MouseEvent, s: Student) {
    const muted = appStore.isDmMuted(s.name)
    ctx.value = {
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: muted ? 'Réactiver les notifications' : 'Couper les notifications',
          action: () => { muted ? appStore.unmuteDm(s.name) : appStore.muteDm(s.name) },
        },
      ],
    }
  }

  return {
    recentDmContacts,
    showAllDmStudents,
    loadRecentDmContacts,
    dmContactsToShow,
    getDmPreview,
    selectDm,
    openDmContextMenu,
  }
}
