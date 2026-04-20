/**
 * useAgendaViewNav : etat de la vue calendrier + navigation (prev/next/today).
 * - Vue Mois : delegue a VueCal via calRef
 * - Vues Jour/Semaine : grille custom, on pilote `selectedDate` directement
 */
import { ref, computed } from 'vue'
import type { Ref } from 'vue'

export type AgendaView = 'month' | 'week' | 'day'

interface VueCalInstance {
  previous?: () => void
  next?: () => void
}

function pad(n: number): string { return String(n).padStart(2, '0') }
function toIso(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

function getWeekBounds(iso: string): [Date, Date] {
  const d = new Date(`${iso}T00:00:00`)
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + mondayOffset)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return [monday, sunday]
}

export function useAgendaViewNav(initialDate?: string) {
  const calRef: Ref<VueCalInstance | null> = ref(null)
  const activeView = ref<AgendaView>('week')
  const selectedDate = ref(initialDate ?? toIso(new Date()))

  const currentTitle = computed(() => {
    const d = new Date(`${selectedDate.value}T00:00:00`)
    if (isNaN(d.getTime())) return ''
    if (activeView.value === 'month') {
      return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    }
    if (activeView.value === 'day') {
      return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    }
    // week
    const [start, end] = getWeekBounds(selectedDate.value)
    const sameMonth = start.getMonth() === end.getMonth()
    return sameMonth
      ? `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
      : `${start.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`
  })

  function onViewChange(event: { view: string; startDate: Date; endDate: Date }) {
    const view = event.view as AgendaView
    if (view === 'month' || view === 'week' || view === 'day') activeView.value = view
    // Le titre est calcule depuis selectedDate ; on synchronise selectedDate pour le mois
    if (view === 'month') selectedDate.value = toIso(event.startDate)
  }

  function shift(days: number) {
    const d = new Date(`${selectedDate.value}T00:00:00`)
    d.setDate(d.getDate() + days)
    selectedDate.value = toIso(d)
  }

  function shiftMonth(delta: number) {
    const d = new Date(`${selectedDate.value}T00:00:00`)
    d.setMonth(d.getMonth() + delta)
    selectedDate.value = toIso(d)
  }

  function goPrev() {
    if (activeView.value === 'month') {
      calRef.value?.previous?.() ?? shiftMonth(-1)
    } else if (activeView.value === 'week') {
      shift(-7)
    } else {
      shift(-1)
    }
  }
  function goNext() {
    if (activeView.value === 'month') {
      calRef.value?.next?.() ?? shiftMonth(1)
    } else if (activeView.value === 'week') {
      shift(7)
    } else {
      shift(1)
    }
  }
  function goToday() { selectedDate.value = toIso(new Date()) }
  function switchView(view: AgendaView) { activeView.value = view }

  return { calRef, activeView, currentTitle, selectedDate, onViewChange, goPrev, goNext, goToday, switchView }
}
