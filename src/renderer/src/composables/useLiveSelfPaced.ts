/**
 * useLiveSelfPaced : navigation etudiante dans une session self-paced
 * (chaque etudiant progresse a son rythme, pas de push socket du prof).
 *
 * Override `currentActivity` dans le store avec l'activite selectionnee,
 * reset `hasResponded` selon le set des activites deja repondues, et
 * simule un `timerStartedAt` local pour les activites chronometrees.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useLiveStore } from '@/stores/live'

export function useLiveSelfPaced() {
  const liveStore = useLiveStore()

  const session = computed(() => liveStore.currentSession)
  const isActive = computed(() => !!session.value?.self_paced && session.value?.status === 'active')

  const index = ref(0)
  const activities = computed(() =>
    (session.value?.activities ?? []).filter((a) => a.type !== 'live_code'),
  )
  const currentActivity = computed(() => activities.value[index.value] ?? null)
  const respondedIds = ref<Set<number>>(new Set())
  const completed = computed(() =>
    activities.value.filter((a) => respondedIds.value.has(a.id)).length,
  )

  watch([isActive, currentActivity], ([active, act]) => {
    if (active && act) {
      liveStore.currentActivity = act
      liveStore.hasResponded = respondedIds.value.has(act.id)
      if (act.timer_seconds && !respondedIds.value.has(act.id)) {
        liveStore.timerStartedAt = new Date().toISOString()
      } else {
        liveStore.timerStartedAt = null
      }
    }
  }, { immediate: true })

  function prev() { if (index.value > 0) index.value-- }
  function next() { if (index.value < activities.value.length - 1) index.value++ }
  function goTo(i: number) { index.value = i }

  async function fetchMyResponses() {
    if (!session.value) return
    try {
      const res = await window.api.getLiveV2MyResponses(session.value.id)
      if (res?.ok && Array.isArray(res.data)) {
        respondedIds.value = new Set(res.data)
      }
    } catch { /* ignore */ }
  }

  // Track nouvelle reponse → ajouter a la liste
  watch(() => liveStore.hasResponded, (responded) => {
    if (responded && isActive.value && liveStore.currentActivity) {
      respondedIds.value = new Set([...respondedIds.value, liveStore.currentActivity.id])
    }
  })

  // Fetch au passage en mode self-paced
  watch(isActive, (active) => { if (active) fetchMyResponses() }, { immediate: true })

  // Socket : toggle self-paced cote prof
  let unsub: (() => void) | null = null
  onMounted(() => {
    unsub = window.api.onLiveSelfPacedUpdate?.((data) => {
      if (session.value && data.sessionId === session.value.id) {
        liveStore.currentSession = { ...session.value, self_paced: data.selfPaced ? 1 : 0 }
      }
    }) ?? null
  })
  onUnmounted(() => { unsub?.() })

  return {
    isActive, index, activities, currentActivity, respondedIds, completed,
    prev, next, goTo, fetchMyResponses,
  }
}
