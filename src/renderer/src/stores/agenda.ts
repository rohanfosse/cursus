/** Store Agenda — calendrier agrégé : échéances travaux + rappels enseignant. */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi'
import type { CalendarEvent, Reminder } from '@/types'

export const useAgendaStore = defineStore('agenda', () => {
  const { api } = useApi()

  const reminders = ref<Reminder[]>([])
  const ganttRows = ref<any[]>([])
  const loading   = ref(false)

  /** Aggregate all events from ganttRows + reminders */
  const events = computed<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = []

    for (const t of ganttRows.value) {
      if (t.deadline) {
        list.push({
          id:        `deadline-${t.id}`,
          start:     t.deadline.substring(0, 10),
          end:       t.deadline.substring(0, 10),
          title:     t.title,
          color:     'blue',
          eventType: 'deadline',
          sourceId:  t.id,
          category:  t.category ?? null,
        })
      }
      if (t.start_date) {
        list.push({
          id:        `start-${t.id}`,
          start:     t.start_date.substring(0, 10),
          end:       t.start_date.substring(0, 10),
          title:     `Début — ${t.title}`,
          color:     'orange',
          eventType: 'start_date',
          sourceId:  t.id,
          category:  t.category ?? null,
        })
      }
    }

    for (const r of reminders.value) {
      list.push({
        id:        `reminder-${r.id}`,
        start:     r.date.substring(0, 10),
        end:       r.date.substring(0, 10),
        title:     r.title,
        color:     'green',
        eventType: 'reminder',
        sourceId:  r.id,
        category:  r.bloc ?? null,
      })
    }

    return list.sort((a, b) => a.start.localeCompare(b.start))
  })

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
    reminders, ganttRows, events, loading,
    fetchEvents, createReminder, updateReminder, deleteReminder,
  }
})
