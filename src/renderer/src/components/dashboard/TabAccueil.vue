/**
 * TabAccueil.vue
 * ---------------------------------------------------------------------------
 * Bento-Box + Task-Driven hybrid layout for the teacher dashboard Accueil tab.
 * Uses CSS Grid with tiles of varying sizes to create visual hierarchy:
 *   Focus (2x2) | 4 stat tiles (1x1) | Schedule strip (2x1) |
 *   Messages (1x1) | Quick actions (2x1) | Activity feed (2x1)
 */
<script setup lang="ts">
import { ref, computed, watch, toRef, type Component } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import TeacherTodoWidget from './TeacherTodoWidget.vue'
import WidgetClock from './student-widgets/WidgetClock.vue'
import WidgetQuote from './student-widgets/WidgetQuote.vue'
import WidgetPomodoro from './student-widgets/WidgetPomodoro.vue'
import WidgetQuickLinks from './student-widgets/WidgetQuickLinks.vue'
import WidgetDmFiles from './teacher-widgets/WidgetDmFiles.vue'
import WidgetWeekCal from './teacher-widgets/WidgetWeekCal.vue'
import WidgetSignatures from './teacher-widgets/WidgetSignatures.vue'
import WidgetAtRisk from './teacher-widgets/WidgetAtRisk.vue'
import WidgetLumenEngagement from './teacher-widgets/WidgetLumenEngagement.vue'
import WidgetLumenMyCourses from './teacher-widgets/WidgetLumenMyCourses.vue'
import WidgetLumenTopRead from './teacher-widgets/WidgetLumenTopRead.vue'
import WidgetQuickCreate from './teacher-widgets/WidgetQuickCreate.vue'
import WidgetNotationPending from './teacher-widgets/WidgetNotationPending.vue'
import WidgetStickyNote from './teacher-widgets/WidgetStickyNote.vue'
import WidgetPromoVelocity from './teacher-widgets/WidgetPromoVelocity.vue'
import WidgetFeedbackTemplates from './teacher-widgets/WidgetFeedbackTemplates.vue'
import WidgetAgendaJour from './teacher-widgets/WidgetAgendaJour.vue'
import WidgetCahier from './student-widgets/WidgetCahier.vue'
import WidgetActuCursus from './student-widgets/WidgetActuCursus.vue'
import MultiPromoCard from './MultiPromoCard.vue'
import AccueilFocusTile from './accueil/AccueilFocusTile.vue'
import AccueilScheduleTile from './accueil/AccueilScheduleTile.vue'
import AccueilMessagesTile from './accueil/AccueilMessagesTile.vue'
import AccueilActivityTile from './accueil/AccueilActivityTile.vue'
import { useTeacherBento } from '@/composables/useTeacherBento'
import { useAccueilFocusTile } from '@/composables/useAccueilFocusTile'
import { useAccueilSchedule } from '@/composables/useAccueilSchedule'
import { useAccueilActivityFeed } from '@/composables/useAccueilActivityFeed'

const bento = useTeacherBento()
import {
  Edit3,
  PlusCircle, Bell, BarChart2,
  X, Plus,
  Percent, Wifi, Award,
} from 'lucide-vue-next'
import { gradeClass } from '@/utils/format'
import type { ProjectCard, GanttRow } from '@/composables/useDashboardTeacher'
import type { AgendaItem } from '@/composables/useDashboardWidgets'
import type { Depot } from '@/types'

const props = defineProps<{
  // Stats
  aNoterCount: number
  submissionRate: number
  onlineStudents: number
  brouillonsCount: number

  // Action center data for focus tile
  actionItems: { id: string; type: string; title: string; subtitle: string; urgency: string; action: () => void }[]

  // Global mode grade (letter grade average)
  globalModeGrade: string | null

  // Schedule (next 48h agenda items)
  next48h: AgendaItem[]

  // Messages
  unreadDmEntries: { name: string; count: number }[]
  totalUnreadDms: number

  // Forgotten drafts (for focus tile)
  forgottenDrafts: GanttRow[]

  // Projects & rendus
  projectCards: ProjectCard[]
  recentRendus: Depot[]

  // Multi-promo
  promos: import('@/types').Promotion[]
}>()

