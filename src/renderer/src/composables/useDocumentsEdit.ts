/**
 * Edit-document modal: form state and submit logic.
 * Used by DocumentsView.vue
 */
import { ref, computed } from 'vue'
import { useDocumentsStore } from '@/stores/documents'
import { useTravauxStore }   from '@/stores/travaux'
import { useToast }          from '@/composables/useToast'
import type { AppDocument }  from '@/types'

export function useDocumentsEdit() {
  const docStore     = useDocumentsStore()
  const travauxStore = useTravauxStore()
  const { showToast } = useToast()

  const showEditModal   = ref(false)
  const editId          = ref<number | null>(null)
  const editName        = ref('')
  const editCategory    = ref('')
  const editDescription = ref('')
  const editTravailId   = ref<number | null>(null)
  const saving          = ref(false)

  const travailList = computed(() =>
    travauxStore.ganttData
      .filter((t) => t.published !== 0)
      .map((t) => ({ id: t.id, title: t.title, category: t.category ?? '' }))
      .sort((a, b) => a.title.localeCompare(b.title, 'fr'))
  )

  function openEditModal(doc: AppDocument) {
    editId.value          = doc.id
    editName.value        = doc.name
    editCategory.value    = doc.category ?? 'Autre'
    editDescription.value = doc.description ?? ''
    editTravailId.value   = doc.travail_id ?? null
    showEditModal.value   = true
  }

  async function submitEdit() {
    if (!editName.value.trim() || !editId.value) return
    saving.value = true
    try {
      const ok = await docStore.updateDocument(editId.value, {
        name:        editName.value.trim(),
        category:    editCategory.value.trim() || 'Général',
        description: editDescription.value.trim() || null,
        travailId:   editTravailId.value,
      })
      if (ok) {
        showToast('Document modifié.', 'success')
        showEditModal.value = false
      } else {
        showToast('Erreur lors de la modification.', 'error')
      }
    } finally {
      saving.value = false
    }
  }

  return {
    showEditModal,
    editName,
    editCategory,
    editDescription,
    editTravailId,
    travailList,
    saving,
    openEditModal,
    submitEdit,
  }
}
