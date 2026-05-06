/**
 * Notation enseignant : édition de note et feedback sur un dépôt étudiant.
 * Used by DevoirsView.vue
 */
import { ref, computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { useToast } from '@/composables/useToast'
import { reportError } from '@/utils/reportError'

/** Validates a note value: allows A-F (case-insensitive), empty, or numeric */
function isValidNote(v: string): boolean {
  const trimmed = v.trim()
  if (!trimmed) return true
  if (/^[A-Fa-f]$/i.test(trimmed)) return true
  if (!isNaN(Number(trimmed))) return true
  return false
}

export function useTeacherGrading() {
  const appStore = useAppStore()
  const travauxStore = useTravauxStore()
  const { showToast } = useToast()

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

  /** Whether the current pending note is valid and can be saved */
  const canSave = computed(() => isValidNote(pendingNoteValue.value))

  async function saveGrade(depotId: number) {
    if (!canSave.value) {
      showToast('Format de note invalide (A–F ou numérique).', 'error')
      return
    }
    savingGrade.value = true
    try {
      await travauxStore.setNote({ depotId, note: pendingNoteValue.value.trim() || null })
      await travauxStore.setFeedback({ depotId, feedback: pendingFeedbackValue.value.trim() || null })
      editingDepotId.value = null
      const promoId = appStore.activePromoId
      if (promoId) await travauxStore.fetchRendus(promoId)
    } catch (err) {
      showToast(reportError(err, {
        tag: 'devoir', op: 'save_grade',
        meta: { depotId, hasNote: !!pendingNoteValue.value.trim(), hasFeedback: !!pendingFeedbackValue.value.trim() },
        userMessage: 'Erreur lors de la sauvegarde de la note.',
      }), 'error')
    } finally {
      savingGrade.value = false
    }
  }

  return {
    editingDepotId,
    pendingNoteValue,
    pendingFeedbackValue,
    savingGrade,
    canSave,
    startEditGrade,
    cancelEditGrade,
    saveGrade,
  }
}
