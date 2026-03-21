/**
 * Dépôt de rendu étudiant : sélection fichier/lien, upload, soumission, prévisualisation rubrique.
 * Used by DevoirsView.vue
 */
import { ref } from 'vue'
import type { Devoir, Rubric } from '@/types'
import { useAppStore } from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { useToast } from '@/composables/useToast'
import { isExpired } from '@/utils/devoir'

export function useStudentDeposit(now: { value: number }) {
  const appStore = useAppStore()
  const travauxStore = useTravauxStore()
  const { showToast } = useToast()

  const depositingDevoirId = ref<number | null>(null)
  const depositMode        = ref<'file' | 'link'>('file')
  const depositLink        = ref('')
  const depositFile        = ref<string | null>(null)
  const depositFileName    = ref<string | null>(null)
  const depositing         = ref(false)
  const rubricPreview      = ref<Rubric | null>(null)

  async function startDeposit(t: Devoir) {
    depositingDevoirId.value = t.id
    depositMode.value        = 'file'
    depositLink.value        = ''
    depositFile.value        = null
    depositFileName.value    = null
    rubricPreview.value      = null
    const res = await window.api.getRubric(t.id)
    rubricPreview.value = res?.ok && res.data ? res.data : null
  }

  function cancelDeposit() {
    depositingDevoirId.value = null
    rubricPreview.value      = null
  }

  async function pickFile() {
    const res = await window.api.openFileDialog()
    if (res?.ok && res.data) {
      depositFile.value     = res.data
      depositFileName.value = res.data.split(/[\\/]/).pop() ?? res.data
    }
  }

  function clearDepositFile() {
    depositFile.value     = null
    depositFileName.value = null
  }

  async function submitDeposit(devoir: Devoir) {
    if (depositing.value) return
    if (!appStore.currentUser) return
    if (depositMode.value === 'file' && !depositFile.value) return
    if (depositMode.value === 'link' && !depositLink.value.trim()) return
    if (isExpired(devoir.deadline, now.value)) return

    depositing.value = true
    try {
      const ok = await travauxStore.addDepot({
        travail_id: devoir.id,
        student_id: appStore.currentUser.id,
        type:       depositMode.value,
        content:    depositMode.value === 'file' ? depositFile.value! : depositLink.value.trim(),
        file_name:  depositMode.value === 'file' ? depositFileName.value : null,
      })
      if (ok) {
        const fileName = depositMode.value === 'file' ? depositFileName.value : depositLink.value.trim()
        const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        showToast(`Rendu soumis — ${fileName} — ${time}`, 'success')
        cancelDeposit()
        await travauxStore.fetchStudentDevoirs()
      } else {
        showToast('Erreur lors du dépôt. Veuillez réessayer.', 'error')
      }
    } finally {
      depositing.value = false
    }
  }

  return {
    depositingDevoirId,
    depositMode,
    depositLink,
    depositFile,
    depositFileName,
    depositing,
    rubricPreview,
    startDeposit,
    cancelDeposit,
    pickFile,
    clearDepositFile,
    submitDeposit,
  }
}
