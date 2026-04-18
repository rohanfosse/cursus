/**
 * useAgendaFilters : toggles deadline/start/reminder/outlook + hidden promos
 * + calcul filtre d'evenements pour injection dans VueCal (class + style).
 */
import { ref, computed } from 'vue'
import { useAgendaStore } from '@/stores/agenda'
import { getCategoryBg } from '@/utils/categoryColor'
import type { CalendarEvent } from '@/types'

function statusClass(e: CalendarEvent): string {
  const classes = ['ag-event']
  if (e.submissionStatus === 'submitted') classes.push('ag-event--submitted')
  if (e.submissionStatus === 'late') classes.push('ag-event--late')
  return classes.join(' ')
}

export function useAgendaFilters() {
  const agenda = useAgendaStore()

  const showDeadlines  = ref(true)
  const showStartDates = ref(true)
  const showReminders  = ref(true)
  const showOutlook    = ref(true)
  const hiddenPromos   = ref(new Set<number>())
  const showFilters    = ref(false)

  const filteredEvents = computed(() =>
    agenda.events.filter((e) => {
      if (e.eventType === 'deadline'   && !showDeadlines.value)  return false
      if (e.eventType === 'start_date' && !showStartDates.value) return false
      if (e.eventType === 'reminder'   && !showReminders.value)  return false
      if (e.eventType === 'outlook'    && !showOutlook.value)    return false
      if (e.promoId && hiddenPromos.value.has(e.promoId))        return false
      return true
    }).map((e) => ({
      start: e.start,
      end:   e.end,
      title: e.title,
      allDay: e.allDay === true,
      class: (e.allDay ? 'ag-event--all-day ' : '') + statusClass(e),
      style: `border-left: 3px solid ${e.color}; background: ${getCategoryBg(e.category)}; color: ${e.color};`,
      _meta: e,
    })),
  )

  return {
    showDeadlines, showStartDates, showReminders, showOutlook, hiddenPromos, showFilters,
    filteredEvents,
  }
}
