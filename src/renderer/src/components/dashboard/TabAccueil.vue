/**
 * TabAccueil.vue
 * ---------------------------------------------------------------------------
 * Accueil (home) tab: project cards grid + recent activity list.
 */
<script setup lang="ts">
import { FolderOpen, Clock, ChevronRight, PlusCircle } from 'lucide-vue-next'
import { deadlineClass, deadlineLabel } from '@/utils/date'
import { avatarColor, gradeClass } from '@/utils/format'
import type { ProjectCard } from '@/composables/useDashboardTeacher'
import type { Depot } from '@/types'

defineProps<{
  projectCards: ProjectCard[]
  recentRendus: Depot[]
}>()

const emit = defineEmits<{
  goToProject: [key: string]
  openNewDevoir: []
}>()
</script>

<template>
  <div class="db-tab-content">
    <div v-if="!projectCards.length" class="db-empty-hint">
      <FolderOpen :size="36" style="opacity:.2;margin-bottom:10px" />
      <p>Aucun projet configuré. Créez des travaux avec une catégorie pour les voir ici.</p>
      <button class="db-empty-action" @click="emit('openNewDevoir')">
        <PlusCircle :size="14" /> Créer un premier devoir
      </button>
    </div>
    <div v-else class="db-project-grid">
      <div
        v-for="p in projectCards"
        :key="p.key"
        class="db-project-card"
        role="button"
        :aria-label="`Ouvrir le projet ${p.label}`"
        @click="emit('goToProject', p.key)"
      >
        <div class="db-project-icon">
          <component :is="p.icon" v-if="p.icon" :size="20" />
          <FolderOpen v-else :size="20" />
        </div>
        <div class="db-project-info">
          <span class="db-project-name">{{ p.label }}</span>
          <span class="db-project-stats">
            {{ p.published }} devoir{{ p.published > 1 ? 's' : '' }} publiés
            <template v-if="p.expected"> · {{ p.depots }}/{{ p.expected }} rendus</template>
          </span>
          <span v-if="p.nextDeadline" class="db-project-next" :class="deadlineClass(p.nextDeadline)">
            <Clock :size="9" /> {{ deadlineLabel(p.nextDeadline) }}
          </span>
        </div>
        <ChevronRight :size="14" class="db-project-chevron" />
      </div>
    </div>

    <!-- Dernière activité -->
    <div v-if="recentRendus.length" class="db-activity">
      <h4 class="db-activity-title"><Clock :size="14" /> Dernière activité</h4>
      <div class="db-activity-list">
        <div v-for="r in recentRendus" :key="r.id" class="db-activity-item">
          <div class="db-activity-avatar" :style="{ background: avatarColor(r.student_name ?? '') }">
            {{ (r.student_name ?? '').slice(0, 2).toUpperCase() }}
          </div>
          <div class="db-activity-info">
            <span class="db-activity-name">{{ r.student_name }}</span>
            <span class="db-activity-devoir">{{ r.travail_title ?? 'Devoir #' + r.travail_id }}</span>
          </div>
          <div class="db-activity-right">
            <span v-if="r.note" class="db-activity-note" :class="gradeClass(r.note)">{{ r.note }}</span>
            <span class="db-activity-date">{{ new Date(r.submitted_at ?? '').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.db-tab-content { display: flex; flex-direction: column; gap: 0; }
.db-empty-hint {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 60px 20px; color: var(--text-muted); font-size: 13px; text-align: center; gap: 4px;
}
.db-empty-action {
  display: inline-flex; align-items: center; gap: 6px; margin-top: 12px;
  padding: 8px 18px; font-size: 13px; font-weight: 600;
  background: var(--accent); color: #fff; border: none; border-radius: 8px;
  cursor: pointer; font-family: var(--font); transition: filter .15s;
}
.db-empty-action:hover { filter: brightness(1.1); }

/* ── Grille projets ── */
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
.db-project-chevron { color: var(--text-muted); flex-shrink: 0; transition: transform var(--t-fast), color var(--t-fast); }
.db-project-card:hover .db-project-chevron { transform: translateX(2px); color: var(--accent); }

/* Dernière activité */
.db-activity { margin-top: 16px; }
.db-activity-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;
}
.db-activity-list { display: flex; flex-direction: column; gap: 4px; }
.db-activity-item {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 10px; border-radius: 8px; background: rgba(255,255,255,.02);
}
.db-activity-avatar {
  width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; font-size: 10px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.db-activity-info { flex: 1; min-width: 0; }
.db-activity-name { font-size: 13px; font-weight: 600; color: var(--text-primary); display: block; }
.db-activity-devoir { font-size: 11px; color: var(--text-muted); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-activity-right { text-align: right; flex-shrink: 0; }
.db-activity-note { font-size: 13px; font-weight: 800; display: block; }
.db-activity-note.grade-a { color: var(--color-success); }
.db-activity-note.grade-b { color: #27ae60; }
.db-activity-note.grade-c { color: var(--color-warning); }
.db-activity-note.grade-d { color: var(--color-danger); }
.db-activity-date { font-size: 10px; color: var(--text-muted); }
</style>
