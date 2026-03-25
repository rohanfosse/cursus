/**
 * StudentBento.vue - Dashboard etudiant compact.
 */
<script setup lang="ts">
import { computed, ref, watch, nextTick, type Component } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { Settings, CheckCircle2, Clock, AlertTriangle, Wifi, X, Plus } from 'lucide-vue-next'
import { useBentoPrefs } from '@/composables/useBentoPrefs'
import { useAppStore } from '@/stores/app'
import { nextUpcoming } from '@/utils/devoirFilters'
import type { StudentProjectCard } from '@/composables/useDashboardStudent'

import WidgetLive from './student-widgets/WidgetLive.vue'
import WidgetProject from './student-widgets/WidgetProject.vue'
import WidgetExams from './student-widgets/WidgetExams.vue'
import WidgetLivrables from './student-widgets/WidgetLivrables.vue'
import WidgetSoutenances from './student-widgets/WidgetSoutenances.vue'
import WidgetLastFeedback from './student-widgets/WidgetLastFeedback.vue'
import WidgetRecentDoc from './student-widgets/WidgetRecentDoc.vue'
import WidgetClock from './student-widgets/WidgetClock.vue'
import WidgetQuote from './student-widgets/WidgetQuote.vue'
import WidgetCalendar from './student-widgets/WidgetCalendar.vue'
import WidgetProgress from './student-widgets/WidgetProgress.vue'
import WidgetQuickLinks from './student-widgets/WidgetQuickLinks.vue'
import WidgetPomodoro from './student-widgets/WidgetPomodoro.vue'
import { STUDENT_WIDGETS } from './student-widgets/registry'

const props = defineProps<{
  studentStats: { pending: number; submitted: number; graded: number; modeGrade: string | null }
  urgentActions: { id: number; title: string; isOverdue: boolean; urgency: string; category?: string | null; deadline?: string; type?: string }[]
  recentGrades: { title: string; note: string; category?: string | null }[]
  recentFeedback?: { title: string; feedback: string; note: string | null; category: string | null }[]
  studentProjectCards: StudentProjectCard[]
  hasDevoirsLoaded: boolean
}>()

const emit = defineEmits<{ goToProject: [key: string] }>()

const appStore = useAppStore()
const showCustomizer = ref(false)
const showWidgetDrawer = ref(false)

function toggleCustomizer() {
  showCustomizer.value = !showCustomizer.value
  if (!showCustomizer.value) showWidgetDrawer.value = false
}
defineExpose({ toggleCustomizer })

const { visibleWidgets, allWidgets, isVisible, toggleWidget, moveWidget, reorderWidgets, resetDefaults } = useBentoPrefs()

// No longer need customizerRef - inline edit mode now

// ── Widget data ──────────────────────────────────────────────────────────
const activeProject = computed(() => {
  if (!props.studentProjectCards.length) return null
  const withDeadline = props.studentProjectCards
    .filter(p => p.nextDeadline && new Date(p.nextDeadline).getTime() > Date.now())
    .sort((a, b) => new Date(a.nextDeadline!).getTime() - new Date(b.nextDeadline!).getTime())
  return withDeadline[0] ?? props.studentProjectCards[0]
})

const nextExams = computed(() => nextUpcoming(props.urgentActions, ['cctl', 'etude_de_cas'], Date.now(), 4))
const nextLivrables = computed(() => nextUpcoming(props.urgentActions, ['livrable', 'memoire'], Date.now(), 2))
const nextSoutenances = computed(() => nextUpcoming(props.urgentActions, ['soutenance'], Date.now(), 2))

const widgetComponents: Record<string, Component> = {
  live: WidgetLive, project: WidgetProject, exams: WidgetExams,
  livrables: WidgetLivrables, soutenances: WidgetSoutenances,
  feedback: WidgetLastFeedback, recentDoc: WidgetRecentDoc,
  clock: WidgetClock, quote: WidgetQuote, calendar: WidgetCalendar,
  progress: WidgetProgress, quicklinks: WidgetQuickLinks, pomodoro: WidgetPomodoro,
}

const latestFeedback = computed(() => props.recentFeedback?.[0] ?? null)

const calendarDeadlines = computed(() =>
  props.urgentActions.filter(a => a.deadline).map(a => ({ date: a.deadline!, title: a.title })),
)

const widgetProps = computed<Record<string, Record<string, unknown>>>(() => ({
  live: {}, project: { project: activeProject.value },
  exams: { exams: nextExams.value }, livrables: { livrables: nextLivrables.value },
  soutenances: { soutenances: nextSoutenances.value },
  feedback: { feedback: latestFeedback.value }, recentDoc: {},
  clock: {}, quote: {},
  calendar: { deadlines: calendarDeadlines.value },
  progress: { submitted: props.studentStats.submitted, total: totalDevoirs.value, graded: props.studentStats.graded },
  quicklinks: {}, pomodoro: {},
}))

