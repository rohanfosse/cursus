/**
 * StudentBento.vue - Dashboard etudiant compact.
 */
<script setup lang="ts">
import { computed, ref, watch, nextTick, type Component } from 'vue'
import { Settings, CheckCircle2, Clock, AlertTriangle, Wifi } from 'lucide-vue-next'
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
import BentoCustomizer from './student-widgets/BentoCustomizer.vue'

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
const customizerRef = ref<InstanceType<typeof BentoCustomizer> | null>(null)

function toggleCustomizer() { showCustomizer.value = !showCustomizer.value }
defineExpose({ toggleCustomizer })

const { visibleWidgets, allWidgets, isVisible, toggleWidget, moveWidget, reorderWidgets, resetDefaults } = useBentoPrefs()

watch(showCustomizer, (visible) => {
  nextTick(() => {
    if (visible) (customizerRef.value?.$el as HTMLElement)?.focus()
  })
})

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
}

const latestFeedback = computed(() => props.recentFeedback?.[0] ?? null)

const widgetProps = computed<Record<string, Record<string, unknown>>>(() => ({
  live: {}, project: { project: activeProject.value },
  exams: { exams: nextExams.value }, livrables: { livrables: nextLivrables.value },
  soutenances: { soutenances: nextSoutenances.value },
  feedback: { feedback: latestFeedback.value }, recentDoc: {},
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

// Focus : only show if overdue (critical) -- pending is shown in stats, no need to duplicate
const showFocusAlert = computed(() => overdueCount.value > 0)
</script>

<template>
  <div class="sb-bento">

    <Transition name="sa-customizer">
      <BentoCustomizer
        ref="customizerRef"
        v-if="showCustomizer"
        :all-widgets="allWidgets"
        :is-visible="isVisible"
        @toggle="toggleWidget"
        @move="moveWidget"
        @reorder="reorderWidgets"
        @reset="resetDefaults"
        @close="showCustomizer = false"
      />
    </Transition>

    <WidgetLive v-if="isVisible('live')" />

    <!-- Alert banner (only if overdue) -->
    <div v-if="showFocusAlert" class="sb-alert">
      <AlertTriangle :size="16" />
      <span>{{ overdueCount }} devoir{{ overdueCount > 1 ? 's' : '' }} en retard</span>
    </div>

    <!-- Stats row (horizontal, compact) -->
    <div class="sb-stats">
      <div class="sb-stat">
        <span class="sb-stat-value">{{ submissionRate }}%</span>
        <span class="sb-stat-label">soumis</span>
      </div>
      <div class="sb-stat-sep" />
      <div class="sb-stat">
        <span class="sb-stat-value" :class="{ 'sb-stat--warn': overdueCount > 0 }">{{ studentStats.pending }}</span>
        <span class="sb-stat-label">à rendre</span>
      </div>
      <div class="sb-stat-sep" />
      <div class="sb-stat">
        <span class="sb-stat-value">{{ studentStats.modeGrade ?? '--' }}</span>
        <span class="sb-stat-label">moyenne</span>
      </div>
      <div class="sb-stat-sep" />
      <div class="sb-stat">
        <span class="sb-stat-value">{{ studentStats.graded }}</span>
        <span class="sb-stat-label">notes</span>
      </div>
      <div class="sb-stat-online">
        <span class="sb-online-dot" />
        <span>{{ onlineCount }}</span>
      </div>
    </div>

    <!-- Widgets grid (2 colonnes, tous en 1 col) -->
    <div class="sb-grid">
      <template v-for="w in visibleWidgets.filter(w => w.id !== 'live' && w.id !== 'promoActivity')" :key="w.id">
        <div class="sb-widget">
          <component
            :is="widgetComponents[w.id]"
            v-bind="widgetProps[w.id]"
            v-on="widgetEvents[w.id] ?? {}"
          />
        </div>
      </template>
    </div>
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
.sb-widget {
  animation: sb-fade .3s ease both;
}

@keyframes sb-fade {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

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
