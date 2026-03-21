/**
 * DashboardStudent.vue
 * ---------------------------------------------------------------------------
 * Complete student-side dashboard view.
 * Receives all reactive data through props from the parent DashboardView
 * which orchestrates composables.
 */
<script setup lang="ts">
import {
  Clock, AlertTriangle, ChevronRight, CheckCircle2,
  LayoutDashboard, Award, TrendingUp, FolderOpen,
  CalendarDays, BarChart2, BookOpen, Menu,
} from 'lucide-vue-next'
import { deadlineClass, deadlineLabel, formatDate } from '@/utils/date'
import type { StudentProjectCard } from '@/composables/useDashboardStudent'
import type { FriseMilestone, FrisePromo } from '@/composables/useFrise'

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
  <div v-if="loadingStudent" class="db-loading">
    <div v-for="i in 4" :key="i" class="skel db-skel-card" />
    <div class="db-skel-content">
      <div v-for="i in 5" :key="i" class="skel skel-line" :style="{ width: (45 + (i % 3) * 18) + '%' }" />
    </div>
  </div>

  <template v-else>
    <!-- En-tête étudiant -->
    <div class="db-header">
      <div class="db-header-left">
        <button v-if="props.toggleSidebar" class="mobile-hamburger" aria-label="Ouvrir le menu" @click="props.toggleSidebar">
          <Menu :size="22" />
        </button>
        <LayoutDashboard :size="20" class="db-header-icon" />
        <div>
          <h1 class="db-title">Bonjour, {{ greetingName }}</h1>
          <p class="db-date">{{ today }}</p>
        </div>
      </div>
      <div class="db-header-actions">
        <button class="btn-ghost db-echeancier-btn" @click="emit('openStudentTimeline')">
          <CalendarDays :size="14" /> Ma timeline
        </button>
        <button class="btn-ghost db-echeancier-btn" @click="emit('navigateDevoirs')">
          <BookOpen :size="14" /> Tous mes devoirs
        </button>
      </div>
    </div>

    <!-- Bannière onboarding (première visite) -->
    <div v-if="showOnboarding" class="db-onboarding">
      <div class="db-onboarding-content">
        <strong>Bienvenue sur Cursus !</strong>
        <span>Consultez vos <b>devoirs</b> dans la section Devoirs, discutez dans les <b>canaux</b>, et suivez votre <b>progression</b> ici.</span>
      </div>
      <button class="btn-ghost db-onboarding-close" @click="emit('dismissOnboarding')">C'est compris</button>
    </div>

    <!-- Top 3 devoirs urgents -->
    <div v-if="urgentActions.length" class="db-urgent-list">
      <h4 class="db-urgent-title"><Clock :size="14" /> À rendre prochainement</h4>
      <div v-for="ua in urgentActions" :key="ua.id" class="db-urgent-item" :class="{ 'db-urgent-item--overdue': ua.isOverdue }" @click="emit('goToProject', ua.category ?? '')">
        <AlertTriangle v-if="ua.isOverdue" :size="14" class="db-urgent-icon--danger" />
        <Clock v-else :size="14" style="opacity:.5" />
        <span class="db-urgent-item-title">{{ ua.title }}</span>
        <span class="db-urgent-item-urgency" :class="{ 'text-danger': ua.isOverdue }">{{ ua.urgency }}</span>
        <ChevronRight :size="12" style="opacity:.3" />
      </div>
    </div>
    <div v-else-if="hasDevoirsLoaded" class="db-all-done">
      <CheckCircle2 :size="18" style="color:var(--color-success)" />
      <span>Tout est à jour ! Aucun devoir en attente.</span>
    </div>

    <!-- Dernières notes reçues -->
    <div v-if="recentGrades.length" class="db-recent-grades">
      <h4 class="db-urgent-title"><Award :size="14" /> Dernières notes</h4>
      <div class="db-recent-grades-list">
        <div v-for="g in recentGrades" :key="g.title" class="db-recent-grade-item">
          <span class="db-grade-badge" :class="'grade-' + g.note.toLowerCase()">{{ g.note }}</span>
          <span class="db-recent-grade-title">{{ g.title }}</span>
        </div>
      </div>
    </div>

    <!-- Stats étudiant -->
    <div class="db-stats">
      <div class="db-stat-card db-stat-warning">
        <span class="db-stat-value">{{ studentStats.pending }}</span>
        <span class="db-stat-label">À rendre</span>
        <Clock :size="18" class="db-stat-icon" />
      </div>
      <div class="db-stat-card db-stat-accent">
        <span class="db-stat-value">{{ studentStats.submitted }}</span>
        <span class="db-stat-label">Rendus déposés</span>
        <CheckCircle2 :size="18" class="db-stat-icon" />
      </div>
      <div class="db-stat-card db-stat-success">
        <span class="db-stat-value">{{ studentStats.graded }}</span>
        <span class="db-stat-label">Devoirs notés</span>
        <Award :size="18" class="db-stat-icon" />
      </div>
      <div class="db-stat-card db-stat-neutral">
        <span class="db-stat-value">{{ studentStats.modeGrade ?? '—' }}</span>
        <span class="db-stat-label">Note fréquente</span>
        <TrendingUp :size="18" class="db-stat-icon" />
      </div>
    </div>

    <!-- Tabs -->
    <div class="db-tabs">
      <button class="db-tab" :class="{ active: dashTab === 'accueil' }" @click="emit('update:dashTab', 'accueil')">
        <FolderOpen :size="13" /> Mes projets
      </button>
      <button class="db-tab" :class="{ active: dashTab === 'frise' }" @click="emit('update:dashTab', 'frise')">
        <BarChart2 :size="13" /> Frise
      </button>
    </div>

    <!-- Tab Projets étudiant -->
    <div v-if="dashTab === 'accueil'" class="db-tab-content">
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
            <span class="db-project-name">{{ p.label }}</span>
            <span class="db-project-stats">
              {{ p.submitted }}/{{ p.total }} rendus
              <template v-if="p.overdue"> · <span style="color:var(--color-danger)">{{ p.overdue }} en retard</span></template>
            </span>
            <span v-if="p.nextDeadline" class="db-project-next" :class="deadlineClass(p.nextDeadline)">
              <Clock :size="9" /> {{ deadlineLabel(p.nextDeadline) }}
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

    <!-- Tab Frise étudiant -->
    <div v-else class="db-tab-content db-frise-outer">
      <div v-if="!ganttDateRange || !frise.length" class="db-empty-hint">
        <BarChart2 :size="36" style="opacity:.2;margin-bottom:10px" />
        <p>Aucune donnée de planification disponible.</p>
      </div>
      <div
        v-else
        class="frise-wrap frise-interactive"
        :class="{ 'frise-grabbing': friseDragging }"
        @wheel.prevent="(e: WheelEvent) => emit('onFriseWheel', e)"
        @mousedown="(e: MouseEvent) => emit('onFriseDragStart', e)"
        @mousemove="(e: MouseEvent) => emit('onFriseDragMove', e)"
        @mouseup="(e: MouseEvent) => emit('onFriseDragEnd', e)"
        @mouseleave="(e: MouseEvent) => emit('onFriseDragEnd', e)"
      >
        <div class="frise-axis-row">
          <div class="frise-label-col frise-axis-label">Projet</div>
          <div class="frise-bar-col frise-axis-months">
            <div v-for="(m, i) in ganttMonths" :key="i" class="frise-month-tick" :style="{ left: m.left + '%' }">{{ m.label }}</div>
            <div v-for="(m, i) in ganttMonths" :key="`bg${i}`" class="frise-month-bg" :class="{ even: i % 2 === 0 }"
              :style="i < ganttMonths.length - 1 ? { left: m.left + '%', width: (ganttMonths[i+1].left - m.left) + '%' } : { left: m.left + '%', right: '0' }" />
            <div v-if="ganttTodayPct >= 0 && ganttTodayPct <= 100" class="frise-today" :style="{ left: ganttTodayPct + '%' }" />
          </div>
        </div>
        <div v-for="promo in frise" :key="promo.name" class="frise-promo">
          <div class="frise-promo-heading">
            <div class="frise-label-col frise-promo-label-col">
              <span class="frise-promo-dot" :style="{ background: promo.color }" />
              <span class="frise-promo-name">{{ promo.name }}</span>
            </div>
            <div class="frise-bar-col frise-promo-bar-col" />
          </div>
          <div v-for="proj in promo.projects" :key="proj.key" class="frise-row" @click="emit('goToProject', proj.key)">
            <div class="frise-label-col frise-project-label">
              <component :is="proj.icon" v-if="proj.icon" :size="11" class="frise-project-icon" />
              <span>{{ proj.label }}</span>
              <ChevronRight :size="10" class="frise-project-arrow" />
            </div>
            <div class="frise-bar-col frise-timeline">
              <div class="frise-proj-line" :style="projectLineStyle(proj.milestones)" />
              <div v-if="ganttTodayPct >= 0 && ganttTodayPct <= 100" class="frise-today" :style="{ left: ganttTodayPct + '%' }" />
              <div
                v-for="(ms, mi) in proj.milestones"
                :key="ms.id"
                class="frise-milestone"
                :class="[`frise-ms-${ms.type}`, { 'frise-ms-done': ms.done, 'frise-ms-draft': !ms.published, 'frise-ms-above': mi % 2 === 0 }]"
                :style="{ left: milestoneLeft(ms.deadline) }"
                :title="`${ms.title} — ${formatDate(ms.deadline)}`"
                @click.stop="emit('onMilestoneClick', ms)"
              >
                <div v-if="mi % 2 === 0" class="frise-ms-label">
                  <span class="frise-ms-title">{{ ms.title }}</span>
                  <span class="frise-ms-date">{{ formatDate(ms.deadline) }}</span>
                </div>
                <div class="frise-ms-dot" />
                <div v-if="mi % 2 !== 0" class="frise-ms-label">
                  <span class="frise-ms-title">{{ ms.title }}</span>
                  <span class="frise-ms-date">{{ formatDate(ms.deadline) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </template>
</template>

<style scoped>
/* ── Chargement ── */
.db-loading { display: flex; flex-direction: column; gap: 14px; padding: 32px 0; }
.db-skel-card { height: 76px; border-radius: 10px; flex-shrink: 0; }
.db-skel-content { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }

/* ── En-tête ── */
.db-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.db-header-left { display: flex; align-items: center; gap: 12px; }
.db-header-icon { color: var(--accent); }
.db-title { font-size: 20px; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
.db-date  { font-size: 12px; color: var(--text-muted); margin-top: 2px; text-transform: capitalize; }
.db-echeancier-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 6px 12px; flex-shrink: 0; }
.db-header-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

/* ── Onboarding ── */
.db-onboarding {
  display: flex; align-items: center; gap: 16px;
  padding: 14px 20px; background: rgba(74,144,217,.1);
  border: 1px solid rgba(74,144,217,.25);
  border-radius: var(--radius); margin-bottom: 16px;
}
.db-onboarding-content { flex: 1; font-size: 13.5px; color: var(--text-secondary); line-height: 1.5; }
.db-onboarding-content strong { color: var(--text-primary); display: block; margin-bottom: 2px; }
.db-onboarding-close { flex-shrink: 0; white-space: nowrap; }

/* ── Urgent list + dernières notes ── */
.db-urgent-list, .db-recent-grades { margin-bottom: 16px; }
.db-urgent-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px;
}
.db-urgent-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 8px; cursor: pointer;
  background: rgba(255,255,255,.02); transition: background .15s;
  margin-bottom: 4px; font-size: 13px; color: var(--text-primary);
}
.db-urgent-item:hover { background: rgba(255,255,255,.06); }
.db-urgent-item--overdue { background: rgba(231,76,60,.06); }
.db-urgent-item-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-urgent-item-urgency { font-size: 11px; font-weight: 600; color: var(--text-muted); flex-shrink: 0; }
.db-urgent-icon--danger { color: var(--color-danger); }
.text-danger { color: var(--color-danger) !important; }

