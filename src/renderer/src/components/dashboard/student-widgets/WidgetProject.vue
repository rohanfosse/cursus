/**
 * WidgetProject.vue - Carte du projet actif avec progression MicroRing.
 */
<script setup lang="ts">
import { FolderOpen, ChevronRight, Clock } from 'lucide-vue-next'
import { deadlineLabel } from '@/utils/date'
import type { StudentProjectCard } from '@/composables/useDashboardStudent'
import MicroRing from '@/components/ui/MicroRing.vue'
import CountdownArc from '@/components/ui/CountdownArc.vue'

const props = defineProps<{
  project: StudentProjectCard | null
}>()

const emit = defineEmits<{
  goToProject: [key: string]
}>()
</script>

<template>
  <div v-if="project" class="dashboard-card sa-card sa-project" role="button" tabindex="0" aria-label="Voir le projet en cours" @click="emit('goToProject', project.key)" @keydown.enter="emit('goToProject', project.key)">
    <div class="sa-card-header">
      <FolderOpen :size="14" class="sa-card-icon" />
      <span class="sa-section-label">Projet en cours</span>
      <ChevronRight :size="13" class="sa-chevron" />
    </div>
    <h3 class="sa-project-name">{{ project.label }}</h3>
    <div class="sa-project-meta">
      <MicroRing :value="project.submitted" :total="project.total" :size="22" />
      <span class="sa-mono">{{ project.submitted }}/{{ project.total }} rendus</span>
      <span v-if="project.overdue" class="sa-badge sa-badge--danger">{{ project.overdue }} en retard</span>
    </div>
    <div v-if="project.nextDeadline" class="sa-project-deadline">
      <CountdownArc :deadline="project.nextDeadline" :size="20" />
      <Clock :size="12" />
      <span>Prochaine échéance : <strong class="sa-mono">{{ deadlineLabel(project.nextDeadline) }}</strong></span>
    </div>
  </div>
</template>

<style scoped>
/* Base card: .dashboard-card from dashboard-shared.css + .sa-card from devoirs-shared.css */
.sa-mono { font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace; font-size: 12px; }
.sa-project { cursor: pointer; }
.sa-project-name {
  font-size: 16px; font-weight: 800; color: var(--text-primary);
  margin-bottom: 8px; line-height: 1.2;
}
.sa-project-meta {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 8px; font-size: 13px; color: var(--text-secondary);
}
.sa-project-deadline {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; color: var(--text-muted);
}
.sa-badge {
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
}
.sa-badge--danger { background: rgba(231,76,60,.12); color: var(--color-danger); }
</style>
