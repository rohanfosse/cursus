import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from './app'
import { useApi } from '@/composables/useApi'
import type { AppDocument } from '@/types'

export const useDocumentsStore = defineStore('documents', () => {
  const appStore = useAppStore()
  const { api } = useApi()

  const documents      = ref<AppDocument[]>([])
  const categories     = ref<string[]>([])
  const loading        = ref(false)
  const searchQuery    = ref('')
  const activeCategory = ref<string>('')
  const previewDoc     = ref<AppDocument | null>(null)

  // Favoris (localStorage)
  const FAVS_KEY = 'cc_doc_favorites'
  const favoriteIds = ref<Set<number>>(new Set(
    (() => { try { return JSON.parse(localStorage.getItem(FAVS_KEY) ?? '[]') } catch { return [] } })(),
  ))

  function toggleFavorite(docId: number) {
    if (favoriteIds.value.has(docId)) favoriteIds.value.delete(docId)
    else favoriteIds.value.add(docId)
    favoriteIds.value = new Set(favoriteIds.value) // trigger reactivity
    localStorage.setItem(FAVS_KEY, JSON.stringify([...favoriteIds.value]))
  }

  function isFavorite(docId: number): boolean {
    return favoriteIds.value.has(docId)
  }

  async function fetchDocuments(promoId?: number, project?: string | null) {
    const pid = promoId ?? appStore.activePromoId ?? appStore.currentUser?.promo_id
    if (!pid) { documents.value = []; return }
    loading.value = true
    activeCategory.value = ''
    try {
      const data = await api<AppDocument[]>(
        () => window.api.getProjectDocuments(pid, project ?? appStore.activeProject ?? null),
      )
      documents.value = data ?? []
    } finally {
      loading.value = false
    }
  }

  async function addDocument(payload: object) {
    const data = await api(() => window.api.addProjectDocument(payload), 'upload')
    if (data !== null) {
      const pid = appStore.activePromoId ?? appStore.currentUser?.promo_id
      await fetchDocuments(pid ?? undefined, appStore.activeProject)
    }
    return data !== null
  }

  async function updateDocument(id: number, payload: object): Promise<boolean> {
    const data = await api(() => window.api.updateProjectDocument(id, payload), 'upload')
    if (data !== null) {
      const pid = appStore.activePromoId ?? appStore.currentUser?.promo_id
      await fetchDocuments(pid ?? undefined, appStore.activeProject)
    }
    return data !== null
  }

  async function deleteDocument(id: number): Promise<boolean> {
    const data = await api(() => window.api.deleteChannelDocument(id), 'delete')
    if (data !== null) {
      const pid = appStore.activePromoId ?? appStore.currentUser?.promo_id
      await fetchDocuments(pid ?? undefined, appStore.activeProject)
    }
    return data !== null
  }

  function openPreview(doc: AppDocument) { previewDoc.value = doc }
  function closePreview() { previewDoc.value = null }

  return {
    documents, categories, loading, searchQuery,
    activeCategory, previewDoc, favoriteIds,
    fetchDocuments, addDocument, updateDocument, deleteDocument,
    openPreview, closePreview, toggleFavorite, isFavorite,
  }
})
