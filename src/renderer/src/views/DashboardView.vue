<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import DashboardTeacher from '@/components/dashboard/DashboardTeacher.vue'
import DashboardStudent from '@/components/dashboard/DashboardStudent.vue'
import { useAppStore }    from '@/stores/app'
import { useModalsStore } from '@/stores/modals'
import { useTravauxStore } from '@/stores/travaux'
import { useRouter, useRoute } from 'vue-router'

import { useDashboardTeacher } from '@/composables/useDashboardTeacher'
import { useDashboardStudent } from '@/composables/useDashboardStudent'
import { useDashboardWidgets } from '@/composables/useDashboardWidgets'
import { useFrise }            from '@/composables/useFrise'
import { useTeacherAnalytics } from '@/composables/useTeacherAnalytics'
import { useActionCenter }     from '@/composables/useActionCenter'

const props = defineProps<{ toggleSidebar?: () => void }>()

const appStore     = useAppStore()
const modals       = useModalsStore()
const travauxStore = useTravauxStore()
const router       = useRouter()
const route        = useRoute()

// ── Onboarding première visite ──────────────────────────────────────────────
const ONBOARDING_KEY = 'cc_onboarding_seen'
const showOnboarding = ref(!localStorage.getItem(ONBOARDING_KEY) && appStore.isStudent)
function dismissOnboarding() {
  showOnboarding.value = false
  localStorage.setItem(ONBOARDING_KEY, '1')
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const greetingName = computed(() => (appStore.currentUser?.name ?? '').split(' ')[0])
const today = computed(() =>
  new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
)

function goToProject(key: string) {
  appStore.activeProject = key
  router.push('/devoirs')
}

// ── Tabs ────────────────────────────────────────────────────────────────────
type DashTab = 'accueil' | 'promotions' | 'frise' | 'analytique' | 'reglages' | 'live' | 'rex' | 'suivi' | 'engagement' | 'projets' | 'notes' | 'planning' | 'quiz'
const dashTab = ref<DashTab>(
  route.query.tab === 'frise' ? 'frise' : route.query.tab === 'planning' ? 'planning' : route.query.tab === 'analytique' ? 'analytique' : route.query.tab === 'promotions' ? 'promotions' : route.query.tab === 'live' ? 'live' : route.query.tab === 'rex' ? 'rex' : route.query.tab === 'suivi' ? 'suivi' : route.query.tab === 'engagement' ? 'engagement' : route.query.tab === 'projets' ? 'projets' : route.query.tab === 'notes' ? 'notes' : 'accueil',
)
watch(() => route.query.tab, (tab) => {
  const valid = ['frise', 'planning', 'analytique', 'promotions', 'reglages', 'live', 'rex', 'projets', 'notes', 'suivi', 'engagement'] as const
  dashTab.value = valid.includes(tab as typeof valid[number]) ? (tab as typeof dashTab.value) : 'accueil'
})

// ── Composables ─────────────────────────────────────────────────────────────
const {
  loadingTeacher, aNoterCount, brouillonsCount, promos, allStudents, ganttAll,
  savingPromo, deletingPromoId,
  allReminders, showAllReminders, thisWeekReminders, doneThisWeek, totalThisWeek,
  toggleReminder,
  activePromo, ganttFiltered, studentsForPromo, totalStudents, urgentsCount,
  renamingPromoId, renamingPromoValue,
  confirmRenamePromo, deletePromo, reloadPromos,
  projectCards, recentRendus,
  loadTeacherData,
} = useDashboardTeacher()

const {
  loadingStudent,
  studentStats, recentGrades, allGradedDevoirs, recentFeedback, urgentActions, studentProjectCards,
  loadStudentData, cleanupTimers,
} = useDashboardStudent()

const {
  unreadDmEntries, totalUnreadDms, openDmFromDashboard,
  savedMessages, removeSavedMessage, goToSavedMessage, cleanupStorage,
  recentChannelActivity, goToChannel,
  unreadMentions, totalUnreadMentions,
  next48h,
  forgottenDrafts, publishDraft,
  devoirsWithoutResources, checkDevoirsResources,
} = useDashboardWidgets(allStudents, ganttFiltered, allReminders, promos, reloadPromos)

const {
  friseOffset, friseDragging, ganttDateRange,
  onFriseWheel, onFriseDragStart, onFriseDragMove, onFriseDragEnd,
  setFriseZoom,
  ganttMonths, ganttTodayPct,
  frise,
  milestoneLeft, projectLineStyle, onMilestoneClick,
} = useFrise(ganttFiltered)

const analyticsRange = ref<string>('all')

const {
  gradeDistribution, submissionRates, globalModeGrade, analyticsStats,
} = useTeacherAnalytics(dashTab, ganttFiltered, analyticsRange)

const { actionItems, classHealth, submissionTrend } = useActionCenter(ganttFiltered)

// ── Change promo color ──────────────────────────────────────────────────────
async function changePromoColor(promoId: number, color: string) {
  const promo = promos.value.find(p => p.id === promoId)
  if (!promo) return
  try {
    await window.api.renamePromotion(promoId, promo.name, color)
    promo.color = color
  } catch { /* silently fail */ }
}

// ── Computed props for TeacherHeader second row ──────────────────────────────
const globalSubmissionRate = computed(() => {
  let depots = 0, expected = 0
  for (const t of ganttFiltered.value) {
    if (!t.published) continue
    depots   += t.depots_count  ?? 0
    expected += t.students_total ?? 0
  }
  return expected > 0 ? (depots / expected) * 100 : 0
})

const nextDeadlineStr = computed(() => {
  const now = Date.now()
  const upcoming = ganttFiltered.value
    .filter(t => t.published && new Date(t.deadline).getTime() > now)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  return upcoming[0]?.deadline ?? null
})

const onlineStudentsCount = computed(() => {
  return appStore.onlineUsers.filter(u => u.role === 'student').length
})

// ── Fetch rendus quand on revient sur l'accueil ─────────────────────────────
watch(dashTab, (tab) => {
  if (tab === 'accueil' && !travauxStore.allRendus.length) {
    const pid = appStore.activePromoId
    if (pid) travauxStore.fetchRendus(pid)
  }
})

// ── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(async () => {
  if (appStore.isTeacher) {
    await loadTeacherData(checkDevoirsResources)
  } else {
    await loadStudentData()
  }
})

