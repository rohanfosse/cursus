/**
 * Branche étudiant de la vue Devoirs : stats bar, apercu projets, groupes urgence,
 * formulaires de dépôt, devoirs rendus.
 */
<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { CheckCircle2, Clock, Lock, AlertTriangle, Calendar, AlertCircle, RefreshCw, ArrowUp } from 'lucide-vue-next'
import { useAppStore }     from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import type { Devoir, Rubric } from '@/types'
import StudentProjetFiche    from '@/components/projet/StudentProjetFiche.vue'
import StudentStatsBar       from './StudentStatsBar.vue'
import StudentProjectOverview from './StudentProjectOverview.vue'
import StudentDevoirGroup    from './StudentDevoirGroup.vue'

const props = defineProps<{
  now: number
  // composable: useDevoirsStudent
  studentGroups: {
    overdue: Devoir[]
    urgent: Devoir[]
    pending: Devoir[]
    event: Devoir[]
    submitted: Devoir[]
  }
  filteredDevoirs: Devoir[]
  submittedDevoirs: Devoir[]
  studentStats: { total: number; pending: number; urgent: number; submitted: number }
  studentProjectOverview: { key: string; label: string; total: number; submitted: number; pending: number }[]
  // composable: useStudentDeposit
  depositingDevoirId: number | null
  depositMode: 'file' | 'link'
  depositLink: string
  depositFile: string | null
  depositFileName: string | null
  depositing: boolean
  rubricPreview: Rubric | null
  startDeposit: (t: Devoir) => void
  cancelDeposit: () => void
  pickFile: () => void
  clearDepositFile: () => void
  submitDeposit: (t: Devoir) => void
  // error / retry
  error: boolean
  retry: () => void
}>()

defineEmits<{
  (e: 'update:depositMode', v: 'file' | 'link'): void
  (e: 'update:depositLink', v: string): void
}>()

const appStore     = useAppStore()
const travauxStore = useTravauxStore()

// ── Scroll to top button ──────────────────────────────────────────────────
const showScrollTop = ref(false)
function onDevoirsScroll() {
  const el = document.querySelector('.devoirs-scroll-area') as HTMLElement | null
  showScrollTop.value = !!el && el.scrollTop > 200
}
function scrollToTop() {
  const el = document.querySelector('.devoirs-scroll-area') as HTMLElement | null
  el?.scrollTo({ top: 0, behavior: 'smooth' })
}
onMounted(() => {
  const el = document.querySelector('.devoirs-scroll-area')
  el?.addEventListener('scroll', onDevoirsScroll, { passive: true })
})
onBeforeUnmount(() => {
  const el = document.querySelector('.devoirs-scroll-area')
  el?.removeEventListener('scroll', onDevoirsScroll)
})

/** Shared deposit props forwarded to every group */
const depositProps = computed(() => ({
  now: props.now,
  depositingDevoirId: props.depositingDevoirId,
  depositMode: props.depositMode,
  depositLink: props.depositLink,
  depositFile: props.depositFile,
  depositFileName: props.depositFileName,
  depositing: props.depositing,
  rubricPreview: props.rubricPreview,
  startDeposit: props.startDeposit,
  cancelDeposit: props.cancelDeposit,
  pickFile: props.pickFile,
  clearDepositFile: props.clearDepositFile,
  submitDeposit: props.submitDeposit,
}))
</script>

