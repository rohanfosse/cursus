/**
 * DashboardStudent.vue
 * Orchestrator for the student dashboard — composes header, urgent actions,
 * stats, projects grid, and frise sub-components.
 */
<script setup lang="ts">
import { FolderOpen, BarChart2 } from 'lucide-vue-next'
import type { StudentProjectCard } from '@/composables/useDashboardStudent'
import type { FriseMilestone, FrisePromo } from '@/composables/useFrise'

import StudentHeader from './StudentHeader.vue'
import StudentUrgentActions from './StudentUrgentActions.vue'
import StudentStatsCards from './StudentStatsCards.vue'
import StudentProjects from './StudentProjects.vue'
import StudentFrise from './StudentFrise.vue'

// ── Props ────────────────────────────────────────────────────────────────────
const props = defineProps<{
  toggleSidebar?: () => void
  loadingStudent: boolean
  greetingName: string
  today: string
  showOnboarding: boolean
  hasDevoirsLoaded: boolean

  // Stats
  studentStats: { pending: number; submitted: number; graded: number; modeGrade: string | null }

  // Urgent actions
  urgentActions: { id: number; title: string; isOverdue: boolean; urgency: string; category?: string | null }[]

  // Recent grades
  recentGrades: { title: string; note: string }[]

  // Recent feedback
  recentFeedback?: { title: string; feedback: string; note: string | null; category: string | null }[]

  // Projects
  studentProjectCards: StudentProjectCard[]

  // Tabs
  dashTab: 'accueil' | 'promotions' | 'frise' | 'analytique' | 'reglages'

  // Frise
  friseDragging: boolean
  ganttDateRange: { start: Date; end: Date } | null
  frise: FrisePromo[]
  ganttMonths: { left: number; label: string }[]
  ganttTodayPct: number

  // Frise helpers (functions)
  milestoneLeft: (deadline: string) => string
  projectLineStyle: (milestones: FriseMilestone[]) => Record<string, string>
}>()

// ── Emits ────────────────────────────────────────────────────────────────────
const emit = defineEmits<{
  'update:dashTab': [tab: 'accueil' | 'frise']
  dismissOnboarding: []
  goToProject: [key: string]
  onFriseWheel: [e: WheelEvent]
  onFriseDragStart: [e: MouseEvent]
  onFriseDragMove: [e: MouseEvent]
  onFriseDragEnd: [e: MouseEvent]
  onMilestoneClick: [ms: FriseMilestone]
  openStudentTimeline: []
  navigateDevoirs: []
}>()
</script>

