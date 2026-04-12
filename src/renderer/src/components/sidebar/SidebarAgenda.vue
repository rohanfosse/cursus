<script setup lang="ts">
/**
 * Sidebar Agenda — inspire d'Outlook : mini calendrier + prochains evenements.
 * Remplace la sidebar channels par defaut quand route.name === 'agenda'.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Plus } from 'lucide-vue-next'
import { useAgendaStore } from '@/stores/agenda'
import { useAppStore } from '@/stores/app'
import type { CalendarEvent } from '@/types'

const agenda = useAgendaStore()
const appStore = useAppStore()
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
  // Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const days: CalDay[] = []

  // Previous month trailing days
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthDays - i
    const m = month === 0 ? 11 : month - 1
    const y = month === 0 ? year - 1 : year
    days.push({ date: d, month: m, year: y, isToday: false, isCurrentMonth: false, eventCount: countEvents(y, m, d), key: `${y}-${m}-${d}` })
  }

  // Current month
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = `${year}-${month}-${d}` === todayStr
    days.push({ date: d, month, year, isToday, isCurrentMonth: true, eventCount: countEvents(year, month, d), key: `${year}-${month}-${d}` })
  }

  // Next month leading days (fill to 42 = 6 rows)
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
  return agenda.events.filter((e) => e.start.startsWith(dateStr)).length
}

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function goToday() {
  currentMonth.value = today.getMonth()
  currentYear.value = today.getFullYear()
}

// ── Upcoming events ───────────────────────────────────────────────────
const upcomingEvents = computed<CalendarEvent[]>(() => {
  const now = new Date().toISOString().slice(0, 10)
  return [...agenda.events]
    .filter((e) => e.start >= now)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 10)
})

function formatEventDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function eventTypeLabel(type: string): string {
  if (type === 'deadline') return 'Echeance'
  if (type === 'start_date') return 'Demarrage'
  return 'Rappel'
}

// ── Emit ──────────────────────────────────────────────────────────────
const emit = defineEmits<{
  (e: 'new-reminder'): void
}>()
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

    <!-- New reminder button (teacher) -->
    <button
      v-if="isTeacher"
      type="button"
      class="sb-agenda-new-btn"
      @click="emit('new-reminder')"
    >
      <Plus :size="13" />
      Nouveau rappel
    </button>

    <!-- Upcoming events -->
    <div class="sb-agenda-upcoming">
      <h3 class="sb-agenda-section-title">A venir</h3>
      <div v-if="upcomingEvents.length === 0" class="sb-agenda-empty">
        Aucun evenement a venir
      </div>
      <div
        v-for="ev in upcomingEvents"
        :key="ev.id"
        class="sb-agenda-event"
      >
        <div class="sb-agenda-event-bar" :class="`sb-agenda-event-bar--${ev.color}`" />
        <div class="sb-agenda-event-body">
          <span class="sb-agenda-event-title">{{ ev.title }}</span>
          <span class="sb-agenda-event-meta">
            <Clock :size="10" />
            {{ formatEventDate(ev.start) }}
            <span class="sb-agenda-event-type">{{ eventTypeLabel(ev.eventType) }}</span>
          </span>
        </div>
      </div>
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
  position: relative;
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

/* New reminder button */
.sb-agenda-new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s ease;
}
.sb-agenda-new-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(var(--accent-rgb), 0.06);
}

/* Section title */
.sb-agenda-section-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  margin: 4px 0 0;
  padding: 0 2px;
}

/* Empty state */
.sb-agenda-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px 2px;
}

/* Event items */
.sb-agenda-event {
  display: flex;
  gap: 8px;
  padding: 8px 6px;
  border-radius: 6px;
  transition: background 0.1s ease;
}
.sb-agenda-event:hover { background: var(--bg-hover); }
.sb-agenda-event-bar {
  width: 3px;
  border-radius: 2px;
  flex-shrink: 0;
  align-self: stretch;
}
.sb-agenda-event-bar--blue { background: #3b82f6; }
.sb-agenda-event-bar--orange { background: #f97316; }
.sb-agenda-event-bar--green { background: #22c55e; }

.sb-agenda-event-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.sb-agenda-event-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sb-agenda-event-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-muted);
}
.sb-agenda-event-type {
  margin-left: auto;
  font-weight: 600;
  opacity: 0.7;
}
</style>
