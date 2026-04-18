/**
 * useRexResultsPolling : rafraichit automatiquement les resultats de
 * l'activite en cours tant qu'elle est "live" (poll toutes les 3s). Au
 * changement d'activite, fetch immediat puis redemarre/arrete le poll
 * selon le status.
 */
import { watch, onBeforeUnmount } from 'vue'
import { useRexStore } from '@/stores/rex'

const POLL_INTERVAL_MS = 3000

export function useRexResultsPolling() {
  const rex = useRexStore()
  let timer: ReturnType<typeof setInterval> | null = null

  watch(() => rex.currentActivity, (act) => {
    if (timer) { clearInterval(timer); timer = null }
    if (!act) return
    rex.fetchResults(act.id)
    if (act.status === 'live') {
      timer = setInterval(() => rex.fetchResults(act.id), POLL_INTERVAL_MS)
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    if (timer) { clearInterval(timer); timer = null }
  })
}
