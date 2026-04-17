/** AgendaView — calendrier complet v2.111.
 *  8 features : vue jour, statut rendu, mini-cal interactif, resume semaine,
 *  numeros de semaine, couleurs par categorie, drag-to-reschedule, notes perso. */
<script setup lang="ts">
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'
import AgendaDayNotes from '@/components/agenda/AgendaDayNotes.vue'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VueCal from 'vue-cal'
import 'vue-cal/dist/vuecal.css'
import { Plus, Trash2, RefreshCw, X, Clock, Tag, ExternalLink, ChevronLeft, ChevronRight, Check, AlertCircle, Download, Filter, Copy, Edit3, Calendar as CalIcon, Video } from 'lucide-vue-next'
import { useAppStore }   from '@/stores/app'
import { useAgendaStore } from '@/stores/agenda'
import { useToast } from '@/composables/useToast'
import { getCategoryBg } from '@/utils/categoryColor'
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
const showDeadlines  = ref(true)
const showStartDates = ref(true)
const showReminders  = ref(true)
const hiddenPromos   = ref(new Set<number>())

const showOutlook = ref(true)

const filteredEvents = computed(() =>
  agenda.events.filter(e => {
    if (e.eventType === 'deadline'   && !showDeadlines.value)  return false
    if (e.eventType === 'start_date' && !showStartDates.value) return false
    if (e.eventType === 'reminder'   && !showReminders.value)  return false
    if (e.eventType === 'outlook'    && !showOutlook.value)    return false
    if (e.promoId && hiddenPromos.value.has(e.promoId))        return false
    return true
  }).map(e => ({
    start: e.start,
    end:   e.end,
    title: e.title,
    allDay: e.allDay === true,
    class: (e.allDay ? 'ag-event--all-day ' : '') + statusClass(e),
    style: `border-left: 3px solid ${e.color}; background: ${getCategoryBg(e.category)}; color: ${e.color};`,
    _meta: e,
  }))
)

function statusClass(e: CalendarEvent): string {
  const classes = ['ag-event']
  if (e.submissionStatus === 'submitted') classes.push('ag-event--submitted')
  if (e.submissionStatus === 'late') classes.push('ag-event--late')
  return classes.join(' ')
}

// ── Calendar ref + view control ──────────────────────────────────────────
const calRef = ref<InstanceType<typeof VueCal> | null>(null)
const activeView = ref<'month' | 'week' | 'day'>('month')
const currentTitle = ref('')
const selectedDate = ref(new Date().toISOString().slice(0, 10))

