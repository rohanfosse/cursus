/**
 * useLiveConfusionToggle : cote etudiant, bouton Wooclap "je suis perdu(e)".
 * Envoie le signal au serveur + maintient l'etat local du toggle.
 *
 * Pendant du useLiveConfusionSignal cote enseignant.
 */
import { ref } from 'vue'
import { useLiveStore } from '@/stores/live'

export function useLiveConfusionToggle() {
  const liveStore = useLiveStore()

  const confused = ref(false)
  const loading = ref(false)

  async function toggle() {
    const session = liveStore.currentSession
    if (!session || loading.value) return
    loading.value = true
    try {
      const res = await window.api.sendConfusionSignal(session.id, !confused.value)
      if (res?.ok) confused.value = !confused.value
    } catch { /* ignore */ }
    loading.value = false
  }

  return { confused, loading, toggle }
}
