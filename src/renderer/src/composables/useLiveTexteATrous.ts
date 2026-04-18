/**
 * useLiveTexteATrous : activite "texte a trous" cote etudiant. Parse les
 * blanks depuis le titre (`{{ ... }}`) et track les inputs par blank.
 */
import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import { useLiveStore } from '@/stores/live'
import type { LiveActivity, LiveScoreResult } from '@/types'

const BLANK_REGEX = /\{\{[^}]+\}\}/g

export function useLiveTexteATrous(activity: Ref<LiveActivity | null>) {
  const liveStore = useLiveStore()
  const inputs = ref<string[]>([])

  const parts = computed(() => {
    const act = activity.value
    if (!act || act.type !== 'texte_a_trous') return { segments: [] as string[], blanksCount: 0 }
    const title = act.title ?? ''
    const segments = title.split(BLANK_REGEX)
    const blanksCount = (title.match(BLANK_REGEX) || []).length
    return { segments, blanksCount }
  })

  watch(activity, (act) => {
    if (act?.type === 'texte_a_trous') {
      const count = (act.title?.match(BLANK_REGEX) || []).length
      inputs.value = Array(count).fill('')
    }
  })

  async function submit(onResult?: (r: LiveScoreResult) => void) {
    if (!activity.value || inputs.value.some((b) => !b.trim())) return
    const answer = inputs.value.join(',')
    const result = await liveStore.submitResponse(activity.value.id, { text: answer })
    if (result && onResult) onResult(result)
  }

  return { inputs, parts, submit }
}
