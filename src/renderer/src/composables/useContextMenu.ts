/**
 * useContextMenu - pattern uniformise pour afficher un menu contextuel.
 *
 * Encapsule la state locale {x, y, items}, la gestion preventDefault/stopPropagation
 * et la fonction de fermeture. Le composant <ContextMenu> reste responsable du
 * rendu + positionnement + fermeture sur clic exterieur / Escape.
 *
 * Usage :
 *   const { state, open, close } = useContextMenu()
 *   function onRightClick(ev: MouseEvent) {
 *     open(ev, [{ label: 'Copier', icon: Copy, action: doCopy }])
 *   }
 *   // template :
 *   <div @contextmenu="onRightClick">...</div>
 *   <ContextMenu v-if="state" :x="state.x" :y="state.y" :items="state.items" @close="close" />
 */
import { ref, type Ref } from 'vue'
import type { ContextMenuItem } from '@/components/ui/ContextMenu.vue'

export interface ContextMenuState {
  x: number
  y: number
  items: ContextMenuItem[]
}

export interface UseContextMenuReturn {
  state: Ref<ContextMenuState | null>
  open: (ev: MouseEvent, items: ContextMenuItem[]) => void
  close: () => void
}

export function useContextMenu(): UseContextMenuReturn {
  const state = ref<ContextMenuState | null>(null)

  function open(ev: MouseEvent, items: ContextMenuItem[]) {
    if (!items.length) return
    ev.preventDefault()
    ev.stopPropagation()
    state.value = { x: ev.clientX, y: ev.clientY, items }
  }

  function close() {
    state.value = null
  }

  return { state, open, close }
}

export type { ContextMenuItem }
