/**
 * Composable drag & drop de fichiers - fonctionne sur Electron et Web.
 * Utilisable dans n'importe quelle vue pour déposer un document.
 */
import { ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'

export interface DroppedFile {
  name: string
  path: string  // file.path (Electron) ou URL serveur (Web)
}

export function useFileDrop() {
  const appStore = useAppStore()
  const { showToast } = useToast()

  const isDragOver  = ref(false)
  const pendingFile = ref<DroppedFile | null>(null)
  const uploading   = ref(false)
  let dragCounter   = 0

  function onDragEnter(e: DragEvent) {
    if (!e.dataTransfer?.types.includes('Files')) return
    dragCounter++
    isDragOver.value = true
  }

  function onDragLeave() {
    dragCounter--
    if (dragCounter <= 0) { dragCounter = 0; isDragOver.value = false }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault()
    dragCounter = 0
    isDragOver.value = false
    const file = e.dataTransfer?.files[0]
    if (!file) return

    // Electron : file.path disponible
    const electronPath = (file as unknown as { path?: string }).path
    if (electronPath) {
      pendingFile.value = { name: file.name, path: electronPath }
      return
    }

    // Web : upload immédiat via FormData
    uploading.value = true
    try {
      const formData = new FormData()
      formData.append('file', file, file.name)
      const SERVER_URL = window.location.origin
      const token = localStorage.getItem('cc_session') ?? ''
      const response = await fetch(`${SERVER_URL}/api/files/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      const json = await response.json() as { ok: boolean; data?: string; error?: string }
      if (json.ok && json.data) {
        pendingFile.value = { name: file.name, path: `${SERVER_URL}${json.data}` }
      } else {
        showToast(json.error ?? 'Erreur lors de l\'upload.', 'error')
      }
    } catch {
      showToast('Erreur lors de l\'upload du fichier.', 'error')
    } finally {
      uploading.value = false
    }
  }

  async function submitDocument(opts: {
    channelId?: number | null
    promoId?: number | null
    project?: string | null
    name?: string
    category?: string
  }) {
    if (!pendingFile.value) return false
    uploading.value = true
    try {
      const res = await window.api.addChannelDocument({
        channelId: opts.channelId ?? appStore.activeChannelId,
        promoId:   opts.promoId ?? appStore.activePromoId,
        project:   opts.project ?? appStore.activeProject,
        type:      'file',
        name:      opts.name?.trim() || pendingFile.value.name,
        pathOrUrl: pendingFile.value.path,
        category:  opts.category?.trim() || 'Général',
        description: null,
      })
      if (res?.ok) {
        showToast(`"${opts.name || pendingFile.value.name}" ajouté.`, 'success')
        pendingFile.value = null
        return true
      }
      showToast('Erreur lors de l\'ajout.', 'error')
      return false
    } finally {
      uploading.value = false
    }
  }

  function cancelDrop() {
    pendingFile.value = null
  }

  return {
    isDragOver,
    pendingFile,
    uploading,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
    submitDocument,
    cancelDrop,
  }
}
