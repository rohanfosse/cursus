import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from './app'
import { useApi } from '@/composables/useApi'

export interface Cahier {
  id: number
  promo_id: number
  group_id: number | null
  project: string | null
  title: string
  created_by: number
  created_at: string
  updated_at: string
  author_name?: string
}

export const useCahierStore = defineStore('cahier', () => {
  const appStore = useAppStore()
  const { api } = useApi()

  const cahiers = ref<Cahier[]>([])
  const loading = ref(false)
  const activeCahierId = ref<number | null>(null)

  async function fetchCahiers(promoId?: number, project?: string | null) {
    const pid = promoId ?? appStore.activePromoId ?? appStore.currentUser?.promo_id
    if (!pid) { cahiers.value = []; return }
    loading.value = true
    try {
      const data = await api<Cahier[]>(
        () => window.api.getCahiers(pid, project ?? appStore.activeProject ?? null),
      )
      cahiers.value = data ?? []
    } finally {
      loading.value = false
    }
  }

  async function createCahier(title?: string): Promise<number | null> {
    const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
    if (!promoId || !appStore.currentUser) return null
    const data = await api<{ id: number }>(() => window.api.createCahier({
      promoId,
      project: appStore.activeProject ?? null,
      title: title || 'Sans titre',
      createdBy: appStore.currentUser!.id,
    }))
    if (data?.id) {
      await fetchCahiers()
      return data.id
    }
    return null
  }

  async function renameCahier(id: number, title: string) {
    await api(() => window.api.renameCahier(id, title))
    const c = cahiers.value.find(c => c.id === id)
    if (c) c.title = title
  }

  async function deleteCahier(id: number) {
    await api(() => window.api.deleteCahier(id))
    cahiers.value = cahiers.value.filter(c => c.id !== id)
    if (activeCahierId.value === id) activeCahierId.value = null
  }

  function openCahier(id: number) {
    activeCahierId.value = id
  }

  function closeCahier() {
    activeCahierId.value = null
  }

  return {
    cahiers, loading, activeCahierId,
    fetchCahiers, createCahier, renameCahier, deleteCahier,
    openCahier, closeCahier,
  }
})
