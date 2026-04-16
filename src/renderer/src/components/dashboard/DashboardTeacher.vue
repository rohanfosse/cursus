/**
 * DashboardTeacher.vue
 * ---------------------------------------------------------------------------
 * Orchestrator for the teacher-side dashboard view.
 * Delegates rendering to focused sub-components and forwards all props/events.
 */
<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  PlusCircle, CalendarDays, Settings,
  LayoutDashboard, Users, BarChart2, TrendingUp, Zap, HeartPulse,
  Notebook, Activity, Pencil,
} from 'lucide-vue-next'
import { useLiveStore } from '@/stores/live'
import { useRexStore }  from '@/stores/rex'
import { useTeacherBento } from '@/composables/useTeacherBento'
import { useModules }      from '@/composables/useModules'

const bento = useTeacherBento()
const tabAccueilRef = ref<InstanceType<typeof TabAccueil> | null>(null)
const isEditingBento = computed(() => tabAccueilRef.value?.editMode ?? false)
import TeacherLiveView    from '@/components/live/TeacherLiveView.vue'
import TeacherRexView     from '@/components/rex/TeacherRexView.vue'
import TabSuiviEtudiants  from './TabSuiviEtudiants.vue'
import TabEngagement      from './TabEngagement.vue'

const liveStore = useLiveStore()
const rexStore  = useRexStore()
const { isEnabled } = useModules()
import type { Promotion, Depot } from '@/types'
import type { GanttRow, ProjectCard, Reminder } from '@/composables/useDashboardTeacher'
import type { SavedMessage, AgendaItem } from '@/composables/useDashboardWidgets'
import type { FriseMilestone, FrisePromo } from '@/composables/useFrise'

import TeacherHeader from './TeacherHeader.vue'
import TeacherActionCenter from './TeacherActionCenter.vue'
import TeacherWidgets from './TeacherWidgets.vue'
import TeacherReminders from './TeacherReminders.vue'
import TabAnalytique from './TabAnalytique.vue'
import TabPromotions from './TabPromotions.vue'
import TabAccueil from './TabAccueil.vue'
import TabReglages from './TabReglages.vue'
import TabFrise from './TabFrise.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'

// ── Props ────────────────────────────────────────────────────────────────────
const props = defineProps<{
  toggleSidebar?: () => void
  loadingTeacher: boolean
  greetingName: string
  today: string

  // Promos
  promos: Promotion[]
  activePromoId: number | null
  savingPromo: boolean
  deletingPromoId: number | null
  renamingPromoId: number | null
  renamingPromoValue: string

  // Stats
  aNoterCount: number
  urgentsCount: number
  brouillonsCount: number
  totalStudents: number
  submissionRate: number
  nextDeadline: string | null
  onlineStudents: number
  allStudents: { id: number; promo_id: number; name?: string }[]
  ganttAll: GanttRow[]

  // Action center & class health
  actionItems: { id: string; type: string; title: string; subtitle: string; urgency: string; action: () => void }[]
  classHealth: { score: number; color: string; label: string; avgSubmission: number } | null
  submissionTrend: { days: { label: string; count: number }[]; maxCount: number }

  // Widgets – DMs
  unreadDmEntries: { name: string; count: number }[]
  totalUnreadDms: number

  // Widgets – Saved messages
  savedMessages: SavedMessage[]

  // Widgets – Mentions
  unreadMentions: { id: string; authorName: string; channelId: number | null; channelName: string }[]
  totalUnreadMentions: number

  // Widgets – Channel activity
  recentChannelActivity: { id: string; authorName: string; channelId: number | null; channelName: string; timestamp: number; read: boolean }[]

  // Widgets – Next 48h
  next48h: AgendaItem[]

  // Widgets – Forgotten drafts
  forgottenDrafts: GanttRow[]

  // Widgets – Devoirs without resources
  devoirsWithoutResources: GanttRow[]

  // Reminders
  thisWeekReminders: (Reminder & { isOverdue: boolean; isToday: boolean })[]
  doneThisWeek: number
  totalThisWeek: number

  // Tabs
  dashTab: 'accueil' | 'promotions' | 'frise' | 'analytique' | 'reglages' | 'live' | 'rex' | 'suivi' | 'engagement' | 'suivi' | 'engagement'

  // Analytics
  analyticsStats: { total: number; graded: number; notGraded: number }
  gradeDistribution: { label: string; pct: number; color: string; count: number }[]
  submissionRates: { title: string; rate: number }[]
  globalModeGrade: string | null

  // Projects
  projectCards: ProjectCard[]
  recentRendus: Depot[]

  // Frise
  friseOffset: number
  friseDragging: boolean
  ganttDateRange: { start: Date; end: Date } | null
  frise: FrisePromo[]
  ganttMonths: { left: number; label: string }[]
  ganttTodayPct: number
  onlineUsersCount: number

  // Frise helpers (functions)
  milestoneLeft: (deadline: string) => string
  projectLineStyle: (milestones: FriseMilestone[]) => Record<string, string>
}>()