<template>
  <!-- Stats bar (sticky) -->
  <StudentStatsBar v-if="filteredDevoirs.length > 0" :stats="studentStats" class="sticky-stats" />

  <!-- Fiche projet étudiant (filtre projet actif) -->
  <template v-if="appStore.activeProject && appStore.activePromoId">
    <StudentProjetFiche
      :project-key="appStore.activeProject"
      :promo-id="appStore.activePromoId"
    />
  </template>

  <!-- Squelettes -->
  <div v-else-if="travauxStore.loading" class="devoirs-list">
    <div v-for="i in 4" :key="i" class="skel-card">
      <div class="skel skel-line skel-w30" style="height:12px" />
      <div class="skel skel-line skel-w70" style="height:16px;margin-top:10px" />
      <div class="skel skel-line skel-w90" style="height:12px;margin-top:8px" />
      <div class="skel skel-line skel-w50" style="height:12px;margin-top:6px" />
    </div>
  </div>

  <!-- État erreur -->
  <div v-else-if="error" class="empty-state-custom">
    <AlertCircle :size="48" class="empty-icon" style="color: var(--color-danger);" />
    <h3>Impossible de charger les devoirs</h3>
    <p>Une erreur est survenue. Vérifiez votre connexion et réessayez.</p>
    <button class="btn-primary" style="margin-top: 12px;" @click="retry"><RefreshCw :size="13" /> Réessayer</button>
  </div>

  <!-- État vide -->
  <div v-else-if="filteredDevoirs.length === 0" class="empty-state-custom">
    <CheckCircle2 :size="48" class="empty-icon" />
    <h3>Aucun devoir assigné</h3>
    <p>Vos devoirs apparaîtront ici dès qu'un enseignant en créera pour votre promotion.</p>
  </div>

  <!-- Aperçu par projet -->
  <StudentProjectOverview
    v-else-if="!appStore.activeProject && studentProjectOverview.length > 1"
    :projects="studentProjectOverview"
  />

  <!-- Groupes de devoirs -->
  <div v-else class="devoirs-grouped">
    <StudentDevoirGroup
      :devoirs="studentGroups.overdue"
      variant="overdue"
      header-class="group-header--danger"
      :icon="Lock"
      label="En retard"
      :count="studentGroups.overdue.length"
      subtitle="La deadline est dépassée - le dépôt n'est plus possible"
      title="Deadline dépassée - dépôt verrouillé"
      v-bind="depositProps"
      @update:deposit-mode="$emit('update:depositMode', $event)"
      @update:deposit-link="$emit('update:depositLink', $event)"
    />

    <StudentDevoirGroup
      :devoirs="studentGroups.urgent"
      variant="urgent"
      header-class="group-header--warning"
      :icon="AlertTriangle"
      label="Urgent"
      :count="studentGroups.urgent.length"
      subtitle="Moins de 3 jours avant la deadline"
      title="Moins de 3 jours avant la deadline"
      v-bind="depositProps"
      @update:deposit-mode="$emit('update:depositMode', $event)"
      @update:deposit-link="$emit('update:depositLink', $event)"
    />

    <StudentDevoirGroup
      :devoirs="studentGroups.pending"
      variant="pending"
      header-class="group-header--accent"
      :icon="Clock"
      label="À rendre"
      :count="studentGroups.pending.length"
      subtitle="Vous avez encore du temps, mais pensez-y"
      title="Plus de 3 jours avant la deadline"
      v-bind="depositProps"
      @update:deposit-mode="$emit('update:depositMode', $event)"
      @update:deposit-link="$emit('update:depositLink', $event)"
    />

    <StudentDevoirGroup
      :devoirs="studentGroups.event"
      variant="event"
      header-class="group-header--purple"
      :icon="Calendar"
      label="Présence requise"
      :count="studentGroups.event.length"
      v-bind="depositProps"
      @update:deposit-mode="$emit('update:depositMode', $event)"
      @update:deposit-link="$emit('update:depositLink', $event)"
    />

    <StudentDevoirGroup
      :devoirs="submittedDevoirs"
      variant="submitted"
      header-class="group-header--success"
      :icon="CheckCircle2"
      label="Rendus"
      :count="`${submittedDevoirs.length} / ${filteredDevoirs.length}`"
      title="Devoirs soumis"
      v-bind="depositProps"
      @update:deposit-mode="$emit('update:depositMode', $event)"
      @update:deposit-link="$emit('update:depositLink', $event)"
    />
  </div>

  <!-- Scroll to top -->
  <Transition name="scroll-btn-fade">
    <button v-if="showScrollTop" class="devoirs-scroll-top" aria-label="Remonter en haut" @click="scrollToTop">
      <ArrowUp :size="18" />
    </button>
  </Transition>
</template>

<style scoped>
.devoirs-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 780px;
  margin: 0 auto;
}

.devoirs-grouped {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 780px;
  margin: 0 auto;
}

/* ── Squelettes ──────────────────────────────────────────────────────────── */
.skel-card {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── État vide ────────────────────────────────────────────────────────────── */
.empty-state-custom {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  color: var(--text-muted);
  opacity: 0.3;
  margin-bottom: 16px;
}

.empty-state-custom h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.empty-state-custom p {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 360px;
  line-height: 1.5;
}
.sticky-stats { position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }

/* ── Scroll to top button ── */
.devoirs-scroll-top {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--bg-modal);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0,0,0,.35);
  z-index: 20;
  transition: background .15s, color .15s, transform .15s;
}
.devoirs-scroll-top:hover {
  background: var(--accent);
  color: #fff;
  transform: translateY(-2px);
}
.scroll-btn-fade-enter-active, .scroll-btn-fade-leave-active { transition: opacity .2s, transform .2s; }
.scroll-btn-fade-enter-from, .scroll-btn-fade-leave-to { opacity: 0; transform: translateY(8px); }
</style>
