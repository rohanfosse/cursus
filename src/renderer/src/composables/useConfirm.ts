// ─── Composable de confirmation asynchrone ──────────────────────────────────
// Usage : const ok = await confirm('Supprimer ce canal ?', 'danger')

import { ref } from 'vue'

interface ConfirmOptions {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
}

const visible  = ref(false)
const options  = ref<ConfirmOptions>({ message: '' })
let resolver:  ((v: boolean) => void) | null = null

export function useConfirm() {
  function confirm(message: string, variant: 'danger' | 'warning' | 'info' = 'danger', confirmLabel?: string): Promise<boolean> {
    options.value = { message, variant, confirmLabel }
    visible.value = true
    return new Promise<boolean>((resolve) => { resolver = resolve })
  }

  function resolve(value: boolean) {
    visible.value = false
    resolver?.(value)
    resolver = null
  }

  return { visible, options, confirm, resolve }
}
