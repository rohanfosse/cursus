import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from './app'
import type { AppDocument } from '@/types'

export const useDocumentsStore = defineStore('documents', () => {
  const appStore = useAppStore()

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
    try {
      const res = await window.api.getProjectDocuments(pid, project ?? appStore.activeProject ?? null)
      documents.value = res?.ok ? res.data : []
    } finally {
      loading.value = false
    }
  }

  async function addDocument(payload: object) {
    const res = await window.api.addProjectDocument(payload)
    if (res?.ok) {
      const pid = appStore.activePromoId ?? appStore.currentUser?.promo_id
      await fetchDocuments(pid ?? undefined, appStore.activeProject)
    }
    return res?.ok ?? false
  }

  async function deleteDocument(id: number) {
    const res = await window.api.deleteChannelDocument(id)
    if (res?.ok) {
      const pid = appStore.activePromoId ?? appStore.currentUser?.promo_id
      await fetchDocuments(pid ?? undefined, appStore.activeProject)
    }
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
