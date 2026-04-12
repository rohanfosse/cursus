/** AgendaView — calendrier agrégé : échéances travaux + rappels enseignant.
 *  v2.108 : redesign UX inspire Outlook. La sidebar interne est deplacee
 *  dans SidebarAgenda (mini-cal + upcoming). Le main area prend toute la
 *  largeur avec un calendrier plus spacieux et un panneau de detail. */
<script setup lang="ts">
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import VueCal from 'vue-cal'
import 'vue-cal/dist/vuecal.css'
import { Calendar, Plus, Trash2, RefreshCw, X, Clock, Tag, ExternalLink } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAppStore }   from '@/stores/app'
import { useAgendaStore } from '@/stores/agenda'
import type { CalendarEvent } from '@/types'

const appStore  = useAppStore()
const agenda    = useAgendaStore()
const route     = useRoute()
const router    = useRouter()

const promoId   = computed(() => appStore.activePromoId ?? appStore.currentUser?.promo_id ?? 0)
const isTeacher = computed(() => appStore.isTeacher)

// ── Filters ───────────────────────────────────────────────────────────────
const showDeadlines  = ref(true)
const showStartDates = ref(true)
const showReminders  = ref(true)

const filteredEvents = computed(() =>
  agenda.events.filter(e => {
    if (e.eventType === 'deadline'   && !showDeadlines.value)  return false
    if (e.eventType === 'start_date' && !showStartDates.value) return false
    if (e.eventType === 'reminder'   && !showReminders.value)  return false
    return true
  }).map(e => ({
    start: e.start,
    end:   e.end,
    title: e.title,
    class: `event-${e.color}`,
    _meta: e,
  }))
)

// ── Selected event ────────────────────────────────────────────────────────
const selectedEvent = ref<CalendarEvent | null>(null)
const detailOpen = ref(false)

function onEventClick(event: { _meta?: CalendarEvent }) {
  selectedEvent.value = event._meta ?? null
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  selectedEvent.value = null
}

// ── New reminder form (teacher) ───────────────────────────────────────────
const showForm   = ref(false)
const formDate   = ref('')
const formTitle  = ref('')
const formDesc   = ref('')
const saving     = ref(false)

async function submitReminder() {
  if (!formDate.value || !formTitle.value.trim()) return
  saving.value = true
  try {
    await agenda.createReminder({
      promo_tag:   null,
      date:        formDate.value,
      title:       formTitle.value.trim(),
      description: formDesc.value.trim(),
      bloc:        null,
    })
    formDate.value  = ''
    formTitle.value = ''
    formDesc.value  = ''
    showForm.value  = false
  } finally {
    saving.value = false
  }
}

async function removeReminder(id: number) {
  await agenda.deleteReminder(id)
  if (selectedEvent.value?.sourceId === id) closeDetail()
}

// ── Locale config (vue-cal) ───────────────────────────────────────────────
const locale = {
  months: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
  weekDays: ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'],
  today: "Aujourd'hui",
  allDay: 'Journée',
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function eventTypeLabel(type: string): string {
  if (type === 'deadline') return 'Echeance'
  if (type === 'start_date') return 'Demarrage'
  return 'Rappel'
}

// ── Load ──────────────────────────────────────────────────────────────────
async function load() {
  if (promoId.value) {
    await agenda.fetchEvents(promoId.value)
  }
}

// Real-time : refresh quand un nouveau devoir est publie
let cleanupAssignmentListener: (() => void) | null = null

onMounted(() => {
  load()
  if (route.query.action === 'new-reminder' && isTeacher.value) {
    showForm.value = true
  }
  cleanupAssignmentListener = window.api.onAssignmentNew?.(() => { load() }) ?? null
})
onBeforeUnmount(() => {
  cleanupAssignmentListener?.()
})
watch(() => promoId.value, load)
watch(() => route.query.action, (action) => {
  if (action === 'new-reminder' && isTeacher.value) showForm.value = true
})
</script>

<template>
  <ErrorBoundary label="Agenda">
  <div class="agenda-area">

    <!-- Header -->
    <UiPageHeader class="agenda-header">
      <template #title>
        <div class="agenda-header-left">
          <Calendar :size="18" />
          <span class="agenda-title">Calendrier</span>
        </div>
      </template>
      <template #actions>
        <button v-if="isTeacher" class="ag-btn ag-btn--accent" @click="showForm = !showForm">
          <Plus :size="13" /> Rappel
        </button>
        <button class="ag-btn ag-btn--ghost" :disabled="agenda.loading" @click="load">
          <RefreshCw :size="13" :class="{ 'ag-spin': agenda.loading }" />
        </button>
      </template>
    </UiPageHeader>

    <div class="agenda-body">
      <!-- Calendar -->
      <div class="agenda-cal-wrap">
        <VueCal
          default-view="month"
          :locale="locale"
          :events="filteredEvents"
          :time="false"
          :disable-views="['years', 'year', 'day']"
          today-button
          class="vuecal--dark"
          @event-click="onEventClick"
        />
      </div>

      <!-- Detail panel (slide in from right) -->
      <Transition name="detail-slide">
        <aside v-if="detailOpen && selectedEvent" class="agenda-detail">
          <header class="agenda-detail-head">
            <div class="agenda-detail-dot" :class="`ag-dot--${selectedEvent.color}`" />
            <span class="agenda-detail-type">{{ eventTypeLabel(selectedEvent.eventType) }}</span>
            <button type="button" class="agenda-detail-close" @click="closeDetail">
              <X :size="14" />
            </button>
          </header>
          <h2 class="agenda-detail-title">{{ selectedEvent.title }}</h2>
          <div class="agenda-detail-meta">
            <Clock :size="12" />
            <span>{{ formatFullDate(selectedEvent.start) }}</span>
          </div>
          <div v-if="selectedEvent.category" class="agenda-detail-meta">
            <Tag :size="12" />
            <span>{{ selectedEvent.category }}</span>
          </div>
          <button
            v-if="selectedEvent.eventType === 'deadline' || selectedEvent.eventType === 'start_date'"
            class="ag-btn ag-btn--accent"
            @click="router.push({ name: 'devoirs' }); closeDetail()"
          >
            <ExternalLink :size="12" /> Voir le devoir
          </button>
          <button
            v-if="isTeacher && selectedEvent.eventType === 'reminder'"
            class="ag-btn ag-btn--danger"
            @click="removeReminder(selectedEvent.sourceId)"
          >
            <Trash2 :size="12" /> Supprimer ce rappel
          </button>
        </aside>
      </Transition>

      <!-- New reminder form (teacher, overlay) -->
      <Transition name="detail-slide">
        <aside v-if="showForm && isTeacher" class="agenda-detail agenda-form-panel">
          <header class="agenda-detail-head">
            <Plus :size="14" />
            <span class="agenda-detail-type">Nouveau rappel</span>
            <button type="button" class="agenda-detail-close" @click="showForm = false">
              <X :size="14" />
            </button>
          </header>
          <div class="ag-form">
            <label class="ag-label">Date
              <input v-model="formDate" type="date" class="ag-input" />
            </label>
            <label class="ag-label">Titre
              <input v-model="formTitle" type="text" class="ag-input" placeholder="Ex: Soutenance finale..." />
            </label>
            <label class="ag-label">Description
              <textarea v-model="formDesc" class="ag-input ag-textarea" rows="3" placeholder="Details optionnels..." />
            </label>
            <div class="ag-form-actions">
              <button class="ag-btn ag-btn--accent" :disabled="!formDate || !formTitle.trim() || saving" @click="submitReminder">
                {{ saving ? 'Enregistrement...' : 'Ajouter' }}
              </button>
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
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-main);
}

