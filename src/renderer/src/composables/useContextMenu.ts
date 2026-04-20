/**
 * Helper generique pour la position + la cible d'un menu contextuel (clic droit).
 * Utilise avec le composant ContextMenu.vue.
 */
import { ref } from 'vue'

export function useContextMenu<T>() {
  const ctx = ref<{ x: number; y: number; target: T } | null>(null)

  function open(e: MouseEvent, target: T, stopPropagation = false) {
    e.preventDefault()
    if (stopPropagation) e.stopPropagation()
    ctx.value = { x: e.clientX, y: e.clientY, target }
  }

  function close() { ctx.value = null }

  return { ctx, open, close }
}