const emit = defineEmits<{
  goToProject: [key: string]
  openNewDevoir: []
  openDmFromDashboard: [name: string]
  publishDraft: [id: number]
  switchToFrise: []
  openActiveDevoir: []
  openDevoirCrossPromo: [travailId: number, promoId: number, channelId: number, channelName: string]
}>()

// ── Focus tile + Schedule + Activity feed (composables extraits) ─────────────
const { state: focusState, bgClass: focusBgClass } = useAccueilFocusTile({
  aNoterCount: toRef(props, 'aNoterCount'),
  actionItems: toRef(props, 'actionItems'),
  forgottenDrafts: toRef(props, 'forgottenDrafts'),
  onPublishSingleDraft: (id: number) => emit('publishDraft', id),
})

const { todayEvents, isPastEvent, isCurrentEvent } = useAccueilSchedule(toRef(props, 'next48h'))

const { items: activityFeed } = useAccueilActivityFeed(toRef(props, 'recentRendus'))

// ── Stat: average grade letter ────────────────────────────────────────────────
const averageGrade = computed(() => props.globalModeGrade ?? '--')

// ── Edit mode (reuse composable for hide/show) ──────────────────────────────
const editMode = ref(false)
const showTileDrawer = ref(false)
const hiddenTileDefs = computed(() => bento.allTiles.filter(t => bento.hidden.value.has(t.id)))

function toggleEditMode() {
  editMode.value = !editMode.value
  if (!editMode.value) showTileDrawer.value = false
}
defineExpose({ toggleEditMode, editMode })

// ── Drag-and-drop widgets optionnels ────────────────────────────────────────
const optWidgetComponents: Record<string, Component> = {
  clock: WidgetClock, quote: WidgetQuote, pomodoro: WidgetPomodoro,
  quicklinks: WidgetQuickLinks, 'dm-files': WidgetDmFiles, 'week-cal': WidgetWeekCal,
  signatures: WidgetSignatures,
  'lumen-engagement': WidgetLumenEngagement,
  'lumen-my-courses': WidgetLumenMyCourses,
  'lumen-top-read': WidgetLumenTopRead,
  'quick-create': WidgetQuickCreate,
  'notation-pending': WidgetNotationPending,
  'sticky-note': WidgetStickyNote,
  'promo-velocity': WidgetPromoVelocity,
  'feedback-templates': WidgetFeedbackTemplates,
  'agenda-jour': WidgetAgendaJour,
  'cahier': WidgetCahier,
  'actu': WidgetActuCursus,
}
const wideWidgets = new Set([
  'quote', 'quicklinks', 'dm-files', 'week-cal', 'signatures',
  'lumen-engagement', 'lumen-my-courses', 'lumen-top-read',
  'feedback-templates', 'agenda-jour', 'cahier',
])

const draggableOpt = ref([...bento.visibleOptionalTiles.value])
watch(() => bento.visibleOptionalTiles.value, (v) => { draggableOpt.value = [...v] })
function onOptDragEnd() { bento.reorderOptional(draggableOpt.value) }
</script>