// ── Emits ────────────────────────────────────────────────────────────────────
const emit = defineEmits<{
  'update:activePromoId': [id: number]
  'update:dashTab': [tab: 'accueil' | 'promotions' | 'frise' | 'analytique' | 'reglages' | 'live' | 'rex' | 'suivi' | 'engagement']
  'update:renamingPromoId': [id: number | null]
  'update:renamingPromoValue': [val: string]
  'update:friseOffset': [val: number]
  'update:currentTravailId': [id: number]
  toggleReminder: [id: number, done: boolean]
  openDmFromDashboard: [name: string]
  removeSavedMessage: [id: number]
  goToSavedMessage: [msg: SavedMessage]
  goToChannel: [channelId: number, channelName: string]
  publishDraft: [id: number]
  goToProject: [key: string]
  confirmRenamePromo: [promo: Promotion]
  changePromoColor: [id: number, color: string]
  deletePromo: [id: number, name: string]
  onFriseWheel: [e: WheelEvent]
  onFriseDragStart: [e: MouseEvent]
  onFriseDragMove: [e: MouseEvent]
  onFriseDragEnd: [e: MouseEvent]
  onMilestoneClick: [ms: FriseMilestone]
  openNewDevoir: []
  openEcheancier: []
  openClasse: []
  openSettings: []
  openCreatePromo: []
  openIntervenants: []
  openImportStudents: [promoId: number]
  openGestionDevoir: [travailId: number]
  navigateDevoirs: []
  navigateMessages: []
  setFriseZoom: [days: number]
  'update:analyticsRange': [range: '7d' | '30d' | 'all']
  openDevoirCrossPromo: [travailId: number, promoId: number, channelId: number, channelName: string]
}>()

type DashTabType = 'accueil' | 'promotions' | 'frise' | 'analytique' | 'reglages' | 'live' | 'rex' | 'suivi' | 'engagement'

function setTab(tab: DashTabType) {
  emit('update:dashTab', tab)
}
</script>

