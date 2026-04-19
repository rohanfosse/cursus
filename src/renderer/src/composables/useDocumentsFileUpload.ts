/**
 * File handling pour la modale d'ajout de documents :
 *   - selection multi-fichiers (picker natif Electron ou <input type="file">)
 *   - drag & drop dans la modale (avec detection de l'env : Electron file.path
 *     vs Web upload immediat via FormData)
 *   - progress tracking sur l'upload batch
 *   - validation des extensions (miroir de la liste server-side)
 *
 * Separe de useDocumentsAdd pour garder chaque composable sous 200 lignes
 * et isoler la logique de manipulation de fichiers (drag counter, fetch
 * upload, liste d'exclusions) du form state de la modale.
 */
import { ref, computed } from 'vue'
import { useToast }     from '@/composables/useToast'
import { getAuthToken } from '@/utils/auth'

// Miroir de server/routes/documents.js : toute modif doit etre synchronisee.
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.dll', '.scr', '.pif', '.vbs', '.wsf',
  '.jar', '.apk', '.ps1', '.sh', '.ps2', '.psm1', '.hta', '.reg', '.lnk', '.js',
  '.wsh', '.cpl', '.gadget', '.inf',
])

const MAX_FILE_SIZE = 50 * 1024 * 1024

export interface PendingFile {
  /** Chemin local (Electron) ou URL serveur (Web, deja uploade via openFileDialog) */
  path: string
  /** Nom affiche */
  name: string
}

function isExtensionAllowed(fileName: string): boolean {
  const match = fileName.toLowerCase().match(/\.[^./\\]+$/)
  if (!match) return true // fichiers sans extension : autorises
  return !BLOCKED_EXTENSIONS.has(match[0])
}

export function useDocumentsFileUpload() {
  const api = window.api
  const { showToast } = useToast()

  const addFiles = ref<PendingFile[]>([])

  // Progression de l'upload (batch, par fichier)
  const uploadProgress     = ref(0)
  const uploadCurrentIndex = ref(0)
  const uploadTotal        = ref(0)

  // Retrocompat : getter simple pour le premier fichier
  const addFile     = computed(() => addFiles.value.length ? addFiles.value[0].path : null)
  const addFileName = computed(() => addFiles.value.length ? addFiles.value[0].name : null)
  const pendingFileCount = computed(() => addFiles.value.length)

  function resetFiles() {
    addFiles.value = []
    uploadProgress.value     = 0
    uploadCurrentIndex.value = 0
    uploadTotal.value        = 0
  }

  function addPendingIfNew(file: PendingFile) {
    if (!addFiles.value.some((f) => f.path === file.path)) {
      addFiles.value.push(file)
    }
  }

  async function pickFile() {
    const res = await api.openFileDialog()
    if (!res?.ok || !res.data) return
    const paths = res.data as string[]
    for (const p of paths) {
      const name = p.split(/[\\/]/).pop()?.replace(/^__web__\S+/, '') || p.split(/[\\/]/).pop() || p
      if (!isExtensionAllowed(name)) {
        showToast(`Type non autorisé : ${name}`, 'error')
        continue
      }
      addPendingIfNew({ path: p, name })
    }
  }

  function removeFile(index: number) {
    addFiles.value.splice(index, 1)
  }

  function clearFile() {
    addFiles.value = []
  }

  // ── Drag & drop dans la modale ──────────────────────────────────────────
  const modalDragOver = ref(false)
  let modalDragCounter = 0

  function onModalDragEnter(e: DragEvent) {
    if (!e.dataTransfer?.types.includes('Files')) return
    modalDragCounter++
    modalDragOver.value = true
  }

  function onModalDragLeave() {
    modalDragCounter--
    if (modalDragCounter <= 0) { modalDragCounter = 0; modalDragOver.value = false }
  }

  function onModalDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  async function onModalDrop(e: DragEvent): Promise<boolean> {
    e.preventDefault()
    modalDragCounter = 0
    modalDragOver.value = false
    const files = e.dataTransfer?.files
    if (!files?.length) return false

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!isExtensionAllowed(file.name)) {
        showToast(`Type non autorisé : ${file.name}`, 'error')
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        showToast(`Fichier trop volumineux : ${file.name} (max 50 Mo)`, 'error')
        continue
      }

      // Electron : file.path disponible, on garde le chemin local
      const electronPath = (file as unknown as { path?: string }).path
      if (electronPath) {
        addPendingIfNew({ path: electronPath, name: file.name })
        continue
      }

      // Web : upload immediat via FormData
      const serverUrl = window.location.origin
      const token = getAuthToken()
      const formData = new FormData()
      formData.append('file', file, file.name)
      try {
        const response = await fetch(`${serverUrl}/api/files/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        })
        const json = await response.json() as { ok: boolean; data?: string; error?: string }
        if (json.ok && json.data) {
          addPendingIfNew({ path: `${serverUrl}${json.data}`, name: file.name })
        } else {
          showToast(json.error ?? `Erreur upload : ${file.name}`, 'error')
        }
      } catch {
        showToast(`Erreur upload : ${file.name}`, 'error')
      }
    }

    return addFiles.value.length > 0
  }

  return {
    // State
    addFiles,
    addFile,
    addFileName,
    pendingFileCount,
    uploadProgress,
    uploadCurrentIndex,
    uploadTotal,
    modalDragOver,
    // Actions
    pickFile,
    removeFile,
    clearFile,
    resetFiles,
    onModalDragEnter,
    onModalDragLeave,
    onModalDragOver,
    onModalDrop,
  }
}
