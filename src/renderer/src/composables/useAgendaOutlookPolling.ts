/**
 * useAgendaOutlookPolling : fetch des events Outlook sur une fenetre de
 * +/- 1 mois autour de la date selectionnee + auto-refresh toutes les 5 min.
 * Reactif au changement de showOutlook et selectedDate.
 */
import { watch, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import { useAgendaStore } from '@/stores/agenda'

const POLL_INTERVAL_MS = 5 * 60 * 1000

export function useAgendaOutlookPolling(
  isTeacher: Ref<boolean>,
  showOutlook: Ref<boolean>,
  selectedDate: Ref<string>,
) {
  const agenda = useAgendaStore()
  let interval: ReturnType<typeof setInterval> | null = null

  async function load() {
    const anchor = new Date(selectedDate.value)
    const from = new Date(anchor); from.setDate(1); from.setMonth(from.getMonth() - 1)
    const to = new Date(anchor); to.setDate(1); to.setMonth(to.getMonth() + 2)
    await agenda.fetchOutlookEvents(from.toISOString(), to.toISOString())
  }

  function start() {
    stop()
    interval = setInterval(() => {
      if (showOutlook.value && isTeacher.value) load()
    }, POLL_INTERVAL_MS)
  }

  function stop() {
    if (interval) { clearInterval(interval); interval = null }
  }

  watch(showOutlook, (v) => {
    agenda.toggleOutlookSync(v)
    if (v && isTeacher.value) load()
  })

  watch(selectedDate, () => {
    if (isTeacher.value && showOutlook.value) load()
  })

  onBeforeUnmount(stop)

  return { load, start, stop }
}
