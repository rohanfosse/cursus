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

  // ── Outlook sync state ───────────────────────────────────────────────
  interface OutlookEvent {
    id: string; subject: string; start: string; end: string
    isAllDay: boolean; location: string | null; bodyPreview: string | null
    teamsJoinUrl: string | null; organizer: string | null
    showAs: string; categories: string[]
  }
  const outlookEvents = ref<OutlookEvent[]>([])
  const outlookConnected = ref(false)
  const outlookEnabled = ref(true) // user toggle

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
          allDay: true,
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
          allDay: true,
        })
      }
    }

    for (const r of reminders.value) {
      // Formats supportes : YYYY-MM-DD (date pure) ET YYYY-MM-DDTHH:MM:SS(Z) (date+heure).
      // Un T00:00:00 (minuit UTC) signifie "date sans heure choisie" (serialisation ISO cote serveur)
      // et non un rappel planifie pile a minuit — traite comme date pure.
      if (typeof r.date !== 'string' || !r.date) continue
      const hasRealTime = r.date.length > 10
        && r.date.includes('T')
        && !/T00:00:00(\.000)?Z?$/.test(r.date)
      const startStr = hasRealTime ? r.date.replace('T', ' ').slice(0, 16) : r.date.substring(0, 10)
      const hasTime = hasRealTime
      // Default to 1h duration for timed events
      let endStr = startStr
      if (hasTime) {
        const d = new Date(r.date)
        if (isNaN(d.getTime())) continue // skip reminders aux dates invalides (evite NaN dans l'UI)
        d.setMinutes(d.getMinutes() + 60)
        endStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      }
      list.push({
        id: `reminder-${r.id}`,
        start: startStr,
        end: endStr,
        title: r.title,
        color: '#22c55e',
        eventType: 'reminder',
        sourceId: r.id,
        category: r.bloc ?? null,
        allDay: !hasTime,
      })
    }

    // Merge Outlook events if enabled
    if (outlookEnabled.value) {
      for (const ev of outlookEvents.value) {
        // Skip events with invalid/missing dates (protection contre Graph qui peut renvoyer undefined)
        const sd = new Date(ev.start)
        const ed = new Date(ev.end)
        if (isNaN(sd.getTime()) || isNaN(ed.getTime())) continue

        // Format pour vue-cal : date pure (YYYY-MM-DD) pour all-day, sinon date+heure.
        // Pour un all-day multi-jours, Outlook renvoie end = lendemain 00:00 UTC → on recule d'1 jour
        // pour que vue-cal l'affiche jusqu'a la derniere journee inclusivement.
        const fmtDateOnly = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const fmtDateTime = (d: Date) =>
          `${fmtDateOnly(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

        let startStr: string
        let endStr: string
        if (ev.isAllDay) {
          startStr = fmtDateOnly(sd)
          // Outlook semi-open : end exclusive (lendemain 00:00). Reculer d'1 jour pour l'inclusivite vue-cal.
          const adjusted = new Date(ed.getTime())
          adjusted.setUTCDate(adjusted.getUTCDate() - 1)
          endStr = fmtDateOnly(adjusted)
          // Safety : si le calcul donne une date < start (evenement 1 jour), on aligne
          if (endStr < startStr) endStr = startStr
        } else {
          startStr = fmtDateTime(sd)
          endStr = fmtDateTime(ed)
        }

        list.push({
          id: `outlook-${ev.id}`,
          start: startStr,
          end:   endStr,
          title: ev.subject,
          color: '#0ea5e9', // outlook blue
          eventType: 'outlook',
          sourceId: 0,
          category: ev.categories[0] ?? null,
          outlookId: ev.id,
          teamsJoinUrl: ev.teamsJoinUrl,
          location: ev.location,
          organizer: ev.organizer,
          allDay: ev.isAllDay,
        } as CalendarEvent)
      }
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

  /**
   * Fetch Outlook events for a window [from, to]. Only works for teachers
   * with connected Microsoft account. Silently sets connected=false otherwise.
   */
  async function fetchOutlookEvents(fromIso: string, toIso: string): Promise<void> {
    if (!outlookEnabled.value) return
    // Validation : eviter un appel reseau si ISO invalides
    if (isNaN(Date.parse(fromIso)) || isNaN(Date.parse(toIso))) {
      outlookConnected.value = false
      return
    }
    try {
      const res = await window.api.getOutlookEvents(fromIso, toIso)
      if (res?.ok && res.data) {
        outlookEvents.value = Array.isArray(res.data.events) ? res.data.events : []
        outlookConnected.value = !!res.data.connected
      } else {
        outlookConnected.value = false
      }
    } catch {
      outlookConnected.value = false
      outlookEvents.value = []
    }
  }

  function toggleOutlookSync(enabled: boolean): void {
    outlookEnabled.value = enabled
    if (!enabled) outlookEvents.value = []
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
    // Outlook sync
    outlookEvents, outlookConnected, outlookEnabled,
    fetchOutlookEvents, toggleOutlookSync,
  }
})