<template>
  <div class="bento-grid" :class="{ 'bento-grid--editing': editMode }">

    <!-- ═══ MULTI-PROMO (full width, above bento) ═══ -->
    <MultiPromoCard
      v-if="promos.length >= 2"
      :promos="promos"
      style="grid-column: 1 / -1"
      @open-devoir="(tid, pid, cid, cname) => emit('openDevoirCrossPromo', tid, pid, cid, cname)"
    />

    <!-- ═══ AT-RISK STUDENTS (2x1) ═══ -->
    <div v-if="bento.isVisible('at-risk')" class="dashboard-card bento-tile" style="grid-column: span 2">
      <WidgetAtRisk />
    </div>

    <!-- ═══ FOCUS TILE (2x2) ═══ -->
    <AccueilFocusTile
      v-if="bento.isVisible('focus')"
      :state="focusState"
      :bg-class="focusBgClass"
    />

    <!-- ═══ STAT TILES (1x1 each) ═══ -->

    <!-- Soumission % -->
    <div v-if="bento.isVisible('stat-soumis')" class="dashboard-card bento-tile bento-stat">
      <div class="stat-ring">
        <svg viewBox="0 0 36 36" class="stat-ring-svg">
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--bg-active)" stroke-width="3" />
          <circle
            cx="18" cy="18" r="15" fill="none"
            stroke="var(--accent)" stroke-width="3"
            stroke-linecap="round"
            :stroke-dasharray="`${submissionRate * 0.942} 94.2`"
            transform="rotate(-90 18 18)"
            style="transition: stroke-dasharray .6s ease"
          />
        </svg>
      </div>
      <span class="stat-number">{{ Math.round(submissionRate) }}%</span>
      <span class="stat-label">soumis</span>
      <Percent :size="14" class="stat-icon" />
    </div>

    <!-- A noter -->
    <div v-if="bento.isVisible('stat-noter')" class="dashboard-card bento-tile bento-stat" :class="{ 'stat--alert': aNoterCount > 0 }">
      <span class="stat-number">{{ aNoterCount }}</span>
      <span class="stat-label">a noter</span>
      <Edit3 :size="14" class="stat-icon" />
    </div>

    <!-- Moyenne -->
    <div v-if="bento.isVisible('stat-moyenne')" class="dashboard-card bento-tile bento-stat">
      <span class="stat-number stat-grade" :class="gradeClass(averageGrade)">{{ averageGrade }}</span>
      <span class="stat-label">moyenne</span>
      <Award :size="14" class="stat-icon" />
    </div>

    <!-- En ligne -->
    <div v-if="bento.isVisible('stat-online')" class="dashboard-card bento-tile bento-stat">
      <span class="stat-online-dot" />
      <span class="stat-number">{{ onlineStudents }}</span>
      <span class="stat-label">en ligne</span>
      <Wifi :size="14" class="stat-icon" />
    </div>

    <!-- ═══ SCHEDULE STRIP (2x1) ═══ -->
    <AccueilScheduleTile
      v-if="bento.isVisible('schedule')"
      :events="todayEvents"
      :edit-mode="editMode"
      :is-past-event="isPastEvent"
      :is-current-event="isCurrentEvent"
      @remove="bento.toggleTile('schedule')"
    />

    <!-- ═══ MESSAGES TILE (1x1) ═══ -->
    <AccueilMessagesTile
      v-if="bento.isVisible('messages')"
      :entries="unreadDmEntries"
      :total-unread="totalUnreadDms"
      :edit-mode="editMode"
      @open-dm="(n) => emit('openDmFromDashboard', n)"
      @remove="bento.toggleTile('messages')"
    />

    <!-- ═══ QUICK ACTIONS (2x1) ═══ -->
    <div v-if="bento.isVisible('actions')" class="dashboard-card bento-tile bento-actions" :class="{ 'bento-tile--editing': editMode }">
      <button v-if="editMode" class="bento-tile-remove" @click="bento.toggleTile('actions')"><X :size="12" /></button>
      <button class="action-btn action-btn--primary" @click="emit('openNewDevoir')">
        <PlusCircle :size="22" />
        <span class="action-label">Creer un devoir</span>
      </button>
      <button class="action-btn action-btn--secondary" @click="emit('openActiveDevoir')">
        <Bell :size="22" />
        <span class="action-label">Envoyer un rappel</span>
      </button>
      <button class="action-btn action-btn--secondary" @click="emit('switchToFrise')">
        <BarChart2 :size="22" />
        <span class="action-label">Voir la frise</span>
      </button>
    </div>

    <!-- ═══ ACTIVITY FEED (2x1) ═══ -->
    <AccueilActivityTile
      v-if="bento.isVisible('activity')"
      :items="activityFeed"
      :edit-mode="editMode"
      @remove="bento.toggleTile('activity')"
    />

    <!-- ═══ TODO WIDGET (2x1) ═══ -->
    <div v-if="bento.isVisible('todo')" class="dashboard-card bento-tile bento-todo" :class="{ 'bento-tile--editing': editMode }">
      <button v-if="editMode" class="bento-tile-remove" @click="bento.toggleTile('todo')"><X :size="12" /></button>
      <TeacherTodoWidget />
    </div>

    <!-- ═══ OPTIONAL WIDGETS (drag-and-drop en mode édition) ═══ -->
    <VueDraggable
      v-if="draggableOpt.length"
      v-model="draggableOpt"
      :disabled="!editMode"
      ghost-class="bento-opt--ghost"
      :animation="200"
      class="bento-opt-grid"
      @end="onOptDragEnd"
    >
      <div
        v-for="t in draggableOpt"
        :key="t.id"
        class="dashboard-card bento-tile bento-optional"
        :class="{ 'bento-tile--editing': editMode, 'bento-optional--wide': wideWidgets.has(t.id) }"
      >
        <button v-if="editMode" class="bento-tile-remove" @click="bento.toggleTile(t.id); bento.refreshVisibleOptional()"><X :size="12" /></button>
        <component :is="optWidgetComponents[t.id]" v-bind="t.id === 'week-cal' ? { items: next48h } : {}" />
      </div>
    </VueDraggable>

    <!-- ═══ ADD WIDGET (edit mode) ═══ -->
    <button v-if="editMode && hiddenTileDefs.length" class="bento-add-tile" @click="showTileDrawer = !showTileDrawer">
      <Plus :size="20" />
      <span>Ajouter une tuile</span>
    </button>
  </div>

  <!-- Tile drawer -->
  <Transition name="bento-drawer">
    <div v-if="editMode && showTileDrawer && hiddenTileDefs.length" class="bento-drawer">
      <div class="bento-drawer-header">
        <h4>Tuiles masquees</h4>
        <button @click="showTileDrawer = false"><X :size="14" /></button>
      </div>
      <div class="bento-drawer-list">
        <button
          v-for="t in hiddenTileDefs"
          :key="t.id"
          class="bento-drawer-item"
          @click="bento.toggleTile(t.id)"
        >
          <component :is="t.icon" :size="16" />
          <span>{{ t.label }}</span>
          <Plus :size="14" class="bento-drawer-item-add" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ── Bento Grid ── */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: minmax(100px, auto);
  gap: 12px;
  padding-top: 14px;
}

