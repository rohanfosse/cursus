/**
 * useLiveQcmShuffle : melange deterministe des options QCM par etudiant
 * (seed = activity.id * 1000 + studentId) pour eviter la copie entre
 * voisins tout en restant stable entre refresh.
 */
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { shuffleArray } from '@/utils/liveActivity'
import type { LiveActivity } from '@/types'

export function useLiveQcmShuffle(activity: Ref<LiveActivity | null>, studentId: Ref<number>) {
  const shuffleMap = ref<number[]>([])

  const shuffledOptions = computed<string[]>(() => {
    const act = activity.value
    if (!act?.options || act.type !== 'qcm') return []
    const opts = Array.isArray(act.options) ? act.options : (() => {
      try { return JSON.parse(act.options as unknown as string) } catch { return [] }
    })()
    return shuffleMap.value.map((origIdx) => (opts as string[])[origIdx])
  })

  watch(activity, (act) => {
    if (act?.type === 'qcm' && act.options) {
      const opts = Array.isArray(act.options) ? act.options : JSON.parse(act.options as unknown as string)
      const seed = act.id * 1000 + studentId.value
      shuffleMap.value = shuffleArray(opts.map((_: unknown, i: number) => i), seed)
    } else {
      shuffleMap.value = []
    }
  })

  return { shuffleMap, shuffledOptions }
}
