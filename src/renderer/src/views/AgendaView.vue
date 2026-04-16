/** AgendaView — calendrier complet v2.111.
 *  8 features : vue jour, statut rendu, mini-cal interactif, resume semaine,
 *  numeros de semaine, couleurs par categorie, drag-to-reschedule, notes perso. */
<script setup lang="ts">
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'
import AgendaDayNotes from '@/components/agenda/AgendaDayNotes.vue'
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VueCal from 'vue-cal'
import 'vue-cal/dist/vuecal.css'
import { Plus, Trash2, RefreshCw, X, Clock, Tag, ExternalLink, ChevronLeft, ChevronRight, Check, AlertCircle, Download, Filter } from 'lucide-vue-next'
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

const filteredEvents = computed(() =>
  agenda.events.filter(e => {
    if (e.eventType === 'deadline'   && !showDeadlines.value)  return false
    if (e.eventType === 'start_date' && !showStartDates.value) return false
    if (e.eventType === 'reminder'   && !showReminders.value)  return false
    if (e.promoId && hiddenPromos.value.has(e.promoId))        return false
    return true
  }).map(e => ({
    start: e.start,
    end:   e.end,
    title: e.title,
    class: statusClass(e),
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
const showForm   = ref(false)
const formDate   = ref('')
const formTitle  = ref('')
const formDesc   = ref('')
const saving     = ref(false)

async function submitReminder() {
  if (!formDate.value || !formTitle.value.trim()) return
  saving.value = true
  try {
    await agenda.createReminder({ promo_tag: null, date: formDate.value, title: formTitle.value.trim(), description: formDesc.value.trim(), bloc: null })
    formDate.value = ''; formTitle.value = ''; formDesc.value = ''; showForm.value = false
  } finally { saving.value = false }
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
    const summary = meta.title.replace(/[,;\\]/g, ' ')
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
      `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
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
}

onMounted(() => {
  load()
  if (route.query.action === 'new-reminder' && isTeacher.value) showForm.value = true
  // P0.3 : deep-link depuis sidebar mini-cal
  if (typeof route.query.date === 'string') {
    selectedDate.value = route.query.date
    activeView.value = 'day'
  }
  cleanupListener = window.api.onAssignmentNew?.(() => { load() }) ?? null
})
onBeforeUnmount(() => { cleanupListener?.() })
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
        <button type="button" class="ag-today-btn" @click="goToday">Aujourd'hui</button>
        <div class="ag-nav-arrows">
          <button type="button" class="ag-nav-btn" @click="goPrev"><ChevronLeft :size="16" /></button>
          <button type="button" class="ag-nav-btn" @click="goNext"><ChevronRight :size="16" /></button>
        </div>
        <h1 class="ag-current-title">{{ currentTitle || 'Calendrier' }}</h1>
      </div>
      <div class="agenda-toolbar-right">
        <div class="ag-view-switch">
          <button type="button" class="ag-view-btn" :class="{ active: activeView === 'month' }" @click="switchView('month')">Mois</button>
          <button type="button" class="ag-view-btn" :class="{ active: activeView === 'week' }" @click="switchView('week')">Semaine</button>
          <button type="button" class="ag-view-btn" :class="{ active: activeView === 'day' }" @click="switchView('day')">Jour</button>
        </div>
        <button class="ag-btn ag-btn--ghost" title="Filtres" :class="{ 'ag-btn--active': showFilters }" @click="showFilters = !showFilters">
          <Filter :size="14" />
        </button>
        <button class="ag-btn ag-btn--ghost" title="Exporter en ICS (Outlook, Google Calendar)" @click="exportIcs">
          <Download :size="14" />
        </button>
        <button v-if="isTeacher" class="ag-btn ag-btn--accent" @click="showForm = !showForm">
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
        <span class="ag-filter-count">{{ filteredEvents.length }} evenement{{ filteredEvents.length > 1 ? 's' : '' }}</span>
      </div>
    </Transition>

    <div class="agenda-body">
      <div class="agenda-cal-wrap">
        <VueCal
          ref="calRef"
          :active-view="activeView"
          :selected-date="selectedDate"
          :locale="locale"
          :events="filteredEvents"
          :time="false"
          :disable-views="['years', 'year']"
          :editable-events="isTeacher ? { drag: true } : false"
          hide-title-bar
          show-week-numbers
          class="vuecal--dark"
          @view-change="onViewChange"
          @event-click="onEventClick"
          @cell-click="onCellClick"
          @event-drop="onEventDrop"
        />
      </div>

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
            <label class="ag-label">Date<input v-model="formDate" type="date" class="ag-input" /></label>
            <label class="ag-label">Titre<input v-model="formTitle" type="text" class="ag-input" placeholder="Ex: Soutenance finale..." /></label>
            <label class="ag-label">Description<textarea v-model="formDesc" class="ag-input ag-textarea" rows="3" placeholder="Details..." /></label>
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

/* Vue-cal overrides */
:deep(.vuecal__title-bar) { display: none !important; }
:deep(.vuecal__header) {
  background: var(--bg-main) !important; color: var(--text-primary) !important;
  border-bottom: 1px solid var(--border) !important;
}
:deep(.vuecal__heading) {
  font-size: 11px !important; font-weight: 600 !important; color: var(--text-muted) !important;
  padding: 8px 0 !important;
}
:deep(.vuecal__cell) {
  background: var(--bg-main) !important; border-color: var(--border) !important; min-height: 90px;
  cursor: pointer;
}
:deep(.vuecal__cell:hover) { background: var(--bg-hover) !important; }
:deep(.vuecal__cell-date) {
  font-size: 12px !important; font-weight: 500 !important; color: var(--text-secondary) !important; padding: 6px 8px !important;
}
:deep(.vuecal__cell--today) { background: rgba(var(--accent-rgb), 0.04) !important; }
:deep(.vuecal__cell--today .vuecal__cell-date) { color: var(--accent) !important; font-weight: 700 !important; }
:deep(.vuecal__cell--out-of-scope .vuecal__cell-date) { opacity: 0.3 !important; }
:deep(.vuecal__cell--selected) { background: rgba(var(--accent-rgb), 0.08) !important; }
/* Week numbers */
:deep(.vuecal__week-number) {
  font-size: 10px !important; font-weight: 600 !important; color: var(--text-muted) !important;
  opacity: 0.6; padding: 6px 4px !important;
}

/* Events with dynamic colors */
:deep(.vuecal__event) {
  border-radius: 4px; padding: 2px 6px; font-size: 11px; font-weight: 600;
  cursor: pointer; margin: 1px 2px; transition: transform 0.1s, box-shadow 0.1s;
}
:deep(.vuecal__event:hover) { transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.15); }

/* Status indicators on events */
:deep(.ag-event--submitted) { opacity: 0.6; }
:deep(.ag-event--submitted::after) {
  content: '✓'; position: absolute; right: 4px; top: 1px;
  font-size: 9px; color: #22c55e; font-weight: 700;
}
:deep(.ag-event--late::after) {
  content: '!'; position: absolute; right: 4px; top: 1px;
  font-size: 9px; color: #ef4444; font-weight: 700;
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

.ag-spin { animation: ag-spin 1s linear infinite; }
@keyframes ag-spin { to { transform: rotate(360deg); } }

.detail-slide-enter-active, .detail-slide-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.detail-slide-enter-from, .detail-slide-leave-to { transform: translateX(20px); opacity: 0; }
</style>
