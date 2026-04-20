/**
 * useAgendaViewNav : etat de la vue calendrier + navigation (prev/next/today).
 * Toutes les vues (Mois/Semaine/Jour) sont des grilles custom : on pilote
 * selectedDate directement, plus de dependance VueCal.
 */
import { ref, computed } from 'vue'
import type { Ref } from 'vue'

export type AgendaView = 'month' | 'week' | 'day'

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
  // calRef conserve pour compat signature, non utilise (toutes les vues sont custom).
  const calRef: Ref<unknown> = ref(null)
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
    const [start, end] = getWeekBounds(selectedDate.value)
    const sameMonth = start.getMonth() === end.getMonth()
    return sameMonth
      ? `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
      : `${start.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`
  })

  // Conserve pour retro-compat avec l'ancien @view-change de VueCal ; no-op desormais.
  function onViewChange(_event: unknown) { /* noop */ }

  function shiftDays(days: number) {
    const d = new Date(`${selectedDate.value}T00:00:00`)
    d.setDate(d.getDate() + days)
    selectedDate.value = toIso(d)
  }

  function shiftMonths(delta: number) {
    const d = new Date(`${selectedDate.value}T00:00:00`)
    d.setMonth(d.getMonth() + delta)
    selectedDate.value = toIso(d)
  }

  function goPrev() {
    if (activeView.value === 'month') shiftMonths(-1)
    else if (activeView.value === 'week') shiftDays(-7)
    else shiftDays(-1)
  }
  function goNext() {
    if (activeView.value === 'month') shiftMonths(1)
    else if (activeView.value === 'week') shiftDays(7)
    else shiftDays(1)
  }
  function goToday() { selectedDate.value = toIso(new Date()) }
  function switchView(view: AgendaView) { activeView.value = view }

  return { calRef, activeView, currentTitle, selectedDate, onViewChange, goPrev, goNext, goToday, switchView }
}
