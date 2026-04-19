/**
 * TabAccueil.vue
 * ---------------------------------------------------------------------------
 * Bento-Box unifie : toutes les tuiles du prof (focus, stats, agenda, actions,
 * widgets optionnels) sont rangees dans une seule grille drag and drop. Aucune
 * tuile n est obligatoire : en mode edition, un bouton X permet de masquer
 * chaque tuile et un bouton "Auto" reorganise intelligemment la grille.
 */
<script setup lang="ts">
import { ref, computed, watch, toRef, type Component, type CSSProperties } from 'vue'
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
import WidgetTypeRace from './student-widgets/WidgetTypeRace.vue'
import MultiPromoCard from './MultiPromoCard.vue'
import AccueilFocusTile from './accueil/AccueilFocusTile.vue'
import AccueilScheduleTile from './accueil/AccueilScheduleTile.vue'
import AccueilMessagesTile from './accueil/AccueilMessagesTile.vue'
import AccueilActivityTile from './accueil/AccueilActivityTile.vue'
import AccueilStatTile    from './accueil/AccueilStatTile.vue'
import { useTeacherBento } from '@/composables/useTeacherBento'
import { useAccueilFocusTile } from '@/composables/useAccueilFocusTile'
import { useAccueilSchedule } from '@/composables/useAccueilSchedule'
import { useAccueilActivityFeed } from '@/composables/useAccueilActivityFeed'
import { sizeToGridSpan } from '@/types/widgets'
import type { WidgetDef } from '@/types/widgets'

