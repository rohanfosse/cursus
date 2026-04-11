/** AgendaView — calendrier agrégé : échéances travaux + rappels enseignant. */
<script setup lang="ts">
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'
import { ref, computed, onMounted, watch } from 'vue'
import VueCal from 'vue-cal'
import 'vue-cal/dist/vuecal.css'
import { Calendar, Plus, Trash2, RefreshCw } from 'lucide-vue-next'
import { useAppStore }   from '@/stores/app'
import { useAgendaStore } from '@/stores/agenda'
import type { CalendarEvent } from '@/types'

const appStore  = useAppStore()
const agenda    = useAgendaStore()

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

function onEventClick(event: any) {
  selectedEvent.value = event._meta ?? null
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
  if (selectedEvent.value?.sourceId === id) selectedEvent.value = null
}

// ── Locale config (vue-cal) ───────────────────────────────────────────────
const locale = {
  months: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
  weekDays: ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'],
  today: "Aujourd'hui",
  allDay: 'Journée',
}

// ── Load ──────────────────────────────────────────────────────────────────
async function load() {
  if (promoId.value) {
    await agenda.fetchEvents(promoId.value)
  }
}

onMounted(load)
watch(() => promoId.value, load)
</script>

<template>
  <ErrorBoundary label="Agenda">
  <div class="agenda-area">

    <!-- Header -->
    <header class="agenda-header">
      <div class="agenda-header-left">
        <Calendar :size="18" />
        <span class="agenda-title">Calendrier</span>
      </div>
      <div class="agenda-header-filters">
        <label class="ag-filter ag-filter--blue">
          <input v-model="showDeadlines" type="checkbox" />
          Échéances
        </label>
        <label class="ag-filter ag-filter--orange">
          <input v-model="showStartDates" type="checkbox" />
          Démarrages
        </label>
        <label class="ag-filter ag-filter--green">
          <input v-model="showReminders" type="checkbox" />
          Rappels
        </label>
      </div>
      <div class="agenda-header-actions">
        <button v-if="isTeacher" class="ag-btn-primary" @click="showForm = !showForm">
          <Plus :size="13" /> Rappel
        </button>
        <button class="ag-btn-ghost" :disabled="agenda.loading" @click="load">
          <RefreshCw :size="13" :class="{ 'ag-spin': agenda.loading }" />
        </button>
      </div>
    </header>

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

      <!-- Sidebar -->
      <aside class="agenda-sidebar">

        <!-- Reminder form (teacher) -->
        <div v-if="showForm && isTeacher" class="ag-form">
          <h3 class="ag-form-title">Nouveau rappel</h3>
          <label class="ag-label">Date
            <input v-model="formDate" type="date" class="ag-input" />
          </label>
          <label class="ag-label">Titre
            <input v-model="formTitle" type="text" class="ag-input" placeholder="Ex: Soutenance finale..." />
          </label>
          <label class="ag-label">Description (optionnel)
            <textarea v-model="formDesc" class="ag-input ag-textarea" rows="2" />
          </label>
          <div class="ag-form-actions">
            <button class="ag-btn-primary" :disabled="!formDate || !formTitle.trim() || saving" @click="submitReminder">
              {{ saving ? 'Enregistrement...' : 'Ajouter' }}
            </button>
            <button class="ag-btn-ghost" @click="showForm = false">Annuler</button>
          </div>
        </div>

        <!-- Selected event detail -->
        <div v-else-if="selectedEvent" class="ag-detail">
          <div class="ag-detail-dot" :class="`ag-dot--${selectedEvent.color}`" />
          <div class="ag-detail-content">
            <p class="ag-detail-type">
              {{ selectedEvent.eventType === 'deadline' ? 'Échéance' : selectedEvent.eventType === 'start_date' ? 'Démarrage' : 'Rappel' }}
            </p>
            <h3 class="ag-detail-title">{{ selectedEvent.title }}</h3>
            <p class="ag-detail-date">{{ new Date(selectedEvent.start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }}</p>
            <p v-if="selectedEvent.category" class="ag-detail-cat">{{ selectedEvent.category }}</p>
            <button
              v-if="isTeacher && selectedEvent.eventType === 'reminder'"
              class="ag-btn-danger"
              @click="removeReminder(selectedEvent.sourceId)"
            >
              <Trash2 :size="12" /> Supprimer
            </button>
          </div>
        </div>

        <!-- List of upcoming reminders -->
        <div v-else class="ag-reminders">
          <h3 class="ag-reminders-title">Rappels à venir</h3>
          <div v-if="agenda.reminders.length === 0" class="ag-reminders-empty">
            Aucun rappel programmé
          </div>
          <div v-for="r in agenda.reminders.slice(0, 8)" :key="r.id" class="ag-reminder-row">
            <div class="ag-reminder-date">{{ new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) }}</div>
            <div class="ag-reminder-info">
              <span class="ag-reminder-title">{{ r.title }}</span>
              <span v-if="r.description" class="ag-reminder-desc">{{ r.description }}</span>
            </div>
            <button v-if="isTeacher" class="ag-icon-btn" @click="removeReminder(r.id)">
              <Trash2 :size="12" />
            </button>
          </div>
        </div>
      </aside>
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

