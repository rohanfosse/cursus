/**
 * Systeme de toast global (singleton) : affichage de notifications temporaires (error, success, info, undo).
 * Supporte une file d'attente : plusieurs toasts s'affichent en pile.
 */
import { reactive, ref } from 'vue'

// ─── Types ──────────────────────────────────────────────────────────────────

export type ToastType = 'error' | 'success' | 'info' | 'undo'

export interface ToastEntry {
  id: string
  message: string
  type: ToastType
  detail?: string
  onUndo?: () => void
  timer?: ReturnType<typeof setTimeout>
  /** Timestamp ms de creation — utilise par Toast.vue pour le hover-pause. */
  _startedAt: number
}

// ─── Etat partage (singleton) ───────────────────────────────────────────────

// Legacy single-toast state (backward compat with Toast.vue)
export const toastState = reactive<{
  message: string; type: ToastType; visible: boolean; detail?: string; onUndo?: () => void
}>({
  message: '',
  type: 'error',
  visible: false,
  detail: undefined,
})

// Queue for stacked toasts
export const toastQueue = ref<ToastEntry[]>([])
const MAX_VISIBLE = 3

let _legacyTimer: ReturnType<typeof setTimeout> | null = null
let _idCounter = 0

// ─── Composable ─────────────────────────────────────────────────────────────

export function useToast() {
  function showToast(msg: string, type: Exclude<ToastType, 'undo'> = 'error', detail?: string) {
    // Add to queue
    const id = `toast_${++_idCounter}_${Date.now()}`
    const duration = type === 'error' ? 8000 : 4000
    const entry: ToastEntry = { id, message: msg, type, detail, _startedAt: Date.now() }
    entry.timer = setTimeout(() => removeToast(id), duration)
    toastQueue.value = [entry, ...toastQueue.value].slice(0, MAX_VISIBLE)

    // Legacy single-toast (for backward compat)
    if (_legacyTimer) clearTimeout(_legacyTimer)
    toastState.message = msg
    toastState.type    = type
    toastState.visible = true
    toastState.detail  = detail
    toastState.onUndo  = undefined
    _legacyTimer = setTimeout(() => { toastState.visible = false }, duration)
  }

  function dismissToast() {
    if (_legacyTimer) clearTimeout(_legacyTimer)
    toastState.visible = false
    // Also dismiss first toast in queue
    if (toastQueue.value.length > 0) {
      removeToast(toastQueue.value[0].id)
    }
  }

  function removeToast(id: string) {
    const entry = toastQueue.value.find(t => t.id === id)
    if (entry?.timer) clearTimeout(entry.timer)
    toastQueue.value = toastQueue.value.filter(t => t.id !== id)
    // Sync legacy state
    if (toastQueue.value.length === 0) toastState.visible = false
  }

  function showUndoToast(msg: string, duration = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      if (_legacyTimer) clearTimeout(_legacyTimer)
      toastState.message = msg
      toastState.type    = 'undo'
      toastState.visible = true
      toastState.detail  = undefined
      let settled = false

      toastState.onUndo = () => {
        if (settled) return
        settled = true
        if (_legacyTimer) clearTimeout(_legacyTimer)
        toastState.visible = false
        resolve(true)
      }

      _legacyTimer = setTimeout(() => {
        if (!settled) { settled = true; toastState.visible = false; resolve(false) }
      }, duration)
    })
  }

  return { showToast, showUndoToast, dismissToast, removeToast }
}
