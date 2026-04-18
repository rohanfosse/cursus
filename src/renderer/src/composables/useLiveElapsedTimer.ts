/**
 * useLiveElapsedTimer : ticker "temps ecoule" pour l'activite Live courante.
 *
 * Ne demarre que pour une activite live non-Spark (Spark a son propre timer).
 * Normalise `started_at` : SQLite retourne sans 'Z' (UTC naif), socket peut
 * deja renvoyer avec 'Z' — on ajoute 'Z' seulement si absent.
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import { isSparkType } from '@/utils/liveActivity'
import type { LiveActivity } from '@/types'

export function useLiveElapsedTimer(currentActivity: Ref<LiveActivity | null>) {
  const tick = ref(0)
  let interval: ReturnType<typeof setInterval> | null = null

  function start() {
    if (interval) return
    interval = setInterval(() => { tick.value++ }, 1000)
  }

  function stop() {
    if (interval) { clearInterval(interval); interval = null }
    tick.value = 0
  }

  watch(currentActivity, (act) => {
    if (act && act.status === 'live' && !isSparkType(act.type)) start()
    else stop()
  }, { immediate: true })

  onUnmounted(stop)

  const elapsedSeconds = computed<number | null>(() => {
    void tick.value
    const started = currentActivity.value?.started_at
    if (!started) return null
    const iso = started.endsWith('Z') ? started : started + 'Z'
    return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  })

  const elapsedTime = computed(() => {
    if (elapsedSeconds.value === null) return '0:00'
    const m = Math.floor(elapsedSeconds.value / 60)
    const s = elapsedSeconds.value % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  })

  return { elapsedSeconds, elapsedTime }
}
