import { reactive } from 'vue'

// ─── État partagé (singleton) ────────────────────────────────────────────────
// Un seul toast visible à la fois. Le composant <Toast> est abonné à cet état.

export type ToastType = 'error' | 'success' | 'info' | 'undo'

interface ToastState {
  message: string
  type: ToastType
  visible: boolean
  onUndo?: () => void
}

export const toastState = reactive<ToastState>({
  message: '',
  type: 'error',
  visible: false,
})

let _timer: ReturnType<typeof setTimeout> | null = null

// ─── Composable ──────────────────────────────────────────────────────────────

export function useToast() {
  function showToast(msg: string, type: Exclude<ToastType, 'undo'> = 'error') {
    if (_timer) clearTimeout(_timer)
    toastState.message = msg
    toastState.type    = type
    toastState.visible = true
    toastState.onUndo  = undefined
    _timer = setTimeout(() => { toastState.visible = false }, 4000)
  }

  function showUndoToast(msg: string, duration = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      if (_timer) clearTimeout(_timer)
      toastState.message = msg
      toastState.type    = 'undo'
      toastState.visible = true
      let settled = false

      toastState.onUndo = () => {
        if (settled) return
        settled = true
        if (_timer) clearTimeout(_timer)
        toastState.visible = false
        resolve(true)
      }

      _timer = setTimeout(() => {
        if (!settled) { settled = true; toastState.visible = false; resolve(false) }
      }, duration)
    })
  }

  return { showToast, showUndoToast }
}
