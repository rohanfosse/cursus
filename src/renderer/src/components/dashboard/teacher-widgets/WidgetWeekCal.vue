/**
 * WidgetWeekCal.vue - Vue semaine avec les événements (deadlines, soutenances, rappels).
 */
<script setup lang="ts">
import { computed } from 'vue'
import { CalendarDays } from 'lucide-vue-next'
import type { AgendaItem } from '@/composables/useDashboardWidgets'

const props = defineProps<{ items: AgendaItem[] }>()

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

const weekDays = computed(() => {
  const today = new Date()
  const days: { label: string; date: string; isToday: boolean; items: AgendaItem[] }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    days.push({
      label: i === 0 ? "Auj." : JOURS[d.getDay()],
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      isToday: i === 0,
      items: props.items.filter(it => {
        const itDate = new Date(it.date ?? it.deadline ?? '').toISOString().slice(0, 10)
        return itDate === dateStr
      }),
    })
  }
  return days
})
</script>

<template>
  <div class="sa-card-header">
    <CalendarDays :size="14" class="sa-card-icon" />
    <span class="sa-section-label">Semaine</span>
  </div>
  <div class="wwc-grid">
    <div
      v-for="day in weekDays"
      :key="day.date"
      class="wwc-day"
      :class="{ 'wwc-day--today': day.isToday, 'wwc-day--has-items': day.items.length > 0 }"
    >
      <span class="wwc-day-label">{{ day.label }}</span>
      <span class="wwc-day-date">{{ day.date }}</span>
      <div v-if="day.items.length" class="wwc-dots">
        <span
          v-for="(it, i) in day.items.slice(0, 3)"
          :key="i"
          class="wwc-dot"
          :class="{
            'wwc-dot--deadline': it.type === 'deadline',
            'wwc-dot--soutenance': it.type === 'soutenance',
            'wwc-dot--reminder': it.type === 'reminder',
          }"
          :title="it.title"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.wwc-grid {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;
}
.wwc-day {
  display: flex; flex-direction: column; align-items: center;
  gap: 2px; padding: 6px 2px; border-radius: 8px;
  transition: background .15s;
}
.wwc-day--today {
  background: var(--accent-subtle);
  border: 1px solid rgba(74,144,217,.2);
}
.wwc-day--has-items:not(.wwc-day--today) {
  background: rgba(255,255,255,.03);
}
.wwc-day-label {
  font-size: 10px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .03em;
}
.wwc-day--today .wwc-day-label { color: var(--accent-light); }
.wwc-day-date {
  font-size: 11px; font-weight: 600; color: var(--text-secondary);
  font-family: 'JetBrains Mono', monospace;
}
.wwc-dots { display: flex; gap: 3px; margin-top: 2px; }
.wwc-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent);
}
.wwc-dot--deadline { background: #e74c3c; }
.wwc-dot--soutenance { background: #9b59b6; }
.wwc-dot--reminder { background: #f39c12; }
</style>
