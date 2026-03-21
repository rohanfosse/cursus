/**
 * Horloge réactive (ref now) mise à jour à intervalle régulier pour les deadlines.
 * Used by DevoirsView.vue
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useRealtimeClock(intervalMs = 30_000) {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    timer = setInterval(() => { now.value = Date.now() }, intervalMs)
  })

  onBeforeUnmount(() => {
    if (timer !== null) clearInterval(timer)
  })

  return { now }
}