const bento = useTeacherBento()
import {
  Edit3,
  PlusCircle, Bell, BarChart2,
  X, Plus, Wand2,
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

// ── Mapping id -> composant (widgets optionnels non "core") ─────────────────
const optWidgetComponents: Record<string, Component> = {
  'at-risk': WidgetAtRisk,
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
  'typerace': WidgetTypeRace,
}
function spanStyle(id: string): CSSProperties {
  const { colSpan, rowSpan } = sizeToGridSpan(bento.getWidgetSize(id))
  return { gridColumn: `span ${colSpan}`, gridRow: `span ${rowSpan}` }
}

// ── Drag-and-drop unifie : toutes les tuiles visibles ────────────────────────
const draggableTiles = ref<WidgetDef[]>([...bento.visibleTiles.value])
watch(() => bento.visibleTiles.value, (v) => { draggableTiles.value = [...v] })
function onDragEnd() { bento.reorderTiles(draggableTiles.value) }

function smartReorganize() {
  bento.smartReorganize()
}
</script>

<template>
  <div class="bento-root">

    <!-- ═══ MULTI-PROMO (full width, hors grille draggable) ═══ -->
    <MultiPromoCard
      v-if="promos.length >= 2"
      :promos="promos"
      class="bento-multi-promo"
      @open-devoir="(tid, pid, cid, cname) => emit('openDevoirCrossPromo', tid, pid, cid, cname)"
    />

    <!-- ═══ GRILLE UNIFIEE (core + optionnels) ═══ -->
    <VueDraggable
      v-model="draggableTiles"
      :disabled="!editMode"
      ghost-class="bento-tile--ghost"
      :animation="200"
      class="bento-grid"
      :class="{ 'bento-grid--editing': editMode }"
      @end="onDragEnd"
    >
      <template v-for="w in draggableTiles" :key="w.id">

        <!-- Focus (2x2) -->
        <AccueilFocusTile
          v-if="w.id === 'focus'"
          :state="focusState"
          :bg-class="focusBgClass"
          :edit-mode="editMode"
          :style="spanStyle(w.id)"
          @remove="bento.toggleTile('focus')"
        />

        <!-- Stats 1x1 — factorises via AccueilStatTile -->
        <AccueilStatTile
          v-else-if="w.id === 'stat-soumis'"
          label="soumis"
          :value="Math.round(submissionRate) + '%'"
          :icon="Percent"
          variant="ring"
          :ring-pct="submissionRate"
          :edit-mode="editMode"
          :aria-label="`Masquer ${w.label}`"
          :style="spanStyle(w.id)"
          @remove="bento.toggleTile(w.id)"
        />
        <AccueilStatTile
          v-else-if="w.id === 'stat-noter'"
          label="a noter"
          :value="aNoterCount"
          :icon="Edit3"
          :alert="aNoterCount > 0"
          :edit-mode="editMode"
          :aria-label="`Masquer ${w.label}`"
          :style="spanStyle(w.id)"
          @remove="bento.toggleTile(w.id)"
        />
        <AccueilStatTile
          v-else-if="w.id === 'stat-moyenne'"
          label="moyenne"
          :value="averageGrade"
          :icon="Award"
          variant="grade"
          :edit-mode="editMode"
          :aria-label="`Masquer ${w.label}`"
          :style="spanStyle(w.id)"
          @remove="bento.toggleTile(w.id)"
        />
        <AccueilStatTile
          v-else-if="w.id === 'stat-online'"
          label="en ligne"
          :value="onlineStudents"
          :icon="Wifi"
          variant="online-dot"
          :edit-mode="editMode"
          :aria-label="`Masquer ${w.label}`"
          :style="spanStyle(w.id)"
          @remove="bento.toggleTile(w.id)"
        />

        <!-- Schedule (2x1 / 4x1) -->
        <AccueilScheduleTile
          v-else-if="w.id === 'schedule'"
          :events="todayEvents"
          :edit-mode="editMode"
          :is-past-event="isPastEvent"
          :is-current-event="isCurrentEvent"
          :style="spanStyle(w.id)"
          @remove="bento.toggleTile('schedule')"
        />

        <!-- Messages (1x1 / 2x1) -->
        <AccueilMessagesTile
          v-else-if="w.id === 'messages'"
          :entries="unreadDmEntries"
          :total-unread="totalUnreadDms"
          :edit-mode="editMode"
          :style="spanStyle(w.id)"
          @open-dm="(n) => emit('openDmFromDashboard', n)"
          @remove="bento.toggleTile('messages')"
        />

        <!-- Quick actions (2x1) -->
        <div
          v-else-if="w.id === 'actions'"
          class="dashboard-card bento-tile bento-actions"
          :class="{ 'bento-tile--editing': editMode }"
          :style="spanStyle(w.id)"
        >
          <button v-if="editMode" class="bento-tile-remove" :aria-label="`Masquer ${w.label}`" @click="bento.toggleTile(w.id)"><X :size="14" /></button>
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

        <!-- Activity feed (2x1) -->
        <AccueilActivityTile
          v-else-if="w.id === 'activity'"
          :items="activityFeed"
          :edit-mode="editMode"
          :style="spanStyle(w.id)"
          @remove="bento.toggleTile('activity')"
        />

        <!-- Todo (2x1) -->
        <div
          v-else-if="w.id === 'todo'"
          class="dashboard-card bento-tile bento-todo"
          :class="{ 'bento-tile--editing': editMode }"
          :style="spanStyle(w.id)"
        >
          <button v-if="editMode" class="bento-tile-remove" :aria-label="`Masquer ${w.label}`" @click="bento.toggleTile(w.id)"><X :size="14" /></button>
          <TeacherTodoWidget />
        </div>

        <!-- Widgets optionnels generiques (tous les autres) -->
        <div
          v-else-if="optWidgetComponents[w.id]"
          class="dashboard-card bento-tile bento-optional"
          :class="{ 'bento-tile--editing': editMode }"
          :style="spanStyle(w.id)"
        >
          <button v-if="editMode" class="bento-tile-remove" :aria-label="`Masquer ${w.label}`" @click="bento.toggleTile(w.id)"><X :size="14" /></button>
          <component :is="optWidgetComponents[w.id]" v-bind="w.id === 'week-cal' ? { items: next48h } : {}" />
        </div>

      </template>
    </VueDraggable>

    <!-- ═══ ACTIONS DE LA BARRE D EDITION ═══ -->
    <div v-if="editMode" class="bento-edit-actions">
      <button v-if="hiddenTileDefs.length" class="bento-edit-btn bento-edit-btn--add" @click="showTileDrawer = !showTileDrawer">
        <Plus :size="16" />
        <span>Ajouter une tuile ({{ hiddenTileDefs.length }})</span>
      </button>
      <button
        v-if="draggableTiles.length > 1"
        class="bento-edit-btn bento-edit-btn--auto"
        title="Reorganiser intelligemment"
        @click="smartReorganize"
      >
        <Wand2 :size="16" />
        <span>Reorganiser auto</span>
      </button>
      <button
        class="bento-edit-btn bento-edit-btn--reset"
        title="Revenir aux tuiles par defaut"
        @click="bento.resetTiles()"
      >
        Reinitialiser
      </button>
    </div>

    <!-- Tile drawer -->
    <Transition name="bento-drawer">
      <div v-if="editMode && showTileDrawer && hiddenTileDefs.length" class="bento-drawer">
        <div class="bento-drawer-header">
          <h4>Tuiles masquees</h4>
          <button aria-label="Fermer" @click="showTileDrawer = false"><X :size="14" /></button>
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

  </div>
</template>

<style scoped>
.bento-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 14px;
}
.bento-multi-promo { width: 100%; }

