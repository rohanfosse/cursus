/**
 * BookingCalendarView.vue
 * Grille semaine des rendez-vous pour le dashboard enseignant.
 * Affiche les blocs colores par type d'evenement avec navigation semaine.
 */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { Booking, EventType } from '@/composables/useBooking'

const props = defineProps<{
  bookings: Booking[]
  eventTypes: EventType[]
}>()

const weekOffset = ref(0)

const weekStart = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay() + 1 + weekOffset.value * 7)
  d.setHours(0, 0, 0, 0)
  return d
})

const days = computed(() => {
  const result: { date: Date; label: string; iso: string }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.value)
    d.setDate(weekStart.value.getDate() + i)
    result.push({
      date: d,
      label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
      iso: d.toISOString().slice(0, 10),
    })
  }
  return result
})

const weekLabel = computed(() => {
  const start = days.value[0]?.date
  const end = days.value[6]?.date
  if (!start || !end) return ''
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${start.toLocaleDateString('fr-FR', opts)} - ${end.toLocaleDateString('fr-FR', opts)}`
})

const isThisWeek = computed(() => weekOffset.value === 0)

// Hours displayed (8h-20h)
const hours = Array.from({ length: 13 }, (_, i) => i + 8)

// Map bookings to day columns
const bookingsByDay = computed(() => {
  const map: Record<string, Booking[]> = {}
  for (const d of days.value) map[d.iso] = []
  for (const bk of props.bookings) {
    if (bk.date && map[bk.date]) {
      map[bk.date].push(bk)
    }
  }
  return map
})

// Color for a booking based on its event type
function bookingColor(bk: Booking): string {
  const et = props.eventTypes.find(e => e.title === bk.event_type_title)
  return et?.color || '#6366f1'
}

// Position a booking block within the day column
function blockStyle(bk: Booking): Record<string, string> {
  const [sh, sm] = (bk.start_time || '09:00').split(':').map(Number)
  const [eh, em] = (bk.end_time || '10:00').split(':').map(Number)
  const startMin = sh * 60 + sm - 8 * 60 // offset from 8h
  const endMin = eh * 60 + em - 8 * 60
  const top = Math.max(0, (startMin / (13 * 60)) * 100)
  const height = Math.max(2, ((endMin - startMin) / (13 * 60)) * 100)
  return {
    top: `${top}%`,
    height: `${height}%`,
    background: bookingColor(bk),
  }
}

// Current time indicator position
const nowPosition = computed(() => {
  if (!isThisWeek.value) return null
  const now = new Date()
  const min = now.getHours() * 60 + now.getMinutes() - 8 * 60
  if (min < 0 || min > 13 * 60) return null
  return (min / (13 * 60)) * 100
})

const todayIso = new Date().toISOString().slice(0, 10)
</script>

<template>
  <div class="bcv">
    <!-- Week nav -->
    <div class="bcv-nav">
      <button class="bcv-nav-btn" aria-label="Semaine precedente" @click="weekOffset--">
        <ChevronLeft :size="14" />
      </button>
      <span class="bcv-week-label">{{ weekLabel }}</span>
      <button class="bcv-nav-btn" aria-label="Semaine suivante" @click="weekOffset++">
        <ChevronRight :size="14" />
      </button>
      <button v-if="!isThisWeek" class="bcv-today-btn" @click="weekOffset = 0">Aujourd'hui</button>
    </div>

    <!-- Grid -->
    <div class="bcv-grid">
      <!-- Hour labels -->
      <div class="bcv-hours">
        <div v-for="h in hours" :key="h" class="bcv-hour">{{ String(h).padStart(2, '0') }}h</div>
      </div>

      <!-- Day columns -->
      <div
        v-for="d in days" :key="d.iso"
        class="bcv-day"
        :class="{ 'bcv-day--today': d.iso === todayIso }"
      >
        <div class="bcv-day-header">{{ d.label }}</div>
        <div class="bcv-day-body">
          <!-- Hour lines -->
          <div v-for="h in hours" :key="h" class="bcv-hour-line" :style="{ top: `${((h - 8) / 13) * 100}%` }" />

          <!-- Now indicator -->
          <div v-if="nowPosition !== null && d.iso === todayIso" class="bcv-now" :style="{ top: `${nowPosition}%` }" />

          <!-- Booking blocks -->
          <div
            v-for="bk in bookingsByDay[d.iso] || []"
            :key="bk.id"
            class="bcv-block"
            :style="blockStyle(bk)"
            :title="`${bk.start_time}-${bk.end_time} ${bk.tutor_name || ''} (${bk.event_type_title || ''})`"
          >
            <span class="bcv-block-time">{{ (bk.start_time || '').slice(0, 5) }}</span>
            <span class="bcv-block-name">{{ bk.tutor_name || bk.student_name || '' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bcv { display: flex; flex-direction: column; gap: 8px; }

.bcv-nav { display: flex; align-items: center; gap: 6px; }
.bcv-nav-btn {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 4px; border: none;
  background: var(--bg-main); color: var(--text-muted); cursor: pointer;
  transition: all 0.12s;
}
.bcv-nav-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.bcv-week-label { font-size: 12px; font-weight: 600; color: var(--text-primary); min-width: 120px; text-align: center; }
.bcv-today-btn {
  font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px;
  background: var(--accent); color: #fff; border: none; cursor: pointer; margin-left: auto;
}

.bcv-grid { display: flex; gap: 0; overflow: hidden; border-radius: 6px; border: 1px solid var(--border); min-height: 300px; overflow-x: auto; }

.bcv-hours {
  display: flex; flex-direction: column; width: 36px; flex-shrink: 0;
  padding-top: 28px; /* offset for day header */
}
.bcv-hour {
  height: calc(100% / 13); min-height: 22px;
  font-size: 9px; color: var(--text-muted); text-align: right; padding-right: 4px;
  display: flex; align-items: flex-start; justify-content: flex-end;
}

.bcv-day { flex: 1; min-width: 0; border-left: 1px solid var(--border); display: flex; flex-direction: column; }
.bcv-day--today { background: rgba(99, 102, 241, 0.04); }
.bcv-day-header {
  font-size: 10px; font-weight: 600; text-align: center; padding: 6px 2px;
  color: var(--text-secondary); border-bottom: 1px solid var(--border);
  text-transform: capitalize;
}
.bcv-day--today .bcv-day-header { color: var(--accent); font-weight: 700; }
.bcv-day-body { position: relative; flex: 1; min-height: 260px; }

.bcv-hour-line {
  position: absolute; left: 0; right: 0; height: 0;
  border-top: 1px solid var(--border); opacity: 0.5;
}

.bcv-now {
  position: absolute; left: 0; right: 0; height: 2px;
  background: #ef4444; z-index: 2;
}
.bcv-now::before {
  content: ''; position: absolute; left: -3px; top: -3px;
  width: 8px; height: 8px; border-radius: 50%; background: #ef4444;
}

.bcv-block {
  position: absolute; left: 2px; right: 2px; border-radius: 4px;
  padding: 2px 4px; overflow: hidden; z-index: 1;
  color: #fff; font-size: 9px; line-height: 1.3;
  cursor: default; transition: opacity 0.12s;
  display: flex; flex-direction: column; gap: 0;
}
.bcv-block:hover { opacity: 0.85; }
.bcv-block-time { font-weight: 700; }
.bcv-block-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
