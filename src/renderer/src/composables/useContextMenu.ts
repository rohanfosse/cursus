/**
 * useContextMenu - composable unifie pour afficher un menu contextuel (clic droit).
 *
 * Supporte deux modes d'utilisation :
 *
 * 1) Mode items (items passes directement a open) :
 *      const { state, open, close } = useContextMenu()
 *      function onRightClick(ev: MouseEvent) {
 *        open(ev, [{ label: 'Copier', icon: Copy, action: doCopy }])
 *      }
 *      <div @contextmenu="onRightClick">...</div>
 *      <ContextMenu v-if="state" :x="state.x" :y="state.y" :items="state.items" @close="close" />
 *
 * 2) Mode target (la cible sert a calculer les items dans un computed) :
 *      const { ctx, open: openCtx, close: closeCtx } = useContextMenu<Student>()
 *      const items = computed(() => ctx.value?.target ? [...] : [])
 *      <div @contextmenu="openCtx($event, student, true)">...</div>
 *      <ContextMenu v-if="ctx" :x="ctx.x" :y="ctx.y" :items="items" @close="closeCtx" />
 *
 * Le composant <ContextMenu> reste responsable du rendu + positionnement +
 * fermeture sur clic exterieur / Escape.
 *
 * ATTENTION : le mode est detecte a l'execution via un type-guard sur payload.
 * Si `T` est un tableau dont chaque element a une propriete `label`, il sera
 * confondu avec des items et route vers `state` au lieu de `ctx`. Eviter
 * d'utiliser comme target un type ambigu ; preferer les objets domaine.
 */
import { ref, type Ref } from 'vue'
import type { ContextMenuItem } from '@/components/ui/ContextMenu.vue'

export interface ContextMenuItemsState {
  x: number
  y: number
  items: ContextMenuItem[]
}

export interface ContextMenuTargetState<T> {
  x: number
  y: number
  target: T
}

export interface UseContextMenuReturn<T> {
  state: Ref<ContextMenuItemsState | null>
  ctx: Ref<ContextMenuTargetState<T> | null>
  open: {
    (ev: MouseEvent, items: ContextMenuItem[]): void
    (ev: MouseEvent, target: T, stopPropagation?: boolean): void
  }
  close: () => void
}

function isContextMenuItemList(value: unknown): value is ContextMenuItem[] {
  if (!Array.isArray(value)) return false
  return value.every(
    (item): item is ContextMenuItem =>
      !!item && typeof item === 'object' && 'label' in item,
  )
}

export function useContextMenu<T = unknown>(): UseContextMenuReturn<T> {
  const state = ref<ContextMenuItemsState | null>(null) as Ref<ContextMenuItemsState | null>
  const ctx = ref<ContextMenuTargetState<T> | null>(null) as Ref<ContextMenuTargetState<T> | null>

  function open(ev: MouseEvent, payload: ContextMenuItem[] | T, stopPropagation = false): void {
    ev.preventDefault()

    if (isContextMenuItemList(payload)) {
      // Items: stopPropagation inconditionnel pour eviter les menus imbriques.
      ev.stopPropagation()
      if (!payload.length) return
      state.value = { x: ev.clientX, y: ev.clientY, items: payload }
      return
    }

    if (stopPropagation) ev.stopPropagation()
    ctx.value = { x: ev.clientX, y: ev.clientY, target: payload }
  }

  function close(): void {
    state.value = null
    ctx.value = null
  }

  return { state, ctx, open, close }
}

export type { ContextMenuItem }