/* ── Bento Grid ── */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: minmax(100px, auto);
  grid-auto-flow: row dense;
  gap: 12px;
}

/* ── FOCUS TILE (2x2) ── */
.bento-focus {
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

/* ── SCHEDULE STRIP ── */
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
.schedule-past { opacity: .4; }
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

/* ── QUICK ACTIONS ── */
.bento-actions {
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

/* ── ACTIVITY FEED ── */
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

/* ── Responsive ── */
@media (max-width: 768px) {
  .bento-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .bento-grid { grid-template-columns: 1fr; }
  .bento-actions { flex-direction: column; }
  .schedule-list { flex-direction: column; }
  .schedule-item { flex-shrink: initial; }
}

/* ── Edit mode ── */
.bento-grid--editing { gap: 14px; }

.bento-tile--editing {
  border: 2px dashed transparent;
  animation: bento-jiggle var(--motion-slow) var(--ease-out) infinite alternate;
}
.bento-tile--editing:hover { border-color: rgba(var(--accent-rgb), .35); }

@keyframes bento-jiggle {
  from { transform: rotate(-0.25deg); }
  to   { transform: rotate(0.25deg); }
}

.bento-tile--ghost {
  opacity: 0.35;
  border: 2px dashed var(--accent) !important;
  border-radius: var(--radius);
}

/* ── Remove button (ameliore) ── */
.bento-tile-remove {
  position: absolute; top: -10px; right: -10px; z-index: 10;
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: var(--radius-full);
  background: var(--color-danger); color: #fff;
  border: 2px solid var(--bg-main);
  cursor: pointer;
  transition: transform var(--t-base), box-shadow var(--t-base), background var(--t-base);
  box-shadow: 0 3px 10px rgba(239, 68, 68, .35);
  padding: 0;
}
.bento-tile-remove:hover {
  transform: scale(1.18);
  background: #dc2626;
  box-shadow: 0 4px 14px rgba(239, 68, 68, .55);
}
.bento-tile-remove:focus-visible {
  outline: 3px solid rgba(239, 68, 68, .4);
  outline-offset: 2px;
}

.bento-grid .dashboard-card,
.bento-grid .bento-tile {
  position: relative;
}

/* ── Edit action bar (boutons bas de grille) ── */
.bento-edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.bento-edit-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 16px; border-radius: var(--radius);
  font-family: var(--font); font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all var(--t-base);
  border: 1px solid var(--border); background: var(--bg-elevated);
  color: var(--text-primary);
}
.bento-edit-btn:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}
.bento-edit-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }

.bento-edit-btn--add {
  border: 1px dashed rgba(var(--accent-rgb), .5);
  background: var(--accent-subtle);
  color: var(--accent);
}
.bento-edit-btn--auto {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.bento-edit-btn--auto:hover { filter: brightness(1.1); border-color: var(--accent); }
.bento-edit-btn--reset { color: var(--text-muted); }

/* Drawer */
.bento-drawer {
  margin-top: 4px; padding: 16px; border-radius: var(--radius-lg);
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
</style>
