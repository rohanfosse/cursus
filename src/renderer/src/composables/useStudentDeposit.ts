/**
 * Dépôt de rendu étudiant : sélection fichier/lien, upload, soumission, prévisualisation rubrique.
 * Used by DevoirsView.vue
 */
import { ref, nextTick } from 'vue'
import type { Devoir, Rubric } from '@/types'
import { useAppStore } from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { isExpired } from '@/utils/devoir'
import { validateDeposit } from '@/utils/depositValidation'
import { celebrate } from '@/utils/celebrate'

export function useStudentDeposit(now: { value: number }) {
  const appStore = useAppStore()
  const travauxStore = useTravauxStore()
  const { showToast } = useToast()
  const { confirm } = useConfirm()

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
      const paths = res.data as string[]
      const firstPath = paths[0]
      if (!firstPath) return
      depositFile.value     = firstPath
      depositFileName.value = firstPath.split(/[\\/]/).pop() ?? firstPath
    }
  }

  // Drag-and-drop : alimente depositFile directement depuis le path Electron.
  function onFileDrop(payload: { path: string; name: string }) {
    depositFile.value     = payload.path
    depositFileName.value = payload.name
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

    // Validation fichier avant upload
    if (depositMode.value === 'file') {
      const validation = validateDeposit(
        depositFileName.value ? { name: depositFileName.value, size: 0 } : null,
        devoir.deadline,
      )
      if (!validation.valid) {
        showToast(validation.error!, 'error')
        return
      }
    }

    // Devoir de groupe v2.199 : un autre membre a deja depose → confirmer
    // avant d'ecraser (pas d'historique, la version precedente sera perdue).
    if (
      devoir.group_id != null
      && devoir.depot_id != null
      && devoir.depot_author_id != null
      && devoir.depot_author_id !== appStore.currentUser.id
    ) {
      const author = devoir.depot_author_name || 'un autre membre'
      const existingName = devoir.file_name || devoir.link_url || 'un rendu'
      const ok = await confirm({
        message: `${author} a deja depose "${existingName}" pour ce devoir de groupe. Votre fichier va le remplacer (la version precedente sera perdue).`,
        variant: 'warning',
        confirmLabel: 'Remplacer',
      })
      if (!ok) return
    }

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
        showToast(`Rendu soumis - ${fileName} - ${time}`, 'success')
        void celebrate()
        cancelDeposit()
        await travauxStore.fetchStudentDevoirs()
        nextTick(() => {
          document.querySelector('.devoir-card--submitted:last-child')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
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
    onFileDrop,
    clearDepositFile,
    submitDeposit,
  }
}
