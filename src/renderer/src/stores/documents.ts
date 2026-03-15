import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from './app'
import type { AppDocument } from '@/types'

export const useDocumentsStore = defineStore('documents', () => {
  const appStore = useAppStore()

  const documents       = ref<AppDocument[]>([])
  const categories      = ref<string[]>([])
  const loading         = ref(false)
  const searchQuery     = ref('')
  const activeCategory  = ref<string>('')
  const previewDoc      = ref<AppDocument | null>(null)

  async function fetchDocuments(channelId?: number, promoId?: number) {
    loading.value = true
    try {
      let res
      if (channelId) {
        res = await window.api.getChannelDocuments(channelId)
      } else if (promoId) {
        res = await window.api.getPromoDocuments(promoId)
      } else {
        documents.value = []
        return
      }
      documents.value = res?.ok ? res.data : []
    } finally {
      loading.value = false
    }
  }

  async function fetchCategories(channelId: number) {
    const res = await window.api.getChannelDocumentCategories(channelId)
    categories.value = res?.ok ? res.data : []
  }

  async function addDocument(payload: object) {
    const res = await window.api.addChannelDocument(payload)
    if (res?.ok && appStore.activeChannelId) {
      await fetchDocuments(appStore.activeChannelId)
    }
    return res?.ok ?? false
  }

  async function deleteDocument(id: number) {
    const res = await window.api.deleteChannelDocument(id)
    if (res?.ok && appStore.activeChannelId) {
      await fetchDocuments(appStore.activeChannelId)
    }
  }

  function openPreview(doc: AppDocument) {
    previewDoc.value = doc
  }

  function closePreview() {
    previewDoc.value = null
  }

  return {
    documents, categories, loading, searchQuery,
    activeCategory, previewDoc,
    fetchDocuments, fetchCategories, addDocument, deleteDocument,
    openPreview, closePreview,
  }
})
