/**
 * TeacherReminders.vue
 * ---------------------------------------------------------------------------
 * Weekly reminders checklist section of the teacher dashboard.
 */
<script setup lang="ts">
import { CheckCircle2 } from 'lucide-vue-next'
import type { Reminder } from '@/composables/useDashboardTeacher'

defineProps<{
  thisWeekReminders: (Reminder & { isOverdue: boolean; isToday: boolean })[]
  doneThisWeek: number
  totalThisWeek: number
}>()

const emit = defineEmits<{
  toggleReminder: [id: number, done: boolean]
}>()
</script>

<template>
  <div class="db-week">
    <div class="db-week-header">
      <h4 class="db-week-title"><CheckCircle2 :size="14" /> À faire cette semaine</h4>
      <span v-if="thisWeekReminders.length" class="db-week-progress">{{ doneThisWeek }}/{{ totalThisWeek }}</span>
    </div>
    <div v-if="!thisWeekReminders.length" class="db-week-empty">
      <CheckCircle2 :size="20" style="color: var(--color-success)" />
      <span>Tout est à jour cette semaine !</span>
    </div>
    <div v-else class="db-week-list">
      <div
        v-for="r in thisWeekReminders"
        :key="r.id"
        class="db-week-item"
        :class="{ done: r.done, overdue: r.isOverdue, today: r.isToday }"
        @click="emit('toggleReminder', r.id, !r.done)"
      >
        <div class="db-week-check">
          <CheckCircle2 v-if="r.done" :size="15" style="color:var(--color-success)" />
          <div v-else class="db-week-circle" :class="{ 'db-week-circle--overdue': r.isOverdue }" />
        </div>
        <div class="db-week-body">
          <span class="db-week-item-title" :class="{ 'line-through': r.done }">{{ r.title }}</span>
          <span class="db-week-meta">
            <span class="db-week-promo">{{ r.promo_tag }}</span>
            <span v-if="r.isOverdue" class="db-week-late">En retard</span>
            <span v-else-if="r.isToday" class="db-week-today-tag">Aujourd'hui</span>
            <span v-else class="db-week-date">{{ new Date(r.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }) }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.db-week { margin-bottom: 16px; }
.db-week-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.db-week-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--text-primary); }
.db-week-progress {
  font-size: 12px; font-weight: 600; color: var(--text-muted);
  background: rgba(255,255,255,.05); padding: 2px 8px; border-radius: 10px;
}
.db-week-list { display: flex; flex-direction: column; gap: 2px; }
.db-week-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: background var(--t-fast);
}
.db-week-item:hover { background: rgba(255,255,255,.04); }
.db-week-item.done { opacity: .45; }
.db-week-item.overdue:not(.done) { background: rgba(239,68,68,.06); }
.db-week-item.today:not(.done) { background: rgba(74,144,217,.06); }
.db-week-check { flex-shrink: 0; }
.db-week-circle {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid var(--border-input); transition: border-color var(--t-fast);
}
.db-week-item:hover .db-week-circle { border-color: var(--accent); }
.db-week-circle--overdue { border-color: var(--color-danger); }
.db-week-body { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
.db-week-item-title { font-size: 13px; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.line-through { text-decoration: line-through; opacity: .6; }
.db-week-meta { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.db-week-promo {
  font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px;
  background: rgba(74,144,217,.1); color: var(--accent); text-transform: uppercase;
}
.db-week-late { font-size: 10px; font-weight: 700; color: var(--color-danger); }
.db-week-today-tag { font-size: 10px; font-weight: 600; color: var(--accent); }
.db-week-date { font-size: 11px; color: var(--text-muted); }
.db-week-empty {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px; font-size: 13px; color: var(--color-success);
  background: rgba(34,197,94,.06); border-radius: 8px; font-weight: 600;
}
</style>
