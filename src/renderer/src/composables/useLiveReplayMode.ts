/**
 * useLiveReplayMode : mode entrainement asynchrone cote etudiant apres la
 * fin d'une session Spark. Les reponses vont dans live_responses_v2 avec
 * mode='replay' et n'impactent pas le leaderboard live.
 */
import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import { isSparkType, buildResponsePayload } from '@/utils/liveActivity'
import { useLiveStore } from '@/stores/live'
import type { LiveScoreResult, LiveActivity } from '@/types'

export interface ReplayInputs {
  selectedAnswers: Ref<number[]>
  textInput: Ref<string>
  associationMapping: Ref<number[]>
}

export function useLiveReplayMode(inputs: ReplayInputs) {
  const liveStore = useLiveStore()

  const active = ref(false)
  const index = ref(0)
  const feedback = ref<LiveScoreResult | null>(null)
  const score = ref(0)

  const sparkActivities = computed<LiveActivity[]>(() =>
    (liveStore.currentSession?.activities ?? []).filter((a) => isSparkType(a.type)),
  )
  const currentActivity = computed<LiveActivity | null>(() =>
    sparkActivities.value[index.value] ?? null,
  )
  const finished = computed(() =>
    active.value && index.value >= sparkActivities.value.length,
  )

  function start() {
    active.value = true
    index.value = 0
    feedback.value = null
    score.value = 0
    inputs.selectedAnswers.value = []
    inputs.textInput.value = ''
  }

  function next() {
    feedback.value = null
    index.value += 1
    inputs.selectedAnswers.value = []
    inputs.textInput.value = ''
    inputs.associationMapping.value = []
  }

  function exit() {
    active.value = false
    index.value = 0
    feedback.value = null
  }

  async function submit() {
    const act = currentActivity.value
    if (!act) return
    const basePayload = buildResponsePayload(act.type, {
      selectedAnswers: inputs.selectedAnswers.value,
      textInput: inputs.textInput.value,
      associationMapping: inputs.associationMapping.value,
    })
    if (!basePayload) return
    const result = await liveStore.submitResponse(act.id, { ...basePayload, mode: 'replay' })
    if (result) {
      feedback.value = result
      if (result.points > 0) score.value += result.points
    }
  }

  return {
    active, index, feedback, score,
    sparkActivities, currentActivity, finished,
    start, next, exit, submit,
  }
}
