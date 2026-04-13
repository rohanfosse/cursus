<script setup lang="ts">
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'
import { onMounted, onBeforeUnmount, watch } from 'vue'
import { useAppStore }     from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { useModalsStore }  from '@/stores/modals'
import { isExpired as _isExpired } from '@/utils/devoir'
import { useRealtimeClock }      from '@/composables/useRealtimeClock'
import { useDevoirsTeacher }     from '@/composables/useDevoirsTeacher'
import { useDevoirsStudent }     from '@/composables/useDevoirsStudent'
import { useStudentDeposit }     from '@/composables/useStudentDeposit'
import { useTeacherGrading }     from '@/composables/useTeacherGrading'
import { useDevoirContextMenu }  from '@/composables/useDevoirContextMenu'
import DevoirsHeader        from '@/components/devoirs/DevoirsHeader.vue'
import StudentDevoirsView   from '@/components/devoirs/StudentDevoirsView.vue'
import TeacherProjectHome   from '@/components/devoirs/TeacherProjectHome.vue'
import TeacherProjectDetail from '@/components/devoirs/TeacherProjectDetail.vue'
import TeacherRendusView    from '@/components/devoirs/TeacherRendusView.vue'
import DevoirContextMenu    from '@/components/devoirs/DevoirContextMenu.vue'

const props = defineProps<{ toggleSidebar?: () => void }>()

const appStore     = useAppStore()
const travauxStore = useTravauxStore()
const modals       = useModalsStore()

// ── Composables ──────────────────────────────────────────────────────────────
const { now } = useRealtimeClock()

const {
  unifiedFlat, globalDrafts, globalToGrade,
  upcomingDevoirs, devoirsByType, teacherCategories, rendusByDevoir,
  publishDevoir, publishAllDrafts, addDevoirOfType,
  projectDevoirCount, projectNextDeadline, projectTypeCounts, projectStats,
  loadView, openDevoir,
} = useDevoirsTeacher()

const {
  studentSearch, studentSort,
  studentGroups, filteredDevoirs, submittedDevoirs,
  studentStats, studentProjectOverview,
  nextExams, nextLivrables, nextSoutenances,
  studentCategories, studentProjectTypeCounts, studentProjectStats,
  error: studentError,
  loadView: loadStudentView,
} = useDevoirsStudent(now)

const {
  depositingDevoirId, depositMode, depositLink, depositFile, depositFileName,
  depositing, rubricPreview,
  startDeposit, cancelDeposit, pickFile, clearDepositFile, submitDeposit,
} = useStudentDeposit(now)

const {
  editingDepotId, pendingNoteValue, pendingFeedbackValue, savingGrade, canSave,
  startEditGrade, cancelEditGrade, saveGrade,
} = useTeacherGrading()

const {
  ctxMenu, openCtxMenu, closeCtxMenu,
  ctxPublishToggle, ctxDuplicate, ctxDelete, ctxOpen,
} = useDevoirContextMenu(loadView)

// ── Wrapper pour template (isExpired avec now implicite) ─────────────────────
function isExpired(deadline: string | null | undefined): boolean {
  return _isExpired(deadline, now.value)
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
function handleGlobalClick() { closeCtxMenu() }

onMounted(async () => {
  document.addEventListener('click', handleGlobalClick)
  if (appStore.isStudent) await loadStudentView()
  else await loadView()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleGlobalClick)
})

watch(() => appStore.activePromoId, loadView)

watch(() => appStore.activeChannelId, () => {
  if (appStore.isStudent) loadStudentView()
})
</script>

<template>
  <ErrorBoundary label="Devoirs">
  <div class="devoirs-area">

    <DevoirsHeader :toggle-sidebar="props.toggleSidebar" />

    <div class="devoirs-content">

      <!-- ══ Vue ÉTUDIANT ══ -->
      <StudentDevoirsView
        v-if="appStore.isStudent"
        :now="now"
        :student-groups="studentGroups"
        :filtered-devoirs="filteredDevoirs"
        :submitted-devoirs="submittedDevoirs"
        :student-stats="studentStats"
        :student-project-overview="studentProjectOverview"
        :next-exams="nextExams"
        :next-livrables="nextLivrables"
        :next-soutenances="nextSoutenances"
        :student-categories="studentCategories"
        :student-project-type-counts="studentProjectTypeCounts"
        :student-project-stats="studentProjectStats"
        :student-search="studentSearch"
        :student-sort="studentSort"
        :error="studentError"
        :retry="loadStudentView"
        :depositing-devoir-id="depositingDevoirId"
        :deposit-mode="depositMode"
        :deposit-link="depositLink"
        :deposit-file="depositFile"
        :deposit-file-name="depositFileName"
        :depositing="depositing"
        :rubric-preview="rubricPreview"
        :start-deposit="startDeposit"
        :cancel-deposit="cancelDeposit"
        :pick-file="pickFile"
        :clear-deposit-file="clearDepositFile"
        :submit-deposit="submitDeposit"
        @update:deposit-mode="depositMode = $event"
        @update:deposit-link="depositLink = $event"
        @update:student-search="studentSearch = $event"
        @update:student-sort="studentSort = $event"
      />

      <!-- ══ ACCUEIL PROJETS (prof, pas de projet sélectionné) ══ -->
      <TeacherProjectHome
        v-else-if="appStore.isTeacher && !appStore.activeProject"
        :teacher-categories="teacherCategories"
        :global-drafts="globalDrafts"
        :global-to-grade="globalToGrade"
        :upcoming-devoirs="upcomingDevoirs"
        :project-devoir-count="projectDevoirCount"
        :project-next-deadline="projectNextDeadline"
        :project-type-counts="projectTypeCounts"
        :project-stats="projectStats"
        :open-devoir="openDevoir"
        :open-ctx-menu="openCtxMenu"
      />

      <!-- ══ VUE PROJET (prof, projet sélectionné) ══ -->
      <TeacherProjectDetail
        v-else-if="appStore.isTeacher && appStore.activeProject"
        :unified-flat="unifiedFlat"
        :devoirs-by-type="devoirsByType"
        :project-type-counts="projectTypeCounts"
        :project-stats="projectStats"
        :project-next-deadline="projectNextDeadline"
        :publish-devoir="publishDevoir"
        :publish-all-drafts="publishAllDrafts"
        :add-devoir-of-type="addDevoirOfType"
        :open-devoir="openDevoir"
        :open-ctx-menu="openCtxMenu"
      />

      <!-- ══ Vue RENDUS (prof) ══ -->
      <TeacherRendusView
        v-else
        :rendus-by-devoir="rendusByDevoir"
        :editing-depot-id="editingDepotId"
        :pending-note-value="pendingNoteValue"
        :pending-feedback-value="pendingFeedbackValue"
        :saving-grade="savingGrade"
        :can-save="canSave"
        :start-edit-grade="startEditGrade"
        :cancel-edit-grade="cancelEditGrade"
        :save-grade="saveGrade"
        :open-devoir="openDevoir"
        @update:pending-note-value="pendingNoteValue = $event"
        @update:pending-feedback-value="pendingFeedbackValue = $event"
      />

    </div>
  </div>

  <DevoirContextMenu
    :ctx-menu="ctxMenu"
    :ctx-open="ctxOpen"
    :ctx-publish-toggle="ctxPublishToggle"
    :ctx-duplicate="ctxDuplicate"
    :ctx-delete="ctxDelete"
    :close-ctx-menu="closeCtxMenu"
  />
  </ErrorBoundary>
</template>

<style scoped>
.devoirs-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  background: var(--bg-main);
}

.devoirs-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
</style>
