/**
 * useDemoMode - composable d'acces au mode demo (sandbox sans inscription).
 *
 * Detecte si l'utilisateur courant est en demo (cf. `User.demo` set par
 * POST /api/demo/start) et expose un helper `restrictAction` qui bloque
 * certaines actions sensibles avec un toast explicatif.
 *
 * Ne pas confondre avec `useDemoListener` (V2) qui ecoute les events
 * Socket.IO de presence fake.
 */
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'

export function useDemoMode() {
  const appStore = useAppStore()
  const { showToast } = useToast()

  const isDemo = computed(() => appStore.currentUser?.demo === true)

  /**
   * Affiche un toast et retourne `true` si l'action doit etre bloquee.
   * Utilise dans les handlers de boutons sensibles :
   *
   *   function inviterParEmail() {
   *     if (restrictAction('Inviter par e-mail')) return
   *     // ... logique reelle
   *   }
   */
  function restrictAction(label = 'Cette action'): boolean {
    if (!isDemo.value) return false
    showToast(
      `${label} n'est pas disponible en demo. Cree un compte pour debloquer.`,
      'info',
    )
    return true
  }

  return { isDemo, restrictAction }
}