/* Header */
.agenda-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}
.agenda-title { font-size: 16px; font-weight: 700; }

.ag-dot--blue   { background: #3b82f6; }
.ag-dot--orange { background: #f97316; }
.ag-dot--green  { background: #22c55e; }

/* Body */
.agenda-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.agenda-cal-wrap {
  flex: 1;
  overflow: auto;
  padding: 16px 24px;
}

/* Vue-cal dark theme */
:deep(.event-blue) {
  background: rgba(59, 130, 246, 0.15) !important;
  border-left: 3px solid #3b82f6 !important;
  color: #93c5fd !important;
}
:deep(.event-orange) {
  background: rgba(249, 115, 22, 0.15) !important;
  border-left: 3px solid #f97316 !important;
  color: #fdba74 !important;
}
:deep(.event-green) {
  background: rgba(34, 197, 94, 0.15) !important;
  border-left: 3px solid #22c55e !important;
  color: #86efac !important;
}
:deep(.vuecal__header) { background: var(--bg-elevated) !important; color: var(--text-primary) !important; }
:deep(.vuecal__cell) { background: var(--bg-elevated) !important; border-color: var(--border) !important; }
:deep(.vuecal__cell--today .vuecal__cell-date) { color: var(--accent) !important; font-weight: 700; }
:deep(.vuecal__title-bar) { background: var(--bg-elevated) !important; color: var(--text-primary) !important; }
:deep(.vuecal__event) {
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.1s ease;
}
:deep(.vuecal__event:hover) { transform: scale(1.02); }

/* Detail panel */
.agenda-detail {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 320px;
  background: var(--bg-main);
  border-left: 1px solid var(--border);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.15);
  z-index: 10;
}
.agenda-detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.agenda-detail-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.agenda-detail-type {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  flex: 1;
}
.agenda-detail-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.agenda-detail-close:hover { background: var(--bg-hover); color: var(--text-primary); }
.agenda-detail-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.3;
}
.agenda-detail-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

/* Form */
.ag-form { display: flex; flex-direction: column; gap: 12px; }
.ag-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}
.ag-input {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font);
  outline: none;
  transition: border-color 0.15s;
}
.ag-input:focus { border-color: var(--accent); }
.ag-textarea { resize: vertical; min-height: 56px; }
.ag-form-actions { display: flex; gap: 8px; }

/* Buttons */
.ag-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: 6px;
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s ease;
}
.ag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ag-btn--accent {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}
.ag-btn--accent:hover:not(:disabled) { opacity: 0.9; }
.ag-btn--ghost {
  background: transparent;
  color: var(--text-secondary);
  border-color: transparent;
}
.ag-btn--ghost:hover:not(:disabled) { background: var(--bg-hover); }
.ag-btn--danger {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: transparent;
  margin-top: 8px;
}
.ag-btn--danger:hover { background: rgba(239, 68, 68, 0.2); }

.ag-spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Detail slide transition */
.detail-slide-enter-active,
.detail-slide-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.detail-slide-enter-from,
.detail-slide-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>
