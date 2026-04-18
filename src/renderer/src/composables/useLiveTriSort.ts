/**
 * useLiveTriSort : activite "tri" cote etudiant. Les items sont melanges
 * avec un seed deterministe (activity.id + studentId) pour que chaque
 * etudiant voie un ordre different mais stable entre refresh.
 */
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { shuffleArray } from '@/utils/liveActivity'
import { useLiveStore } from '@/stores/live'
import type { LiveActivity } from '@/types'

export function useLiveTriSort(activity: Ref<LiveActivity | null>, studentId: Ref<number>) {
  const liveStore = useLiveStore()
  const order = ref<number[]>([])

  const options = computed<string[]>(() => {
    const act = activity.value
    if (!act || act.type !== 'tri' || !act.options) return []
    try {
      const arr = Array.isArray(act.options) ? act.options : JSON.parse(act.options as string)
      return Array.isArray(arr) ? arr : []
    } catch {
      return []
    }
  })

  watch(activity, (act) => {
    if (act?.type === 'tri' && options.value.length > 0) {
      const seed = act.id * 1000 + studentId.value
      order.value = shuffleArray(options.value.map((_, i) => i), seed)
    }
  }, { immediate: true })

  function moveUp(i: number) {
    if (i <= 0) return
    const arr = [...order.value];
    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
    order.value = arr
  }
  function moveDown(i: number) {
    if (i >= order.value.length - 1) return
    const arr = [...order.value];
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
    order.value = arr
  }

  async function submit(onResult?: (r: import('@/types').LiveScoreResult) => void) {
    if (!activity.value || order.value.length === 0) return
    const result = await liveStore.submitResponse(activity.value.id, { answer: order.value.join(',') })
    if (result && onResult) onResult(result)
  }

  return { order, options, moveUp, moveDown, submit }
}