<template>
  <div v-if="loadingTeacher" class="db-loading">
    <SkeletonLoader variant="card" :rows="4" />
  </div>

  <template v-else>
    <TeacherHeader
      :toggle-sidebar="props.toggleSidebar"
      :greeting-name="greetingName"
      :today="today"
      :promos="promos"
      :active-promo-id="activePromoId"
      @update:active-promo-id="id => emit('update:activePromoId', id)"
    />

    <!-- Action center retiré — infos disponibles dans le bento Accueil -->

    <!-- Widgets et rappels retires du dashboard prof (infos deja dans le bento) -->

    <!-- Tabs -->
    <div class="db-tabs">
      <button class="db-tab" :class="{ active: dashTab === 'accueil' }" @click="setTab('accueil')">
        <LayoutDashboard :size="13" /> Accueil
      </button>
      <button class="db-tab" :class="{ active: dashTab === 'promotions' }" @click="setTab('promotions')">
        <Users :size="13" /> Promotions
      </button>
      <button v-if="isEnabled('frise')" class="db-tab" :class="{ active: dashTab === 'frise' }" @click="setTab('frise')">
        <BarChart2 :size="13" /> Frise
      </button>
      <button class="db-tab" :class="{ active: dashTab === 'suivi' }" @click="setTab('suivi')">
        <Notebook :size="13" /> Suivi
      </button>
      <button class="db-tab" :class="{ active: dashTab === 'analytique' }" @click="setTab('analytique')">
        <TrendingUp :size="13" /> Analytique
      </button>
      <button class="db-tab" :class="{ active: dashTab === 'engagement' }" @click="setTab('engagement')">
        <Activity :size="13" /> Engagement
      </button>
      <button v-if="isEnabled('live')" class="db-tab db-tab-live" :class="{ active: dashTab === 'live' }" @click="setTab('live')">
        <Zap :size="13" /> Live
        <span
          v-if="liveStore.currentSession && liveStore.currentSession.status !== 'ended'"
          class="db-tab-live-dot"
        />
      </button>
      <button v-if="isEnabled('rex')" class="db-tab db-tab-rex" :class="{ active: dashTab === 'rex' }" @click="setTab('rex')">
        <HeartPulse :size="13" /> Pulse
        <span
          v-if="rexStore.currentSession && rexStore.currentSession.status !== 'ended'"
          class="db-tab-rex-dot"
        />
      </button>
      <button class="db-tab" :class="{ active: dashTab === 'reglages' }" @click="setTab('reglages')">
        <Settings :size="13" /> Admin
      </button>
      <!-- Bouton personnalisation bento (onglet Accueil uniquement) -->
      <button
        v-if="dashTab === 'accueil'"
        class="db-tab-edit-btn"
        :class="{ active: isEditingBento }"
        title="Personnaliser le tableau de bord"
        @click="tabAccueilRef?.toggleEditMode()"
      >
        <Pencil :size="13" />
      </button>
    </div>

    <!-- Tab content -->
    <TabAnalytique
      v-if="dashTab === 'analytique'"
      :analytics-stats="analyticsStats"
      :grade-distribution="gradeDistribution"
      :submission-rates="submissionRates"
      :global-mode-grade="globalModeGrade"
      :online-users-count="onlineUsersCount"
      :submission-trend="submissionTrend"
      @update:analytics-range="range => emit('update:analyticsRange', range)"
    />

    <TabPromotions
      v-else-if="dashTab === 'promotions'"
      :promos="promos"
      :active-promo-id="activePromoId"
      :saving-promo="savingPromo"
      :deleting-promo-id="deletingPromoId"
      :renaming-promo-id="renamingPromoId"
      :renaming-promo-value="renamingPromoValue"
      :all-students="allStudents"
      :gantt-all="ganttAll"
      @update:active-promo-id="id => emit('update:activePromoId', id)"
      @update:renaming-promo-id="id => emit('update:renamingPromoId', id)"
      @update:renaming-promo-value="val => emit('update:renamingPromoValue', val)"
      @confirm-rename-promo="p => emit('confirmRenamePromo', p)"
      @change-promo-color="(id, color) => emit('changePromoColor', id, color)"
      @delete-promo="(id, name) => emit('deletePromo', id, name)"
      @open-classe="emit('openClasse')"
      @open-import-students="id => emit('openImportStudents', id)"
      @open-create-promo="emit('openCreatePromo')"
    />

    <TabAccueil
      ref="tabAccueilRef"
      v-else-if="dashTab === 'accueil'"
      :a-noter-count="aNoterCount"
      :submission-rate="submissionRate"
      :online-students="onlineStudents"
      :brouillons-count="brouillonsCount"
      :action-items="actionItems"
      :global-mode-grade="globalModeGrade"
      :next48h="next48h"
      :unread-dm-entries="unreadDmEntries"
      :total-unread-dms="totalUnreadDms"
      :forgotten-drafts="forgottenDrafts"
      :project-cards="projectCards"
      :recent-rendus="recentRendus"
      :promos="promos"
      @open-devoir-cross-promo="(tid, pid, cid, cname) => emit('openDevoirCrossPromo', tid, pid, cid, cname)"
      @go-to-project="key => emit('goToProject', key)"
      @open-new-devoir="emit('openNewDevoir')"
      @open-dm-from-dashboard="name => emit('openDmFromDashboard', name)"
      @publish-draft="id => emit('publishDraft', id)"
      @switch-to-frise="setTab('frise')"
      @open-active-devoir="emit('navigateDevoirs')"
    />

    <TabReglages
      v-else-if="dashTab === 'reglages'"
      :promos="promos"
      :all-students="allStudents"
      :gantt-all="ganttAll"
      @open-intervenants="emit('openIntervenants')"
      @open-echeancier="emit('openEcheancier')"
      @navigate-devoirs="emit('navigateDevoirs')"
      @navigate-messages="emit('navigateMessages')"
      @open-settings="emit('openSettings')"
    />

    <TeacherLiveView
      v-else-if="dashTab === 'live'"
    />

    <TeacherRexView
      v-else-if="dashTab === 'rex'"
    />

    <TabSuiviEtudiants
      v-else-if="dashTab === 'suivi'"
    />

    <TabEngagement
      v-else-if="dashTab === 'engagement'"
    />

    <TabFrise
      v-else-if="dashTab === 'frise'"
      :frise-offset="friseOffset"
      :frise-dragging="friseDragging"
      :gantt-date-range="ganttDateRange"
      :frise="frise"
      :gantt-months="ganttMonths"
      :gantt-today-pct="ganttTodayPct"
      :milestone-left="milestoneLeft"
      :project-line-style="projectLineStyle"
      @update:frise-offset="val => emit('update:friseOffset', val)"
      @go-to-project="key => emit('goToProject', key)"
      @on-frise-wheel="e => emit('onFriseWheel', e)"
      @on-frise-drag-start="e => emit('onFriseDragStart', e)"
      @on-frise-drag-move="e => emit('onFriseDragMove', e)"
      @on-frise-drag-end="e => emit('onFriseDragEnd', e)"
      @on-milestone-click="ms => emit('onMilestoneClick', ms)"
      @set-frise-zoom="days => emit('setFriseZoom', days)"
    />

    <!-- Removed: floating "Nouveau devoir" bar — available in TabAccueil quick actions -->
  </template>