.db-recent-grades-list { display: flex; gap: 8px; flex-wrap: wrap; }
.db-recent-grade-item {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 8px;
  background: rgba(255,255,255,.03); font-size: 13px;
}
.db-recent-grade-title { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
.db-grade-badge { font-size: 12px; font-weight: 800; padding: 2px 8px; border-radius: 6px; }
.db-grade-badge.grade-a { background: rgba(39,174,96,.15); color: #27ae60; }
.db-grade-badge.grade-b { background: rgba(39,174,96,.08); color: #2ecc71; }
.db-grade-badge.grade-c { background: rgba(243,156,18,.12); color: #e67e22; }
.db-grade-badge.grade-d { background: rgba(231,76,60,.12); color: #e74c3c; }

.db-all-done {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 20px; background: rgba(46,204,113,.08);
  border: 1px solid rgba(46,204,113,.2); border-radius: var(--radius);
  margin-bottom: 16px; font-size: 14px; font-weight: 600; color: var(--text-secondary);
}

/* ── Stats grid ── */
.db-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
@media (max-width: 900px) { .db-stats { grid-template-columns: repeat(2, 1fr); } }
.db-stat-card {
  position: relative; border-radius: 10px; padding: 16px 18px;
  border: 1px solid var(--border); background: var(--bg-sidebar);
  display: flex; flex-direction: column; gap: 4px; overflow: hidden;
}
.db-stat-value { font-size: 28px; font-weight: 800; line-height: 1; }
.db-stat-label { font-size: 11.5px; color: var(--text-secondary); }
.db-stat-icon  { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); opacity: .18; }
.db-stat-warning { border-color: rgba(243,156,18,.2); }
.db-stat-warning .db-stat-value { color: var(--color-warning); }
.db-stat-warning .db-stat-icon  { color: var(--color-warning); opacity: .3; }
.db-stat-accent  { border-color: rgba(74,144,217,.2); }
.db-stat-accent  .db-stat-value { color: var(--accent-light); }
.db-stat-accent  .db-stat-icon  { color: var(--accent); opacity: .3; }
.db-stat-success { border-color: rgba(39,174,96,.2); }
.db-stat-success .db-stat-value { color: var(--color-success); }
.db-stat-success .db-stat-icon  { color: var(--color-success); opacity: .3; }
.db-stat-neutral .db-stat-value { color: var(--text-primary); }

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
.db-tab-content { display: flex; flex-direction: column; gap: 0; }

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

/* ── Cartes étudiant (avec barre de progression) ── */
.db-student-grid .db-student-card {
  flex-direction: column; align-items: flex-start; padding-bottom: 10px; gap: 6px;
}
.db-student-bar {
  width: 100%; height: 3px; border-radius: 2px;
  background: rgba(255,255,255,.06); overflow: hidden;
}
.db-student-fill {
  height: 100%; border-radius: 2px; background: #9B87F5; transition: width .3s ease;
}
.db-student-fill.fill-done { background: var(--color-success); }
.db-student-fill.fill-overdue { background: var(--color-danger); }

/* ── Empty hint ── */
.db-empty-hint {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 60px 20px; color: var(--text-muted); font-size: 13px; text-align: center; gap: 4px;
}

/* ── Frise ── */
.db-frise-outer { flex: 1; min-height: 0; overflow: hidden; padding-top: 12px; }
.frise-wrap {
  overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 340px);
  border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--bg-sidebar); min-width: 0;
}
.frise-label-col {
  width: 180px; min-width: 180px; flex-shrink: 0;
  position: sticky; left: 0; background: var(--bg-sidebar);
  z-index: 2; border-right: 1px solid var(--border);
}
.frise-bar-col { flex: 1; position: relative; overflow: hidden; }
.frise-axis-row {
  display: flex; align-items: stretch; border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 4; background: var(--bg-sidebar);
}
.frise-axis-label {
  display: flex; align-items: center; padding: 0 12px;
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .5px; color: var(--text-muted); height: 32px; z-index: 5;
}
.frise-axis-months { height: 32px; position: relative; }
.frise-month-tick {
  position: absolute; top: 8px; font-size: 10px; font-weight: 600;
  color: var(--text-muted); white-space: nowrap; transform: translateX(-50%);
  pointer-events: none; letter-spacing: .3px;
}
.frise-month-bg { position: absolute; top: 0; bottom: 0; }
.frise-month-bg.even { background: rgba(255,255,255,.018); }
.frise-today {
  position: absolute; top: 0; bottom: 0; width: 1.5px;
  background: rgba(74,144,217,.55); z-index: 1; pointer-events: none;
}
.frise-promo-heading { display: flex; align-items: stretch; border-bottom: 1px solid var(--border); }
.frise-promo-label-col {
  display: flex; align-items: center; gap: 8px; padding: 7px 12px;
  font-size: 10.5px; font-weight: 800; text-transform: uppercase;
  letter-spacing: .4px; color: var(--text-secondary);
}
.frise-promo-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 6px currentColor; }
.frise-promo-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.frise-promo-bar-col { background: rgba(255,255,255,.015); }
.frise-row {
  display: flex; align-items: stretch; height: 96px;
  border-bottom: 1px solid rgba(255,255,255,.04);
  cursor: pointer; transition: background var(--t-fast); min-width: 700px;
}
.frise-row:hover { background: rgba(74,144,217,.04); }
.frise-row:hover .frise-label-col { background: rgba(74,144,217,.06); }
.frise-project-label {
  display: flex; align-items: center; gap: 7px; padding: 0 10px 0 14px;
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  cursor: pointer; transition: color var(--t-fast);
}
.frise-row:hover .frise-project-label { color: var(--accent-light); }
.frise-project-icon { color: var(--accent); flex-shrink: 0; }
.frise-project-label > span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.frise-project-arrow { color: var(--text-muted); flex-shrink: 0; transition: transform var(--t-fast), color var(--t-fast); }
.frise-row:hover .frise-project-arrow { transform: translateX(2px); color: var(--accent); }
.frise-timeline { position: relative; }
.frise-proj-line {
  position: absolute; top: 50%; height: 2px; transform: translateY(-50%);
  background: rgba(255,255,255,.12); border-radius: 1px; pointer-events: none;
}
.frise-milestone {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center;
  cursor: pointer; z-index: 2; transition: transform var(--t-fast);
}
.frise-milestone:hover { transform: translate(-50%, -50%) scale(1.15); }
.frise-ms-dot {
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--bg-sidebar); flex-shrink: 0; transition: box-shadow var(--t-fast);
}
.frise-milestone:hover .frise-ms-dot { box-shadow: 0 0 0 3px rgba(255,255,255,.15); }
.frise-ms-soutenance .frise-ms-dot,
.frise-ms-cctl .frise-ms-dot { border-radius: 2px; transform: rotate(45deg); }
.frise-ms-livrable .frise-ms-dot     { background: var(--accent); }
.frise-ms-soutenance .frise-ms-dot   { background: var(--color-warning); }
.frise-ms-cctl .frise-ms-dot         { background: #9b87f5; }
.frise-ms-etude_de_cas .frise-ms-dot { background: var(--color-success); }
.frise-ms-memoire .frise-ms-dot      { background: #e74c3c; }
.frise-ms-autre .frise-ms-dot        { background: #95a5a6; }
.frise-ms-draft .frise-ms-dot { opacity: .35; }
.frise-ms-done .frise-ms-dot { filter: brightness(1.2); box-shadow: 0 0 0 2px rgba(255,255,255,.2); }
.frise-ms-label {
  display: flex; flex-direction: column; align-items: center;
  gap: 1px; pointer-events: none; white-space: nowrap;
}
.frise-ms-above .frise-ms-label { margin-bottom: 5px; }
.frise-milestone:not(.frise-ms-above) .frise-ms-label { margin-top: 5px; }
.frise-ms-title {
  font-size: 9.5px; font-weight: 700; color: var(--text-secondary);
  max-width: 90px; overflow: hidden; text-overflow: ellipsis; text-align: center;
}
.frise-ms-date { font-size: 8.5px; color: var(--text-muted); font-weight: 500; }
.frise-interactive { cursor: grab; user-select: none; }
.frise-grabbing    { cursor: grabbing; }
</style>