const widgetEvents: Record<string, Record<string, (...args: unknown[]) => void>> = {
  project: { goToProject: (key: unknown) => emit('goToProject', key as string) },
  exams: { goToProject: (key: unknown) => emit('goToProject', key as string) },
  livrables: { goToProject: (key: unknown) => emit('goToProject', key as string) },
  soutenances: { goToProject: (key: unknown) => emit('goToProject', key as string) },
  feedback: { goToProject: (key: unknown) => emit('goToProject', key as string) },
}

// ── Stats ──────────────────────────────────────────────────────────────────
const totalDevoirs = computed(() => props.studentStats.pending + props.studentStats.submitted + props.studentStats.graded)
const overdueCount = computed(() => props.urgentActions.filter(a => a.isOverdue).length)
const submissionRate = computed(() =>
  totalDevoirs.value > 0
    ? Math.round(((props.studentStats.submitted + props.studentStats.graded) / totalDevoirs.value) * 100)
    : 0,
)
const onlineCount = computed(() => appStore.onlineUsers?.length ?? 0)

// Widgets masques (pour le drawer)
const hiddenWidgets = computed(() =>
  STUDENT_WIDGETS.filter(w => !isVisible(w.id) && w.id !== 'live' && w.id !== 'promoActivity'),
)

// Focus : only show if overdue (critical)
const showFocusAlert = computed(() => overdueCount.value > 0)

// Drag-and-drop : liste réordonnée des widgets visibles (hors live/promoActivity)
const draggableWidgets = ref(visibleWidgets.value.filter(w => w.id !== 'live' && w.id !== 'promoActivity'))
watch(visibleWidgets, (v) => { draggableWidgets.value = v.filter(w => w.id !== 'live' && w.id !== 'promoActivity') })
function onDragEnd() { reorderWidgets(draggableWidgets.value) }
</script>

<template>
  <div class="sb-bento">

    <WidgetLive v-if="isVisible('live')" />

    <!-- Alert banner (only if overdue) -->
    <div v-if="showFocusAlert" class="sb-alert">
      <AlertTriangle :size="16" />
      <span>{{ overdueCount }} devoir{{ overdueCount > 1 ? 's' : '' }} en retard</span>
    </div>

    <!-- Widgets grid (2 colonnes, drag-and-drop en mode édition) -->
    <VueDraggable
      v-model="draggableWidgets"
      :disabled="!showCustomizer"
      ghost-class="sb-widget--ghost"
      :animation="200"
      class="sb-grid"
      :class="{ 'sb-grid--editing': showCustomizer }"
      @end="onDragEnd"
    >
      <div v-for="w in draggableWidgets" :key="w.id" class="sb-widget" :class="{ 'sb-widget--editing': showCustomizer }">
        <button v-if="showCustomizer" class="sb-widget-remove" title="Retirer" @click="toggleWidget(w.id)">
          <X :size="14" />
        </button>
        <component
          :is="widgetComponents[w.id]"
          v-bind="widgetProps[w.id]"
          v-on="widgetEvents[w.id] ?? {}"
        />
      </div>
    </VueDraggable>

    <!-- Add widget button (edit mode) -->
    <button v-if="showCustomizer" class="sb-add-widget" @click="showWidgetDrawer = !showWidgetDrawer">
      <Plus :size="24" />
      <span>Ajouter un widget</span>
    </button>

    <!-- Widget drawer (edit mode) -->
    <Transition name="sb-drawer">
      <div v-if="showCustomizer && showWidgetDrawer" class="sb-drawer">
        <div class="sb-drawer-header">
          <h4>Widgets disponibles</h4>
          <button class="sb-drawer-close" @click="showWidgetDrawer = false"><X :size="14" /></button>
        </div>
        <div class="sb-drawer-grid">
          <button
            v-for="w in hiddenWidgets"
            :key="w.id"
            class="sb-drawer-card"
            @click="toggleWidget(w.id); showWidgetDrawer = hiddenWidgets.length > 1"
          >
            <div class="sb-drawer-card-icon">
              <component :is="w.icon" :size="20" />
            </div>
            <span class="sb-drawer-card-label">{{ w.label }}</span>
            <span class="sb-drawer-card-desc">{{ w.description }}</span>
            <Plus :size="14" class="sb-drawer-card-add" />
          </button>
        </div>
        <p v-if="!hiddenWidgets.length" class="sb-drawer-empty">Tous les widgets sont actifs</p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.sb-bento {
  display: flex; flex-direction: column; gap: 10px;
}

/* ── Alert (overdue only) ── */
.sb-alert {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: 10px;
  background: rgba(231, 76, 60, 0.08);
  border: 1px solid rgba(231, 76, 60, 0.2);
  color: #e74c3c; font-size: 13px; font-weight: 600;
}

