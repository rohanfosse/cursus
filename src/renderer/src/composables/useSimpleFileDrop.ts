/**
 * useSimpleFileDrop — drag-and-drop unifie, robuste et prêt pour toutes les
 * surfaces d'upload de l'app (Electron + fallback web).
 *
 * Design :
 * - **Drag counter** interne : le passage du curseur sur les enfants de la
 *   zone ne fait plus flicker l'etat `isDragOver` (bug classique de
 *   `dragenter`/`dragleave` qui se declenchent pour chaque descendant).
 * - **Machine a etats** explicite : `status = 'idle' | 'drag-over' |
 *   'processing' | 'success' | 'error'`. Les consumers peuvent peindre une
 *   animation differente par etat.
 * - **Auto-reset** apres succes/erreur (delai configurable) pour animer un
 *   flash "depot recu" sans boilerplate cote consumer.
 * - **Bindings object** : `v-bind="bindings"` sur une div suffit, plus besoin
 *   de cabler les 4 handlers un par un.
 * - **Disabled reactif** : passe un ref/computed pour bloquer dynamiquement.
 * - **API legacy preservee** : `isDragOver`, `onDragEnter`, `onDragOver`,
 *   `onDragLeave`, `onDrop` restent disponibles pour les consumers deja en
 *   place. Pas de breaking change.
 *
 * Usage minimal (single-file, path Electron) :
 *   const drop = useSimpleFileDrop({
 *     onDrop: ([item]) => { if (item?.path) myFile.value = item.path },
 *   })
 *   <div v-bind="drop.bindings" :class="{ active: drop.isDragOver }">...</div>
 *
 * Usage avec state machine pour animation :
 *   <div v-bind="drop.bindings" :data-state="drop.status">...</div>
 *
 * Usage avec callback async et auto-flash succes :
 *   const drop = useSimpleFileDrop({
 *     onDrop: async ([item]) => { await upload(item.file) },
 *     successResetMs: 1500, // flash "success" pendant 1.5s apres resolution
 *   })
 */
import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { useToast } from './useToast'

export interface FileDropItem {
  /** Chemin filesystem absolu (Electron). null si non disponible (contexte web). */
  path: string | null
  name: string
  size: number
  /** MIME type detecte par le navigateur (peut etre vide). */
  type: string
  /** Objet File brut pour FileReader / FormData / inspection binaire. */
  file: File
}

export type DropStatus = 'idle' | 'drag-over' | 'processing' | 'success' | 'error'

export interface UseSimpleFileDropOptions {
  onDrop: (items: FileDropItem[]) => void | Promise<void>
  /** Taille max par fichier en octets. Defaut 50 Mo. */
  maxBytes?: number
  /** Extensions autorisees (sans le point, lowercase). */
  allowedExtensions?: string[]
  /** Accept MIME pattern (ex: 'image/*', 'application/pdf'). Supporte wildcard apres /. */
  accept?: string
  /** Accepte plusieurs fichiers. Defaut false (seul le premier est conserve). */
  multiple?: boolean
  /** Desactive le drop (reactif). Defaut false. */
  disabled?: Ref<boolean> | ComputedRef<boolean>
  /**
   * Delai (ms) avant de revenir a 'idle' apres 'success' ou 'error'.
   * 0 = manuel (le consumer reset via resetStatus()). Defaut 1500.
   */
  successResetMs?: number
  /**
   * Si true, tous les fichiers doivent avoir un `path` Electron valide,
   * sinon on reject l'ensemble avec un toast. Defaut false.
   */
  requireElectronPath?: boolean
}

export interface FileDropBindings {
  onDragenter: (e: DragEvent) => void
  onDragover: (e: DragEvent) => void
  onDragleave: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void | Promise<void>
}

export interface UseSimpleFileDropReturn {
  /** Machine a etats complete. */
  status: Ref<DropStatus>
  /** true quand status === 'drag-over'. Back-compat avec l'ancienne API. */
  isDragOver: ComputedRef<boolean>
  /** true quand un callback async est en cours (`onDrop` n'a pas encore resolve). */
  isProcessing: ComputedRef<boolean>
  /** true pendant le flash de confirmation apres succes. */
  isSuccess: ComputedRef<boolean>
  /** true pendant le flash d'erreur. */
  isError: ComputedRef<boolean>
  /**
   * Object a spread via `v-bind="bindings"` sur l'element drop-zone.
   * Evite le cablage manuel des 4 handlers.
   */
  bindings: FileDropBindings
  /** Force le retour a 'idle' immediatement (override l'auto-reset). */
  resetStatus: () => void
  // ── Handlers individuels (back-compat) ────────────────────────────────
  onDragEnter: (e: DragEvent) => void
  onDragOver: (e: DragEvent) => void
  onDragLeave: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void | Promise<void>
}

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024
const DEFAULT_RESET_MS = 1500

