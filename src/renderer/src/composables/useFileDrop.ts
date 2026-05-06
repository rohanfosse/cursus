/**
 * Composable drag & drop de fichiers - fonctionne sur Electron et Web.
 * Utilisable dans n'importe quelle vue pour déposer un document.
 */
import { ref, onUnmounted, getCurrentInstance } from 'vue'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { getAuthToken } from '@/utils/auth'
import { fetchWithTimeout, isAbortError, DEFAULT_UPLOAD_TIMEOUT_MS } from '@/utils/fetchWithTimeout'

export interface DroppedFile {
  name: string
  path: string  // file.path (Electron) ou URL serveur (Web)
}

export interface FileDropOptions {
  /** Taille max en Mo (défaut 50) */
  maxSizeMb?: number
}

interface UploadResponse {
  ok: boolean
  data?: string
  error?: string
}

const DEFAULT_MAX_SIZE_MB = 50

function isUploadResponse(x: unknown): x is UploadResponse {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return typeof o.ok === 'boolean'
}

export function useFileDrop(options: FileDropOptions = {}) {
  const appStore = useAppStore()
  const { showToast } = useToast()

  const maxSizeBytes = Math.max(1, options.maxSizeMb ?? DEFAULT_MAX_SIZE_MB) * 1024 * 1024

  const isDragOver  = ref(false)
  const pendingFile = ref<DroppedFile | null>(null)
  const uploading   = ref(false)
  let dragCounter   = 0
  let inflightCtrl: AbortController | null = null

  function resetDragState(): void {
    dragCounter = 0
    isDragOver.value = false
  }

  function onDragEnter(e: DragEvent): void {
    if (!e.dataTransfer?.types.includes('Files')) return
    dragCounter++
    isDragOver.value = true
  }

  function onDragLeave(): void {
    dragCounter--
    if (dragCounter <= 0) { dragCounter = 0; isDragOver.value = false }
  }

  function onDragOver(e: DragEvent): void {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  async function onDrop(e: DragEvent): Promise<void> {
    e.preventDefault()
    resetDragState()

    const file = e.dataTransfer?.files[0]
    if (!file) return

    // Validation taille
    if (file.size > maxSizeBytes) {
      const mb = Math.round(maxSizeBytes / (1024 * 1024))
      showToast(`Fichier trop volumineux (max ${mb} Mo).`, 'error')
      return
    }

    // Electron 32+ : file.path supprime → webUtils.getPathForFile.
    const electronPath = window.api.getPathForFile?.(file) || ''
    if (electronPath) {
      pendingFile.value = { name: file.name, path: electronPath }
      return
    }

    // Web : upload immédiat via FormData
    // On annule tout upload en cours si un nouveau drop arrive
    inflightCtrl?.abort()
    inflightCtrl = new AbortController()
    const ctrl = inflightCtrl

    uploading.value = true
    try {
      const formData = new FormData()
      formData.append('file', file, file.name)
      const SERVER_URL = window.location.origin
      const token = getAuthToken()
      const response = await fetchWithTimeout(`${SERVER_URL}/api/files/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
        signal: ctrl.signal,
      }, DEFAULT_UPLOAD_TIMEOUT_MS)
      const raw = await response.json() as unknown
      if (!isUploadResponse(raw)) {
        showToast('Réponse serveur invalide.', 'error')
        return
      }
      if (raw.ok && raw.data) {
        pendingFile.value = { name: file.name, path: `${SERVER_URL}${raw.data}` }
      } else {
        showToast(raw.error ?? 'Erreur lors de l\'upload.', 'error')
      }
    } catch (err) {
      // TimeoutError (AbortSignal.timeout) : toast explicite.
      if (err instanceof Error && err.name === 'TimeoutError') {
        showToast('Upload trop long (timeout)', 'error')
        return
      }
      // Abort volontaire (drop suivant ou unmount) : silencieux.
      if (ctrl.signal.aborted || isAbortError(err)) return
      showToast('Erreur lors de l\'upload du fichier.', 'error')
    } finally {
      if (inflightCtrl === ctrl) inflightCtrl = null
      uploading.value = false
    }
  }

  async function submitDocument(opts: {
    channelId?: number | null
    promoId?: number | null
    project?: string | null
    name?: string
    category?: string
  }): Promise<boolean> {
    if (!pendingFile.value) return false
    uploading.value = true
    try {
      const res = await window.api.addChannelDocument({
        channelId: opts.channelId ?? appStore.activeChannelId ?? 0,
        promoId:   opts.promoId ?? appStore.activePromoId ?? 0,
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

  function cancelDrop(): void {
    inflightCtrl?.abort()
    inflightCtrl = null
    pendingFile.value = null
    uploading.value = false
  }

  // Cleanup : abort les uploads en cours à l'unmount
  if (getCurrentInstance()) {
    onUnmounted(() => {
      inflightCtrl?.abort()
      inflightCtrl = null
    })
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
