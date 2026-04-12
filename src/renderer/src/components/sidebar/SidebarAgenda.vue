<script setup lang="ts">
/**
 * Sidebar Agenda v2.111 — mini-cal interactif + resume semaine + categories dynamiques.
 */
import { ref, computed } from 'vue'
import { ChevronLeft, ChevronRight, Download, ExternalLink, AlertCircle, Clock } from 'lucide-vue-next'
import { useAgendaStore } from '@/stores/agenda'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { countdown } from '@/utils/date'

const agenda = useAgendaStore()
const appStore = useAppStore()
const { showToast } = useToast()

const emit = defineEmits<{
  (e: 'select-date', date: string): void
  (e: 'new-reminder'): void
}>()

// ── Mini calendar ─────────────────────────────────────────────────────
const today = new Date()
const currentMonth = ref(today.getMonth())
const currentYear = ref(today.getFullYear())

const monthLabel = computed(() => {
  return new Date(currentYear.value, currentMonth.value)
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
})

const dayNames = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']

interface CalDay {
  date: number; month: number; year: number
  isToday: boolean; isCurrentMonth: boolean; eventCount: number
  dateStr: string; key: string
}

const calendarDays = computed<CalDay[]>(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month, 1)
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const days: CalDay[] = []

  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthDays - i
    const m = month === 0 ? 11 : month - 1
    const y = month === 0 ? year - 1 : year
    const ds = makeDateStr(y, m, d)
    days.push({ date: d, month: m, year: y, isToday: ds === todayStr, isCurrentMonth: false, eventCount: countEventsForDate(ds), dateStr: ds, key: ds })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = makeDateStr(year, month, d)
    days.push({ date: d, month, year, isToday: ds === todayStr, isCurrentMonth: true, eventCount: countEventsForDate(ds), dateStr: ds, key: ds })
  }
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const m = month === 11 ? 0 : month + 1
    const y = month === 11 ? year + 1 : year
    const ds = makeDateStr(y, m, d)
    days.push({ date: d, month: m, year: y, isToday: false, isCurrentMonth: false, eventCount: countEventsForDate(ds), dateStr: ds, key: ds })
  }
  return days
})

function makeDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function countEventsForDate(dateStr: string): number {
  return agenda.events.filter((e) => e.start === dateStr).length
}

function prevMonth() { if (currentMonth.value === 0) { currentMonth.value = 11; currentYear.value-- } else currentMonth.value-- }
function nextMonth() { if (currentMonth.value === 11) { currentMonth.value = 0; currentYear.value++ } else currentMonth.value++ }
function goToday() { currentMonth.value = today.getMonth(); currentYear.value = today.getFullYear() }

// P0.3 : clic sur un jour → emit pour naviguer
function selectDay(d: CalDay) {
  emit('select-date', d.dateStr)
}

// ── Resume "Cette semaine" (P1.1) ─────────────────────────────────────
const thisWeekDeadlines = computed(() => {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const start = monday.toISOString().slice(0, 10)
  const end = sunday.toISOString().slice(0, 10)
  return agenda.events.filter((e) => e.eventType === 'deadline' && e.start >= start && e.start <= end)
})

const thisWeekSubmitted = computed(() => thisWeekDeadlines.value.filter((e) => e.submissionStatus === 'submitted').length)
const thisWeekTotal = computed(() => thisWeekDeadlines.value.length)

const nextDeadline = computed(() => {
  const now = new Date().toISOString().slice(0, 10)
  return agenda.events.find((e) => e.eventType === 'deadline' && e.start >= now && e.submissionStatus !== 'submitted') ?? null
})

// ── Promos toggleables (style Outlook) ────────────────────────────────
const hiddenPromos = ref(new Set<number>())
const showReminders = ref(true)

function togglePromo(promoId: number) {
  const next = new Set(hiddenPromos.value)
  if (next.has(promoId)) next.delete(promoId)
  else next.add(promoId)
  hiddenPromos.value = next
}

defineExpose({ hiddenPromos, showReminders })

// ── Sync ──────────────────────────────────────────────────────────────
function copyIcalUrl() {
  try {
    const url = window.api.getCalendarFeedUrl()
    navigator.clipboard.writeText(url)
    showToast('URL iCal copiee — colle-la dans Outlook', 'success')
  } catch { showToast('Impossible de copier', 'error') }
}
</script>

