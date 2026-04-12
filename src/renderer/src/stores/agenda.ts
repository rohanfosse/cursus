/** Store Agenda — calendrier agrege multi-promo pour les profs. */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi'
import type { CalendarEvent, Reminder } from '@/types'

export interface PromoCalendar {
  id: number
  name: string
  color: string
}

export const useAgendaStore = defineStore('agenda', () => {
  const { api } = useApi()

  const reminders = ref<Reminder[]>([])
  const ganttRows = ref<any[]>([])
  const loading   = ref(false)

  /** Promos uniques extraites des ganttRows (pour le mode multi-promo prof). */
  const promos = computed<PromoCalendar[]>(() => {
    const map = new Map<number, PromoCalendar>()
    for (const t of ganttRows.value) {
      if (t.promo_id && !map.has(t.promo_id)) {
        map.set(t.promo_id, {
          id: t.promo_id,
          name: t.promo_name || `Promo ${t.promo_id}`,
          color: t.promo_color || '#4A90D9',
        })
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  })

  /** Categories uniques. */
  const categories = computed<string[]>(() => {
    const set = new Set<string>()
    for (const t of ganttRows.value) {
      if (t.category) set.add(t.category)
    }
    return [...set].sort()
  })

  /** Aggregate all events. Couleur = promo color (pas categorie). */
  const events = computed<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = []
    const now = new Date().toISOString().slice(0, 10)

    for (const t of ganttRows.value) {
      const promoColor = t.promo_color || '#4A90D9'

      if (t.deadline) {
        const deadlineDate = t.deadline.substring(0, 10)
        let status: CalendarEvent['submissionStatus'] = 'upcoming'
        if (t.depot_id != null) status = 'submitted'
        else if (deadlineDate < now) status = 'late'
        else status = 'pending'

        list.push({
          id: `deadline-${t.id}`,
          start: deadlineDate,
          end: deadlineDate,
          title: t.title,
          color: promoColor,
          eventType: 'deadline',
          sourceId: t.id,
          category: t.category ?? null,
          submissionStatus: status,
          depotsCount: t.depots_count ?? 0,
          studentsTotal: t.students_total ?? 0,
          promoId: t.promo_id,
          promoName: t.promo_name,
          promoColor,
        })
      }
      if (t.start_date) {
        list.push({
          id: `start-${t.id}`,
          start: t.start_date.substring(0, 10),
          end: t.start_date.substring(0, 10),
          title: t.title,
          color: promoColor,
          eventType: 'start_date',
          sourceId: t.id,
          category: t.category ?? null,
          promoId: t.promo_id,
          promoName: t.promo_name,
          promoColor,
        })
      }
    }

    for (const r of reminders.value) {
      list.push({
        id: `reminder-${r.id}`,
        start: r.date.substring(0, 10),
        end: r.date.substring(0, 10),
        title: r.title,
        color: '#22c55e',
        eventType: 'reminder',
        sourceId: r.id,
        category: r.bloc ?? null,
      })
    }

    return list.sort((a, b) => a.start.localeCompare(b.start))
  })

  /**
   * Charge les events. pid=0 charge toutes les promos (mode prof multi-promo).
   */
  async function fetchEvents(pid: number): Promise<void> {
    loading.value = true
    try {
      const [gantt, rems] = await Promise.all([
        api<any[]>(() => window.api.getGanttData(pid)),
        api<Reminder[]>(() => window.api.getReminders()),
      ])
      if (gantt) ganttRows.value = gantt
      if (rems)  reminders.value = rems
    } finally {
      loading.value = false
    }
  }

  async function createReminder(payload: Omit<Reminder, 'id' | 'created_at'>): Promise<boolean> {
    const data = await api<Reminder>(() => window.api.createReminder(payload))
    if (data) {
      reminders.value = [...reminders.value, data].sort((a, b) => a.date.localeCompare(b.date))
      return true
    }
    return false
  }

  async function updateReminder(id: number, payload: Partial<Reminder>): Promise<boolean> {
    const data = await api<Reminder>(() => window.api.updateReminder(id, payload))
    if (data) {
      reminders.value = reminders.value.map(r => r.id === id ? data : r)
      return true
    }
    return false
  }

  async function deleteReminder(id: number): Promise<boolean> {
    const data = await api(() => window.api.deleteReminder(id))
    if (data !== null) {
      reminders.value = reminders.value.filter(r => r.id !== id)
      return true
    }
    return false
  }

  return {
    reminders, ganttRows, events, promos, categories, loading,
    fetchEvents, createReminder, updateReminder, deleteReminder,
  }
})
