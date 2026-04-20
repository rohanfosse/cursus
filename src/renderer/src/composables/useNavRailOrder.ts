/**
 * useNavRailOrder - ordre personnalise des boutons de la sidebar (NavRail).
 *
 * L'utilisateur peut drag-and-drop les elements de navigation principale pour
 * les reordonner selon ses preferences. L'ordre est persiste localement.
 *
 * - Les ids inconnus stockes en localStorage sont ignores (ex: module retire).
 * - Les nouveaux ids pas encore dans l'ordre apparaissent dans leur position
 *   par defaut (fin de l'ordre canonique).
 * - La visibilite (module desactive, role student, ...) est decidee par
 *   l'appelant et ne fait pas partie de l'ordre stocke.
 */
import { ref, computed, type Ref } from 'vue'
import { safeGetJSON, safeSetJSON } from '@/utils/safeStorage'

const ORDER_KEY = 'cc_navrail_order_v1'

export function useNavRailOrder(defaultOrder: readonly string[]) {
  const savedOrder: Ref<string[]> = ref(safeGetJSON<string[]>(ORDER_KEY, []))

  function persist(ids: string[]) {
    savedOrder.value = ids
    safeSetJSON(ORDER_KEY, ids)
  }

  /** Ordre effectif : ids sauves (filtres par defaultOrder) puis ids manquants
   *  dans l'ordre canonique. Garantit qu'ajouter un nouveau module le place
   *  a la fin plutot que de le cacher. */
  const effectiveOrder = computed<string[]>(() => {
    const known = new Set<string>(defaultOrder)
    const seen = new Set<string>()
    const result: string[] = []
    for (const id of savedOrder.value) {
      if (known.has(id) && !seen.has(id)) {
        result.push(id); seen.add(id)
      }
    }
    for (const id of defaultOrder) {
      if (!seen.has(id)) { result.push(id); seen.add(id) }
    }
    return result
  })

  /** Deplace `draggedId` juste avant `targetId`. No-op si ids identiques. */
  function move(draggedId: string, targetId: string) {
    if (draggedId === targetId) return
    const current = [...effectiveOrder.value]
    const from = current.indexOf(draggedId)
    if (from === -1) return
    current.splice(from, 1)
    const to = current.indexOf(targetId)
    if (to === -1) {
      current.push(draggedId)
    } else {
      current.splice(to, 0, draggedId)
    }
    persist(current)
  }

  function reset() {
    persist([])
  }

  return { effectiveOrder, move, reset }
}