/* ── Base tile: extends .dashboard-card from dashboard-shared.css ── */

/* ── FOCUS TILE (2x2) ── */
.bento-focus {
  grid-column: span 2;
  grid-row: span 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
  padding: 28px 24px;
}
.focus-icon { opacity: .7; margin-bottom: 4px; }

.focus--critical {
  background: rgba(239, 68, 68, .08);
  border-color: rgba(239, 68, 68, .25);
}
.focus--critical .focus-icon { color: var(--color-danger); }

.focus--warning {
  background: rgba(245, 158, 11, .08);
  border-color: rgba(245, 158, 11, .25);
}
.focus--warning .focus-icon { color: var(--color-warning); }

.focus--normal {
  background: rgba(var(--accent-rgb), .06);
  border-color: rgba(var(--accent-rgb), .2);
}
.focus--normal .focus-icon { color: var(--accent); }

.focus--clear {
  background: linear-gradient(135deg, rgba(34, 197, 94, .06) 0%, rgba(var(--accent-rgb), .04) 100%);
  border-color: rgba(34, 197, 94, .2);
}
.focus--clear .focus-icon { color: var(--color-success); }

.focus-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2;
  margin: 0;
}
.focus-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}
.focus-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font);
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  transition: filter var(--t-base), transform var(--t-base);
}
.focus-action:hover { filter: brightness(1.1); transform: translateY(-1px); }
.focus-action:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }

