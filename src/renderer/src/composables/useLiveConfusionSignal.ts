/**
 * useLiveConfusionSignal : compteur "je suis perdu(e)" Wooclap.
 * Fetch initial + souscription socket scoped a la session courante.
 */
import { ref, watch, onUnmounted } from 'vue'
import { useLiveStore } from '@/stores/live'

export function useLiveConfusionSignal() {
  const liveStore = useLiveStore()
  const count = ref(0)
  let unsub: (() => void) | null = null

  watch(() => liveStore.currentSession?.id, async (sessionId) => {
    count.value = 0
    unsub?.()
    unsub = null
    if (!sessionId) return
    try {
      const res = await window.api.getConfusionCount(sessionId)
      if (res?.ok) count.value = res.data?.count ?? 0
    } catch { /* ignore */ }
    unsub = window.api.onLiveConfusionUpdate((data) => {
      if (data.sessionId === sessionId) count.value = data.count
    })
  }, { immediate: true })

  onUnmounted(() => { unsub?.(); unsub = null })

  return { count }
}
