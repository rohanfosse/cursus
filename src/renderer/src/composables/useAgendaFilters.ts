/**
 * useAgendaFilters : toggles deadline/start/reminder/outlook + hidden promos
 * + calcul filtre d'evenements pour injection dans VueCal (class + style).
 */
import { ref, computed } from 'vue'
import { useAgendaStore } from '@/stores/agenda'
import type { CalendarEvent } from '@/types'

function statusClass(e: CalendarEvent): string {
  const classes = ['ag-event']
  if (e.submissionStatus === 'submitted') classes.push('ag-event--submitted')
  if (e.submissionStatus === 'late') classes.push('ag-event--late')
  return classes.join(' ')
}

/**
 * Construit le style d'un event au look "pill" (inspiration Notion Calendar) :
 * un seul signal de couleur via `color-mix()` — pas de concurrence bordure/fond/texte.
 * - Fond : 18% color mixé avec bg-main (subtil en dark, pastel en light)
 * - Texte : 88% color mixé avec text-primary (lisible sur fond teinté)
 * - Bordure gauche conservée fine pour les events multi-jours (visibilité continuité)
 *
 * Mémoisation : la palette est fermée (8 couleurs) → au max 8 entrées en cache,
 * évite des dizaines d'allocations de string à chaque toggle de filtre.
 */
const styleCache = new Map<string, string>()
function buildEventStyle(color: string): string {
  const cached = styleCache.get(color)
  if (cached) return cached
  const style = `--ev-color: ${color}; background: color-mix(in srgb, ${color} 18%, var(--bg-main)); color: color-mix(in srgb, ${color} 88%, var(--text-primary)); border-left: 3px solid ${color};`
  styleCache.set(color, style)
  return style
}

/** Normalisation accent/casse-insensible pour la recherche. */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function useAgendaFilters() {
  const agenda = useAgendaStore()

  const showDeadlines  = ref(true)
  const showStartDates = ref(true)
  const showReminders  = ref(true)
  const showOutlook    = ref(true)
  const hiddenPromos   = ref(new Set<number>())
  const showFilters    = ref(false)
  const searchQuery    = ref('')

  const filteredEvents = computed(() => {
    const q = normalize(searchQuery.value.trim())
    return agenda.events.filter((e) => {
      if (e.eventType === 'deadline'   && !showDeadlines.value)  return false
      if (e.eventType === 'start_date' && !showStartDates.value) return false
      if (e.eventType === 'reminder'   && !showReminders.value)  return false
      if (e.eventType === 'outlook'    && !showOutlook.value)    return false
      if (e.promoId && hiddenPromos.value.has(e.promoId))        return false
      if (q) {
        const hay = `${normalize(e.title)} ${normalize(e.promoName ?? '')} ${normalize(e.category ?? '')} ${normalize(e.organizer ?? '')} ${normalize(e.location ?? '')}`
        if (!hay.includes(q)) return false
      }
      return true
    }).map((e) => ({
      start: e.start,
      end:   e.end,
      title: e.title,
      allDay: e.allDay === true,
      draggable: e.draggable === true,
      class: (e.allDay ? 'ag-event--all-day ' : '') + statusClass(e),
      style: buildEventStyle(e.color),
      _meta: e,
    }))
  })

  return {
    showDeadlines, showStartDates, showReminders, showOutlook, hiddenPromos, showFilters,
    searchQuery,
    filteredEvents,
  }
}
