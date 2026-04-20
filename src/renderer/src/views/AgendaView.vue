/** AgendaView — calendrier complet v2.111.
 *  8 features : vue jour, statut rendu, mini-cal interactif, resume semaine,
 *  numeros de semaine, couleurs par categorie, drag-to-reschedule, notes perso. */
<script setup lang="ts">
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'
import AgendaDayNotes from '@/components/agenda/AgendaDayNotes.vue'
import AgendaTimeGrid from '@/components/agenda/AgendaTimeGrid.vue'
import AgendaMonthGrid from '@/components/agenda/AgendaMonthGrid.vue'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, Trash2, RefreshCw, X, Clock, Tag, ExternalLink, ChevronLeft, ChevronRight, Check, AlertCircle, Download, Filter, Copy, Edit3, Calendar as CalIcon, Video, MapPin, User } from 'lucide-vue-next'
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
import { getISOWeekNumber } from '@/utils/date'
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
const { activeView, currentTitle, selectedDate, goPrev, goNext, goToday, switchView } = useAgendaViewNav()

// ── Day view hero : résumé du jour sélectionné ───────────────────────────
const dayHero = computed(() => {
  if (activeView.value !== 'day') return null
  const d = new Date(selectedDate.value)
  if (isNaN(d.getTime())) return null
  const iso = selectedDate.value

  // Comptage single-pass : total + deadlines + teams en un seul parcours
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
    isToday: iso === new Date().toISOString().slice(0, 10),
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

// ── Selected event ────────────────────────────────────────────────────────
const selectedEvent = ref<CalendarEvent | null>(null)
const detailOpen = ref(false)
const detailRef = ref<HTMLElement | null>(null)
useFocusTrap(detailRef, detailOpen)

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
const { confirm } = useConfirm()

function fmtFrDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── Wrappers grille custom (AgendaTimeGrid + AgendaMonthGrid) ──────────
type GridEvent = { _meta: CalendarEvent; start: string; end: string; allDay: boolean; draggable: boolean }

function onGridCellClick(date: Date) { onCellClick(date) }
function onGridCellDblClick(date: Date) { onCellDblClick(date) }
function onGridEventClick(ev: GridEvent) { selectedEvent.value = ev._meta ?? null; detailOpen.value = true }
function onGridEventContextMenu(e: MouseEvent, ev: GridEvent) { onEventContextMenu(e, { _meta: ev._meta }) }
function onGridCellContextMenu(e: MouseEvent, date: Date) { onCellContextMenu(e, date) }

async function onGridEventDrop(ev: GridEvent, newDate: Date) {
  const meta = ev._meta
  if (!meta || !meta.draggable) return
  if (meta.eventType === 'deadline' && !isTeacher.value) return

  if (meta.eventType === 'deadline') {
    const suffix = meta.depotsCount && meta.depotsCount > 0
      ? ` (${meta.depotsCount} depot${meta.depotsCount > 1 ? 's' : ''} deja soumis)`
      : ''
    const ok = await confirm(
      `Deplacer "${meta.title}" au ${fmtFrDate(newDate)} ?${suffix}`,
      'warning',
      'Deplacer',
    )
    if (!ok) return
  }

  // Pour les rappels timed : garder l'heure du drop, sinon date pure
  const iso = meta.allDay || ev.allDay
    ? newDate.toISOString().slice(0, 10)
    : `${newDate.toISOString().slice(0, 10)} ${String(newDate.getHours()).padStart(2, '0')}:${String(newDate.getMinutes()).padStart(2, '0')}`
  const success = await agenda.updateEventDate(meta.id, iso)
  if (!success) return

  const label = meta.eventType === 'deadline' ? 'Echeance' : 'Rappel'
  showToast(`${label} deplace${meta.eventType === 'deadline' ? 'e' : ''} au ${fmtFrDate(newDate)}.`, 'success')
}

// ── Export ICS (iCalendar) ───────────────────────────────────────────────
const { exportIcs: exportIcsRaw } = useAgendaIcsExport()
function exportIcs() { exportIcsRaw(filteredEvents.value) }

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
        <button class="ag-btn ag-btn--ghost" title="Filtres" :aria-label="showFilters ? 'Masquer les filtres' : 'Afficher les filtres'" :aria-expanded="showFilters" :class="{ 'ag-btn--active': showFilters }" @click="showFilters = !showFilters">
          <Filter :size="14" aria-hidden="true" />
        </button>
        <button class="ag-btn ag-btn--ghost" title="Exporter en ICS (Outlook, Google Calendar)" aria-label="Exporter le calendrier en ICS" @click="exportIcs">
          <Download :size="14" aria-hidden="true" />
        </button>
        <button v-if="isTeacher" class="ag-btn ag-btn--accent" @click="showForm = !showForm" title="Nouveau rappel (N)" aria-label="Créer un nouveau rappel">
          <Plus :size="14" aria-hidden="true" /> Rappel
        </button>
        <button class="ag-btn ag-btn--ghost" :disabled="agenda.loading" @click="load" :aria-label="agenda.loading ? 'Rafraîchissement en cours' : 'Rafraîchir le calendrier'" :aria-busy="agenda.loading" title="Rafraîchir">
          <RefreshCw :size="14" :class="{ 'ag-spin': agenda.loading }" aria-hidden="true" />
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
      <div class="agenda-cal-wrap" :class="`agenda-cal-wrap--${activeView}`">
        <!-- Skeleton overlay : affiche pendant le premier load (pas de spam pendant refresh) -->
        <div v-if="agenda.loading && !filteredEvents.length" class="ag-skeleton" aria-hidden="true">
          <div v-for="i in 12" :key="i" class="ag-skel-event" :style="{
            gridColumn: ((i * 3) % 7) + 1,
            gridRow: Math.floor(i / 3) + 1,
            width: (50 + (i * 13) % 40) + '%',
          }" />
        </div>
        <!-- Vue Mois : grille custom -->
        <AgendaMonthGrid
          v-if="activeView === 'month'"
          :selected-date="selectedDate"
          :events="filteredEvents"
          :is-teacher="isTeacher"
          @cell-click="onGridCellClick"
          @cell-dblclick="onGridCellDblClick"
          @event-click="onGridEventClick"
          @event-contextmenu="onGridEventContextMenu"
          @cell-contextmenu="onGridCellContextMenu"
          @event-drop="onGridEventDrop"
        />

        <!-- Vues Jour & Semaine : grille horaire custom -->
        <AgendaTimeGrid
          v-else
          :view="activeView"
          :selected-date="selectedDate"
          :events="filteredEvents"
          :is-teacher="isTeacher"
          @cell-click="onGridCellClick"
          @cell-dblclick="onGridCellDblClick"
          @event-click="onGridEventClick"
          @event-contextmenu="onGridEventContextMenu"
          @cell-contextmenu="onGridCellContextMenu"
          @event-drop="onGridEventDrop"
        />
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
  padding: 12px 20px; background: var(--bg-main); border-bottom: 1px solid var(--border);
  flex-shrink: 0; min-height: 56px;
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

/* ── Body ── */
.agenda-body { flex: 1; display: flex; overflow: hidden; position: relative; }
.agenda-cal-wrap { flex: 1; overflow: auto; padding: 0; }


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

/* ══════════════ Day view hero banner ══════════════ */
.ag-day-hero {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  padding: 16px 24px 12px;
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
  font-size: 24px; font-weight: 500; color: var(--text-primary);
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
/* ══════════════ Reduced motion (a11y) ══════════════
 * Respecte prefers-reduced-motion : désactive toute animation décorative.
 */
@media (prefers-reduced-motion: reduce) {
  .ag-sync-dot--live { animation: none !important; }
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
}

/* Keyboard shortcut hints */
.ag-today-btn[title]::after,
.ag-view-btn[title]::after { content: ''; } /* rely on native tooltip */
</style>