</template>

<style scoped>
/* Header, tabs, loading skeleton: see dashboard-shared.css */

/* ── Barre d'actions rapides flottante ── */
.db-fab-bar {
  position: sticky; bottom: 14px;
  display: flex; align-items: center; gap: 2px; justify-content: center;
  padding: 4px;
  background: color-mix(in srgb, var(--bg-secondary, #1e1e2e) 90%, transparent);
  backdrop-filter: blur(14px);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  border-radius: 12px;
  width: fit-content; margin: 0 auto;
  box-shadow: 0 2px 12px rgba(0,0,0,.2), 0 0 0 1px rgba(255,255,255,.03);
  z-index: 5;
  opacity: .35; transition: opacity var(--motion-base) var(--ease-out);
}
.db-fab-bar:hover { opacity: 1; }
.db-fab {
  display: inline-flex; align-items: center; gap: 5px;
  height: 30px; padding: 0 12px; font-size: 12px; font-weight: 600;
  background: var(--accent); color: #fff;
  border: none; border-radius: 8px; cursor: pointer;
  transition: filter var(--motion-fast) var(--ease-out), transform .1s ease; font-family: var(--font);
  letter-spacing: .01em; white-space: nowrap;
}
.db-fab:hover { filter: brightness(1.12); }
.db-fab:active { transform: scale(.96); filter: brightness(.95); }
.db-fab-divider {
  width: 1px; height: 16px; margin: 0 3px;
  background: color-mix(in srgb, var(--border) 70%, transparent);
  flex-shrink: 0;
}
.db-fab-ghost {
  position: relative;
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; padding: 0;
  background: transparent; color: var(--text-muted);
  border: none; border-radius: 8px; cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out), color var(--motion-fast) var(--ease-out), transform .1s ease;
  flex-shrink: 0;
}
.db-fab-ghost:hover { background: var(--bg-hover); color: var(--text-primary); }
.db-fab-ghost:active { transform: scale(.9); }
/* Tooltip CSS */
.db-fab-ghost::after {
  content: attr(title);
  position: absolute;
  bottom: calc(100% + 7px); left: 50%;
  transform: translateX(-50%) translateY(3px);
  background: var(--bg-elevated, #2a2a3e);
  color: var(--text-primary); font-size: 10.5px; font-family: var(--font);
  padding: 3px 8px; border-radius: 5px; white-space: nowrap;
  border: 1px solid var(--border);
  pointer-events: none; opacity: 0;
  transition: opacity var(--motion-fast) var(--ease-out), transform var(--motion-fast) var(--ease-out);
  box-shadow: 0 2px 6px rgba(0,0,0,.2);
}
.db-fab-ghost:hover::after { opacity: 1; transform: translateX(-50%) translateY(0); }

/* ── Live tab indicator ── */
.db-tab-live { position: relative; }
.db-tab-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ef4444;
  display: inline-block;
  margin-left: 4px;
  animation: pulse-live-dot 2s infinite;
}
@keyframes pulse-live-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: .4; }
}

/* ── REX tab indicator ── */
.db-tab-rex { position: relative; }
.db-tab-rex-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #0d9488;
  display: inline-block;
  margin-left: 4px;
  animation: pulse-live-dot 2s infinite;
}

/* ── Bouton édition bento ── */
.db-tab-edit-btn {
  margin-left: auto;
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 7px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); cursor: pointer; flex-shrink: 0;
  transition: all .15s;
}
.db-tab-edit-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.db-tab-edit-btn.active { background: var(--accent-subtle); color: var(--accent); border-color: var(--accent); }

/* ── Panneau personnalisation bento ── */
/* bento-cust panel removed — now inline in TabAccueil */
</style>