<template>
  <div class="sb-agenda">
    <!-- Resume semaine (P1.1) -->
    <div v-if="thisWeekTotal > 0 || nextDeadline" class="sb-week-summary">
      <div class="sb-week-header">Cette semaine</div>
      <div v-if="thisWeekTotal > 0" class="sb-week-stats">
        <div class="sb-week-progress-wrap">
          <div class="sb-week-progress-bar">
            <div class="sb-week-progress-fill" :style="{ width: `${thisWeekTotal ? (thisWeekSubmitted / thisWeekTotal) * 100 : 0}%` }" />
          </div>
          <span class="sb-week-progress-label">{{ thisWeekSubmitted }}/{{ thisWeekTotal }} rendus</span>
        </div>
      </div>
      <div v-if="nextDeadline" class="sb-week-next">
        <AlertCircle :size="11" />
        <span>{{ nextDeadline.title }}</span>
        <span class="sb-week-countdown">{{ countdown(nextDeadline.start) }}</span>
      </div>
    </div>

    <!-- Mini calendar -->
    <div class="sb-agenda-cal">
      <div class="sb-cal-header">
        <button type="button" class="sb-cal-nav" @click="prevMonth"><ChevronLeft :size="14" /></button>
        <button type="button" class="sb-cal-month" @click="goToday">{{ monthLabel }}</button>
        <button type="button" class="sb-cal-nav" @click="nextMonth"><ChevronRight :size="14" /></button>
      </div>
      <div class="sb-cal-grid">
        <div v-for="day in dayNames" :key="day" class="sb-cal-day-name">{{ day }}</div>
        <button
          v-for="d in calendarDays"
          :key="d.key"
          type="button"
          class="sb-cal-day"
          :class="{ 'is-today': d.isToday, 'is-other': !d.isCurrentMonth, 'has-events': d.eventCount > 0 }"
          @click="selectDay(d)"
        >
          <span class="sb-cal-day-num">{{ d.date }}</span>
          <span v-if="d.eventCount > 0" class="sb-cal-day-dot" />
        </button>
      </div>
    </div>

    <!-- Mes calendriers = promos (style Outlook) -->
    <div v-if="agenda.promos.length > 0" class="sb-agenda-section">
      <h3 class="sb-section-title">Mes calendriers</h3>
      <label v-for="p in agenda.promos" :key="p.id" class="sb-cal-toggle">
        <input type="checkbox" :checked="!hiddenPromos.has(p.id)" @change="togglePromo(p.id)" />
        <span class="sb-cal-dot" :style="{ background: p.color }" />
        <span class="sb-cal-name">{{ p.name }}</span>
      </label>
      <!-- Rappels (toujours vert, pas lie a une promo) -->
      <label class="sb-cal-toggle">
        <input type="checkbox" :checked="showReminders" @change="showReminders = !showReminders" />
        <span class="sb-cal-dot" style="background: #22c55e" />
        <span class="sb-cal-name">Rappels</span>
      </label>
    </div>

    <!-- Sync Outlook -->
    <div class="sb-agenda-section">
      <h3 class="sb-section-title">Synchronisation</h3>
      <button type="button" class="sb-sync-btn" @click="copyIcalUrl">
        <ExternalLink :size="11" /> Copier l'URL iCal
      </button>
      <p class="sb-sync-hint">Outlook &gt; Ajouter un calendrier &gt; A partir d'Internet</p>
    </div>
  </div>
</template>

<style scoped>
.sb-agenda { display: flex; flex-direction: column; gap: 10px; padding: 8px 10px; overflow-y: auto; flex: 1; }

/* Week summary */
.sb-week-summary {
  background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; padding: 10px;
}
.sb-week-header { font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 6px; }
.sb-week-stats { margin-bottom: 6px; }
.sb-week-progress-wrap { display: flex; align-items: center; gap: 8px; }
.sb-week-progress-bar { flex: 1; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
.sb-week-progress-fill { height: 100%; background: var(--accent); border-radius: 2px; transition: width 0.3s; }
.sb-week-progress-label { font-size: 10px; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
.sb-week-next {
  display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-secondary);
}
.sb-week-next svg { color: #f97316; flex-shrink: 0; }
.sb-week-next span:nth-child(2) { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.sb-week-countdown { font-weight: 700; color: #f97316; white-space: nowrap; }

/* Mini Calendar */
.sb-agenda-cal { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; padding: 10px; }
.sb-cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.sb-cal-nav {
  display: flex; align-items: center; justify-content: center; width: 24px; height: 24px;
  border-radius: 4px; border: none; background: transparent; color: var(--text-muted); cursor: pointer;
}
.sb-cal-nav:hover { background: var(--bg-hover); color: var(--text-primary); }
.sb-cal-month {
  font-size: 12px; font-weight: 700; color: var(--text-primary); background: none;
  border: none; cursor: pointer; padding: 2px 6px; border-radius: 4px; text-transform: capitalize;
}
.sb-cal-month:hover { background: var(--bg-hover); }

.sb-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; }
.sb-cal-day-name { font-size: 9px; font-weight: 600; color: var(--text-muted); text-align: center; padding: 2px 0 3px; }
.sb-cal-day {
  display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 2px 0;
  border-radius: 4px; border: none; background: transparent; cursor: pointer;
  transition: background 0.1s;
}
.sb-cal-day:hover { background: var(--bg-hover); }
.sb-cal-day.is-other { opacity: 0.25; }
.sb-cal-day.is-today .sb-cal-day-num {
  background: var(--accent); color: white; border-radius: 50%;
  width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;
}
.sb-cal-day-num { font-size: 10px; font-weight: 500; color: var(--text-secondary); }
.sb-cal-day-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--accent); }

/* Sections */
.sb-agenda-section { padding: 0 2px; }
.sb-section-title { font-size: 11px; font-weight: 700; color: var(--text-muted); margin: 0 0 4px; }

/* Calendar toggles (promos style Outlook) */
.sb-cal-toggle {
  display: flex; align-items: center; gap: 6px; padding: 4px 3px;
  border-radius: 4px; cursor: pointer; transition: background 0.1s;
}
.sb-cal-toggle:hover { background: var(--bg-hover); }
.sb-cal-toggle input { width: 12px; height: 12px; cursor: pointer; }
.sb-cal-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.sb-cal-toggle input:not(:checked) ~ .sb-cal-dot { opacity: 0.2; }
.sb-cal-name { font-size: 11px; font-weight: 500; color: var(--text-primary); }
.sb-cal-toggle input:not(:checked) ~ .sb-cal-name { color: var(--text-muted); text-decoration: line-through; }

/* Sync */
.sb-sync-btn {
  display: flex; align-items: center; gap: 5px; width: 100%; padding: 5px 6px;
  border-radius: 4px; border: none; background: transparent; color: var(--text-secondary);
  font-size: 11px; font-weight: 500; font-family: inherit; cursor: pointer; text-align: left;
}
.sb-sync-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.sb-sync-hint { font-size: 9px; color: var(--text-muted); margin: 2px 0 0; padding: 0 4px; opacity: 0.6; line-height: 1.3; }
</style>