function matchesAccept(mimeType: string, accept: string): boolean {
  const [type, subtype] = accept.split('/')
  const [fileType, fileSubtype] = (mimeType || '').split('/')
  if (type !== fileType) return false
  if (subtype === '*') return true
  return subtype === fileSubtype
}

function extensionOf(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

export function useSimpleFileDrop(opts: UseSimpleFileDropOptions): UseSimpleFileDropReturn {
  const {
    onDrop: callback,
    maxBytes = DEFAULT_MAX_BYTES,
    allowedExtensions,
    accept,
    multiple = false,
    disabled,
    successResetMs = DEFAULT_RESET_MS,
    requireElectronPath = false,
  } = opts
  const { showToast } = useToast()

  const status = ref<DropStatus>('idle')
  // Drag counter : compte les dragenter moins les dragleave. Robuste meme
  // quand la souris passe sur des enfants de la zone.
  let dragCounter = 0
  let resetTimer: ReturnType<typeof setTimeout> | null = null

  const isDisabled = computed(() => !!disabled?.value)
  const isDragOver = computed(() => status.value === 'drag-over')
  const isProcessing = computed(() => status.value === 'processing')
  const isSuccess = computed(() => status.value === 'success')
  const isError = computed(() => status.value === 'error')

  function hasFiles(e: DragEvent): boolean {
    return !!e.dataTransfer?.types.includes('Files')
  }

  function resetStatus(): void {
    if (resetTimer) { clearTimeout(resetTimer); resetTimer = null }
    dragCounter = 0
    status.value = 'idle'
  }

  function scheduleReset(): void {
    if (successResetMs <= 0) return
    if (resetTimer) clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      status.value = 'idle'
      resetTimer = null
    }, successResetMs)
  }

  function validateFile(file: File): { ok: boolean; reason?: string } {
    if (file.size > maxBytes) {
      const mb = Math.round(maxBytes / (1024 * 1024))
      return { ok: false, reason: `"${file.name}" trop volumineux (max ${mb} Mo).` }
    }
    if (allowedExtensions && allowedExtensions.length) {
      const ext = extensionOf(file.name)
      if (!allowedExtensions.includes(ext)) {
        return { ok: false, reason: `"${file.name}" : format non supporte (accepte : ${allowedExtensions.join(', ')}).` }
      }
    }
    if (accept && file.type && !matchesAccept(file.type, accept)) {
      return { ok: false, reason: `"${file.name}" ne correspond pas au filtre ${accept}.` }
    }
    return { ok: true }
  }

  function onDragEnter(e: DragEvent): void {
    if (isDisabled.value || !hasFiles(e)) return
    e.preventDefault()
    dragCounter++
    if (status.value === 'idle') status.value = 'drag-over'
  }

  function onDragOver(e: DragEvent): void {
    if (isDisabled.value || !hasFiles(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  function onDragLeave(e: DragEvent): void {
    if (isDisabled.value || !hasFiles(e)) return
    dragCounter = Math.max(0, dragCounter - 1)
    if (dragCounter === 0 && status.value === 'drag-over') {
      status.value = 'idle'
    }
  }

  async function handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault()
    dragCounter = 0
    if (isDisabled.value) { status.value = 'idle'; return }

    const fileList = e.dataTransfer?.files
    if (!fileList || !fileList.length) { status.value = 'idle'; return }

    const rawFiles = Array.from(fileList)
    const files = multiple ? rawFiles : rawFiles.slice(0, 1)

    const valid: FileDropItem[] = []
    const errors: string[] = []
    for (const file of files) {
      const check = validateFile(file)
      if (!check.ok) { errors.push(check.reason!); continue }
      // Electron 32+ : file.path supprime → webUtils.getPathForFile.
      const electronPath = window.api.getPathForFile?.(file) || null
      if (requireElectronPath && !electronPath) {
        errors.push(`"${file.name}" : chemin Electron indisponible.`)
        continue
      }
      valid.push({
        path: electronPath,
        name: file.name,
        size: file.size,
        type: file.type,
        file,
      })
    }

    if (errors.length) showToast(errors[0], 'error')

    if (!valid.length) {
      status.value = 'error'
      scheduleReset()
      return
    }

    status.value = 'processing'
    try {
      await callback(valid)
      status.value = 'success'
      scheduleReset()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue lors du depot.'
      showToast(msg, 'error')
      status.value = 'error'
      scheduleReset()
    }
  }

  const bindings: FileDropBindings = {
    onDragenter: onDragEnter,
    onDragover: onDragOver,
    onDragleave: onDragLeave,
    onDrop: handleDrop,
  }

  return {
    status,
    isDragOver,
    isProcessing,
    isSuccess,
    isError,
    bindings,
    resetStatus,
    // Back-compat handlers individuels
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop: handleDrop,
  }
}