/* ── STAT TILES ── */
.bento-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
  min-height: 100px;
}
.stat-number {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
}
.stat-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .5px;
}
.stat-icon {
  position: absolute;
  top: 10px;
  right: 10px;
  color: var(--text-muted);
  opacity: .3;
}
.stat-ring {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.stat-ring-svg {
  width: 72px;
  height: 72px;
  opacity: .6;
}
.stat--alert {
  background: rgba(239, 68, 68, .06);
  border-color: rgba(239, 68, 68, .2);
}
.stat--alert .stat-number { color: var(--color-danger); }
.stat--alert .stat-icon { color: var(--color-danger); opacity: .4; }

.stat-online-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-success);
  box-shadow: 0 0 6px rgba(34, 197, 94, .5);
  margin-bottom: 2px;
}

.stat-grade.grade-a { color: var(--color-success); }
.stat-grade.grade-b { color: var(--color-online); }
.stat-grade.grade-c { color: var(--color-warning); }
.stat-grade.grade-d { color: var(--color-danger); }
.stat-grade.grade-empty { color: var(--text-muted); }

/* ── SCHEDULE STRIP (spans 2 cols) ── */
.bento-schedule {
  grid-column: span 2;
}
.tile-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  margin: 0 0 10px;
}
.schedule-empty, .messages-empty, .activity-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px 0;
}
.schedule-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.schedule-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  flex-shrink: 0;
  transition: opacity var(--t-base), background var(--t-base);
}
.schedule-past {
  opacity: .4;
}
.schedule-current {
  background: var(--accent-subtle);
  border-color: rgba(var(--accent-rgb), .3);
}
.schedule-time {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.schedule-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.schedule-type-deadline   { background: rgba(var(--accent-rgb), .15); color: var(--accent); }
.schedule-type-soutenance { background: rgba(139, 92, 246, .15); color: var(--color-cctl); }
.schedule-type-reminder   { background: rgba(34, 197, 94, .15); color: var(--color-success); }
.schedule-title {
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

/* ── MESSAGES TILE ── */
.bento-messages {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.messages-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-subtle);
  padding: 2px 8px;
  border-radius: var(--radius);
  align-self: flex-start;
}
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.messages-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  font-family: var(--font);
  color: var(--text-primary);
  transition: background var(--t-fast);
}
.messages-item:hover { background: var(--bg-hover); }
.messages-avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.messages-name {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.messages-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-subtle);
  padding: 1px 6px;
  border-radius: var(--radius);
  flex-shrink: 0;
}