<template>
  <!-- Loading skeleton -->
  <div v-if="loadingStudent" class="db-loading">
    <div v-for="i in 4" :key="i" class="skel db-skel-card" />
    <div class="db-skel-content">
      <div v-for="i in 5" :key="i" class="skel skel-line" :style="{ width: (45 + (i % 3) * 18) + '%' }" />
    </div>
  </div>

  <template v-else>
    <StudentHeader
      :toggle-sidebar="props.toggleSidebar"
      :greeting-name="greetingName"
      :today="today"
      :urgent-count="urgentActions.length"
      @open-student-timeline="emit('openStudentTimeline')"
      @navigate-devoirs="emit('navigateDevoirs')"
    />

    <!-- Encart première connexion (beta + guide) -->
    <div v-if="showOnboarding" class="db-welcome">
      <div class="db-welcome-header">
        <span class="db-welcome-badge">Beta</span>
        <span class="db-welcome-title">Bienvenue sur Cursus</span>
      </div>
      <p class="db-welcome-intro">
        Cette plateforme est en <strong>version beta</strong>. Vous êtes parmi les premiers à l'utiliser.
        N'hésitez pas à signaler tout problème à votre enseignant.
      </p>
      <div class="db-welcome-grid">
        <div class="db-welcome-card">
          <strong>Devoirs</strong>
          <span>Consultez vos devoirs, déposez vos rendus et suivez vos notes dans la section Devoirs.</span>
        </div>
        <div class="db-welcome-card">
          <strong>Messages</strong>
          <span>Échangez avec vos enseignants et camarades dans les canaux de votre promotion.</span>
        </div>
        <div class="db-welcome-card">
          <strong>Documents</strong>
          <span>Retrouvez les ressources partagées par vos enseignants dans la section Documents.</span>
        </div>
      </div>
      <div class="db-welcome-footer">
        <span class="db-welcome-hint">Utilisez la barre latérale pour naviguer entre les sections.</span>
        <button class="btn-primary db-welcome-btn" @click="emit('dismissOnboarding')">C'est noté</button>
      </div>
    </div>

    <StudentUrgentActions
      :urgent-actions="urgentActions"
      :has-devoirs-loaded="hasDevoirsLoaded"
      @go-to-project="(k) => emit('goToProject', k)"
      @navigate-devoirs="emit('navigateDevoirs')"
    />

    <StudentStatsCards
      :student-stats="studentStats"
      :recent-grades="recentGrades"
      :recent-feedback="recentFeedback"
      @navigate-project="(k) => emit('goToProject', k)"
    />

    <!-- Tabs -->
    <div class="db-tabs">
      <button class="db-tab" :class="{ active: dashTab === 'accueil' }" @click="emit('update:dashTab', 'accueil')">
        <FolderOpen :size="13" /> Mes projets
      </button>
      <button class="db-tab" :class="{ active: dashTab === 'frise' }" @click="emit('update:dashTab', 'frise')">
        <BarChart2 :size="13" /> Frise
      </button>
    </div>

    <StudentProjects
      v-if="dashTab === 'accueil'"
      :student-project-cards="studentProjectCards"
      @go-to-project="(k) => emit('goToProject', k)"
      @navigate-devoirs="emit('navigateDevoirs')"
    />

    <StudentFrise
      v-else
      :frise-dragging="friseDragging"
      :gantt-date-range="ganttDateRange"
      :frise="frise"
      :gantt-months="ganttMonths"
      :gantt-today-pct="ganttTodayPct"
      :milestone-left="milestoneLeft"
      :project-line-style="projectLineStyle"
      @go-to-project="(k) => emit('goToProject', k)"
      @on-frise-wheel="(e) => emit('onFriseWheel', e)"
      @on-frise-drag-start="(e) => emit('onFriseDragStart', e)"
      @on-frise-drag-move="(e) => emit('onFriseDragMove', e)"
      @on-frise-drag-end="(e) => emit('onFriseDragEnd', e)"
      @on-milestone-click="(ms) => emit('onMilestoneClick', ms)"
    />
  </template>
</template>

<style scoped>
/* ── Chargement ── */
.db-loading { display: flex; flex-direction: column; gap: 14px; padding: 32px 0; }
.db-skel-card { height: 76px; border-radius: 10px; flex-shrink: 0; }
.db-skel-content { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }

/* ── Welcome (beta) ── */
.db-welcome {
  background: var(--bg-elevated, rgba(255,255,255,.03));
  border: 1px solid var(--border); border-radius: 12px;
  padding: 20px 24px; margin-bottom: 16px;
}
.db-welcome-header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
}
.db-welcome-badge {
  font-size: 10px; font-weight: 800; text-transform: uppercase;
  letter-spacing: .6px; padding: 3px 10px; border-radius: 6px;
  background: rgba(74,144,217,.15); color: var(--accent);
}
.db-welcome-title {
  font-size: 16px; font-weight: 700; color: var(--text-primary);
}
.db-welcome-intro {
  font-size: 13px; color: var(--text-secondary); line-height: 1.6;
  margin-bottom: 16px; max-width: 520px;
}
.db-welcome-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
  margin-bottom: 16px;
}
.db-welcome-card {
  background: rgba(255,255,255,.02); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 12px; display: flex; flex-direction: column; gap: 4px;
}
.db-welcome-card strong {
  font-size: 13px; font-weight: 700; color: var(--text-primary);
}
.db-welcome-card span {
  font-size: 11.5px; color: var(--text-muted); line-height: 1.4;
}
.db-welcome-footer {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.db-welcome-hint {
  font-size: 12px; color: var(--text-muted); font-style: italic;
}
.db-welcome-btn { font-size: 13px; }
@media (max-width: 600px) {
  .db-welcome-grid { grid-template-columns: 1fr; }
}

/* ── Tabs ── */
.db-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); padding-bottom: 0; }
.db-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border: none; background: transparent;
  color: var(--text-secondary); font-family: var(--font);
  font-size: 13px; font-weight: 600; cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px; border-radius: 0;
  transition: color var(--t-fast), border-color var(--t-fast);
}
.db-tab:hover { color: var(--text-primary); }
.db-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
</style>