/* ── Stats row ── */
.sb-stats {
  display: flex; align-items: center; gap: 0;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.sb-stat {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; gap: 1px;
}
.sb-stat-value {
  font-size: 18px; font-weight: 700;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  color: var(--text-primary); line-height: 1;
}
.sb-stat--warn { color: #e74c3c; }
.sb-stat-label {
  font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: .04em;
  color: var(--text-muted);
}
.sb-stat-sep {
  width: 1px; height: 24px;
  background: var(--border); opacity: .5;
}
.sb-stat-online {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 600; color: var(--text-muted);
  padding-left: 12px; margin-left: auto; flex-shrink: 0;
}
.sb-online-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 4px rgba(74, 222, 128, .4);
}

/* ── Widgets grid ── */
.sb-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.sb-grid--editing {
  gap: 12px;
}
.sb-widget {
  animation: sb-fade .3s ease both;
  position: relative;
}
.sb-widget--editing {
  border: 2px dashed transparent;
  border-radius: 14px;
  animation: sb-jiggle .3s ease infinite alternate;
}
.sb-widget--editing:hover {
  border-color: rgba(74,144,217,.3);
}
.sb-widget--ghost {
  opacity: 0.3;
  border: 2px dashed var(--accent) !important;
  border-radius: 14px;
}

@keyframes sb-fade {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sb-jiggle {
  from { transform: rotate(-0.3deg); }
  to   { transform: rotate(0.3deg); }
}

/* Remove button on widget */
.sb-widget-remove {
  position: absolute; top: -6px; right: -6px; z-index: 5;
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 50%;
  background: #ef4444; color: #fff; border: 2px solid var(--bg-main);
  cursor: pointer; transition: transform .15s;
  box-shadow: 0 2px 6px rgba(0,0,0,.2);
}
.sb-widget-remove:hover { transform: scale(1.15); }

/* Add widget button */
.sb-add-widget {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 6px;
  padding: 24px; border-radius: 14px;
  border: 2px dashed rgba(74,144,217,.3);
  background: rgba(74,144,217,.03);
  color: var(--accent); cursor: pointer;
  transition: all .2s; grid-column: span 2;
  font-family: var(--font);
}
.sb-add-widget:hover {
  border-color: var(--accent);
  background: rgba(74,144,217,.06);
}
.sb-add-widget span { font-size: 12px; font-weight: 600; }

/* ── Widget drawer ── */
.sb-drawer {
  padding: 16px; border-radius: 14px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  box-shadow: 0 8px 24px rgba(0,0,0,.12);
}
.sb-drawer-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.sb-drawer-header h4 { font-size: 14px; font-weight: 700; color: var(--text-primary); margin: 0; }
.sb-drawer-close {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  border: none; background: transparent; color: var(--text-muted);
  cursor: pointer; transition: all .15s;
}
.sb-drawer-close:hover { background: var(--bg-hover); color: var(--text-primary); }

.sb-drawer-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
}
.sb-drawer-card {
  display: flex; flex-direction: column; align-items: center;
  gap: 6px; padding: 16px 10px; border-radius: 12px;
  background: var(--bg-main); border: 1px solid var(--border);
  cursor: pointer; transition: all .2s; text-align: center;
  position: relative; font-family: var(--font);
}
.sb-drawer-card:hover {
  border-color: var(--accent);
  background: rgba(74,144,217,.04);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,.08);
}
.sb-drawer-card-icon {
  display: flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 12px;
  background: rgba(74,144,217,.1); color: var(--accent);
}
.sb-drawer-card-label { font-size: 12px; font-weight: 600; color: var(--text-primary); }
.sb-drawer-card-desc { font-size: 10px; color: var(--text-muted); line-height: 1.3; }
.sb-drawer-card-add {
  position: absolute; top: 8px; right: 8px;
  color: var(--accent); opacity: .5;
}
.sb-drawer-card:hover .sb-drawer-card-add { opacity: 1; }
.sb-drawer-empty { text-align: center; color: var(--text-muted); font-size: 12px; padding: 16px 0; }

/* Drawer transition */
.sb-drawer-enter-active { transition: all .25s cubic-bezier(.4,0,.2,1); }
.sb-drawer-leave-active { transition: all .15s ease; }
.sb-drawer-enter-from { opacity: 0; transform: translateY(12px); }
.sb-drawer-leave-to { opacity: 0; transform: translateY(8px); }

/* ── Transitions ── */
.sa-customizer-enter-active,
.sa-customizer-leave-active { transition: all 0.25s ease; }
.sa-customizer-enter-from,
.sa-customizer-leave-to { opacity: 0; transform: translateY(-6px); }

/* ── Responsive ── */
@media (max-width: 600px) {
  .sb-grid { grid-template-columns: 1fr; }
  .sb-stats { flex-wrap: wrap; gap: 8px; }
  .sb-stat-sep { display: none; }
}
</style>
