/** Shared reactive clock + auto-refresh with cleanup */
import { ref, type Ref } from 'vue'

export function useClockTimer(
  refreshCb: () => Promise<void>,
  opts?: { clockMs?: number; refreshMs?: number },
): { now: Ref<number>; start: () => void; cleanup: () => void } {
  const clockMs   = opts?.clockMs   ?? 30_000
  const refreshMs = opts?.refreshMs ?? 60_000

  const now = ref(Date.now())

  let _clock:   ReturnType<typeof setInterval> | null = null
  let _refresh: ReturnType<typeof setInterval> | null = null

  function start() {
    cleanup()
    _clock   = setInterval(() => { now.value = Date.now() }, clockMs)
    _refresh = setInterval(() => { refreshCb() }, refreshMs)
  }

  function cleanup() {
    if (_clock)   clearInterval(_clock)
    if (_refresh) clearInterval(_refresh)
    _clock   = null
    _refresh = null
  }

  return { now, start, cleanup }
}
