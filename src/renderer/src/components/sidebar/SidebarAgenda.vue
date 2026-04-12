<script setup lang="ts">
/**
 * Sidebar Agenda — inspire d'Outlook : mini calendrier + calendriers
 * toggleables + export iCal. v2.108.
 */
import { ref, computed, onMounted } from 'vue'
import { Calendar, ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-vue-next'
import { useAgendaStore } from '@/stores/agenda'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'

const agenda = useAgendaStore()
const appStore = useAppStore()
const { showToast } = useToast()
const isTeacher = computed(() => appStore.isTeacher)

// ── Mini calendar ─────────────────────────────────────────────────────
const today = new Date()
const currentMonth = ref(today.getMonth())
const currentYear = ref(today.getFullYear())

const monthLabel = computed(() => {
  const d = new Date(currentYear.value, currentMonth.value)
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
})

const dayNames = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']

interface CalDay {
  date: number
  month: number
  year: number
  isToday: boolean
  isCurrentMonth: boolean
  eventCount: number
  key: string
}

const calendarDays = computed<CalDay[]>(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month, 1)
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const days: CalDay[] = []
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`

  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthDays - i
    const m = month === 0 ? 11 : month - 1
    const y = month === 0 ? year - 1 : year
    days.push({ date: d, month: m, year: y, isToday: false, isCurrentMonth: false, eventCount: countEvents(y, m, d), key: `${y}-${m}-${d}` })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = `${year}-${month}-${d}` === todayStr
    days.push({ date: d, month, year, isToday, isCurrentMonth: true, eventCount: countEvents(year, month, d), key: `${year}-${month}-${d}` })
  }

  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const m = month === 11 ? 0 : month + 1
    const y = month === 11 ? year + 1 : year
    days.push({ date: d, month: m, year: y, isToday: false, isCurrentMonth: false, eventCount: countEvents(y, m, d), key: `${y}-${m}-${d}` })
  }

  return days
})

function countEvents(year: number, month: number, day: number): number {
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return agenda.events.filter((e) => {
    if (e.eventType === 'deadline' && !showDeadlines.value) return false
    if (e.eventType === 'start_date' && !showStarts.value) return false
    if (e.eventType === 'reminder' && !showReminders.value) return false
    return e.start.startsWith(dateStr)
  }).length
}

function prevMonth() {
  if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value-- }
  else { currentMonth.value-- }
}

function nextMonth() {
  if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value++ }
  else { currentMonth.value++ }
}

function goToday() {
  currentMonth.value = today.getMonth()
  currentYear.value = today.getFullYear()
}

// ── Calendriers toggleables (style Outlook) ───────────────────────────
const showDeadlines = ref(true)
const showStarts = ref(true)
const showReminders = ref(true)

// Expose les filtres pour que AgendaView puisse les lire
defineExpose({ showDeadlines, showStarts, showReminders })

// ── Export iCal ───────────────────────────────────────────────────────
async function exportIcs() {
  try {
    const feedUrl = window.api.getCalendarFeedUrl()
    await navigator.clipboard.writeText(feedUrl)
    showToast('URL du calendrier copiee. Colle-la dans Outlook > Ajouter un calendrier > A partir d\'Internet', 'success')
  } catch {
    showToast('Impossible de copier l\'URL', 'error')
  }
}

function downloadIcs() {
  const feedUrl = window.api.getCalendarFeedUrl()
  window.open(feedUrl, '_blank')
}
</script>

<template>
  <div class="sb-agenda">
    <!-- Mini calendar -->
    <div class="sb-agenda-cal">
      <div class="sb-agenda-cal-header">
        <button type="button" class="sb-agenda-nav" @click="prevMonth">
          <ChevronLeft :size="14" />
        </button>
        <button type="button" class="sb-agenda-month" @click="goToday">
          {{ monthLabel }}
        </button>
        <button type="button" class="sb-agenda-nav" @click="nextMonth">
          <ChevronRight :size="14" />
        </button>
      </div>
      <div class="sb-agenda-cal-grid">
        <div v-for="day in dayNames" :key="day" class="sb-agenda-day-name">{{ day }}</div>
        <div
          v-for="d in calendarDays"
          :key="d.key"
          class="sb-agenda-day"
          :class="{
            'is-today': d.isToday,
            'is-other-month': !d.isCurrentMonth,
            'has-events': d.eventCount > 0,
          }"
        >
          <span class="sb-agenda-day-num">{{ d.date }}</span>
          <span v-if="d.eventCount > 0" class="sb-agenda-day-dot" />
        </div>
      </div>
    </div>

    <!-- Mes calendriers (style Outlook) -->
    <div class="sb-agenda-calendars">
      <h3 class="sb-agenda-section-title">Mes calendriers</h3>
      <label class="sb-agenda-cal-toggle">
        <input v-model="showDeadlines" type="checkbox" class="sb-agenda-cal-check" />
        <span class="sb-agenda-cal-color" style="background: #3b82f6" />
        <span class="sb-agenda-cal-name">Echeances</span>
      </label>
      <label class="sb-agenda-cal-toggle">
        <input v-model="showStarts" type="checkbox" class="sb-agenda-cal-check" />
        <span class="sb-agenda-cal-color" style="background: #f97316" />
        <span class="sb-agenda-cal-name">Demarrages</span>
      </label>
      <label class="sb-agenda-cal-toggle">
        <input v-model="showReminders" type="checkbox" class="sb-agenda-cal-check" />
        <span class="sb-agenda-cal-color" style="background: #22c55e" />
        <span class="sb-agenda-cal-name">Rappels</span>
      </label>
    </div>

    <!-- Synchronisation Outlook -->
    <div class="sb-agenda-sync">
      <h3 class="sb-agenda-section-title">Synchronisation</h3>
      <button type="button" class="sb-agenda-sync-btn" @click="exportIcs" title="Copier l'URL pour Outlook / Google Calendar">
        <ExternalLink :size="12" />
        <span>Copier l'URL iCal</span>
      </button>
      <button type="button" class="sb-agenda-sync-btn" @click="downloadIcs" title="Telecharger le fichier .ics">
        <Download :size="12" />
        <span>Telecharger .ics</span>
      </button>
      <p class="sb-agenda-sync-hint">
        Dans Outlook : Ajouter un calendrier &gt; A partir d'Internet &gt; coller l'URL
      </p>
    </div>
  </div>
</template>

<style scoped>
.sb-agenda {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 10px;
  overflow-y: auto;
  flex: 1;
}

/* Mini Calendar */
.sb-agenda-cal {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
}
.sb-agenda-cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.sb-agenda-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.sb-agenda-nav:hover { background: var(--bg-hover); color: var(--text-primary); }
.sb-agenda-month {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: capitalize;
}
.sb-agenda-month:hover { background: var(--bg-hover); }

.sb-agenda-cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}
.sb-agenda-day-name {
  font-size: 9px;
  font-weight: 600;
  color: var(--text-muted);
  text-align: center;
  padding: 2px 0 4px;
}
.sb-agenda-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 3px 0;
  border-radius: 4px;
  cursor: default;
}
.sb-agenda-day.is-other-month { opacity: 0.3; }
.sb-agenda-day.is-today .sb-agenda-day-num {
  background: var(--accent);
  color: white;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sb-agenda-day.has-events { cursor: pointer; }
.sb-agenda-day.has-events:hover { background: var(--bg-hover); }
.sb-agenda-day-num {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
}
.sb-agenda-day-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent);
}

/* Section title */
.sb-agenda-section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  margin: 0 0 6px;
  padding: 0 2px;
}

/* Calendriers toggleables */
.sb-agenda-calendars {
  padding: 0 2px;
}
.sb-agenda-cal-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 4px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s;
}
.sb-agenda-cal-toggle:hover { background: var(--bg-hover); }
.sb-agenda-cal-check {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: var(--accent);
}
.sb-agenda-cal-color {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}
.sb-agenda-cal-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}
.sb-agenda-cal-check:not(:checked) ~ .sb-agenda-cal-color { opacity: 0.3; }
.sb-agenda-cal-check:not(:checked) ~ .sb-agenda-cal-name { color: var(--text-muted); text-decoration: line-through; }

/* Sync section */
.sb-agenda-sync {
  padding: 0 2px;
}
.sb-agenda-sync-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: all 0.1s;
}
.sb-agenda-sync-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.sb-agenda-sync-hint {
  font-size: 10px;
  color: var(--text-muted);
  margin: 4px 0 0;
  padding: 0 4px;
  line-height: 1.4;
  opacity: 0.7;
}
</style>
