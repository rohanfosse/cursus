/**
 * StudentProjects.vue
 * Project cards grid for the student dashboard "Mes projets" tab,
 * with progress bars and deadline indicators.
 */
<script setup lang="ts">
import { FolderOpen, Clock, CheckCircle2 } from 'lucide-vue-next'
import { deadlineClass, deadlineLabel } from '@/utils/date'
import type { StudentProjectCard } from '@/composables/useDashboardStudent'

defineProps<{
  studentProjectCards: StudentProjectCard[]
}>()

const emit = defineEmits<{
  goToProject: [key: string]
  navigateDevoirs: []
}>()
</script>

<template>
  <div class="db-tab-content">
    <div v-if="!studentProjectCards.length" class="db-empty-hint">
      <FolderOpen :size="36" style="opacity:.2;margin-bottom:10px" />
      <p>Aucun projet pour l'instant.</p>
      <button class="btn-ghost" style="margin-top:8px;font-size:13px" @click="emit('navigateDevoirs')">Voir mes devoirs</button>
    </div>
    <div v-else class="db-project-grid db-student-grid">
      <div
        v-for="p in studentProjectCards"
        :key="p.key"
        class="db-project-card db-student-card"
        @click="emit('goToProject', p.key)"
      >
        <div class="db-project-icon">
          <component :is="p.icon" v-if="p.icon" :size="18" />
          <FolderOpen v-else :size="18" />
        </div>
        <div class="db-project-info">
          <span class="db-project-name">
            {{ p.label }}
            <span v-if="p.pending > 0" class="project-status-badge project-status--active">En cours</span>
            <span v-else class="project-status-badge project-status--done"><CheckCircle2 :size="9" /> Termine</span>
          </span>
          <span v-if="p.nextDeadline" class="db-project-next db-project-next--header" :class="deadlineClass(p.nextDeadline)">
            <Clock :size="9" /> {{ deadlineLabel(p.nextDeadline) }}
          </span>
          <span class="db-project-stats">
            {{ p.submitted }}/{{ p.total }} rendus · {{ p.graded }} notes
            <template v-if="p.overdue"> · <span style="color:var(--color-danger)">{{ p.overdue }} en retard</span></template>
          </span>
        </div>
        <div class="db-student-bar">
          <div
            class="db-student-fill"
            :style="{ width: (p.total ? Math.round(p.submitted / p.total * 100) : 0) + '%' }"
            :class="{ 'fill-done': p.submitted === p.total && p.total > 0, 'fill-overdue': p.overdue > 0 }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.db-tab-content { display: flex; flex-direction: column; gap: 0; }

.db-empty-hint {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 60px 20px; color: var(--text-muted); font-size: 13px; text-align: center; gap: 6px;
}
.db-empty-hint :deep(svg) { opacity: .3; }

.db-project-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px; padding-top: 14px;
}
.db-project-card {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; border: 1px solid var(--border);
  border-radius: var(--radius); background: var(--bg-sidebar);
  cursor: pointer; transition: background var(--t-fast), border-color var(--t-fast), box-shadow var(--t-fast);
}
.db-project-card:hover {
  background: rgba(74,144,217,.07); border-color: rgba(74,144,217,.3);
  box-shadow: 0 2px 12px rgba(0,0,0,.15);
}
.db-project-icon {
  flex-shrink: 0; width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 8px; background: var(--accent-subtle); color: var(--accent-light);
}
.db-project-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.db-project-name  { font-size: 13.5px; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-project-stats { font-size: 11px; color: var(--text-muted); }
.db-project-next  { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 600; }
.db-project-next.deadline-ok       { color: var(--color-success); }
.db-project-next.deadline-warning  { color: #F39C12; }
.db-project-next.deadline-soon     { color: var(--color-warning); }
.db-project-next.deadline-critical,
.db-project-next.deadline-passed   { color: var(--color-danger); }

.db-student-grid .db-student-card {
  flex-direction: column; align-items: flex-start; padding-bottom: 10px; gap: 6px;
}
.db-student-bar {
  width: 100%; height: 3px; border-radius: 2px;
  background: rgba(255,255,255,.06); overflow: hidden;
}
.db-student-fill {
  height: 100%; border-radius: 2px; background: var(--color-cctl); transition: width .3s ease;
}
.db-student-fill.fill-done { background: var(--color-success); }
.db-student-fill.fill-overdue { background: var(--color-danger); }

.project-status-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  padding: 1px 6px; border-radius: 4px; vertical-align: middle; margin-left: 6px;
}
.project-status--active { background: rgba(39,174,96,.15); color: var(--color-success); }
.project-status--done { background: rgba(255,255,255,.08); color: var(--text-muted); }
.db-project-next--header { margin-top: -1px; }
</style>
