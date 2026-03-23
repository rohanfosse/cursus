/**
 * Chargement des données sidebar : promotions, canaux, étudiants, groupes par catégorie.
 * Used by AppSidebar.vue
 */
import { ref, computed } from 'vue'
import { useAppStore } from '@/stores/app'
import type { Channel, Student, Promotion } from '@/types'

export const NO_CAT = '__no_category__'

export interface CategoryGroup {
  label: string
  key: string
  channels: Channel[]
}

export function useSidebarData() {
  const appStore = useAppStore()

  const promotions = ref<Promotion[]>([])
  const channels   = ref<Channel[]>([])
  const students   = ref<Student[]>([])
  const loading    = ref(false)

  const user = computed(() => appStore.currentUser)

  const activePromoName = computed(() => {
    const p = promotions.value.find(p => p.id === appStore.activePromoId)
    return p?.name ?? appStore.currentUser?.promo_name ?? null
  })

  // ── Chargement ──────────────────────────────────────────────────────────
  async function loadTeacherChannels() {
    if (!appStore.activePromoId) return
    const res = await window.api.getChannels(appStore.activePromoId)
    channels.value = res?.ok ? res.data : []
  }

  async function loadRecentDmContacts_internal(): Promise<void> {
    // Stub - real implementation is in useSidebarDm; this is used by load*Sidebar
    // Will be replaced after composition
  }

  let _loadRecentDmContacts: () => Promise<void> = loadRecentDmContacts_internal

  function setLoadRecentDmContacts(fn: () => Promise<void>) {
    _loadRecentDmContacts = fn
  }

  async function loadTeacherSidebar() {
    loading.value = true
    try {
      const [promRes, stuRes] = await Promise.all([
        window.api.getPromotions(),
        window.api.getAllStudents(),
      ])
      promotions.value = promRes?.ok ? promRes.data : []
      students.value   = stuRes?.ok ? stuRes.data : []

      if (promotions.value.length && !appStore.activePromoId) {
        appStore.activePromoId = promotions.value[0].id
      }
      await loadTeacherChannels()
      await _loadRecentDmContacts()
    } finally {
      loading.value = false
    }
  }

  async function loadStudentSidebar() {
    if (!user.value?.promo_id) return
    loading.value = true
    try {
      const [chRes, stuRes, teachRes] = await Promise.all([
        window.api.getChannels(user.value.promo_id),
        window.api.getStudents(user.value.promo_id),
        window.api.getTeachers(),
      ])
      channels.value = chRes?.ok ? chRes.data : []
      const stuList  = stuRes?.ok ? stuRes.data : []
      const teachers = teachRes?.ok ? teachRes.data : []
      students.value = [...teachers, ...stuList]
      await _loadRecentDmContacts()
    } finally {
      loading.value = false
    }
  }

  async function load() {
    if (appStore.isStaff) await loadTeacherSidebar()
    else await loadStudentSidebar()
  }

  // ── Canaux visibles ─────────────────────────────────────────────────────
  const visibleChannels = computed(() => {
    if (appStore.isTeacher) return channels.value
    if (appStore.currentUser?.type === 'ta') {
      const ids = appStore.taChannelIds
      if (ids.length > 0) return channels.value.filter((ch) => ids.includes(ch.id))
      return channels.value
    }
    return channels.value.filter((ch) => {
      if (!ch.is_private) return true
      try {
        const members: number[] = Array.isArray(ch.members) ? ch.members : JSON.parse(ch.members as unknown as string ?? '[]')
        return members.includes(user.value?.id ?? -1)
      } catch { return false }
    })
  })

  // ── Grouper par catégorie ───────────────────────────────────────────────
  const channelGroups = computed((): CategoryGroup[] => {
    const map = new Map<string, Channel[]>()
    for (const ch of visibleChannels.value) {
      const key = ch.category?.trim() || NO_CAT
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ch)
    }

    const groups: CategoryGroup[] = []
    for (const [key, chs] of map) {
      if (key !== NO_CAT) groups.push({ label: key, key, channels: chs })
    }
    if (map.has(NO_CAT)) {
      const hasCats = groups.length > 0
      groups.push({ label: hasCats ? 'Autres' : 'Canaux', key: NO_CAT, channels: map.get(NO_CAT)! })
    }
    return groups
  })

  // ── Ordre des categories (localStorage) ──────────────────────────────────
  const CHANNEL_ORDER_KEY = 'cc_channel_order'

  function _loadCategoryOrder(): string[] {
    try {
      const promoId = appStore.activePromoId ?? user.value?.promo_id
      const raw = localStorage.getItem(`${CHANNEL_ORDER_KEY}_${promoId}`)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  }

  function _saveCategoryOrder(order: string[]) {
    const promoId = appStore.activePromoId ?? user.value?.promo_id
    localStorage.setItem(`${CHANNEL_ORDER_KEY}_${promoId}`, JSON.stringify(order))
  }

  const sortedChannelGroups = computed((): CategoryGroup[] => {
    const groups = channelGroups.value
    const savedOrder = _loadCategoryOrder()
    if (!savedOrder.length) return groups

    const orderMap = new Map(savedOrder.map((key, idx) => [key, idx]))
    return [...groups].sort((a, b) => {
      const ia = orderMap.get(a.key) ?? 999
      const ib = orderMap.get(b.key) ?? 999
      return ia - ib
    })
  })

  function reorderCategories(newOrder: CategoryGroup[]) {
    _saveCategoryOrder(newOrder.map(g => g.key))
  }

  // ── DM students ─────────────────────────────────────────────────────────
  const dmStudents = computed(() => {
    const promoId = appStore.isStaff ? appStore.activePromoId : user.value?.promo_id
    return students.value.filter((s) => {
      if (s.id === user.value?.id) return false
      if (s.id < 0) return true
      return !promoId || s.promo_id === promoId
    })
  })

  // ── Sélection promo ─────────────────────────────────────────────────────
  async function selectPromo(promoId: number) {
    appStore.activePromoId = promoId
    await loadTeacherChannels()
  }

  return {
    promotions,
    channels,
    students,
    loading,
    user,
    activePromoName,
    loadTeacherSidebar,
    loadTeacherChannels,
    loadStudentSidebar,
    load,
    visibleChannels,
    channelGroups, sortedChannelGroups, reorderCategories,
    dmStudents,
    selectPromo,
    setLoadRecentDmContacts,
  }
}
