/**
 * useRexActivityDrag : drag & drop pour reordonner les activites d'une
 * session Rex en construction. L'appelant fournit juste la liste
 * d'activites courante (par exemple via le store).
 */
import { ref } from 'vue'
import { useRexStore } from '@/stores/rex'

export function useRexActivityDrag() {
  const rex = useRexStore()
  const dragSrcId = ref<number | null>(null)

  function onDragStart(actId: number) {
    dragSrcId.value = actId
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
  }

  async function onDrop(targetId: number) {
    if (dragSrcId.value === null || dragSrcId.value === targetId) return
    const acts = rex.sessionActivities
    const fromIdx = acts.findIndex((a) => a.id === dragSrcId.value)
    const toIdx = acts.findIndex((a) => a.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const reordered = [...acts]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    await rex.reorderActivities(reordered.map((a) => a.id))
    dragSrcId.value = null
  }

  return { dragSrcId, onDragStart, onDragOver, onDrop }
}
