/**
 * useStudentDepositInline : depot inline d'un devoir (fichier ou lien) depuis
 * la fiche projet etudiant, avec support drag & drop.
 *
 * Le composable gere :
 *   - l'id du devoir en cours de depot (un seul a la fois)
 *   - mode file/link
 *   - fichier uploade (url + displayName + taille cote client)
 *   - drag over visual state
 *   - soumission (appelle travauxStore.addDepot + refresh)
 *
 * Robustesse (v2.214) :
 *   - validation URL via utils/urlValidation (scheme http/https/mailto uniquement)
 *   - validation fichier via utils/fileValidation (50 Mo max, extensions bloquees)
 *   - rejet early si deadline passee ou utilisateur absent
 *   - messages d'erreur specifiques au lieu d'un generique
 */
import { ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { useToast } from '@/composables/useToast'
import { validateFile } from '@/utils/fileValidation'
import { validateUrl } from '@/utils/urlValidation'
import { celebrate } from '@/utils/celebrate'
import { reportError } from '@/utils/reportError'
import type { Devoir } from '@/types'

export type DepositMode = 'file' | 'link'

export function displayDepotName(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl.split('/').pop()?.replace(/^\d+_[a-f0-9]+_/, '') ?? pathOrUrl
  }
  return pathOrUrl.split(/[\\/]/).pop() ?? pathOrUrl
}

export function useStudentDepositInline(isExpired: (deadline: string) => boolean) {
  const appStore = useAppStore()
  const travauxStore = useTravauxStore()
  const { showToast } = useToast()

  const depositingDevoirId = ref<number | null>(null)
  const mode = ref<DepositMode>('file')
  const link = ref('')
  const file = ref<string | null>(null)
  const fileName = ref<string | null>(null)
  const fileSize = ref<number | null>(null)
  const depositing = ref(false)
  const uploading = ref(false)
  const uploadProgress = ref(0) // 0-100, 0 = indetermine
  const dragOver = ref(false)

  function start(t: Devoir) {
    depositingDevoirId.value = t.id
    mode.value = 'file'
    link.value = ''
    file.value = null
    fileName.value = null
    fileSize.value = null
    dragOver.value = false
  }

  function cancel() {
    depositingDevoirId.value = null
    dragOver.value = false
  }

  /**
   * Valide un fichier local (nom + taille) AVANT d'appeler uploadFile.
   * Evite d'uploader un .exe de 100 Mo pour se prendre une erreur a la fin.
   */
  function validateLocalFile(name: string, size: number): boolean {
    const result = validateFile({ name, size })
    if (!result.valid) {
      showToast(result.error ?? 'Fichier invalide.', 'error')
      return false
    }
    return true
  }

  async function pickFile() {
    if (uploading.value) return
    const res = await window.api.openFileDialog()
    if (!res?.ok || !res.data) return
    const paths = res.data as string[]
    const localPath = paths[0]
    if (!localPath) return
    const localName = displayDepotName(localPath)

    // La taille n'est pas toujours disponible via openFileDialog (depend de
    // l'impl Electron). On laisse le serveur valider en dernier recours.
    uploading.value = true
    uploadProgress.value = 0
    try {
      const uploadRes = await window.api.uploadFile(localPath, (p) => { uploadProgress.value = p })
      if (uploadRes?.ok && uploadRes.data) {
        file.value = uploadRes.data.url
        fileName.value = localName
        fileSize.value = typeof uploadRes.data.file_size === 'number' ? uploadRes.data.file_size : null
      } else {
        showToast(uploadRes?.error ?? 'Erreur lors du chargement du fichier.', 'error')
      }
    } catch (err) {
      showToast(reportError(err, {
        tag: 'deposit', op: 'upload_file_picker',
        userMessage: 'Erreur reseau lors de l\'upload. Verifie ta connexion.',
      }), 'error')
    } finally {
      uploading.value = false
      uploadProgress.value = 0
    }
  }

  function clearFile() {
    file.value = null
    fileName.value = null
    fileSize.value = null
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    if (mode.value === 'file' && !uploading.value) dragOver.value = true
  }

  function onDragLeave() { dragOver.value = false }

  async function onDrop(e: DragEvent) {
    e.preventDefault()
    dragOver.value = false
    if (mode.value !== 'file' || uploading.value) return

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    if (files.length > 1) {
      showToast('Depose un seul fichier a la fois.', 'error')
      return
    }
    const dropped = files[0]
    // Validation cote client avant upload
    if (!validateLocalFile(dropped.name, dropped.size)) return

    // Electron 32+ : file.path supprime de Chromium pour la securite. On
    // passe par window.api.getPathForFile (preload webUtils.getPathForFile)
    // qui renvoie '' si le fichier ne vient pas d'un drop OS.
    const filePath = window.api.getPathForFile?.(dropped) || ''
    if (!filePath) {
      showToast('Depose le fichier depuis l\'explorateur Windows/macOS, pas depuis un navigateur.', 'error')
      return
    }

    uploading.value = true
    uploadProgress.value = 0
    try {
      const uploadRes = await window.api.uploadFile(filePath, (p) => { uploadProgress.value = p })
      if (uploadRes?.ok && uploadRes.data) {
        file.value = uploadRes.data.url
        fileName.value = dropped.name
        fileSize.value = dropped.size
      } else {
        showToast(uploadRes?.error ?? 'Erreur lors du chargement du fichier.', 'error')
      }
    } catch (err) {
      showToast(reportError(err, {
        tag: 'deposit', op: 'upload_file_drop',
        meta: { fileName: dropped.name, fileSize: dropped.size },
        userMessage: 'Erreur reseau lors de l\'upload.',
      }), 'error')
    } finally {
      uploading.value = false
      uploadProgress.value = 0
    }
  }

  async function submit(devoir: Devoir) {
    if (depositing.value || !appStore.currentUser) return
    if (isExpired(devoir.deadline)) {
      showToast('La date limite est depassee.', 'error')
      return
    }

    let content: string
    let file_name: string | null = null

    if (mode.value === 'file') {
      if (!file.value) {
        showToast('Selectionne un fichier avant de deposer.', 'error')
        return
      }
      content = file.value
      file_name = fileName.value
    } else {
      const urlCheck = validateUrl(link.value)
      if (!urlCheck.valid) {
        showToast(urlCheck.error ?? 'Lien invalide.', 'error')
        return
      }
      content = urlCheck.normalized ?? link.value.trim()
    }

    depositing.value = true
    try {
      const ok = await travauxStore.addDepot({
        travail_id: devoir.id,
        student_id: appStore.currentUser.id,
        type:       mode.value,
        content,
        file_name,
      })
      if (ok) {
        showToast('Depot enregistre.', 'success')
        // Celebration : depot a l'heure (la validation isExpired plus haut
        // garantit qu'on est bien avant la deadline). Cosmetique, respecte
        // prefers-reduced-motion.
        void celebrate()
        cancel()
        await travauxStore.fetchStudentDevoirs()
      } else {
        showToast('Erreur lors du depot. Reessaie dans un instant.', 'error')
      }
    } catch (err) {
      showToast(reportError(err, {
        tag: 'deposit', op: 'submit',
        meta: { devoirId: devoir.id, mode: mode.value, hasFile: !!file.value },
        userMessage: 'Erreur reseau lors du depot.',
      }), 'error')
    } finally {
      depositing.value = false
    }
  }

  return {
    depositingDevoirId, mode, link, file, fileName, fileSize, depositing, uploading, uploadProgress, dragOver,
    start, cancel, pickFile, clearFile,
    onDragOver, onDragLeave, onDrop, submit,
  }
}
