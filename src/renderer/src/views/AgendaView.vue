/** AgendaView — calendrier complet v2.111.
 *  8 features : vue jour, statut rendu, mini-cal interactif, resume semaine,
 *  numeros de semaine, couleurs par categorie, drag-to-reschedule, notes perso. */
<script setup lang="ts">
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'
import AgendaDayNotes from '@/components/agenda/AgendaDayNotes.vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import { useContextMenu, type ContextMenuItem } from '@/composables/useContextMenu'
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VueCal from 'vue-cal'
import 'vue-cal/dist/vuecal.css'
import { Plus, Trash2, RefreshCw, X, Clock, Tag, ExternalLink, ChevronLeft, ChevronRight, Check, AlertCircle, Download, Filter, Copy, Edit3, Calendar as CalIcon, Video, MapPin, User, MoreHorizontal } from 'lucide-vue-next'
import { useAppStore }   from '@/stores/app'
import { useAgendaStore } from '@/stores/agenda'
import { useToast } from '@/composables/useToast'
import { useAgendaFilters } from '@/composables/useAgendaFilters'
import { useAgendaViewNav } from '@/composables/useAgendaViewNav'
import { useAgendaIcsExport } from '@/composables/useAgendaIcsExport'
import { useAgendaOutlookPolling } from '@/composables/useAgendaOutlookPolling'
import { useAgendaKeyboardShortcuts } from '@/composables/useAgendaKeyboardShortcuts'
import { useConfirm } from '@/composables/useConfirm'
import { useFocusTrap } from '@/composables/useFocusTrap'
import { getISOWeekNumber, startOfISOWeek } from '@/utils/date'
import type { CalendarEvent } from '@/types'

const appStore  = useAppStore()
const agenda    = useAgendaStore()
const route     = useRoute()
const router    = useRouter()
const { showToast } = useToast()

const promoId   = computed(() => appStore.activePromoId ?? appStore.currentUser?.promo_id ?? 0)
const isTeacher = computed(() => appStore.isTeacher)

// En mode prof, charger toutes les promos (pid=0). En mode etudiant, sa promo.
const fetchPromoId = computed(() => isTeacher.value ? 0 : promoId.value)

// ── Filters ───────────────────────────────────────────────────────────────
const {
  showDeadlines, showStartDates, showReminders, showOutlook, showFilters,
  filteredEvents,
} = useAgendaFilters()

// ── Calendar ref + view control ──────────────────────────────────────────
const { calRef, activeView, currentTitle, selectedDate, onViewChange, goPrev, goNext, goToday, switchView } = useAgendaViewNav()