function onViewChange(event: { view: string; startDate: Date; endDate: Date }) {
  const view = event.view as 'month' | 'week' | 'day'
  if (view === 'month' || view === 'week' || view === 'day') activeView.value = view
  const start = event.startDate
  const end = event.endDate
  if (view === 'month') {
    currentTitle.value = start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  } else if (view === 'day') {
    currentTitle.value = start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  } else {
    const sameMonth = start.getMonth() === end.getMonth()
    currentTitle.value = sameMonth
      ? `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
      : `${start.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`
  }
}

// P0.1 : clic sur un jour → vue jour
function onCellClick(date: Date) {
  selectedDate.value = date.toISOString().slice(0, 10)
  activeView.value = 'day'
}

// P2 : double-clic = creer un evenement (pre-rempli avec la date/heure cliquee)
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
const ctxMenu = ref<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)

function closeCtxMenu() { ctxMenu.value = null }

function onEventContextMenu(e: MouseEvent, event: { _meta?: CalendarEvent }) {
  e.preventDefault()
  e.stopPropagation()
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

  ctxMenu.value = { x: e.clientX, y: e.clientY, items }
}

function onCellContextMenu(e: MouseEvent, date: Date) {
  if (!isTeacher.value) return
  e.preventDefault()
  e.stopPropagation()
  const dateStr = date.toISOString().slice(0, 10)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const timeStr = (hours || minutes) ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : ''

  ctxMenu.value = {
    x: e.clientX, y: e.clientY,
    items: [
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
    ],
  }
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

function goPrev() { (calRef.value as any)?.previous?.() }
function goNext() { (calRef.value as any)?.next?.() }
function goToday() { selectedDate.value = new Date().toISOString().slice(0, 10) }
function switchView(view: 'month' | 'week' | 'day') { activeView.value = view }

// ── Selected event ────────────────────────────────────────────────────────
const selectedEvent = ref<CalendarEvent | null>(null)
const detailOpen = ref(false)

function onEventClick(event: { _meta?: CalendarEvent }) {
  selectedEvent.value = event._meta ?? null
  detailOpen.value = true
}
function closeDetail() { detailOpen.value = false; selectedEvent.value = null }

// ── New reminder form ────────────────────────────────────────────────────
const showForm       = ref(false)
const formDate       = ref('')
const formTime       = ref('')
const formTitle      = ref('')
const formDesc       = ref('')
const formCreateTeams = ref(false)
const saving         = ref(false)

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
        const startIso = new Date(`${formDate.value}T${formTime.value}:00`).toISOString()
        const endIso   = new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString()
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

// P2.1 : drag-to-reschedule (prof)
async function onEventDrop(event: { event: { _meta?: CalendarEvent }; newDate: Date }) {
  const meta = event.event._meta
  if (!meta || !isTeacher.value || meta.eventType !== 'deadline') return
  const newDateStr = event.newDate.toISOString().slice(0, 10)
  try {
    await (window.api as any).updateTravail?.(meta.sourceId, { deadline: newDateStr })
    showToast(`Echeance deplacee au ${event.newDate.toLocaleDateString('fr-FR')}`, 'success')
    await load()
  } catch { showToast('Impossible de deplacer l\'echeance', 'error') }
}

// ── Export ICS (iCalendar) ───────────────────────────────────────────────
function formatIcsDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
}

/** Escape un champ texte selon RFC 5545 */
function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function exportIcs() {
  const events = filteredEvents.value
  if (events.length === 0) {
    showToast('Aucun evenement a exporter.', 'error')
    return
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cursus//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Cursus - Agenda',
  ]

  for (const ev of events) {
    const meta = ev._meta as CalendarEvent
    const uid = `cursus-${meta.id}@cursus.school`
    const summary = icsEscape(meta.title)
    const category = meta.category ? meta.category.replace(/[,;\\]/g, ' ') : ''
    const status = meta.submissionStatus === 'submitted' ? 'COMPLETED' : 'NEEDS-ACTION'
    const description = [
      meta.eventType === 'deadline' ? 'Echeance' : meta.eventType === 'start_date' ? 'Demarrage' : 'Rappel',
      category ? `Projet: ${category}` : '',
      meta.promoName ? `Promo: ${meta.promoName}` : '',
      meta.submissionStatus ? `Statut: ${statusLabel(meta.submissionStatus)}` : '',
    ].filter(Boolean).join(' | ')

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${formatIcsDate(meta.start)}`,
      `DTEND:${formatIcsDate(meta.end)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${icsEscape(description)}`,
      `STATUS:${status}`,
    )
    if (category) lines.push(`CATEGORIES:${category}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cursus-agenda-${new Date().toISOString().slice(0, 10)}.ics`
  a.click()
  URL.revokeObjectURL(url)
  showToast(`${events.length} evenement${events.length > 1 ? 's' : ''} exporte${events.length > 1 ? 's' : ''} en ICS.`, 'success')
}

// ── Filter panel toggle ─────────────────────────────────────────────────
const showFilters = ref(false)

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

// ── Load ─────────────────────────────────────────────────────────────────
let cleanupListener: (() => void) | null = null

async function load() {
  const pid = fetchPromoId.value
  if (pid !== null) await agenda.fetchEvents(pid)
  if (isTeacher.value && showOutlook.value) await loadOutlook()
}

async function loadOutlook() {
  // Window = current month (generous : ±1 month from selected date)
  const anchor = new Date(selectedDate.value)
  const from = new Date(anchor); from.setDate(1); from.setMonth(from.getMonth() - 1)
  const to = new Date(anchor); to.setDate(1); to.setMonth(to.getMonth() + 2)
  await agenda.fetchOutlookEvents(from.toISOString(), to.toISOString())
}

// Auto-refresh Outlook every 5 minutes (live sync)
let outlookPoll: ReturnType<typeof setInterval> | null = null
function startOutlookPolling() {
  stopOutlookPolling()
  outlookPoll = setInterval(() => { if (showOutlook.value && isTeacher.value) loadOutlook() }, 5 * 60 * 1000)
}
function stopOutlookPolling() {
  if (outlookPoll) { clearInterval(outlookPoll); outlookPoll = null }
}

watch(showOutlook, (v) => {
  agenda.toggleOutlookSync(v)
  if (v && isTeacher.value) loadOutlook()
})
watch(selectedDate, () => { if (isTeacher.value && showOutlook.value) loadOutlook() })

// ── Keyboard shortcuts (Phase 5) ──────────────────────────────────────
function onGlobalKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
  if (e.ctrlKey || e.metaKey || e.altKey) return

  switch (e.key.toLowerCase()) {
    case 't':
      goToday()
      break
    case 'm':
      switchView('month')
      break
    case 's':
      switchView('week')
      break
    case 'j':
      switchView('day')
      break
    case 'n':
      if (isTeacher.value) { showForm.value = true; e.preventDefault() }
      break
    case 'arrowleft':
      if (!detailOpen.value) goPrev()
      break
    case 'arrowright':
      if (!detailOpen.value) goNext()
      break
    case 'escape':
      if (ctxMenu.value) closeCtxMenu()
      else if (detailOpen.value) closeDetail()
      else if (showForm.value) { showForm.value = false; editingId.value = null }
      break
  }
}

onMounted(() => {
  load()
  startOutlookPolling()
  window.addEventListener('keydown', onGlobalKeydown)
  if (route.query.action === 'new-reminder' && isTeacher.value) showForm.value = true
  // P0.3 : deep-link depuis sidebar mini-cal
  if (typeof route.query.date === 'string') {
    selectedDate.value = route.query.date
    activeView.value = 'day'
  }
  cleanupListener = window.api.onAssignmentNew?.(() => { load() }) ?? null
})
onBeforeUnmount(() => {
  cleanupListener?.()
  stopOutlookPolling()
  window.removeEventListener('keydown', onGlobalKeydown)
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
    <header class="agenda-toolbar">
      <div class="agenda-toolbar-left">
        <button type="button" class="ag-today-btn" @click="goToday" title="Aujourd'hui (T)">Aujourd'hui</button>
        <div class="ag-nav-arrows">
          <button type="button" class="ag-nav-btn" @click="goPrev"><ChevronLeft :size="16" /></button>
          <button type="button" class="ag-nav-btn" @click="goNext"><ChevronRight :size="16" /></button>
        </div>
        <h1 class="ag-current-title">{{ currentTitle || 'Calendrier' }}</h1>
      </div>
      <div class="agenda-toolbar-right">
        <div class="ag-view-switch">
          <button type="button" class="ag-view-btn" :class="{ active: activeView === 'month' }" @click="switchView('month')" title="Vue mois (M)">Mois</button>
          <button type="button" class="ag-view-btn" :class="{ active: activeView === 'week' }" @click="switchView('week')" title="Vue semaine (S)">Semaine</button>
          <button type="button" class="ag-view-btn" :class="{ active: activeView === 'day' }" @click="switchView('day')" title="Vue jour (J)">Jour</button>
        </div>
        <button class="ag-btn ag-btn--ghost" title="Filtres" :class="{ 'ag-btn--active': showFilters }" @click="showFilters = !showFilters">
          <Filter :size="14" />
        </button>
        <button class="ag-btn ag-btn--ghost" title="Exporter en ICS (Outlook, Google Calendar)" @click="exportIcs">
          <Download :size="14" />
        </button>
        <button v-if="isTeacher" class="ag-btn ag-btn--accent" @click="showForm = !showForm" title="Nouveau rappel (N)">
          <Plus :size="13" /> Rappel
        </button>
        <button class="ag-btn ag-btn--ghost" :disabled="agenda.loading" @click="load">
          <RefreshCw :size="14" :class="{ 'ag-spin': agenda.loading }" />
        </button>
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

    <div class="agenda-body">
      <div class="agenda-cal-wrap" @contextmenu="onCalWrapContextMenu">
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
          :editable-events="isTeacher ? { drag: true } : false"
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
            <div class="ag-event-body" @contextmenu="onEventContextMenu($event, event)">
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
      </div>

      <!-- Right-click context menu -->
      <ContextMenu v-if="ctxMenu" :x="ctxMenu.x" :y="ctxMenu.y" :items="ctxMenu.items" @close="closeCtxMenu" />

      <!-- Detail panel -->
      <Transition name="detail-slide">
        <aside v-if="detailOpen && selectedEvent" class="agenda-detail">
          <header class="agenda-detail-head">
            <div class="agenda-detail-dot" :style="{ background: selectedEvent.color }" />
            <span class="agenda-detail-type">{{ eventTypeLabel(selectedEvent.eventType) }}</span>
            <button type="button" class="agenda-detail-close" @click="closeDetail"><X :size="14" /></button>
          </header>
          <h2 class="agenda-detail-title">{{ selectedEvent.title }}</h2>
          <div class="agenda-detail-meta">
            <Clock :size="12" />
            <span>{{ formatFullDate(selectedEvent.start) }}</span>
          </div>
          <div v-if="selectedEvent.promoName" class="agenda-detail-meta">
            <span class="agenda-detail-promo-dot" :style="{ background: selectedEvent.promoColor }" />
            <span>{{ selectedEvent.promoName }}</span>
          </div>
          <div v-if="selectedEvent.category" class="agenda-detail-meta">
            <Tag :size="12" />
            <span>{{ selectedEvent.category }}</span>
          </div>
          <!-- Outlook-specific metadata -->
          <div v-if="selectedEvent.location" class="agenda-detail-meta">
            <span class="ag-icon-pin">📍</span>
            <span>{{ selectedEvent.location }}</span>
          </div>
          <div v-if="selectedEvent.organizer" class="agenda-detail-meta">
            <span class="ag-icon-org">👤</span>
            <span>{{ selectedEvent.organizer }}</span>
          </div>
          <!-- Teams join button -->
          <a v-if="selectedEvent.teamsJoinUrl" :href="selectedEvent.teamsJoinUrl" target="_blank" rel="noopener" class="ag-btn ag-btn--teams">
            <Video :size="13" /> Rejoindre Teams
          </a>
          <!-- Statut rendu -->
          <div v-if="selectedEvent.submissionStatus" class="agenda-detail-status" :class="`status--${selectedEvent.submissionStatus}`">
            <Check v-if="selectedEvent.submissionStatus === 'submitted'" :size="13" />
            <AlertCircle v-else-if="selectedEvent.submissionStatus === 'late'" :size="13" />
            <Clock v-else :size="13" />
            <span>{{ statusLabel(selectedEvent.submissionStatus) }}</span>
            <span v-if="isTeacher && selectedEvent.depotsCount != null" class="agenda-detail-progress">
              {{ selectedEvent.depotsCount }}/{{ selectedEvent.studentsTotal }} rendus
            </span>
          </div>
          <button
            v-if="selectedEvent.eventType === 'deadline' || selectedEvent.eventType === 'start_date'"
            class="ag-btn ag-btn--accent"
            @click="router.push({ name: 'devoirs' }); closeDetail()"
          >
            <ExternalLink :size="12" /> Voir le devoir
          </button>
          <button v-if="isTeacher && selectedEvent.eventType === 'reminder'" class="ag-btn ag-btn--danger" @click="removeReminder(selectedEvent.sourceId)">
            <Trash2 :size="12" /> Supprimer
          </button>
          <!-- Notes personnelles pour ce jour -->
          <AgendaDayNotes :date="selectedEvent.start" />
        </aside>
      </Transition>

      <!-- New reminder form -->
      <Transition name="detail-slide">
        <aside v-if="showForm && isTeacher" class="agenda-detail">
          <header class="agenda-detail-head">
            <Plus :size="14" />
            <span class="agenda-detail-type">Nouveau rappel</span>
            <button type="button" class="agenda-detail-close" @click="showForm = false"><X :size="14" /></button>
          </header>
          <div class="ag-form">
            <div class="ag-form-row">
              <label class="ag-label" style="flex:1;">Date<input v-model="formDate" type="date" class="ag-input" /></label>
              <label class="ag-label" style="width: 110px;">Heure<input v-model="formTime" type="time" class="ag-input" /></label>
            </div>
            <label class="ag-label">Titre<input v-model="formTitle" type="text" class="ag-input" placeholder="Ex: Soutenance finale..." /></label>
            <label class="ag-label">Description<textarea v-model="formDesc" class="ag-input ag-textarea" rows="3" placeholder="Details..." /></label>
            <label v-if="formTime && isTeacher && !editingId" class="ag-label ag-check-label">
              <input type="checkbox" v-model="formCreateTeams" />
              <Video :size="12" />
              <span>Creer une reunion Teams + Outlook</span>
            </label>
            <div class="ag-form-actions">
              <button class="ag-btn ag-btn--accent" :disabled="!formDate || !formTitle.trim() || saving" @click="submitReminder">{{ saving ? 'Enregistrement...' : 'Ajouter' }}</button>
              <button class="ag-btn ag-btn--ghost" @click="showForm = false">Annuler</button>
            </div>
          </div>
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
  padding: 10px 20px; background: var(--bg-main); border-bottom: 1px solid var(--border);
  flex-shrink: 0; min-height: 52px;
}
.agenda-toolbar-left { display: flex; align-items: center; gap: 12px; }
.agenda-toolbar-right { display: flex; align-items: center; gap: 10px; }

.ag-today-btn {
  padding: 6px 16px; border-radius: 20px; border: 1px solid var(--border);
  background: transparent; color: var(--text-primary); font-size: 13px;
  font-weight: 600; font-family: inherit; cursor: pointer; transition: all 0.12s;
}
.ag-today-btn:hover { background: var(--bg-hover); border-color: var(--accent); color: var(--accent); }

/* Filter bar */
.ag-filter-bar {
  display: flex; align-items: center; gap: 16px;
  padding: 8px 20px; background: var(--bg-sidebar); border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.ag-filter-check {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; color: var(--text-secondary); cursor: pointer;
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
  background: #22c55e;
  box-shadow: 0 0 0 0 rgba(34,197,94,0.6);
  animation: ag-sync-pulse 2s infinite;
}
@keyframes ag-sync-pulse {
  0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
  70% { box-shadow: 0 0 0 5px rgba(34,197,94,0); }
  100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
}
.ag-btn--active { color: var(--accent) !important; border-color: var(--accent) !important; }
.filter-slide-enter-active, .filter-slide-leave-active { transition: all .2s ease; }
.filter-slide-enter-from, .filter-slide-leave-to { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; overflow: hidden; }
.filter-slide-enter-to, .filter-slide-leave-from { max-height: 50px; }

.ag-nav-arrows { display: flex; gap: 2px; }
.ag-nav-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%; border: none;
  background: transparent; color: var(--text-secondary); cursor: pointer; transition: all 0.12s;
}
.ag-nav-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.ag-current-title {
  font-size: 18px; font-weight: 600; color: var(--text-primary);
  margin: 0; text-transform: capitalize; white-space: nowrap;
}

.ag-view-switch {
  display: flex; background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 8px; padding: 2px; gap: 2px;
}
.ag-view-btn {
  padding: 5px 14px; border-radius: 6px; border: none; background: transparent;
  color: var(--text-muted); font-size: 12px; font-weight: 600; font-family: inherit;
  cursor: pointer; transition: all 0.15s;
}
.ag-view-btn:hover { color: var(--text-primary); }
.ag-view-btn.active { background: var(--accent); color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }

/* ── Body ── */
.agenda-body { flex: 1; display: flex; overflow: hidden; position: relative; }
.agenda-cal-wrap { flex: 1; overflow: auto; padding: 0; }

/* ══════════════ Vue-cal overrides (Phase 1 - high contrast) ══════════════ */
:deep(.vuecal__title-bar) { display: none !important; }
:deep(.vuecal__header) {
  background: var(--bg-elevated) !important; color: var(--text-primary) !important;
  border-bottom: 2px solid var(--border) !important;
}
:deep(.vuecal__heading) {
  font-size: 12px !important; font-weight: 700 !important;
  color: var(--text-primary) !important; padding: 6px 0 !important;
  text-transform: uppercase; letter-spacing: 0.5px;
  height: auto !important;
  min-height: 3.4em;
}

/* ── Day heading custom slot (Outlook-like: big number + day name below) ── */
.ag-day-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 4px;
  width: 100%;
  box-sizing: border-box;
  position: relative;
}
.ag-day-head--month { padding: 8px 4px; }
.ag-day-num {
  font-size: 22px;
  font-weight: 400;
  color: var(--text-primary);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-transform: none;
  letter-spacing: -0.01em;
}
.ag-day-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: capitalize;
  letter-spacing: 0;
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
/* Today : numero en accent comme Outlook ("17 Ven" en bleu) */
.ag-day-head--today .ag-day-num {
  color: var(--accent);
  font-weight: 600;
}
.ag-day-head--today .ag-day-name {
  color: var(--accent);
  font-weight: 600;
}
/* Trait coloré sous le nom du jour courant */
.ag-day-head--today::after {
  content: '';
  position: absolute;
  left: 30%; right: 30%;
  bottom: 2px;
  height: 2px;
  background: var(--accent);
  border-radius: 2px;
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
 * Week/day view : tres legere coloration de la colonne ; le highlight principal
 * est porte par le heading (ag-day-head--today).
 * Month view : tint plus marque (sinon le jour n'est pas reperable). */
:deep(.vuecal__cell--today) {
  background: rgba(var(--accent-rgb), 0.05) !important;
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
/* Weekend shading for better visual rhythm */
:deep(.vuecal__cell--has-splits.vuecal__cell--day-6),
:deep(.vuecal__cell--has-splits.vuecal__cell--day-7),
:deep(.vuecal__flex.weekday-label:nth-child(6)),
:deep(.vuecal__flex.weekday-label:nth-child(7)) {
  background: var(--bg-elevated) !important;
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
  color: var(--text-muted) !important;
  font-size: 10.5px !important; font-weight: 500 !important;
  text-align: right; padding-right: 6px;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
/* Demi-heures : tres discretes (presque invisibles) */
:deep(.vuecal__time-cell-line) {
  border-top: 1px dashed var(--border) !important;
  opacity: 0.25;
}
/* Heures pleines : ligne pleine mais legere */
:deep(.vuecal__time-cell-line.hours::before) {
  border-top: 1px solid var(--border) !important;
  opacity: 0.4;
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
  color: #ef4444 !important;
  border-color: #ef4444 !important;
  border-width: 2px !important;
}
:deep(.vuecal__now-line::before) {
  background: #ef4444 !important;
  width: 10px; height: 10px;
  box-shadow: 0 0 0 3px rgba(239,68,68,0.2);
}

/* ══════════════ Events (larger, higher contrast) ══════════════ */
:deep(.vuecal__event) {
  border-radius: 6px !important;
  padding: 4px 8px !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  cursor: pointer;
  margin: 2px 3px !important;
  transition: transform 0.12s, box-shadow 0.12s, filter 0.12s;
  line-height: 1.35 !important;
  min-height: 22px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
  /* Force higher contrast : darken text on light backgrounds */
  -webkit-font-smoothing: antialiased;
}
:deep(.vuecal__event:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  filter: brightness(1.05);
  z-index: 5;
}
:deep(.vuecal__event-title) {
  font-weight: 700 !important;
  text-shadow: 0 1px 0 rgba(255,255,255,0.15);
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
  font-size: 9.5px;
  font-weight: 500;
  opacity: 0.75;
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
  text-transform: uppercase;
  letter-spacing: 0.3px;
  width: 3em !important;
}
:deep(.vuecal__event--all-day) {
  min-height: 20px !important;
  height: 20px !important;
  border-radius: 3px !important;
  margin: 1px 2px !important;
  padding: 2px 8px !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  line-height: 1.3 !important;
  box-shadow: none !important;
  display: flex;
  align-items: center;
  transition: filter 0.12s;
}
:deep(.vuecal__event--all-day:hover) {
  filter: brightness(1.08);
  transform: none !important;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15) !important;
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

/* Status indicators (more visible) */
:deep(.ag-event--submitted) { opacity: 0.55; text-decoration: line-through; }
:deep(.ag-event--submitted::after) {
  content: '✓'; position: absolute; right: 6px; top: 2px;
  font-size: 11px; color: #22c55e; font-weight: 800;
  text-shadow: 0 1px 0 rgba(0,0,0,0.2);
}
:deep(.ag-event--late) {
  animation: ag-pulse-late 2s infinite;
}
:deep(.ag-event--late::after) {
  content: '⚠'; position: absolute; right: 6px; top: 2px;
  font-size: 11px; color: #ef4444; font-weight: 800;
}
@keyframes ag-pulse-late {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
  50% { box-shadow: 0 0 0 4px rgba(239,68,68,0); }
}

/* ── Detail panel ── */
.agenda-detail {
  position: absolute; right: 0; top: 0; bottom: 0; width: 320px;
  background: var(--bg-main); border-left: 1px solid var(--border);
  padding: 20px; display: flex; flex-direction: column; gap: 12px;
  overflow-y: auto; box-shadow: -4px 0 16px rgba(0,0,0,0.15); z-index: 10;
}
.agenda-detail-head { display: flex; align-items: center; gap: 8px; }
.agenda-detail-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.agenda-detail-type { font-size: 11px; font-weight: 700; color: var(--text-muted); flex: 1; }
.agenda-detail-close {
  background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 4px;
}
.agenda-detail-close:hover { background: var(--bg-hover); color: var(--text-primary); }
.agenda-detail-title { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.3; }
.agenda-detail-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); }
.agenda-detail-promo-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }

/* Status badge */
.agenda-detail-status {
  display: flex; align-items: center; gap: 6px; padding: 6px 10px;
  border-radius: 6px; font-size: 12px; font-weight: 600;
}
.status--submitted { background: rgba(34,197,94,0.12); color: #22c55e; }
.status--late { background: rgba(239,68,68,0.12); color: #ef4444; }
.status--pending { background: rgba(59,130,246,0.12); color: #3b82f6; }
.status--upcoming { background: var(--bg-hover); color: var(--text-muted); }
.agenda-detail-progress { margin-left: auto; font-weight: 500; opacity: 0.8; }

/* Form */
.ag-form { display: flex; flex-direction: column; gap: 12px; }
.ag-form-row { display: flex; gap: 8px; }
.ag-label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 600; color: var(--text-muted); }
.ag-input {
  padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border);
  background: var(--bg-elevated); color: var(--text-primary); font-size: 13px;
  font-family: var(--font); outline: none; transition: border-color 0.15s;
}
.ag-input:focus { border-color: var(--accent); }
.ag-textarea { resize: vertical; min-height: 56px; }
.ag-form-actions { display: flex; gap: 8px; }

/* Buttons */
.ag-btn {
  display: inline-flex; align-items: center; gap: 5px; padding: 7px 14px;
  border-radius: 6px; border: 1px solid var(--border); font-size: 12px;
  font-weight: 600; font-family: inherit; cursor: pointer; transition: all 0.12s;
}
.ag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ag-btn--accent { background: var(--accent); color: white; border-color: var(--accent); }
.ag-btn--accent:hover:not(:disabled) { opacity: 0.9; }
.ag-btn--ghost { background: transparent; color: var(--text-secondary); border-color: transparent; }
.ag-btn--ghost:hover:not(:disabled) { background: var(--bg-hover); }
.ag-btn--danger { background: rgba(239,68,68,0.1); color: #ef4444; border-color: transparent; margin-top: 8px; }
.ag-btn--danger:hover { background: rgba(239,68,68,0.2); }
.ag-btn--teams {
  background: #6264a7; color: #fff; border-color: #6264a7; margin-top: 4px;
  text-decoration: none;
}
.ag-btn--teams:hover { background: #4e5199; border-color: #4e5199; }
.ag-check-label {
  flex-direction: row !important; align-items: center; gap: 6px;
  background: rgba(98, 100, 167, 0.08); padding: 8px 10px; border-radius: 6px;
  color: var(--text-primary); cursor: pointer;
  font-size: 12px !important; font-weight: 500 !important;
}
.ag-check-label input { accent-color: #6264a7; }
.ag-icon-pin, .ag-icon-org { font-size: 12px; }

.ag-spin { animation: ag-spin 1s linear infinite; }
@keyframes ag-spin { to { transform: rotate(360deg); } }

.detail-slide-enter-active, .detail-slide-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.detail-slide-enter-from, .detail-slide-leave-to { transform: translateX(20px); opacity: 0; }

/* ══════════════ Mobile responsive (Phase 5) ══════════════ */
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