/* ── Header ── */
.agenda-header {
  min-height: var(--header-height, 52px);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: 0 var(--space-xl);
  background: var(--bg-main);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--elevation-2);
  flex-wrap: wrap;
  z-index: 10;
}
.agenda-header-left {
  display: flex; align-items: center; gap: 8px;
  color: var(--text-primary); font-size: 16px; font-weight: 700;
}
.agenda-title { font-size: 16px; font-weight: 700; }
.agenda-header-filters {
  display: flex; gap: 12px; flex: 1;
}
.agenda-header-actions { display: flex; gap: 8px; }

/* ── Filters ── */
.ag-filter {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; cursor: pointer;
  color: var(--text-secondary);
}
.ag-filter input[type="checkbox"] { cursor: pointer; }
.ag-filter--blue  input { accent-color: #3b82f6; }
.ag-filter--orange input { accent-color: #f97316; }
.ag-filter--green  input { accent-color: #22c55e; }

/* ── Body ── */
.agenda-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 280px;
  overflow: hidden;
  gap: 0;
}
@media (max-width: 800px) {
  .agenda-body { grid-template-columns: 1fr; }
  .agenda-sidebar { display: none; }
}

/* ── Calendar wrap ── */
.agenda-cal-wrap {
  flex: 1;
  overflow: auto;
  padding: 16px 20px;
}

/* vue-cal custom colors */
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

/* Dark theme overrides for vue-cal */
:deep(.vuecal__header) { background: var(--bg-elevated) !important; color: var(--text-primary) !important; }
:deep(.vuecal__cell)   { background: var(--bg-elevated) !important; border-color: var(--border) !important; }
:deep(.vuecal__cell--today .vuecal__cell-date) { color: var(--accent, #0d9488) !important; font-weight: 700; }
:deep(.vuecal__title-bar) { background: var(--bg-elevated) !important; color: var(--text-primary) !important; }
:deep(.vuecal__event) { border-radius: 4px; padding: 2px 6px; font-size: 11px; font-weight: 600; cursor: pointer; }

/* ── Sidebar ── */
.agenda-sidebar {
  width: 280px;
  border-left: 1px solid var(--border);
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Reminder form ── */
.ag-form { display: flex; flex-direction: column; gap: 10px; }
.ag-form-title { font-size: 14px; font-weight: 700; color: var(--text-primary); margin: 0; }
.ag-label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .3px; }
.ag-input {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 13px; font-family: var(--font);
  outline: none; transition: border-color .15s;
}
.ag-input:focus { border-color: var(--accent, #0d9488); }
.ag-textarea { resize: vertical; min-height: 56px; }
.ag-form-actions { display: flex; gap: 8px; }

/* ── Detail ── */
.ag-detail { display: flex; gap: 12px; align-items: flex-start; }
.ag-detail-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
.ag-dot--blue   { background: #3b82f6; }
.ag-dot--orange { background: #f97316; }
.ag-dot--green  { background: #22c55e; }
.ag-detail-content { flex: 1; }
.ag-detail-type { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--text-muted); margin: 0; }
.ag-detail-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 4px 0; }
.ag-detail-date { font-size: 12px; color: var(--text-secondary); margin: 0 0 8px; }
.ag-detail-cat { font-size: 11px; color: var(--text-muted); margin: 0 0 8px; }

/* ── Reminders list ── */
.ag-reminders-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--text-muted); margin: 0 0 8px; }
.ag-reminders-empty { font-size: 13px; color: var(--text-muted); }
.ag-reminder-row { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.ag-reminder-date { font-size: 11px; font-weight: 700; color: #22c55e; min-width: 40px; text-align: center; }
.ag-reminder-info { flex: 1; min-width: 0; }
.ag-reminder-title { display: block; font-size: 12px; font-weight: 600; color: var(--text-primary); }
.ag-reminder-desc { display: block; font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ag-icon-btn { background: transparent; border: none; cursor: pointer; color: var(--text-muted); padding: 2px; transition: color .15s; }
.ag-icon-btn:hover { color: #ef4444; }

/* ── Buttons ── */
.ag-btn-primary {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 8px 14px; border-radius: 7px; border: none;
  background: var(--accent, #0d9488); color: #fff;
  font-size: 12px; font-weight: 600; cursor: pointer;
  font-family: var(--font); transition: background .15s;
}
.ag-btn-primary:hover:not(:disabled) { background: #14b8a6; }
.ag-btn-primary:disabled { opacity: .4; cursor: not-allowed; }
.ag-btn-ghost {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 12px; border-radius: 7px;
  border: 1px solid var(--border);
  background: transparent; color: var(--text-secondary);
  font-size: 12px; font-weight: 600; cursor: pointer;
  font-family: var(--font); transition: all .15s;
}
.ag-btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary); }
.ag-btn-danger {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 7px; border: none;
  background: rgba(239,68,68,.12); color: #ef4444;
  font-size: 12px; font-weight: 600; cursor: pointer;
  font-family: var(--font); transition: background .15s; margin-top: 4px;
}
.ag-btn-danger:hover { background: rgba(239,68,68,.22); }
.ag-spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