// ── View hero : résumé contextuel pour day ET week ──────────────────────
// On réutilise la même bannière pour les vues day et week afin d'uniformiser
// le design. En week, la plage affichée va du lundi au dimanche de la semaine
// contenant selectedDate.
const dayHero = computed(() => {
  if (activeView.value !== 'day' && activeView.value !== 'week') return null
  const d = new Date(selectedDate.value)
  if (isNaN(d.getTime())) return null

  const todayIso = new Date().toISOString().slice(0, 10)

  if (activeView.value === 'day') {
    const iso = selectedDate.value
    let total = 0, deadlines = 0, teams = 0
    for (const ev of filteredEvents.value) {
      const meta = ev._meta
      if (typeof meta?.start !== 'string' || meta.start.slice(0, 10) !== iso) continue
      total++
      if (meta.eventType === 'deadline') deadlines++
      if (meta.teamsJoinUrl) teams++
    }
    return {
      weekday: d.toLocaleDateString('fr-FR', { weekday: 'long' }),
      dateFull: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      weekNum: getISOWeekNumber(d),
      isToday: iso === todayIso,
      total, deadlines, teams,
    }
  }

  // Week
  const start = startOfISOWeek(d)
  const end = new Date(start); end.setDate(start.getDate() + 6)
  const startIso = start.toISOString().slice(0, 10)
  const endIso = end.toISOString().slice(0, 10)
  let total = 0, deadlines = 0, teams = 0
  for (const ev of filteredEvents.value) {
    const meta = ev._meta
    if (typeof meta?.start !== 'string') continue
    const iso = meta.start.slice(0, 10)
    if (iso < startIso || iso > endIso) continue
    total++
    if (meta.eventType === 'deadline') deadlines++
    if (meta.teamsJoinUrl) teams++
  }
  const sameMonth = start.getMonth() === end.getMonth()
  const dateFull = sameMonth
    ? `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
    : `${start.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`
  const isCurrentWeek = todayIso >= startIso && todayIso <= endIso
  return {
    weekday: 'Semaine',
    dateFull,
    weekNum: getISOWeekNumber(start),
    isToday: isCurrentWeek,
    total, deadlines, teams,
  }
})

function onCellClick(date: Date) {
  selectedDate.value = date.toISOString().slice(0, 10)
  activeView.value = 'day'
}

function onCellDblClick(date: Date) {
  if (!isTeacher.value) return
  formDate.value = date.toISOString().slice(0, 10)
  // Format HH:MM for time if we clicked on a time slot
  const hours = date.getHours()
  const minutes = date.getMinutes()
  if (hours || minutes) {
    formTime.value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }
  formTitle.value = ''
  formDesc.value = ''
  showForm.value = true
}

// ── Context menu (right-click) ─────────────────────────────────────────
const { state: ctxMenu, open: openCtxMenu, close: closeCtxMenu } = useContextMenu()

function onEventContextMenu(e: MouseEvent, event: { _meta?: CalendarEvent }) {
  const meta = event._meta
  if (!meta) return

  const items: ContextMenuItem[] = [
    { label: 'Voir les details', icon: ExternalLink, action: () => { selectedEvent.value = meta; detailOpen.value = true } },
    { label: 'Copier le titre',  icon: Copy,         action: () => { navigator.clipboard.writeText(meta.title); showToast('Titre copie', 'success') } },
  ]

  if (meta.teamsJoinUrl) {
    items.push({ label: 'Rejoindre Teams', icon: Video, action: () => window.open(meta.teamsJoinUrl!, '_blank', 'noopener') })
  }

  if (meta.eventType === 'deadline' || meta.eventType === 'start_date') {
    items.push({ label: 'Voir le devoir', icon: CalIcon, action: () => router.push({ name: 'devoirs' }) })
  }

  if (meta.eventType === 'outlook' && meta.outlookId) {
    items.push(
      { separator: true, label: '' },
      { label: 'Supprimer de Outlook', icon: Trash2, danger: true, action: () => deleteOutlookEventAction(meta.outlookId!) },
    )
  }

  if (isTeacher.value && meta.eventType === 'reminder') {
    items.push(
      { separator: true, label: '' },
      { label: 'Modifier',   icon: Edit3,  action: () => startEditReminder(meta) },
      { label: 'Dupliquer',  icon: Copy,   action: () => duplicateReminder(meta) },
      { label: 'Supprimer',  icon: Trash2, danger: true, action: () => removeReminder(meta.sourceId) },
    )
  }

  openCtxMenu(e, items)
}

function onCellContextMenu(e: MouseEvent, date: Date) {
  if (!isTeacher.value) return
  const dateStr = date.toISOString().slice(0, 10)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const timeStr = (hours || minutes) ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : ''

  openCtxMenu(e, [
    { label: 'Nouveau rappel ici', icon: Plus, action: () => {
      formDate.value = dateStr
      formTime.value = timeStr
      formTitle.value = ''
      formDesc.value = ''
      showForm.value = true
    } },
    { label: 'Aller a cette date', icon: CalIcon, action: () => {
      selectedDate.value = dateStr
      activeView.value = 'day'
    } },
  ])
}

// ── Inline edit reminder ──────────────────────────────────────────────
const editingId = ref<number | null>(null)

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function toIsoString(start: string | Date | null | undefined): string {
  if (!start) return ''
  if (start instanceof Date) {
    const y = start.getFullYear(), m = String(start.getMonth() + 1).padStart(2, '0')
    const d = String(start.getDate()).padStart(2, '0')
    return `${y}-${m}-${d} ${hhmm(start)}`
  }
  return typeof start === 'string' ? start : ''
}

function startEditReminder(meta: CalendarEvent) {
  if (meta.eventType !== 'reminder') return
  editingId.value = meta.sourceId
  const startStr = toIsoString(meta.start)
  formDate.value = startStr.slice(0, 10)
  // Extract time if present (format can be "YYYY-MM-DD HH:MM" or ISO)
  const timeMatch = startStr.match(/(\d{2}):(\d{2})/)
  formTime.value = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : ''
  formTitle.value = meta.title
  formDesc.value = ''
  showForm.value = true
}

async function duplicateReminder(meta: CalendarEvent) {
  if (meta.eventType !== 'reminder') return
  try {
    await agenda.createReminder({ promo_tag: null, date: toIsoString(meta.start).slice(0, 10), title: `${meta.title} (copie)`, description: '', bloc: null })
    showToast('Rappel duplique', 'success')
  } catch { showToast('Impossible de dupliquer', 'error') }
}

// Context menu on calendar wrapper (empty cell)
function onCalWrapContextMenu(e: MouseEvent) {
  const target = e.target as HTMLElement
  // If we right-clicked on an event, let the event handler run
  if (target.closest('.vuecal__event')) return
  // Otherwise, resolve clicked cell date from data attributes
  const cell = target.closest('.vuecal__cell') as HTMLElement | null
  if (!cell) return
  const splitDate = cell.getAttribute('data-date') || cell.querySelector('[data-date]')?.getAttribute('data-date')
  if (splitDate) {
    onCellContextMenu(e, new Date(splitDate))
  } else {
    // Fallback : use currently selected date
    onCellContextMenu(e, new Date(selectedDate.value))
  }
}

function formatEventTime(start: string | Date | null | undefined): string {
  if (!start) return ''
  // VueCal peut passer une Date apres re-render (slot #event)
  if (start instanceof Date) return hhmm(start)
  if (typeof start !== 'string') return ''
  const m = start.match(/(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : ''
}

/** Vue-cal heading helpers (slot #weekday-heading). Heading a dayOfMonth + full/small
 *  mais pas de Date directe. On retrouve la date via selectedDate + dayOfMonth. */
function isHeadingToday(heading: { dayOfMonth?: number | string }): boolean {
  if (!heading.dayOfMonth) return false
  const today = new Date()
  const d = Number(heading.dayOfMonth)
  if (today.getDate() !== d) return false
  // Compare mois/annee via selectedDate (fiable car pointe sur la semaine courante)
  const sel = new Date(selectedDate.value)
  return sel.getMonth() === today.getMonth() && sel.getFullYear() === today.getFullYear()
}

function isHeadingWeekend(heading: { full?: string; small?: string }): boolean {
  const label = (heading.small || heading.full || '').toLowerCase()
  return /^(sam|dim|sat|sun)/.test(label)
}

// ── Selected event ────────────────────────────────────────────────────────
const selectedEvent = ref<CalendarEvent | null>(null)
const detailOpen = ref(false)
const detailRef = ref<HTMLElement | null>(null)
useFocusTrap(detailRef, detailOpen)

function onEventClick(event: { _meta?: CalendarEvent }) {
  selectedEvent.value = event._meta ?? null
  detailOpen.value = true
}
function closeDetail() { detailOpen.value = false; selectedEvent.value = null }

// ── New reminder form ────────────────────────────────────────────────────
const showForm       = ref(false)
const formRef        = ref<HTMLElement | null>(null)
const titleInputRef  = ref<HTMLInputElement | null>(null)
useFocusTrap(formRef, showForm)
const formDate       = ref('')
const formTime       = ref('')
const formTitle      = ref('')
const formDesc       = ref('')
const formCreateTeams = ref(false)
const saving         = ref(false)

// Autofocus : quand showForm passe à true, focus le champ Titre après rendu
watch(showForm, async (open) => {
  if (!open) return
  await nextTick()
  titleInputRef.value?.focus()
  titleInputRef.value?.select?.()
})

// Fermeture protégée : confirme si l'utilisateur a tapé quelque chose
async function tryCloseForm(): Promise<void> {
  const dirty = formTitle.value.trim() !== '' || formDesc.value.trim() !== ''
  if (dirty) {
    const ok = await confirm(
      'Fermer sans enregistrer ?',
      'warning',
      'Fermer',
    )
    if (!ok) return
  }
  showForm.value = false
  editingId.value = null
  formTitle.value = ''
  formDesc.value = ''
}

async function submitReminder() {
  if (!formDate.value || !formTitle.value.trim()) return
  saving.value = true
  try {
    const dateVal = formTime.value ? `${formDate.value}T${formTime.value}:00` : formDate.value
    if (editingId.value) {
      await agenda.updateReminder(editingId.value, { date: dateVal, title: formTitle.value.trim(), description: formDesc.value.trim(), bloc: null })
      showToast('Rappel modifie', 'success')
    } else {
      await agenda.createReminder({ promo_tag: null, date: dateVal, title: formTitle.value.trim(), description: formDesc.value.trim(), bloc: null })

      // If Teams meeting requested, also create in Outlook with online meeting
      if (formCreateTeams.value && isTeacher.value && formTime.value) {
        const startDate = new Date(`${formDate.value}T${formTime.value}:00`)
        if (isNaN(startDate.getTime())) {
          showToast('Date ou heure invalide pour la reunion Teams', 'error')
        } else {
          const startIso = startDate.toISOString()
          const endIso   = new Date(startDate.getTime() + 60 * 60 * 1000).toISOString()
          try {
            const res = await window.api.createOutlookEvent({
              subject: formTitle.value.trim(),
              startDateTime: startIso,
              endDateTime: endIso,
              body: formDesc.value.trim() || undefined,
              createTeams: true,
            })
            if (res.ok && res.data?.teamsJoinUrl) {
              showToast('Reunion Teams creee — lien dans Outlook', 'success')
              // Refresh outlook to see the new event
              await loadOutlook()
            }
          } catch { showToast('Teams non disponible (verifiez la connexion Microsoft)', 'error') }
        }
      }
    }
    editingId.value = null
    formDate.value = ''; formTime.value = ''; formTitle.value = ''; formDesc.value = ''
    formCreateTeams.value = false
    showForm.value = false
  } finally { saving.value = false }
}

async function deleteOutlookEventAction(outlookId: string) {
  if (!confirm('Supprimer cet evenement de votre Outlook ?')) return
  try {
    const res = await window.api.deleteOutlookEvent(outlookId)
    if (res.ok) {
      showToast('Evenement supprime de Outlook', 'success')
      await loadOutlook()
      closeDetail()
    } else {
      showToast(res.error || 'Erreur suppression', 'error')
    }
  } catch { showToast('Impossible de supprimer', 'error') }
}

async function removeReminder(id: number) {
  await agenda.deleteReminder(id)
  if (selectedEvent.value?.sourceId === id) closeDetail()
}

// Drag-to-reschedule : rappels + deadlines (prof uniquement pour deadlines).
// Rollback optimiste confie a VueCal : si on rejette, vue-cal replace l'event.
const { confirm } = useConfirm()
type VueCalDropEvent = {
  event: { _meta?: CalendarEvent }
  newDate: Date
  originalEvent?: { start: Date | string; end: Date | string }
  revert?: () => void
}

function fmtFrDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

async function onEventDrop(e: VueCalDropEvent): Promise<void> {
  const meta = e.event._meta
  if (!meta || !meta.draggable) { e.revert?.(); return }

  // Deadlines = profs uniquement
  if (meta.eventType === 'deadline' && !isTeacher.value) { e.revert?.(); return }

  const newDateStr = e.newDate.toISOString().slice(0, 10)

  // Confirmation pour deadline : zone sensible (etudiants peuvent avoir deja rendu)
  if (meta.eventType === 'deadline') {
    const suffix = meta.depotsCount && meta.depotsCount > 0
      ? ` (${meta.depotsCount} depot${meta.depotsCount > 1 ? 's' : ''} deja soumis)`
      : ''
    const ok = await confirm(
      `Deplacer "${meta.title}" au ${fmtFrDate(e.newDate)} ?${suffix}`,
      'warning',
      'Deplacer',
    )
    if (!ok) { e.revert?.(); return }
  }

  const success = await agenda.updateEventDate(meta.id, newDateStr)
  if (!success) {
    e.revert?.()
    return
  }

  const label = meta.eventType === 'deadline' ? 'Echeance' : 'Rappel'
  showToast(`${label} deplace${meta.eventType === 'deadline' ? 'e' : ''} au ${fmtFrDate(e.newDate)}.`, 'success')
}

// ── Export ICS (iCalendar) ───────────────────────────────────────────────
const { exportIcs: exportIcsRaw } = useAgendaIcsExport()
function exportIcs() { exportIcsRaw(filteredEvents.value) }

// ── Locale ───────────────────────────────────────────────────────────────
const locale = {
  months: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
  weekDays: ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'],
  today: "Aujourd'hui",
  allDay: 'Journée',
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function eventTypeLabel(type: string): string {
  return type === 'deadline' ? 'Echeance' : type === 'start_date' ? 'Demarrage' : 'Rappel'
}

function statusLabel(s?: string): string {
  if (s === 'submitted') return 'Rendu'
  if (s === 'late') return 'En retard'
  if (s === 'pending') return 'A rendre'
  return ''
}

// ── More menu (kebab) ───────────────────────────────────────────────────
// Le listener document est strictement couple a l'etat ouvert : ajoute a
// l'ouverture, retire a chaque fermeture (que la fermeture vienne d'un clic
// exterieur, d'un clic sur un item, ou d'un toggle). Evite les listeners
// orphelins si l'utilisateur re-toggle rapidement.
const moreOpen = ref(false)
function toggleMore(ev: MouseEvent) {
  ev.stopPropagation()
  if (moreOpen.value) {
    closeMore()
  } else {
    moreOpen.value = true
    document.addEventListener('click', closeMore)
  }
}
function closeMore() {
  moreOpen.value = false
  document.removeEventListener('click', closeMore)
}
onBeforeUnmount(() => document.removeEventListener('click', closeMore))

// ── Load ─────────────────────────────────────────────────────────────────
let cleanupListener: (() => void) | null = null

const { load: loadOutlook, start: startOutlookPolling } = useAgendaOutlookPolling(isTeacher, showOutlook, selectedDate)

async function load() {
  const pid = fetchPromoId.value
  if (pid !== null) await agenda.fetchEvents(pid)
  if (isTeacher.value && showOutlook.value) await loadOutlook()
}

// ── Keyboard shortcuts ────────────────────────────────────────────────
useAgendaKeyboardShortcuts({
  isTeacher,
  detailOpen,
  showForm,
  editingId,
  ctxMenu,
  goToday,
  switchView,
  goPrev,
  goNext,
  closeCtxMenu,
  closeDetail,
})

onMounted(() => {
  load()
  startOutlookPolling()
  if (route.query.action === 'new-reminder' && isTeacher.value) showForm.value = true
  if (typeof route.query.date === 'string') {
    selectedDate.value = route.query.date
    activeView.value = 'day'
  }
  cleanupListener = window.api.onAssignmentNew?.(() => { load() }) ?? null
})
onBeforeUnmount(() => {
  cleanupListener?.()
})
watch(() => promoId.value, load)
watch(() => route.query, (q) => {
  if (typeof q.date === 'string' && q.date !== selectedDate.value) {
    selectedDate.value = q.date
    activeView.value = 'day'
  }
  if (q.action === 'new-reminder' && isTeacher.value) showForm.value = true
})
</script>

<template>
  <ErrorBoundary label="Agenda">
  <div class="agenda-area">

    <!-- Toolbar -->
    <header class="agenda-toolbar" role="toolbar" aria-label="Barre d'outils du calendrier">
      <div class="agenda-toolbar-left">
        <button type="button" class="ag-today-btn" @click="goToday" title="Aujourd'hui (T)" aria-label="Aller à aujourd'hui">Aujourd'hui</button>
        <div class="ag-nav-arrows" role="group" aria-label="Navigation par période">
          <button type="button" class="ag-nav-btn" @click="goPrev" title="Période précédente" aria-label="Période précédente"><ChevronLeft :size="16" aria-hidden="true" /></button>
          <button type="button" class="ag-nav-btn" @click="goNext" title="Période suivante" aria-label="Période suivante"><ChevronRight :size="16" aria-hidden="true" /></button>
        </div>
        <h1 class="ag-current-title" aria-live="polite">{{ currentTitle || 'Calendrier' }}</h1>
      </div>
      <div class="agenda-toolbar-right">
        <div class="ag-view-switch" role="group" aria-label="Changer de vue">
          <button type="button" class="ag-view-btn" :class="{ active: activeView === 'month' }" @click="switchView('month')" title="Vue mois (M)" :aria-pressed="activeView === 'month'">Mois</button>
          <button type="button" class="ag-view-btn" :class="{ active: activeView === 'week' }" @click="switchView('week')" title="Vue semaine (S)" :aria-pressed="activeView === 'week'">Semaine</button>
          <button type="button" class="ag-view-btn" :class="{ active: activeView === 'day' }" @click="switchView('day')" title="Vue jour (J)" :aria-pressed="activeView === 'day'">Jour</button>
        </div>
        <button v-if="isTeacher" class="ag-btn ag-btn--accent" @click="showForm = !showForm" title="Nouveau rappel (N)" aria-label="Créer un nouveau rappel">
          <Plus :size="14" aria-hidden="true" /> Rappel
        </button>
        <div class="ag-more-wrap">
          <button
            class="ag-btn ag-btn--ghost"
            title="Plus d'options"
            aria-label="Plus d'options"
            :aria-expanded="moreOpen"
            @click="toggleMore"
          >
            <MoreHorizontal :size="16" aria-hidden="true" />
          </button>
          <div v-if="moreOpen" class="ag-more-menu" role="menu" @click.stop>
            <button class="ag-more-item" role="menuitem" :class="{ 'ag-more-item--active': showFilters }" @click="showFilters = !showFilters; closeMore()">
              <Filter :size="14" /> {{ showFilters ? 'Masquer les filtres' : 'Afficher les filtres' }}
            </button>
            <button class="ag-more-item" role="menuitem" @click="exportIcs(); closeMore()">
              <Download :size="14" /> Exporter (.ics)
            </button>
            <button class="ag-more-item" role="menuitem" :disabled="agenda.loading" @click="load(); closeMore()">
              <RefreshCw :size="14" :class="{ 'ag-spin': agenda.loading }" /> {{ agenda.loading ? 'Rafraichissement...' : 'Rafraichir' }}
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Filter bar -->
    <Transition name="filter-slide">
      <div v-if="showFilters" class="ag-filter-bar">
        <label class="ag-filter-check">
          <input type="checkbox" v-model="showDeadlines" /> Echeances
        </label>
        <label class="ag-filter-check">
          <input type="checkbox" v-model="showStartDates" /> Demarrages
        </label>
        <label class="ag-filter-check">
          <input type="checkbox" v-model="showReminders" /> Rappels
        </label>
        <label v-if="isTeacher" class="ag-filter-check">
          <input type="checkbox" v-model="showOutlook" /> Outlook
          <span v-if="agenda.outlookConnected" class="ag-sync-dot ag-sync-dot--live" title="Connecte" />
          <span v-else class="ag-sync-dot" title="Non connecte" />
        </label>
        <span class="ag-filter-count">{{ filteredEvents.length }} evenement{{ filteredEvents.length > 1 ? 's' : '' }}</span>
      </div>
    </Transition>

    <!-- Day view hero : résumé contextuel du jour sélectionné -->
    <Transition name="filter-slide">
      <div v-if="dayHero" class="ag-day-hero">
        <div class="ag-day-hero-main">
          <span class="ag-day-hero-weekday">{{ dayHero.weekday }}</span>
          <h2 class="ag-day-hero-date">
            {{ dayHero.dateFull }}
            <span v-if="dayHero.isToday" class="ag-day-hero-badge">Aujourd'hui</span>
          </h2>
        </div>
        <div class="ag-day-hero-meta">
          <span class="ag-day-hero-week">Semaine {{ dayHero.weekNum }}</span>
          <span v-if="dayHero.total === 0" class="ag-day-hero-chip ag-day-hero-chip--empty">Journée libre</span>
          <template v-else>
            <span class="ag-day-hero-chip">
              <span class="ag-chip-dot" :style="{ background: 'var(--accent)' }" />
              {{ dayHero.total }} événement{{ dayHero.total > 1 ? 's' : '' }}
            </span>
            <span v-if="dayHero.deadlines > 0" class="ag-day-hero-chip">
              <span class="ag-chip-dot" :style="{ background: 'var(--color-danger)' }" />
              {{ dayHero.deadlines }} échéance{{ dayHero.deadlines > 1 ? 's' : '' }}
            </span>
            <span v-if="dayHero.teams > 0" class="ag-day-hero-chip">
              <Video :size="12" aria-hidden="true" />
              {{ dayHero.teams }} Teams
            </span>
          </template>
        </div>
      </div>
    </Transition>

    <div class="agenda-body">
      <div class="agenda-cal-wrap" @contextmenu="onCalWrapContextMenu">
        <!-- Skeleton overlay : affiche pendant le premier load (pas de spam pendant refresh) -->
        <div v-if="agenda.loading && !filteredEvents.length" class="ag-skeleton" aria-hidden="true">
          <div v-for="i in 12" :key="i" class="ag-skel-event" :style="{
            gridColumn: ((i * 3) % 7) + 1,
            gridRow: Math.floor(i / 3) + 1,
            width: (50 + (i * 13) % 40) + '%',
          }" />
        </div>
        <VueCal
          ref="calRef"
          :active-view="activeView"
          :selected-date="selectedDate"
          :locale="locale"
          :events="filteredEvents"
          :time="activeView !== 'month'"
          :time-from="7 * 60"
          :time-to="22 * 60"
          :time-step="30"
          :time-cell-height="28"
          :disable-views="['years', 'year']"
          :editable-events="{ drag: true }"
          hide-title-bar
          show-week-numbers
          class="vuecal--dark"
          @view-change="onViewChange"
          @event-click="onEventClick"
          @cell-click="onCellClick"
          @cell-dblclick="onCellDblClick"
          @event-drop="onEventDrop"
        >
          <template #weekday-heading="{ heading, view }">
            <div
              class="ag-day-head"
              :class="{
                'ag-day-head--today': isHeadingToday(heading),
                'ag-day-head--weekend': heading.dayOfMonth !== undefined && isHeadingWeekend(heading),
                'ag-day-head--month': view === 'month',
              }"
            >
              <template v-if="view !== 'month'">
                <span class="ag-day-num">{{ heading.dayOfMonth }}</span>
                <span class="ag-day-name">{{ heading.small || heading.full }}</span>
              </template>
              <template v-else>
                <span class="ag-day-name-mo">{{ heading.full }}</span>
              </template>
            </div>
          </template>

          <template #event="{ event }">
            <div
              class="ag-event-body"
              :class="{ 'ag-event-body--allday-tinted': event.allDay && (event.eventType === 'deadline' || event.eventType === 'start_date') }"
              :style="event.allDay && event.color ? { '--ag-event-color': event.color } : undefined"
              @contextmenu="onEventContextMenu($event, event)"
            >
              <span v-if="!event.allDay && event.startTimeMinutes !== undefined" class="vuecal__event-time">
                {{ formatEventTime(event.start) }}
              </span>
              <span class="ag-event-title">{{ event.title }}</span>
              <span
                v-if="!event.allDay && event._meta?.organizer"
                class="ag-event-subtitle"
              >{{ event._meta.organizer }}</span>
              <span
                v-else-if="!event.allDay && event._meta?.promoName"
                class="ag-event-subtitle"
              >{{ event._meta.promoName }}</span>
            </div>
          </template>
        </VueCal>
        <!-- Empty state : pas de chargement en cours + aucun event -->
        <div v-if="!agenda.loading && filteredEvents.length === 0" class="ag-empty-state" role="status">
          <!-- SVG illustré : mini-calendrier avec 3 events qui flottent doucement -->
          <svg class="ag-empty-illus" width="128" height="104" viewBox="0 0 128 104" aria-hidden="true" fill="none">
            <rect x="12" y="22" width="104" height="72" rx="10" stroke="currentColor" stroke-width="1.5" opacity="0.35" />
            <rect x="30" y="12" width="4" height="16" rx="2" fill="currentColor" opacity="0.45" />
            <rect x="94" y="12" width="4" height="16" rx="2" fill="currentColor" opacity="0.45" />
            <path d="M12 38 L116 38" stroke="currentColor" stroke-width="1.5" opacity="0.35" />
            <g opacity="0.22">
              <line x1="38" y1="38" x2="38" y2="94" stroke="currentColor" stroke-width="1" />
              <line x1="64" y1="38" x2="64" y2="94" stroke="currentColor" stroke-width="1" />
              <line x1="90" y1="38" x2="90" y2="94" stroke="currentColor" stroke-width="1" />
              <line x1="12" y1="58" x2="116" y2="58" stroke="currentColor" stroke-width="1" />
              <line x1="12" y1="76" x2="116" y2="76" stroke="currentColor" stroke-width="1" />
            </g>
            <rect class="ag-empty-ev ag-empty-ev1" x="16" y="46" width="18" height="6" rx="2" fill="var(--accent)" opacity="0.78" />
            <rect class="ag-empty-ev ag-empty-ev2" x="68" y="62" width="22" height="6" rx="2" fill="var(--color-success)" opacity="0.72" />
            <rect class="ag-empty-ev ag-empty-ev3" x="42" y="80" width="20" height="6" rx="2" fill="var(--color-info)" opacity="0.78" />
          </svg>
          <p class="ag-empty-title">Rien de prévu pour cette période</p>
          <p class="ag-empty-hint">
            {{ isTeacher ? 'Créez un rappel avec la touche N, double-cliquez sur un jour, ou faites glisser un événement pour le replanifier.' : 'Vos échéances apparaîtront ici dès qu\'un devoir sera publié par votre enseignant.' }}
          </p>
          <button v-if="isTeacher" class="ag-btn ag-btn--accent" @click="showForm = true">
            <Plus :size="14" aria-hidden="true" /> Nouveau rappel
          </button>
        </div>
      </div>

      <!-- Right-click context menu -->
      <ContextMenu v-if="ctxMenu" :x="ctxMenu.x" :y="ctxMenu.y" :items="ctxMenu.items" @close="closeCtxMenu" />

      <!-- Detail panel -->
      <Transition name="detail-slide">
        <aside
          v-if="detailOpen && selectedEvent"
          ref="detailRef"
          class="agenda-detail"
          role="dialog"
          aria-modal="false"
          aria-labelledby="agenda-detail-title"
          @keydown.esc="closeDetail"
        >
          <!-- Hero : bande de couleur promo pleine largeur -->
          <div class="agenda-detail-hero" :style="{ background: selectedEvent.color }" aria-hidden="true" />

          <div class="agenda-detail-body">
            <header class="agenda-detail-head">
              <span class="agenda-detail-type">{{ eventTypeLabel(selectedEvent.eventType) }}</span>
              <button type="button" class="agenda-detail-close" @click="closeDetail" aria-label="Fermer le panneau de détails"><X :size="14" aria-hidden="true" /></button>
            </header>
            <h2 id="agenda-detail-title" class="agenda-detail-title">{{ selectedEvent.title }}</h2>

            <div class="agenda-detail-meta-list">
              <div class="agenda-detail-meta">
                <Clock :size="14" aria-hidden="true" />
                <span>{{ formatFullDate(selectedEvent.start) }}</span>
              </div>
              <div v-if="selectedEvent.promoName" class="agenda-detail-meta">
                <span class="agenda-detail-promo-dot" :style="{ background: selectedEvent.promoColor }" aria-hidden="true" />
                <span>{{ selectedEvent.promoName }}</span>
              </div>
              <div v-if="selectedEvent.category" class="agenda-detail-meta">
                <Tag :size="14" aria-hidden="true" />
                <span>{{ selectedEvent.category }}</span>
              </div>
              <div v-if="selectedEvent.location" class="agenda-detail-meta">
                <MapPin :size="14" aria-hidden="true" />
                <span>{{ selectedEvent.location }}</span>
              </div>
              <div v-if="selectedEvent.organizer" class="agenda-detail-meta">
                <User :size="14" aria-hidden="true" />
                <span>{{ selectedEvent.organizer }}</span>
              </div>
            </div>

            <!-- Teams join button -->
            <a v-if="selectedEvent.teamsJoinUrl" :href="selectedEvent.teamsJoinUrl" target="_blank" rel="noopener" class="ag-btn ag-btn--teams ag-btn--block">
              <Video :size="14" aria-hidden="true" /> Rejoindre Teams
            </a>

            <!-- Statut rendu avec progress bar -->
            <div v-if="selectedEvent.submissionStatus" class="agenda-detail-status-card" :class="`status--${selectedEvent.submissionStatus}`">
              <div class="agenda-detail-status-head">
                <Check v-if="selectedEvent.submissionStatus === 'submitted'" :size="14" aria-hidden="true" />
                <AlertCircle v-else-if="selectedEvent.submissionStatus === 'late'" :size="14" aria-hidden="true" />
                <Clock v-else :size="14" aria-hidden="true" />
                <span>{{ statusLabel(selectedEvent.submissionStatus) }}</span>
                <span v-if="isTeacher && selectedEvent.depotsCount != null && selectedEvent.studentsTotal" class="agenda-detail-status-count">
                  {{ selectedEvent.depotsCount }} / {{ selectedEvent.studentsTotal }}
                </span>
              </div>
              <div v-if="isTeacher && selectedEvent.depotsCount != null && selectedEvent.studentsTotal" class="agenda-detail-progress-bar" :aria-label="`${selectedEvent.depotsCount} rendus sur ${selectedEvent.studentsTotal}`">
                <div class="agenda-detail-progress-fill" :style="{ width: ((selectedEvent.depotsCount / selectedEvent.studentsTotal) * 100) + '%' }" />
              </div>
            </div>

            <!-- Notes personnelles pour ce jour -->
            <AgendaDayNotes :date="selectedEvent.start" />
          </div>

          <!-- CTA sticky footer -->
          <footer class="agenda-detail-footer">
            <button
              v-if="selectedEvent.eventType === 'deadline' || selectedEvent.eventType === 'start_date'"
              class="ag-btn ag-btn--accent ag-btn--block"
              @click="router.push({ name: 'devoirs' }); closeDetail()"
            >
              <ExternalLink :size="14" aria-hidden="true" /> Voir le devoir
            </button>
            <button v-if="isTeacher && selectedEvent.eventType === 'reminder'" class="ag-btn ag-btn--danger ag-btn--block" @click="removeReminder(selectedEvent.sourceId)">
              <Trash2 :size="14" aria-hidden="true" /> Supprimer
            </button>
          </footer>
        </aside>
      </Transition>

      <!-- New reminder form -->
      <Transition name="detail-slide">
        <aside
          v-if="showForm && isTeacher"
          ref="formRef"
          class="agenda-detail"
          role="dialog"
          aria-modal="false"
          aria-labelledby="agenda-form-title"
          @keydown.esc="tryCloseForm"
        >
          <!-- Hero accent : couleur d'accent pour identifier le formulaire -->
          <div class="agenda-detail-hero" style="background: var(--accent);" aria-hidden="true" />

          <div class="agenda-detail-body">
            <header class="agenda-detail-head">
              <span id="agenda-form-title" class="agenda-detail-type">{{ editingId ? 'Modifier le rappel' : 'Nouveau rappel' }}</span>
              <button type="button" class="agenda-detail-close" @click="tryCloseForm" aria-label="Fermer le formulaire"><X :size="14" aria-hidden="true" /></button>
            </header>
            <div class="ag-form">
              <div class="ag-form-row">
                <label class="ag-label" style="flex:1;">Date<input v-model="formDate" type="date" class="ag-input" /></label>
                <label class="ag-label" style="width: 110px;">Heure<input v-model="formTime" type="time" class="ag-input" /></label>
              </div>
              <label class="ag-label">Titre<input v-model="formTitle" ref="titleInputRef" type="text" class="ag-input" placeholder="Ex: Soutenance finale..." /></label>
              <label class="ag-label">Description<textarea v-model="formDesc" class="ag-input ag-textarea" rows="3" placeholder="Details..." /></label>
              <label v-if="isTeacher && !editingId" class="ag-label ag-check-label" :class="{ 'ag-check-label--disabled': !formTime }">
                <input type="checkbox" v-model="formCreateTeams" :disabled="!formTime" />
                <Video :size="14" aria-hidden="true" />
                <span>Créer une réunion Teams + Outlook</span>
                <small v-if="!formTime" class="ag-hint">Nécessite une heure</small>
              </label>
            </div>
          </div>

          <footer class="agenda-detail-footer">
            <button class="ag-btn ag-btn--accent ag-btn--block" :disabled="!formDate || !formTitle.trim() || saving" @click="submitReminder">{{ saving ? 'Enregistrement...' : (editingId ? 'Enregistrer' : 'Ajouter') }}</button>
            <button class="ag-btn ag-btn--ghost ag-btn--block" @click="tryCloseForm">Annuler</button>
          </footer>
        </aside>
      </Transition>
    </div>
  </div>
  </ErrorBoundary>
</template>

<style scoped>
.agenda-area {
  display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg-main);
}

/* ── Toolbar ── */
.agenda-toolbar {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 8px 20px; background: var(--bg-main); border-bottom: 1px solid var(--border);
  flex-shrink: 0; min-height: 48px;
}
.agenda-toolbar-left { display: flex; align-items: center; gap: 12px; }
.agenda-toolbar-right { display: flex; align-items: center; gap: 8px; }

.ag-today-btn {
  padding: 6px 16px; border-radius: 20px; border: 1px solid var(--border);
  background: transparent; color: var(--text-primary); font-size: 13px;
  font-weight: 600; font-family: inherit; cursor: pointer;
  transition: background-color 0.12s, color 0.12s, border-color 0.12s;
}
.ag-today-btn:hover { background: var(--bg-hover); border-color: var(--accent); color: var(--accent); }

/* Filter bar */
.ag-filter-bar {
  display: flex; align-items: center; gap: 16px;
  padding: 8px 20px; background: var(--bg-sidebar); border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.ag-filter-check {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 500; color: var(--text-primary); cursor: pointer;
  accent-color: var(--accent);
}
.ag-filter-count {
  margin-left: auto; font-size: 11px; color: var(--text-muted); font-weight: 600;
}
.ag-sync-dot {
  display: inline-block; width: 7px; height: 7px; border-radius: 50%;
  background: #94a3b8; margin-left: 4px;
}
.ag-sync-dot--live {
  background: var(--color-success);
  box-shadow: 0 0 0 0 rgba(34,197,94,0.6);
  animation: ag-sync-pulse 2s infinite;
}
@keyframes ag-sync-pulse {
  0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
  70% { box-shadow: 0 0 0 5px rgba(34,197,94,0); }
  100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
}
.ag-btn--active { color: var(--accent) !important; border-color: var(--accent) !important; }
.filter-slide-enter-active, .filter-slide-leave-active {
  transition: opacity 0.18s ease,
              max-height 0.22s cubic-bezier(0.4, 0, 0.2, 1),
              padding 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.filter-slide-enter-from, .filter-slide-leave-to { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; overflow: hidden; }
.filter-slide-enter-to, .filter-slide-leave-from { max-height: 50px; }

.ag-nav-arrows { display: flex; gap: 2px; }
.ag-nav-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%; border: none;
  background: transparent; color: var(--text-secondary); cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
}
.ag-nav-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.ag-current-title {
  font-size: 22px; font-weight: 500; color: var(--text-primary);
  margin: 0; text-transform: capitalize; white-space: nowrap;
  letter-spacing: -0.015em;
  font-variant-numeric: tabular-nums;
}

.ag-view-switch {
  display: flex; background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 8px; padding: 2px; gap: 2px;
}
.ag-view-btn {
  padding: 5px 14px; border-radius: 6px; border: none; background: transparent;
  color: var(--text-muted); font-size: 12px; font-weight: 600; font-family: inherit;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, box-shadow 0.15s;
}
.ag-view-btn:hover { color: var(--text-primary); }
.ag-view-btn.active { background: var(--accent); color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }

/* Kebab menu (plus d'options) */
.ag-more-wrap { position: relative; }
.ag-more-menu {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 50;
  min-width: 210px; padding: 6px;
  display: flex; flex-direction: column; gap: 2px;
  background: var(--bg-modal, var(--bg-elevated));
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(0,0,0,0.35);
}
.ag-more-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border: none; border-radius: 6px;
  background: transparent; color: var(--text-primary);
  font-family: var(--font); font-size: 13px; font-weight: 500;
  cursor: pointer; text-align: left;
  transition: background .12s, color .12s;
}
.ag-more-item:hover:not(:disabled) { background: var(--bg-hover); }
.ag-more-item:disabled { opacity: .5; cursor: not-allowed; }
.ag-more-item--active { color: var(--accent); background: rgba(var(--accent-rgb), .08); }
.ag-more-item svg { flex-shrink: 0; color: var(--text-secondary); }
.ag-more-item--active svg { color: var(--accent); }

/* ── Body ── */
.agenda-body { flex: 1; display: flex; overflow: hidden; position: relative; }
.agenda-cal-wrap { flex: 1; overflow: auto; padding: 0; }

/* ══════════════ Vue-cal overrides (high contrast) ══════════════ */
:deep(.vuecal__title-bar) { display: none !important; }
:deep(.vuecal__header) {
  background: var(--bg-elevated) !important; color: var(--text-primary) !important;
  border-bottom: 2px solid var(--border) !important;
}
:deep(.vuecal__heading) {
  font-size: 12px !important; font-weight: 600 !important;
  color: var(--text-primary) !important; padding: 0 !important;
  height: auto !important;
  min-height: 2.4em;
}

/* ── Day heading custom slot — name top, number bottom (style Apple Calendar)
 * Compact pour ne pas manger d'espace vertical au-dessus du grid horaire. ── */
.ag-day-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 4px 5px;
  width: 100%;
  box-sizing: border-box;
  position: relative;
}
.ag-day-head--month { padding: 6px 4px; }
.ag-day-name {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: capitalize;
  letter-spacing: 0;
  order: -1;
}
.ag-day-num {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.ag-day-name-mo {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.6px;
}
.ag-day-head--weekend .ag-day-num,
.ag-day-head--weekend .ag-day-name {
  color: var(--text-muted);
}
/* Today : badge rond rempli (style Fantastical / Notion Calendar) */
.ag-day-head--today .ag-day-num {
  background: var(--accent);
  color: #fff;
  border-radius: 50%;
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 700;
  font-size: 17px;
  letter-spacing: -0.01em;
  box-shadow: 0 2px 8px rgba(var(--accent-rgb), 0.35);
}
.ag-day-head--today .ag-day-name {
  color: var(--accent);
  font-weight: 700;
}
:deep(.vuecal__cell) {
  background: var(--bg-main) !important; border-color: var(--border) !important;
  min-height: 100px; cursor: pointer;
  transition: background 0.15s;
}
:deep(.vuecal__cell:hover) { background: var(--bg-hover) !important; }
:deep(.vuecal__cell-date) {
  font-size: 14px !important; font-weight: 600 !important;
  color: var(--text-primary) !important; padding: 8px 10px !important;
}

/* Today : tint subtil pour coller au style Outlook.
 * Week/day view : la colonne du jour courant est mise en valeur comme dans
 * la vue "jour" pour unifier le rendu.
 * Month view : tint plus marque (sinon le jour n'est pas reperable). */
:deep(.vuecal--week-view .vuecal__cell--today),
:deep(.vuecal--day-view .vuecal__cell--today) {
  background: rgba(var(--accent-rgb), 0.08) !important;
  box-shadow: inset 2px 0 0 var(--accent), inset -1px 0 0 rgba(var(--accent-rgb), 0.2);
}
:deep(.vuecal__cell--today) {
  background: rgba(var(--accent-rgb), 0.06) !important;
}
:deep(.vuecal--month-view .vuecal__cell--today) {
  background: rgba(var(--accent-rgb), 0.10) !important;
  box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb), 0.4);
}
:deep(.vuecal--month-view .vuecal__cell--today .vuecal__cell-date) {
  color: var(--accent) !important; font-weight: 800 !important;
}
:deep(.vuecal__cell--out-of-scope) { opacity: 0.55; }
:deep(.vuecal__cell--out-of-scope .vuecal__cell-date) { color: var(--text-muted) !important; }
:deep(.vuecal__cell--selected) {
  background: rgba(var(--accent-rgb), 0.12) !important;
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
/* Weekend : pas de shading (modern calendars don't) — on shade plutôt les off-hours. */

/* Off-hours shading (avant 8h et après 18h) — met en valeur la journée active. */
:deep(.vuecal--week-view .vuecal__bg),
:deep(.vuecal--day-view .vuecal__bg) {
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--bg-elevated) 65%, transparent) 0%,
    color-mix(in srgb, var(--bg-elevated) 65%, transparent) 6.7%,   /* 7h → 8h = 1/15 = 6.7% */
    transparent 6.7%,
    transparent 73.3%,                                               /* jusqu'à 18h = 11/15 = 73.3% */
    color-mix(in srgb, var(--bg-elevated) 65%, transparent) 73.3%,
    color-mix(in srgb, var(--bg-elevated) 65%, transparent) 100%
  ) !important;
}

/* Week numbers — more prominent */
:deep(.vuecal__week-number) {
  font-size: 11px !important; font-weight: 700 !important;
  color: var(--text-secondary) !important;
  background: var(--bg-elevated) !important;
  padding: 8px 4px !important;
  border-right: 1px solid var(--border);
}

/* ══════════════ Hours grid (week/day view) — adoucie ══════════════ */
:deep(.vuecal__time-column) {
  background: transparent !important;
  border-right: 1px solid var(--border) !important;
  width: 2.8em !important;
}
:deep(.vuecal__time-cell) {
  color: var(--text-secondary) !important;
  font-size: 11px !important; font-weight: 600 !important;
  text-align: right; padding-right: 6px;
  opacity: 0.95;
  font-variant-numeric: tabular-nums;
}
/* Demi-heures : discretes mais visibles */
:deep(.vuecal__time-cell-line) {
  border-top: 1px dashed var(--border) !important;
  opacity: 0.4;
}
/* Heures pleines : ligne pleine, plus lisible pour se reperer */
:deep(.vuecal__time-cell-line.hours::before) {
  border-top: 1px solid var(--border) !important;
  opacity: 0.7;
}
/* Separateurs de colonnes (entre jours) adoucis */
:deep(.vuecal__cell:before) {
  border-color: var(--border) !important;
  opacity: 0.5;
}

/* Cacher toute navigation residuelle de VueCal (title-bar + fleches internes) */
:deep(.vuecal__arrow),
:deep(.vuecal__title-bar),
:deep(.vuecal__title),
:deep(.vuecal__today-btn) {
  display: none !important;
}
/* Current-time red line */
:deep(.vuecal__now-line) {
  color: var(--color-danger) !important;
  border-color: var(--color-danger) !important;
  border-width: 2px !important;
  position: relative;
}
:deep(.vuecal__now-line::before) {
  background: var(--color-danger) !important;
  width: 10px; height: 10px;
  box-shadow: 0 0 0 3px rgba(239,68,68,0.2);
}
/* a11y : label texte pour les daltoniens — le trait rouge seul ne transmet pas l'info */
:deep(.vuecal__now-line::after) {
  content: 'Maintenant';
  position: absolute;
  left: 6px;
  top: -0.75em;
  font-size: 9.5px;
  font-weight: 700;
  color: var(--color-danger);
  background: var(--bg-main);
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.3px;
  pointer-events: none;
}

/* ══════════════ Events (larger, higher contrast) ══════════════ */
:deep(.vuecal__event) {
  border-radius: 8px !important;          /* plus doux, style "pill" */
  padding: 5px 10px !important;           /* un peu plus d'air */
  font-size: 12px !important;
  font-weight: 600 !important;
  cursor: pointer;
  margin: 2px 3px !important;
  transition: transform 0.14s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.14s cubic-bezier(0.4, 0, 0.2, 1),
              filter 0.14s;
  line-height: 1.35 !important;
  min-height: 24px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  -webkit-font-smoothing: antialiased;
  position: relative;
}
/* Drag affordance : cursor grab/grabbing + style dragging */
:deep(.vuecal__event.vuecal__event--draggable),
:deep(.vuecal__event[draggable="true"]) { cursor: grab; }
:deep(.vuecal__event.vuecal__event--draggable:active),
:deep(.vuecal__event.vuecal__event--dragging) {
  cursor: grabbing;
  opacity: 0.88;
  transform: scale(1.03) rotate(-0.5deg);
  box-shadow: 0 12px 28px rgba(0,0,0,0.22),
              0 0 0 2px color-mix(in srgb, var(--ev-color, var(--accent)) 60%, transparent);
  z-index: 100;
}
:deep(.vuecal__cell.vuecal__cell--drop-target) {
  background: rgba(var(--accent-rgb), 0.18) !important;
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
}
:deep(.vuecal__event:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.18),
              0 0 0 1px color-mix(in srgb, var(--ev-color, var(--accent)) 40%, transparent);
  filter: brightness(1.05);
  z-index: 5;
}
:deep(.vuecal__event:active) {
  transform: scale(0.97);
  transition: transform 80ms ease-out, box-shadow 80ms ease-out;
}
:deep(.vuecal__event-title) {
  font-weight: 600 !important;
  letter-spacing: -0.005em;
}
:deep(.vuecal__event-time) {
  font-size: 10px !important; font-weight: 600 !important;
  opacity: 0.85;
  display: block;
  margin-bottom: 1px;
}
/* Event multi-ligne (timed events) : titre + sous-titre teacher/organizer */
:deep(.ag-event-body) {
  display: flex; flex-direction: column; gap: 1px;
  width: 100%; min-width: 0;
}
:deep(.ag-event-title) {
  font-weight: 700 !important;
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
:deep(.ag-event-subtitle) {
  font-size: 10px;
  font-weight: 600;
  opacity: 0.92;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-style: italic;
}

/* ══════════════ All-day events (barre horizontale haut de journee, style Outlook) ══ */
:deep(.vuecal__all-day) {
  min-height: 2.2em !important;
  max-height: 6em;
  background: var(--bg-main);
  border-bottom: 1px solid var(--border);
  padding: 3px 0 4px;
  overflow-y: auto;
}
:deep(.vuecal__all-day-text) {
  color: var(--text-muted) !important;
  border-bottom: 1px solid var(--border) !important;
  font-size: 10px !important;
  font-weight: 600;
  width: 3em !important;
}
:deep(.vuecal__event--all-day) {
  min-height: 22px !important;
  height: 22px !important;
  border-radius: 4px !important;
  margin: 1px 2px !important;
  padding: 0 !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  line-height: 1.3 !important;
  box-shadow: none !important;
  display: flex;
  align-items: stretch;
  transition: background var(--motion-fast) var(--ease-out);
}
/* Devoirs all-day : fond tinte avec la couleur promo + barre laterale.
   Override du background satur\u00e9 que VueCal applique inline. */
:deep(.vuecal__event--all-day):has(.ag-event-body--allday-tinted) {
  background: transparent !important;
}
.ag-event-body--allday-tinted {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 2px 8px;
  background: color-mix(in srgb, var(--ag-event-color, var(--accent)) 14%, transparent);
  border-left: 3px solid var(--ag-event-color, var(--accent));
  border-radius: 3px;
  color: var(--text-primary);
  transition: background var(--motion-fast) var(--ease-out);
}
.ag-event-body--allday-tinted:hover {
  background: color-mix(in srgb, var(--ag-event-color, var(--accent)) 22%, transparent);
}
@supports not (background: color-mix(in srgb, white, black)) {
  .ag-event-body--allday-tinted {
    background: var(--bg-elevated);
  }
}
:deep(.vuecal__event--all-day:hover) {
  transform: none !important;
}
:deep(.vuecal__event--all-day .vuecal__event-title) {
  font-weight: 500 !important;
  text-shadow: none !important;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}
/* Barre qui continue sur plusieurs jours : coins coupes cote jour non-bordure */
:deep(.vuecal__event--all-day.vuecal__event--multiple-days:not(.vuecal__event--first-day)) {
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
  margin-left: 0 !important;
  border-left-width: 0 !important;
}
:deep(.vuecal__event--all-day.vuecal__event--multiple-days:not(.vuecal__event--last-day)) {
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
  margin-right: 0 !important;
}
/* Titre visible seulement sur le premier jour d'un evenement multi-jours */
:deep(.vuecal__event--all-day.vuecal__event--multiple-days:not(.vuecal__event--first-day) .vuecal__event-title) {
  opacity: 0;
}

/* Status indicators : dots ronds SVG (sans emoji, pas de font-dépendance) */
:deep(.ag-event--submitted) { opacity: 0.55; text-decoration: line-through; }
:deep(.ag-event--submitted::after) {
  content: ''; position: absolute; right: 5px; top: 5px;
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--color-success);
  box-shadow: 0 0 0 2px var(--bg-main);
}
:deep(.ag-event--late) { animation: ag-pulse-late 2.4s infinite; }
:deep(.ag-event--late::after) {
  content: ''; position: absolute; right: 5px; top: 5px;
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--color-danger);
  box-shadow: 0 0 0 2px var(--bg-main), 0 0 8px rgba(239,68,68,0.55);
}
@keyframes ag-pulse-late {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); }
  50% { box-shadow: 0 0 0 5px rgba(239,68,68,0); }
}

/* ══════════════ Detail panel — hero design ══════════════ */
.agenda-detail {
  position: absolute; right: 0; top: 0; bottom: 0;
  width: clamp(300px, 32vw, 380px);
  background: var(--bg-main);
  border-left: 1px solid var(--border);
  display: flex; flex-direction: column;
  overflow: hidden; /* le body gère son propre scroll */
  box-shadow: -4px 0 24px rgba(0,0,0,0.18);
  z-index: 10;
}
/* Hero : bande de couleur pleine largeur en haut */
.agenda-detail-hero {
  height: 6px;
  flex-shrink: 0;
}
.agenda-detail-body {
  flex: 1; overflow-y: auto;
  padding: 20px 24px 16px;
  display: flex; flex-direction: column; gap: 16px;
}
.agenda-detail-head { display: flex; align-items: center; gap: 8px; }
.agenda-detail-type {
  font-size: 10.5px; font-weight: 700; color: var(--text-muted); flex: 1;
  text-transform: uppercase; letter-spacing: 0.08em;
}
.agenda-detail-close {
  background: none; border: none; color: var(--text-muted); cursor: pointer;
  padding: 6px; border-radius: 6px;
  transition: background-color 0.12s, color 0.12s;
}
.agenda-detail-close:hover { background: var(--bg-hover); color: var(--text-primary); }
.agenda-detail-title {
  font-size: 22px; font-weight: 600; color: var(--text-primary);
  margin: -4px 0 0; line-height: 1.25;
  letter-spacing: -0.015em;
}

.agenda-detail-meta-list {
  display: flex; flex-direction: column; gap: 8px;
  padding: 12px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.agenda-detail-meta {
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; color: var(--text-secondary);
  line-height: 1.4;
}
.agenda-detail-meta svg { color: var(--text-muted); flex-shrink: 0; }
.agenda-detail-promo-dot {
  width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0;
}

/* Status card avec progress bar */
.agenda-detail-status-card {
  display: flex; flex-direction: column; gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px; font-weight: 600;
}
.agenda-detail-status-head {
  display: flex; align-items: center; gap: 8px;
}
.agenda-detail-status-count {
  margin-left: auto; font-weight: 500; opacity: 0.85; font-variant-numeric: tabular-nums;
}
.agenda-detail-progress-bar {
  height: 6px; border-radius: 3px;
  background: rgba(0,0,0,0.1);
  overflow: hidden;
}
.agenda-detail-progress-fill {
  height: 100%; border-radius: 3px;
  background: currentColor;
  transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.status--submitted { background: color-mix(in srgb, var(--color-success) 14%, transparent); color: var(--color-success); }
.status--late      { background: color-mix(in srgb, var(--color-danger) 14%, transparent);  color: var(--color-danger); }
.status--pending   { background: color-mix(in srgb, var(--color-info) 14%, transparent);    color: var(--color-info); }
.status--upcoming  { background: var(--bg-hover); color: var(--text-muted); }

/* Sticky footer avec CTA plein-width */
.agenda-detail-footer {
  flex-shrink: 0;
  padding: 12px 24px 16px;
  background: var(--bg-main);
  border-top: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 8px;
}
.ag-btn--block { width: 100%; justify-content: center; padding: 10px 14px; font-size: 13px; }

/* Form */
.ag-form { display: flex; flex-direction: column; gap: 12px; }
.ag-form-row { display: flex; gap: 8px; }
.ag-label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 600; color: var(--text-muted); }
.ag-input {
  padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border);
  background: var(--bg-elevated); color: var(--text-primary); font-size: 13px;
  font-family: var(--font); outline: none; transition: border-color 0.15s;
}
.ag-input:focus,
.ag-input:focus-visible {
  border-color: var(--accent);
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.ag-textarea { resize: vertical; min-height: 56px; }

/* Buttons */
.ag-btn {
  display: inline-flex; align-items: center; gap: 5px; padding: 7px 14px;
  border-radius: 6px; border: 1px solid var(--border); font-size: 12px;
  font-weight: 600; font-family: inherit; cursor: pointer;
  transition: background-color 0.12s, color 0.12s, border-color 0.12s, opacity 0.12s;
}
.ag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ag-btn--accent { background: var(--accent); color: white; border-color: var(--accent); }
.ag-btn--accent:hover:not(:disabled) { opacity: 0.9; }
.ag-btn--ghost { background: transparent; color: var(--text-secondary); border-color: transparent; }
.ag-btn--ghost:hover:not(:disabled) { background: var(--bg-hover); }
.ag-btn--danger { background: rgba(239,68,68,0.1); color: var(--color-danger); border-color: transparent; margin-top: 8px; }
.ag-btn--danger:hover { background: rgba(239,68,68,0.2); }
.ag-btn--teams {
  background: var(--brand-teams); color: #fff; border-color: var(--brand-teams); margin-top: 4px;
  text-decoration: none;
}
.ag-btn--teams:hover { background: var(--brand-teams-hover); border-color: var(--brand-teams-hover); }
.ag-check-label {
  flex-direction: row !important; align-items: center; gap: 6px;
  background: rgba(98, 100, 167, 0.08); padding: 8px 10px; border-radius: 6px;
  color: var(--text-primary); cursor: pointer;
  font-size: 12px !important; font-weight: 500 !important;
}
.ag-check-label input { accent-color: var(--brand-teams); }
.ag-check-label--disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: color-mix(in srgb, var(--bg-hover) 60%, transparent) !important;
}
.ag-check-label--disabled input { cursor: not-allowed; }
.ag-hint {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--text-muted);
  font-style: italic;
}

.ag-spin { animation: ag-spin 1s linear infinite; }
@keyframes ag-spin { to { transform: rotate(360deg); } }

/* ══════════════ Day/Week view hero banner ══════════════ */
.ag-day-hero {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  padding: 10px 20px 10px;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--accent) 6%, var(--bg-main)) 0%,
    var(--bg-main) 100%
  );
  border-bottom: 1px solid var(--border);
}
.ag-day-hero-main {
  display: flex; flex-direction: column; gap: 2px;
  min-width: 0;
}
.ag-day-hero-weekday {
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: var(--text-muted);
}
.ag-day-hero-date {
  font-size: 20px; font-weight: 600; color: var(--text-primary);
  margin: 0; line-height: 1.15;
  letter-spacing: -0.02em;
  display: flex; align-items: center; gap: 10px;
  flex-wrap: wrap;
}
.ag-day-hero-badge {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: 999px;
  background: var(--accent); color: white;
  font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
  text-transform: none;
}
.ag-day-hero-meta {
  display: flex; align-items: center; gap: 8px;
  flex-wrap: wrap;
}
.ag-day-hero-week {
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  padding: 4px 10px; border-radius: 999px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  font-variant-numeric: tabular-nums;
}
.ag-day-hero-chip {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  padding: 4px 10px; border-radius: 999px;
  background: var(--bg-elevated); border: 1px solid var(--border);
}
.ag-day-hero-chip--empty {
  color: var(--text-muted);
  font-style: italic;
  font-weight: 500;
}
.ag-chip-dot {
  width: 7px; height: 7px; border-radius: 50%;
  display: inline-block;
}

/* ══════════════ Skeleton loading (premier chargement) ══════════════ */
.ag-skeleton {
  position: absolute; inset: 60px 0 0 0;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(5, 1fr);
  gap: 8px;
  padding: 16px;
  pointer-events: none;
  z-index: 2;
}
.ag-skel-event {
  height: 22px;
  background: linear-gradient(90deg, var(--bg-hover) 25%, var(--bg-elevated) 50%, var(--bg-hover) 75%);
  background-size: 200% 100%;
  border-radius: 6px;
  animation: ag-skel-shimmer 1.6s linear infinite;
  align-self: start;
}
@keyframes ag-skel-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ══════════════ Empty state ══════════════ */
.ag-empty-state {
  position: absolute; inset: 60px 0 0 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px;
  padding: 32px;
  color: var(--text-muted);
  text-align: center;
  pointer-events: none;
  z-index: 1;
}
.ag-empty-state > * { pointer-events: auto; }
.ag-empty-illus {
  color: var(--text-muted);
  margin-bottom: 8px;
}
.ag-empty-ev { transform-origin: center; }
.ag-empty-ev1 { animation: ag-empty-float 4s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
.ag-empty-ev2 { animation: ag-empty-float 4.8s cubic-bezier(0.4, 0, 0.2, 1) infinite 0.4s; }
.ag-empty-ev3 { animation: ag-empty-float 5.2s cubic-bezier(0.4, 0, 0.2, 1) infinite 0.8s; }
@keyframes ag-empty-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
.ag-empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary);
  margin: 0;
}
.ag-empty-hint {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
  max-width: 360px;
  line-height: 1.5;
}

/* ══════════════ Responsive detail panel + toolbar ══════════════ */
@media (max-width: 900px) {
  .agenda-toolbar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
  }
  .agenda-toolbar-right {
    flex-wrap: wrap;
    gap: 6px;
  }
  .ag-current-title { font-size: 15px; }
  .agenda-detail {
    position: fixed !important;
    inset: 0 !important;
    width: 100% !important;
    z-index: var(--z-modal, 1100);
    box-shadow: none;
    border-left: none;
  }
}
@media (min-width: 901px) {
  .agenda-detail {
    width: clamp(280px, 30vw, 360px);
  }
}

/* ══════════════ Focus rings (a11y) ══════════════ */
.ag-btn:focus-visible,
.ag-nav-btn:focus-visible,
.ag-view-btn:focus-visible,
.ag-today-btn:focus-visible,
.agenda-detail-close:focus-visible,
.ag-filter-check:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 6px;
}
:deep(.vuecal__event:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  filter: brightness(1.1);
}

/* ══════════════ Reduced motion (a11y) ══════════════
 * Respecte prefers-reduced-motion : désactive toute animation décorative.
 * Les transitions courtes de hover/focus sont conservées (< 150 ms = invisible).
 */
@media (prefers-reduced-motion: reduce) {
  .ag-sync-dot--live { animation: none !important; }
  :deep(.ag-event--late) { animation: none !important; }
  :deep(.vuecal__event) { transition: none !important; }
  :deep(.vuecal__event:hover),
  :deep(.vuecal__event:active) { transform: none !important; }
  .ag-spin { animation: none !important; }
  .filter-slide-enter-active,
  .filter-slide-leave-active,
  .detail-slide-enter-active,
  .detail-slide-leave-active { transition: none !important; }
  .ag-skel-event { animation: none !important; }
  .ag-empty-ev1, .ag-empty-ev2, .ag-empty-ev3 { animation: none !important; }
  .agenda-detail-progress-fill { transition: none !important; }
}

.detail-slide-enter-active, .detail-slide-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.detail-slide-enter-from, .detail-slide-leave-to { transform: translateX(20px); opacity: 0; }

/* ══════════════ Mobile responsive ══════════════ */
@media (max-width: 768px) {
  .agenda-toolbar {
    flex-wrap: wrap; gap: 8px; padding: 8px 12px;
  }
  .agenda-toolbar-left, .agenda-toolbar-right {
    flex: 1 1 100%; justify-content: space-between;
  }
  .ag-current-title { font-size: 15px; }
  .ag-view-btn { padding: 4px 10px; font-size: 11px; }
  .ag-today-btn { padding: 5px 12px; font-size: 12px; }
  .agenda-detail {
    width: 100% !important;
    box-shadow: none;
  }
  :deep(.vuecal__cell) { min-height: 70px; }
  :deep(.vuecal__cell-date) { font-size: 13px !important; padding: 6px 8px !important; }
  :deep(.vuecal__event) { font-size: 10px !important; padding: 2px 5px !important; }
}

/* Keyboard shortcut hints */
.ag-today-btn[title]::after,
.ag-view-btn[title]::after { content: ''; } /* rely on native tooltip */
</style>
