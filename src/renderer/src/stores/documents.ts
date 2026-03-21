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
    activeCategory, previewDoc,
    fetchDocuments, addDocument, deleteDocument,
    openPreview, closePreview,
  }
})
