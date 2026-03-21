/**
 * Preferences settings composable — notification toggles, input behavior,
 * and document opening defaults.
 * Used by SettingsModal.vue
 */
import { ref, watch } from 'vue'
import { usePrefs } from '@/composables/usePrefs'

export function useSettingsPreferences() {
  const { getPref, setPref } = usePrefs()

  const docsDefault  = ref(getPref('docsOpenByDefault'))
  const notifSound   = ref(getPref('notifSound') ?? true)
  const notifDesktop = ref(getPref('notifDesktop') ?? true)
  const enterToSend  = ref(getPref('enterToSend') ?? true)

  watch(docsDefault,  (v) => setPref('docsOpenByDefault', v))
  watch(notifSound,   (v) => setPref('notifSound', v))
  watch(notifDesktop, (v) => setPref('notifDesktop', v))
  watch(enterToSend,  (v) => setPref('enterToSend', v))

  return {
    docsDefault,
    notifSound,
    notifDesktop,
    enterToSend,
  }
}
