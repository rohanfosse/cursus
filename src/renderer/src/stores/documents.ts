import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from './app'
import { useApi } from '@/composables/useApi'
import type { AppDocument } from '@/types'
import { cacheData, loadCached } from '@/composables/useOfflineCache'
import { safeGetJSON, safeSetJSON } from '@/utils/safeStorage'

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
    safeGetJSON<number[]>(FAVS_KEY, []),
  ))

  function toggleFavorite(docId: number) {
    if (favoriteIds.value.has(docId)) favoriteIds.value.delete(docId)
    else favoriteIds.value.add(docId)
    favoriteIds.value = new Set(favoriteIds.value) // trigger reactivity
    safeSetJSON(FAVS_KEY, [...favoriteIds.value])
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
      // Filtrer par projet si specifie, sinon charger tous les docs de la promo
      const effectiveProject = project ?? appStore.activeProject ?? null
      const data = await api<AppDocument[]>(
        () => window.api.getProjectDocuments(pid, effectiveProject),
      )
      documents.value = data ?? []

      // Fallback : si un filtre projet retourne vide, recharger sans filtre
      if (documents.value.length === 0 && effectiveProject) {
        const allData = await api<AppDocument[]>(
          () => window.api.getProjectDocuments(pid, null),
        )
        if (allData && allData.length > 0) {
          documents.value = allData
          // Le filtre projet ne correspond a aucun doc — reset le filtre
          if (appStore.activeProject) appStore.activeProject = null
        }
      }

      if (documents.value.length) {
        cacheData(`documents-${pid}`, documents.value)
      }
    } catch {
      // Fallback offline
      if (!appStore.isOnline && pid) {
        const cached = await loadCached<AppDocument[]>(`documents-${pid}`)
        if (cached) documents.value = cached
      }
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

  // Liste de navigation (documents filtres actuels)
  const previewList = ref<AppDocument[]>([])

  function openPreview(doc: AppDocument, list?: AppDocument[]) {
    previewDoc.value = doc
    if (list) previewList.value = list
  }
  function closePreview() { previewDoc.value = null }

  function previewNext() {
    if (!previewDoc.value || !previewList.value.length) return
    const idx = previewList.value.findIndex(d => d.id === previewDoc.value!.id)
    if (idx >= 0 && idx < previewList.value.length - 1) {
      previewDoc.value = previewList.value[idx + 1]
    }
  }
  function previewPrev() {
    if (!previewDoc.value || !previewList.value.length) return
    const idx = previewList.value.findIndex(d => d.id === previewDoc.value!.id)
    if (idx > 0) {
      previewDoc.value = previewList.value[idx - 1]
    }
  }
  function previewIndex(): { current: number; total: number } {
    if (!previewDoc.value || !previewList.value.length) return { current: 0, total: 0 }
    const idx = previewList.value.findIndex(d => d.id === previewDoc.value!.id)
    return { current: idx + 1, total: previewList.value.length }
  }

  return {
    documents, categories, loading, searchQuery,
    activeCategory, previewDoc, previewList, favoriteIds,
    fetchDocuments, addDocument, updateDocument, deleteDocument,
    openPreview, closePreview, previewNext, previewPrev, previewIndex,
    toggleFavorite, isFavorite,
  }
})
