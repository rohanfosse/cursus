/**
 * DashboardStudent.vue
 * Orchestrator for the student dashboard - composes header, urgent actions,
 * stats, projects grid, and frise sub-components.
 */
<script setup lang="ts">
import { computed } from 'vue'
import { FolderOpen, Award, CalendarDays, Home, Menu } from 'lucide-vue-next'
import type { StudentProjectCard } from '@/composables/useDashboardStudent'
import type { FriseMilestone, FrisePromo } from '@/composables/useFrise'
import type { GradedDevoir } from './StudentGradesTab.vue'

import StudentBento from './StudentBento.vue'
import StudentProjectsTab from './StudentProjectsTab.vue'
import StudentGradesTab from './StudentGradesTab.vue'
import TabFrise from './TabFrise.vue'

// ── Props ────────────────────────────────────────────────────────────────────
const props = defineProps<{
  toggleSidebar?: () => void
  greetingName: string
  today: string
  loadingStudent: boolean
  showOnboarding: boolean
  hasDevoirsLoaded: boolean

  // Stats
  studentStats: { pending: number; submitted: number; graded: number; modeGrade: string | null }

  // Urgent actions
  urgentActions: { id: number; title: string; isOverdue: boolean; urgency: string; category?: string | null }[]

  // Recent grades
  recentGrades: { title: string; note: string }[]

  // All graded devoirs (for Mes notes tab)
  allGradedDevoirs: GradedDevoir[]

  // Recent feedback
  recentFeedback?: { title: string; feedback: string; note: string | null; category: string | null }[]

  // Projects
  studentProjectCards: StudentProjectCard[]

  // Tabs
  dashTab: string

  // Frise
  friseOffset: number
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
  'update:dashTab': [tab: 'accueil' | 'projets' | 'notes' | 'planning']
  'update:friseOffset': [val: number]
  dismissOnboarding: []
  goToProject: [key: string]
  onFriseWheel: [e: WheelEvent]
  onFriseDragStart: [e: MouseEvent]
  onFriseDragMove: [e: MouseEvent]
  onFriseDragEnd: [e: MouseEvent]
  onMilestoneClick: [ms: FriseMilestone]
  setFriseZoom: [days: number]
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
    <!-- Header (meme design que pilote) -->
    <div class="db-header">
      <div class="db-header-left">
        <button v-if="props.toggleSidebar" class="mobile-hamburger" aria-label="Ouvrir le menu" @click="props.toggleSidebar">
          <Menu :size="22" />
        </button>
        <div>
          <h1 class="db-title">Bonjour, {{ greetingName }}</h1>
          <p class="db-date">{{ today }}</p>
        </div>
      </div>
    </div>

    <!-- Compact welcome banner -->
    <div v-if="showOnboarding" class="db-welcome-banner">
      <div class="db-welcome-text">
        <strong>Bienvenue sur Cursus</strong> - Retrouvez vos devoirs, messages et documents au même endroit.
      </div>
      <button class="db-welcome-dismiss" @click="emit('dismissOnboarding')">OK</button>
    </div>

    <!-- Tabs -->
    <div class="db-tabs">
      <button class="db-tab" :class="{ active: dashTab === 'accueil' }" @click="emit('update:dashTab', 'accueil')">
        <Home :size="13" /> Accueil
      </button>
      <button class="db-tab" :class="{ active: dashTab === 'projets' }" @click="emit('update:dashTab', 'projets')">
        <FolderOpen :size="13" /> Mes projets
      </button>
      <button class="db-tab" :class="{ active: dashTab === 'notes' }" @click="emit('update:dashTab', 'notes')">
        <Award :size="13" /> Mes notes
      </button>
      <button class="db-tab" :class="{ active: dashTab === 'planning' }" @click="emit('update:dashTab', 'planning')">
        <CalendarDays :size="13" /> Planning
      </button>
    </div>

    <!-- Tab: Accueil -->
    <StudentBento
      v-if="dashTab === 'accueil'"
      :student-stats="studentStats"
      :urgent-actions="urgentActions"
      :recent-grades="recentGrades"
      :recent-feedback="recentFeedback"
      :student-project-cards="studentProjectCards"
      :has-devoirs-loaded="hasDevoirsLoaded"
      @go-to-project="(k) => emit('goToProject', k)"
    />

    <!-- Tab: Mes projets -->
    <StudentProjectsTab
      v-else-if="dashTab === 'projets'"
      :student-project-cards="studentProjectCards"
      @go-to-project="(k) => emit('goToProject', k)"
      @navigate-devoirs="emit('navigateDevoirs')"
    />

    <!-- Tab: Mes notes -->
    <StudentGradesTab
      v-else-if="dashTab === 'notes'"
      :graded-devoirs="allGradedDevoirs"
      :mode-grade="studentStats.modeGrade"
    />

    <!-- Tab: Planning (TabFrise) -->
    <TabFrise
      v-else-if="dashTab === 'planning'"
      :frise-offset="friseOffset"
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
      @set-frise-zoom="(days) => emit('setFriseZoom', days)"
      @update:frise-offset="(val) => emit('update:friseOffset', val)"
    />
  </template>
</template>

<style scoped>
/* ── Header (meme style que pilote) ── */
.db-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 4px 0;
}
.db-header-left { display: flex; align-items: center; gap: 12px; }
.db-title { font-size: 20px; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
.db-date { font-size: 12px; color: var(--text-muted); margin-top: 2px; text-transform: capitalize; }

/* ── Chargement ── */
.db-loading { display: flex; flex-direction: column; gap: 14px; padding: 32px 0; }
.db-skel-card { height: 76px; border-radius: 10px; flex-shrink: 0; }
.db-skel-content { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }

/* ── Welcome banner (compact) ── */
.db-welcome-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  max-height: 48px;
  padding: 10px 16px;
  background: linear-gradient(135deg, rgba(74,144,217,.08) 0%, rgba(155,135,245,.06) 100%);
  border: 1px solid rgba(74,144,217,.18);
  border-radius: 10px;
}
.db-welcome-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
  min-width: 0;
}
.db-welcome-text strong {
  color: var(--text-primary);
  font-weight: 700;
}
.db-welcome-dismiss {
  flex-shrink: 0;
  padding: 4px 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: rgba(255,255,255,.04);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--font);
  transition: background var(--t-fast), color var(--t-fast);
}
.db-welcome-dismiss:hover {
  background: rgba(255,255,255,.08);
  color: var(--text-primary);
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
