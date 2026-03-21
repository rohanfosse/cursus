/**
 * Notation enseignant : édition de note et feedback sur un dépôt étudiant.
 * Used by DevoirsView.vue
 */
import { ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'

export function useTeacherGrading() {
  const appStore = useAppStore()
  const travauxStore = useTravauxStore()

  const editingDepotId       = ref<number | null>(null)
  const pendingNoteValue     = ref('')
  const pendingFeedbackValue = ref('')
  const savingGrade          = ref(false)

  function startEditGrade(depotId: number, currentNote: string | null, currentFeedback: string | null) {
    editingDepotId.value       = depotId
    pendingNoteValue.value     = currentNote ?? ''
    pendingFeedbackValue.value = currentFeedback ?? ''
  }

  function cancelEditGrade() {
    editingDepotId.value = null
  }

  async function saveGrade(depotId: number) {
    savingGrade.value = true
    try {
      await travauxStore.setNote({ depotId, note: pendingNoteValue.value.trim() || null })
      await travauxStore.setFeedback({ depotId, feedback: pendingFeedbackValue.value.trim() || null })
      editingDepotId.value = null
      const promoId = appStore.activePromoId
      if (promoId) await travauxStore.fetchRendus(promoId)
    } finally {
      savingGrade.value = false
    }
  }

  return {
    editingDepotId,
    pendingNoteValue,
    pendingFeedbackValue,
    savingGrade,
    startEditGrade,
    cancelEditGrade,
    saveGrade,
  }
}
