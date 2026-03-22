/**
 * StudentBento.vue — Accueil personnalisable du dashboard étudiant.
 * Orchestre les widgets via useBentoPrefs : l'étudiant choisit
 * quels widgets afficher et dans quel ordre.
 */
<script setup lang="ts">
import { computed, ref, watch, nextTick, type Component } from 'vue'
import { Settings, Smile } from 'lucide-vue-next'
import { useBentoPrefs } from '@/composables/useBentoPrefs'
import { nextUpcoming } from '@/utils/devoirFilters'
import type { StudentProjectCard } from '@/composables/useDashboardStudent'

import WidgetLive from './student-widgets/WidgetLive.vue'
import WidgetProject from './student-widgets/WidgetProject.vue'
import WidgetExams from './student-widgets/WidgetExams.vue'
import WidgetLivrables from './student-widgets/WidgetLivrables.vue'
import WidgetSoutenances from './student-widgets/WidgetSoutenances.vue'
import WidgetShortcuts from './student-widgets/WidgetShortcuts.vue'
import WidgetActions from './student-widgets/WidgetActions.vue'
import BentoCustomizer from './student-widgets/BentoCustomizer.vue'

const props = defineProps<{
  studentStats: { pending: number; submitted: number; graded: number; modeGrade: string | null }
  urgentActions: { id: number; title: string; isOverdue: boolean; urgency: string; category?: string | null; deadline?: string; type?: string }[]
  recentGrades: { title: string; note: string; category?: string | null }[]
  recentFeedback?: { title: string; feedback: string; note: string | null; category: string | null }[]
  studentProjectCards: StudentProjectCard[]
  hasDevoirsLoaded: boolean
}>()

const emit = defineEmits<{
  navigateDevoirs: []
  openStudentTimeline: []
  goToProject: [key: string]
}>()

const showCustomizer = ref(false)
const gearBtnRef = ref<HTMLButtonElement | null>(null)
const customizerRef = ref<InstanceType<typeof BentoCustomizer> | null>(null)
const { visibleWidgets, allWidgets, isVisible, toggleWidget, moveWidget, resetDefaults } = useBentoPrefs()

watch(showCustomizer, (visible) => {
  nextTick(() => {
    if (visible) {
      const el = customizerRef.value?.$el as HTMLElement | undefined
      el?.focus()
    } else {
      gearBtnRef.value?.focus()
    }
  })
})

// ── Computed data for widgets ──────────────────────────────────────────────
const activeProject = computed(() => {
  if (!props.studentProjectCards.length) return null
  const withDeadline = props.studentProjectCards
    .filter(p => p.nextDeadline && new Date(p.nextDeadline).getTime() > Date.now())
    .sort((a, b) => new Date(a.nextDeadline!).getTime() - new Date(b.nextDeadline!).getTime())
  return withDeadline[0] ?? props.studentProjectCards[0]
})

const nextExams = computed(() =>
  nextUpcoming(props.urgentActions, ['cctl', 'etude_de_cas'], Date.now(), 4),
)

const nextLivrables = computed(() =>
  nextUpcoming(props.urgentActions, ['livrable', 'memoire'], Date.now(), 2),
)

const nextSoutenances = computed(() =>
  nextUpcoming(props.urgentActions, ['soutenance'], Date.now(), 2),
)

// ── Widget component map ───────────────────────────────────────────────────
const widgetComponents: Record<string, Component> = {
  live: WidgetLive,
  project: WidgetProject,
  exams: WidgetExams,
  livrables: WidgetLivrables,
  soutenances: WidgetSoutenances,
  shortcuts: WidgetShortcuts,
  actions: WidgetActions,
}

const widgetProps = computed<Record<string, Record<string, unknown>>>(() => ({
  live: {},
  project: { project: activeProject.value },
  exams: { exams: nextExams.value },
  livrables: { livrables: nextLivrables.value },
  soutenances: { soutenances: nextSoutenances.value },
  shortcuts: {},
  actions: {},
}))

const widgetEvents: Record<string, Record<string, (...args: unknown[]) => void>> = {
  project: { goToProject: (key: unknown) => emit('goToProject', key as string) },
  exams: { goToProject: (key: unknown) => emit('goToProject', key as string) },
  livrables: { goToProject: (key: unknown) => emit('goToProject', key as string) },
  soutenances: { goToProject: (key: unknown) => emit('goToProject', key as string) },
  actions: {
    navigateDevoirs: () => emit('navigateDevoirs'),
    openStudentTimeline: () => emit('openStudentTimeline'),
  },
}

const showAllClear = computed(() =>
  !nextExams.value.length && !nextLivrables.value.length && !nextSoutenances.value.length && props.hasDevoirsLoaded && props.studentProjectCards.length > 0,
)
</script>

<template>
  <div class="sb-accueil">

    <div class="sa-header">
      <button
        ref="gearBtnRef"
        class="sa-customize-btn"
        :class="{ 'sa-customize-btn--active': showCustomizer }"
        title="Personnaliser"
        aria-label="Personnaliser le tableau de bord"
        @click="showCustomizer = !showCustomizer"
      >
        <Settings :size="14" />
      </button>
    </div>

    <Transition name="sa-customizer">
      <BentoCustomizer
        ref="customizerRef"
        v-if="showCustomizer"
        :all-widgets="allWidgets"
        :is-visible="isVisible"
        @toggle="toggleWidget"
        @move="moveWidget"
        @reset="resetDefaults"
        @close="showCustomizer = false"
      />
    </Transition>

    <TransitionGroup name="sa-widget" tag="div" class="sa-widgets">
      <component
        v-for="w in visibleWidgets"
        :key="w.id"
        :is="widgetComponents[w.id]"
        v-bind="widgetProps[w.id]"
        v-on="widgetEvents[w.id] ?? {}"
      />
    </TransitionGroup>

    <!-- All clear -->
    <div v-if="showAllClear" class="sa-card sa-ok">
      <Smile :size="20" class="sa-ok-icon" />
      <span class="sa-ok-text">Aucune échéance à venir — tout est à jour</span>
    </div>

  </div>
</template>

<style scoped>
.sb-accueil {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Header with customize button ─────────────────────────────────────────── */
.sa-header {
  display: flex;
  justify-content: flex-end;
}
.sa-customize-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 8px;
  background: rgba(255,255,255,.03); border: 1px solid var(--border);
  color: var(--text-muted); cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.sa-customize-btn:hover,
.sa-customize-btn--active {
  background: rgba(74,144,217,.08);
  border-color: rgba(74,144,217,.25);
  color: var(--accent);
}

/* ── Widget list ──────────────────────────────────────────────────────────── */
.sa-widgets {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Transition: widget reorder ───────────────────────────────────────────── */
.sa-widget-enter-active,
.sa-widget-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.sa-widget-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.sa-widget-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
.sa-widget-move {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ── Customizer transition ────────────────────────────────────────────────── */
.sa-customizer-enter-active,
.sa-customizer-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.sa-customizer-enter-from,
.sa-customizer-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ── Cards base (for ok state) ────────────────────────────────────────────── */
.sa-card {
  background: rgba(255,255,255,.03);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px 18px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ── Tout est à jour ──────────────────────────────────────────────────────── */
.sa-ok {
  display: flex; align-items: center; gap: 10px;
  background: rgba(46,204,113,.06);
  border-color: rgba(46,204,113,.2);
}
.sa-ok-icon { color: var(--color-success); }
.sa-ok-text { font-size: 13px; color: var(--color-success); font-weight: 600; }
</style>
