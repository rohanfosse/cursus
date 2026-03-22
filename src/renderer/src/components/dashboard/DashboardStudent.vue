/**
 * DashboardStudent.vue
 * Orchestrator for the student dashboard — composes header, urgent actions,
 * stats, projects grid, and frise sub-components.
 */
<script setup lang="ts">
import { FolderOpen, BarChart2, BookOpen } from 'lucide-vue-next'
import type { StudentProjectCard } from '@/composables/useDashboardStudent'
import type { FriseMilestone, FrisePromo } from '@/composables/useFrise'

import StudentHeader from './StudentHeader.vue'
import StudentBento from './StudentBento.vue'
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
  dashTab: string

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

    <!-- Encart première connexion (guide) -->
    <div v-if="showOnboarding" class="db-welcome">
      <div class="db-welcome-hero">
        <div class="db-welcome-hero-text">
          <h2 class="db-welcome-title">Bienvenue sur Cursus</h2>
          <p class="db-welcome-subtitle">Votre espace de travail collaboratif</p>
        </div>
      </div>
      <p class="db-welcome-intro">
        Cursus centralise tout ce dont vous avez besoin pour suivre votre formation. Voici ce que vous pouvez faire :
      </p>
      <div class="db-welcome-grid">
        <div class="db-welcome-card db-welcome-card--devoirs">
          <div class="db-welcome-card-icon">
            <BookOpen :size="18" />
          </div>
          <div class="db-welcome-card-body">
            <strong>Devoirs et rendus</strong>
            <span>Consultez vos devoirs, deposez vos rendus et suivez vos notes en temps reel.</span>
          </div>
        </div>
        <div class="db-welcome-card db-welcome-card--messages">
          <div class="db-welcome-card-icon">
            <FolderOpen :size="18" />
          </div>
          <div class="db-welcome-card-body">
            <strong>Messagerie par canal</strong>
            <span>Echangez avec vos enseignants et camarades dans les canaux de votre promotion.</span>
          </div>
        </div>
        <div class="db-welcome-card db-welcome-card--docs">
          <div class="db-welcome-card-icon">
            <BarChart2 :size="18" />
          </div>
          <div class="db-welcome-card-body">
            <strong>Documents partages</strong>
            <span>Retrouvez les ressources et supports de cours partages par vos enseignants.</span>
          </div>
        </div>
      </div>
      <div class="db-welcome-footer">
        <span class="db-welcome-hint">Explorez la barre laterale pour naviguer entre les sections.</span>
        <button class="btn-primary db-welcome-btn" @click="emit('dismissOnboarding')">C'est compris</button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="db-tabs">
      <button class="db-tab" :class="{ active: dashTab === 'accueil' }" @click="emit('update:dashTab', 'accueil')">
        <FolderOpen :size="13" /> Accueil
      </button>
      <button class="db-tab" :class="{ active: dashTab === 'frise' }" @click="emit('update:dashTab', 'frise')">
        <BarChart2 :size="13" /> Frise
      </button>
    </div>

    <StudentBento
      v-if="dashTab === 'accueil'"
      :student-stats="studentStats"
      :urgent-actions="urgentActions"
      :recent-grades="recentGrades"
      :recent-feedback="recentFeedback"
      :student-project-cards="studentProjectCards"
      :has-devoirs-loaded="hasDevoirsLoaded"
      @navigate-devoirs="emit('navigateDevoirs')"
      @open-student-timeline="emit('openStudentTimeline')"
      @go-to-project="(k) => emit('goToProject', k)"
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

/* ── Welcome (onboarding) ── */
.db-welcome {
  background: linear-gradient(135deg, rgba(74,144,217,.08) 0%, rgba(155,135,245,.06) 100%);
  border: 1px solid rgba(74,144,217,.18); border-radius: 16px;
  padding: 24px 28px; margin-bottom: 18px;
}
.db-welcome-hero {
  display: flex; align-items: center; gap: 14px; margin-bottom: 14px;
}
.db-welcome-hero-text {
  display: flex; flex-direction: column; gap: 2px;
}
.db-welcome-title {
  font-size: 20px; font-weight: 800; color: var(--text-primary);
  letter-spacing: -.3px; margin: 0;
}
.db-welcome-subtitle {
  font-size: 13.5px; color: var(--accent); font-weight: 600; margin: 0;
}
.db-welcome-intro {
  font-size: 13px; color: var(--text-secondary); line-height: 1.6;
  margin-bottom: 16px; max-width: 560px;
}
.db-welcome-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
  margin-bottom: 18px;
}
.db-welcome-card {
  background: rgba(255,255,255,.03); border: 1px solid var(--border);
  border-radius: 12px; padding: 16px; display: flex; align-items: flex-start; gap: 12px;
  transition: background .15s, border-color .15s;
}
.db-welcome-card:hover {
  background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.15);
}
.db-welcome-card-icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.db-welcome-card--devoirs .db-welcome-card-icon { background: rgba(155,135,245,.15); color: #9B87F5; }
.db-welcome-card--messages .db-welcome-card-icon { background: rgba(74,144,217,.15); color: var(--accent); }
.db-welcome-card--docs .db-welcome-card-icon { background: rgba(46,204,113,.15); color: #2ECC71; }
.db-welcome-card-body {
  display: flex; flex-direction: column; gap: 4px; min-width: 0;
}
.db-welcome-card strong {
  font-size: 13px; font-weight: 700; color: var(--text-primary);
}
.db-welcome-card span {
  font-size: 11.5px; color: var(--text-muted); line-height: 1.45;
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
  .db-welcome { padding: 18px 16px; }
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
