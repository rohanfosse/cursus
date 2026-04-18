/**
 * useLiveAutoChain : mode Kahoot-like — apres fermeture d'une question Spark,
 * declenche un countdown avant de lancer automatiquement la suivante.
 *
 * L'appelant gere quand appeler `startCountdown()` (apres fermeture si toggle ON
 * et next pending existe) et fournit le `launchNext` a executer a la fin.
 */
import { ref, onUnmounted } from 'vue'

export function useLiveAutoChain(launchNext: () => void | Promise<void>) {
  const enabled = ref(false)
  const delaySeconds = ref(5)
  const countdown = ref<number | null>(null)
  let timer: ReturnType<typeof setInterval> | null = null
  let podiumTimeout: ReturnType<typeof setTimeout> | null = null

  function clear() {
    if (timer) { clearInterval(timer); timer = null }
    if (podiumTimeout) { clearTimeout(podiumTimeout); podiumTimeout = null }
    countdown.value = null
  }

  function startCountdown() {
    clear()
    countdown.value = delaySeconds.value
    timer = setInterval(() => {
      if (countdown.value === null) return
      countdown.value -= 1
      if (countdown.value <= 0) {
        clear()
        launchNext()
      }
    }, 1000)
  }

  /** Schedule un callback (typiquement ouverture podium final) apres delai. */
  function schedulePodium(callback: () => void, ms = 2000) {
    if (podiumTimeout) clearTimeout(podiumTimeout)
    podiumTimeout = setTimeout(() => {
      podiumTimeout = null
      if (!enabled.value) return
      callback()
    }, ms)
  }

  onUnmounted(clear)

  return { enabled, delaySeconds, countdown, startCountdown, cancel: clear, schedulePodium }
}