onUnmounted(() => {
  cleanupTimers()
  cleanupStorage()
})
</script>

<template>
  <div class="dashboard-shell">

    <!-- ════════════════════ VUE PROFESSEUR ════════════════════ -->
    <DashboardTeacher
      v-if="appStore.isTeacher"
      :toggle-sidebar="props.toggleSidebar"
      :loading-teacher="loadingTeacher"
      :greeting-name="greetingName"
      :today="today"
      :promos="promos"
      :active-promo-id="appStore.activePromoId"
      :saving-promo="savingPromo"
      :deleting-promo-id="deletingPromoId"
      :renaming-promo-id="renamingPromoId"
      :renaming-promo-value="renamingPromoValue"
      :a-noter-count="aNoterCount"
      :urgents-count="urgentsCount"
      :brouillons-count="brouillonsCount"
      :total-students="totalStudents"
      :submission-rate="globalSubmissionRate"
      :next-deadline="nextDeadlineStr"
      :online-students="onlineStudentsCount"
      :all-students="allStudents"
      :gantt-all="ganttAll"
      :action-items="actionItems"
      :class-health="classHealth"
      :submission-trend="submissionTrend"
      :unread-dm-entries="unreadDmEntries"
      :total-unread-dms="totalUnreadDms"
      :saved-messages="savedMessages"
      :unread-mentions="unreadMentions"
      :total-unread-mentions="totalUnreadMentions"
      :recent-channel-activity="recentChannelActivity"
      :next48h="next48h"
      :forgotten-drafts="forgottenDrafts"
      :devoirs-without-resources="devoirsWithoutResources"
      :this-week-reminders="thisWeekReminders"
      :done-this-week="doneThisWeek"
      :total-this-week="totalThisWeek"
      :dash-tab="dashTab as 'accueil' | 'promotions' | 'frise' | 'analytique' | 'reglages' | 'live' | 'rex'"
      :analytics-stats="analyticsStats"
      :grade-distribution="gradeDistribution"
      :submission-rates="submissionRates"
      :global-mode-grade="globalModeGrade"
      :project-cards="projectCards"
      :recent-rendus="recentRendus"
      :frise-offset="friseOffset"
      :frise-dragging="friseDragging"
      :gantt-date-range="ganttDateRange"
      :frise="frise"
      :gantt-months="ganttMonths"
      :gantt-today-pct="ganttTodayPct"
      :online-users-count="appStore.onlineUsers.length"
      :milestone-left="milestoneLeft"
      :project-line-style="projectLineStyle"
      @update:active-promo-id="appStore.activePromoId = $event"
      @update:dash-tab="(t: DashTab) => { dashTab = t; router.replace({ query: { ...route.query, tab: t === 'accueil' ? undefined : t } }) }"
      @update:renaming-promo-id="renamingPromoId = $event"
      @update:renaming-promo-value="renamingPromoValue = $event"
      @update:frise-offset="friseOffset = $event"
      @update:current-travail-id="appStore.currentTravailId = $event; modals.gestionDevoir = true"
      @toggle-reminder="(id, done) => toggleReminder(id, done)"
      @open-dm-from-dashboard="openDmFromDashboard"
      @remove-saved-message="removeSavedMessage"
      @go-to-saved-message="goToSavedMessage"
      @go-to-channel="(cid, cname) => goToChannel(cid, cname)"
      @publish-draft="publishDraft"
      @go-to-project="goToProject"
      @confirm-rename-promo="confirmRenamePromo"
      @change-promo-color="(id, color) => changePromoColor(id, color)"
      @delete-promo="(id, name) => deletePromo(id, name)"
      @on-frise-wheel="onFriseWheel"
      @on-frise-drag-start="onFriseDragStart"
      @on-frise-drag-move="onFriseDragMove"
      @on-frise-drag-end="onFriseDragEnd"
      @on-milestone-click="onMilestoneClick"
      @open-new-devoir="modals.newDevoir = true"
      @open-echeancier="modals.echeancier = true"
      @open-classe="modals.classe = true"
      @open-settings="modals.settings = true"
      @open-create-promo="modals.createPromo = true"
      @open-intervenants="modals.intervenants = true"
      @open-import-students="(pid) => { appStore.activePromoId = pid; modals.importStudents = true }"
      @open-gestion-devoir="(id) => { appStore.currentTravailId = id; modals.gestionDevoir = true }"
      @open-devoir-cross-promo="(tid, pid, cid, cname) => { appStore.activePromoId = pid; appStore.currentTravailId = tid; modals.gestionDevoir = true }"
      @navigate-devoirs="router.push('/devoirs')"
      @navigate-messages="router.push('/messages')"
      @set-frise-zoom="setFriseZoom"
      @update:analytics-range="analyticsRange = $event"
    />

    <!-- ════════════════════ VUE ÉTUDIANT ════════════════════ -->
    <DashboardStudent
      v-else
      :toggle-sidebar="props.toggleSidebar"
      :greeting-name="greetingName"
      :today="today"
      :loading-student="loadingStudent"
      :show-onboarding="showOnboarding"
      :student-stats="studentStats"
      :urgent-actions="urgentActions"
      :recent-grades="recentGrades"
      :all-graded-devoirs="allGradedDevoirs"
      :recent-feedback="recentFeedback"
      :student-project-cards="studentProjectCards"
      :dash-tab="dashTab"
      :frise-offset="friseOffset"
      :frise-dragging="friseDragging"
      :gantt-date-range="ganttDateRange"
      :frise="frise"
      :gantt-months="ganttMonths"
      :gantt-today-pct="ganttTodayPct"
      :milestone-left="milestoneLeft"
      :project-line-style="projectLineStyle"
      @update:dash-tab="(t: DashTab) => { dashTab = t; router.replace({ query: { ...route.query, tab: t === 'accueil' ? undefined : t } }) }"
      @update:frise-offset="friseOffset = $event"
      @dismiss-onboarding="dismissOnboarding"
      @go-to-project="goToProject"
      @on-frise-wheel="onFriseWheel"
      @on-frise-drag-start="onFriseDragStart"
      @on-frise-drag-move="onFriseDragMove"
      @on-frise-drag-end="onFriseDragEnd"
      @on-milestone-click="onMilestoneClick"
      @set-frise-zoom="setFriseZoom"
      @open-student-timeline="modals.studentTimeline = true"
      @navigate-devoirs="router.push('/devoirs')"
    />

  </div>
</template>

<style scoped>
/* ── Shell ── */
.dashboard-shell {
  flex: 1;
  overflow-y: auto;
  padding: 28px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}
</style>