/* ── QUICK ACTIONS (spans 2 cols) ── */
.bento-actions {
  grid-column: span 2;
  display: flex;
  gap: 10px;
  align-items: stretch;
  padding: 12px;
}
.action-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 10px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--t-base) ease;
  font-family: var(--font);
  border: 1px solid var(--border);
  min-height: 80px;
}
.action-btn--primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.action-btn--primary:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
.action-btn--secondary {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}
.action-btn--secondary:hover {
  background: var(--bg-active);
  color: var(--text-primary);
  border-color: var(--accent);
}
.action-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }
.action-label {
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

/* ── ACTIVITY FEED (spans 2 cols) ── */
.bento-activity {
  grid-column: span 2;
}
.bento-todo {
  grid-column: span 2;
}

/* ── Optional widgets (drag-drop grid) ── */
.bento-opt-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  grid-column: 1 / -1;
}
.bento-optional { grid-column: span 1; }
.bento-optional--wide { grid-column: span 2; }
.bento-opt--ghost {
  opacity: 0.3;
  border: 2px dashed var(--accent) !important;
  border-radius: var(--radius);
}
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.activity-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  transition: background var(--t-fast);
}
.activity-item:hover { background: var(--bg-elevated); }
.activity-icon {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-subtle);
  color: var(--accent);
  flex-shrink: 0;
}
.activity-label {
  flex: 1;
  font-size: 12.5px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.activity-time {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

/* ── Responsive: tablet (2 cols) ── */
@media (max-width: 768px) {
  .bento-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .bento-focus {
    grid-column: span 2;
    grid-row: span 1;
    padding: 20px;
  }
  .focus-title { font-size: 18px; }
  .bento-schedule { grid-column: span 2; }
  .bento-actions { grid-column: span 2; }
  .bento-activity { grid-column: span 2; }
}

/* ── Responsive: mobile (1 col) ── */
@media (max-width: 480px) {
  .bento-grid {
    grid-template-columns: 1fr;
  }
  .bento-focus,
  .bento-schedule,
  .bento-actions,
  .bento-activity {
    grid-column: span 1;
  }
  .bento-focus { grid-row: span 1; }
  .bento-actions {
    flex-direction: column;
  }
  .schedule-list {
    flex-direction: column;
  }
  .schedule-item {
    flex-shrink: initial;
  }
}

/* ── Edit mode ── */
.bento-grid--editing { gap: 14px; }

.bento-tile--editing {
  border: 2px dashed transparent;
  animation: bento-jiggle var(--motion-slow) var(--ease-out) infinite alternate;
}
.bento-tile--editing:hover { border-color: rgba(var(--accent-rgb), .3); }

@keyframes bento-jiggle {
  from { transform: rotate(-0.2deg); }
  to   { transform: rotate(0.2deg); }
}

.bento-tile-remove {
  position: absolute; top: -8px; right: -8px; z-index: 5;
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: var(--radius-full);
  background: var(--color-danger); color: #fff; border: 2px solid var(--bg-main);
  cursor: pointer; transition: transform var(--t-base);
  box-shadow: 0 2px 6px rgba(0,0,0,.2);
}
.bento-tile-remove:hover { transform: scale(1.15); }

.bento-tile { position: relative; }

/* Add tile button */
.bento-add-tile {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 16px; border-radius: var(--radius-lg); grid-column: span 4;
  border: 2px dashed rgba(var(--accent-rgb), .3);
  background: var(--accent-subtle);
  color: var(--accent); cursor: pointer;
  transition: all var(--t-base); font-family: var(--font); font-size: 13px; font-weight: 600;
}
.bento-add-tile:hover {
  border-color: var(--accent); background: var(--accent-subtle);
}
.bento-add-tile:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }

/* Drawer */
.bento-drawer {
  margin-top: 12px; padding: 16px; border-radius: var(--radius-lg);
  background: var(--bg-elevated); border: 1px solid var(--border);
  box-shadow: 0 8px 24px rgba(0,0,0,.12);
}
.bento-drawer-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.bento-drawer-header h4 { font-size: 14px; font-weight: 700; color: var(--text-primary); margin: 0; }
.bento-drawer-header button {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  border: none; background: transparent; color: var(--text-muted); cursor: pointer;
}
.bento-drawer-header button:hover { background: var(--bg-hover); }

.bento-drawer-list {
  display: flex; flex-wrap: wrap; gap: 8px;
}
.bento-drawer-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: var(--radius);
  background: var(--bg-main); border: 1px solid var(--border);
  cursor: pointer; transition: all var(--t-base); font-family: var(--font);
  color: var(--text-primary); font-size: 12px; font-weight: 600;
}
.bento-drawer-item:hover {
  border-color: var(--accent); transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}
.bento-drawer-item:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }
.bento-drawer-item-add { color: var(--accent); opacity: .5; }
.bento-drawer-item:hover .bento-drawer-item-add { opacity: 1; }

/* Drawer transition */
.bento-drawer-enter-active { transition: all var(--t-slow) cubic-bezier(.4,0,.2,1); }
.bento-drawer-leave-active { transition: all var(--t-base) ease; }
.bento-drawer-enter-from { opacity: 0; transform: translateY(12px); }
.bento-drawer-leave-to { opacity: 0; transform: translateY(8px); }

@media (max-width: 768px) {
  .bento-add-tile { grid-column: span 2; }
}
@media (max-width: 480px) {
  .bento-add-tile { grid-column: span 1; }
}
</style>
