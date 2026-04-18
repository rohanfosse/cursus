/**
 * useLiveSelfPacedProgress : polling (3s) du nombre de reponses par activite
 * quand la session est en mode self-paced + active. Fournit aussi les actions
 * launch-all et toggle self-paced.
 */
import { ref, watch, onUnmounted } from 'vue'
import { useLiveStore } from '@/stores/live'
import { useToast } from '@/composables/useToast'

const POLL_INTERVAL_MS = 3000

export interface ActivityProgress {
  id: number
  title: string
  type: string
  responseCount: number
}

export function useLiveSelfPacedProgress() {
  const liveStore = useLiveStore()
  const { showToast } = useToast()

  const activityProgress = ref<ActivityProgress[]>([])
  let interval: ReturnType<typeof setInterval> | null = null

  async function fetchProgress() {
    if (!liveStore.currentSession?.self_paced || !liveStore.currentSession?.id) return
    try {
      const res = await window.api.getLiveV2Progress(liveStore.currentSession.id)
      if (res?.ok && Array.isArray(res.data)) activityProgress.value = res.data
    } catch { /* ignore */ }
  }

  watch(
    () => liveStore.currentSession?.self_paced && liveStore.currentSession?.status === 'active',
    (active) => {
      if (interval) { clearInterval(interval); interval = null }
      if (active) {
        fetchProgress()
        interval = setInterval(fetchProgress, POLL_INTERVAL_MS)
      } else {
        activityProgress.value = []
      }
    },
    { immediate: true },
  )

  onUnmounted(() => { if (interval) clearInterval(interval) })

  async function launchAllActivities() {
    if (!liveStore.currentSession) return
    try {
      const res = await window.api.launchAllLiveV2(liveStore.currentSession.id)
      if (res?.ok) {
        await liveStore.fetchSession(liveStore.currentSession.id)
        showToast(`${res.data?.launched ?? 0} activite(s) lancee(s)`, 'success')
        fetchProgress()
      }
    } catch {
      showToast('Erreur lors du lancement', 'error')
    }
  }

  async function toggleSelfPaced() {
    if (!liveStore.currentSession) return
    const newVal = !liveStore.currentSession.self_paced
    try {
      const res = await window.api.toggleLiveV2SelfPaced(liveStore.currentSession.id, newVal)
      if (res?.ok && liveStore.currentSession) {
        liveStore.currentSession = { ...liveStore.currentSession, self_paced: newVal ? 1 : 0 }
      }
    } catch { /* ignore */ }
  }

  return { activityProgress, launchAllActivities, toggleSelfPaced }
}
