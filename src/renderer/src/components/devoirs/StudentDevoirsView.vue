/**
 * Branche étudiant de la vue Devoirs : accueil unifié (stat pills, prochaines
 * échéances, grille projets) quand aucun projet n'est sélectionné, groupes
 * urgence + formulaires de dépôt quand un projet est actif.
 */
<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import {
  CheckCircle2, Clock, Lock, AlertTriangle, Calendar, AlertCircle,
  RefreshCw, ArrowUp, BookOpen, BarChart2, Award, FileText, Mic, FolderOpen,
  Search, ArrowUpDown,
} from 'lucide-vue-next'
import { useAppStore }     from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { deadlineClass, deadlineLabel } from '@/utils/date'
import type { Devoir, Rubric } from '@/types'
import StudentProjetFiche    from '@/components/projet/StudentProjetFiche.vue'
import StudentStatsBar       from './StudentStatsBar.vue'
import KanbanBoard           from './KanbanBoard.vue'
import { useModules }        from '@/composables/useModules'
import StudentDevoirGroup    from './StudentDevoirGroup.vue'
import DevoirsProjectCard    from './DevoirsProjectCard.vue'
import EmptyState            from '@/components/ui/EmptyState.vue'
import UiPill                from '@/components/ui/UiPill.vue'

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
  // accueil
  nextExams: Devoir[]
  nextLivrables: Devoir[]
  nextSoutenances: Devoir[]
  studentCategories: string[]
  studentProjectTypeCounts: (cat: string) => { type: string; count: number }[]
  studentProjectStats: (cat: string) => { submitted: number; total: number; pct: number; devoirCount: number; nextDeadline: string | null }
  // search & sort
  studentSearch: string
  studentSort: 'deadline' | 'title' | 'type'
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
  (e: 'update:studentSearch', v: string): void
  (e: 'update:studentSort', v: 'deadline' | 'title' | 'type'): void
}>()

const appStore     = useAppStore()
const travauxStore = useTravauxStore()
const { isEnabled } = useModules()

/** Are we on the accueil (no project selected, multiple categories)? */
const isAccueil = computed(() => !appStore.activeProject && props.studentCategories.length > 0)

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

/** Cached project stats for all categories */
const cachedProjectStats = computed(() => {
  const map: Record<string, ReturnType<typeof props.studentProjectStats>> = {}
  for (const cat of props.studentCategories) map[cat] = props.studentProjectStats(cat)
  return map
})

/** Group devoirs for current student (travaux assigned to a group) */
const groupDevoirs = computed<Devoir[]>(() =>
  props.filteredDevoirs.filter(d => d.assigned_to === 'group' && d.group_id != null),
)

const kanbanExpanded = ref<Record<number, boolean>>({})

/** Global progression percentage */
const globalPct = computed(() => {
  const t = props.studentStats.total
  return t > 0 ? Math.round((props.studentStats.submitted / t) * 100) : 0
})
</script>

<template>
  <!-- Squelettes -->
  <div v-if="travauxStore.loading" class="devoirs-list">
    <div v-for="i in 4" :key="i" class="skel-card">
      <div class="skel skel-line skel-w30" style="height:12px" />
      <div class="skel skel-line skel-w70" style="height:16px;margin-top:10px" />
      <div class="skel skel-line skel-w90" style="height:12px;margin-top:8px" />
      <div class="skel skel-line skel-w50" style="height:12px;margin-top:6px" />
    </div>
  </div>

  <!-- État erreur -->
  <EmptyState
    v-else-if="error"
    size="lg"
    tone="danger"
    :icon="AlertCircle"
    title="Impossible de charger les devoirs"
    subtitle="Une erreur est survenue. Vérifiez votre connexion et réessayez."
  >
    <button class="btn-primary" @click="retry"><RefreshCw :size="13" /> Réessayer</button>
  </EmptyState>

  <!-- État vide -->
  <EmptyState
    v-else-if="filteredDevoirs.length === 0"
    size="lg"
    tone="success"
    :icon="CheckCircle2"
    title="Aucun devoir assigné"
    subtitle="Vos devoirs apparaîtront ici dès qu'un responsable en créera pour votre promotion."
  />

  <!-- ══ ACCUEIL étudiant (aucun projet sélectionné) - même layout que prof ══ -->
  <div v-else-if="isAccueil" class="dv-page">

    <!-- ── Résumé global avec donut ──────────────────────────────── -->
    <div class="sdv-summary-row">
      <div class="sdv-donut-wrap">
        <svg class="sdv-donut" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bg-active)" stroke-width="3" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke="var(--color-success)"
            stroke-width="3"
            stroke-dasharray="100"
            :stroke-dashoffset="100 - globalPct"
            stroke-linecap="round"
            transform="rotate(-90 18 18)"
            class="sdv-donut-fill"
          />
        </svg>
        <span class="sdv-donut-label">{{ globalPct }}%</span>
      </div>
      <div class="sdv-summary-info">
        <span class="sdv-summary-title">Progression globale</span>
        <span class="sdv-summary-desc">{{ studentStats.submitted }} / {{ studentStats.total }} devoirs rendus</span>
      </div>
    </div>

    <!-- ── Stat pills ──────────────────────────────────────────────── -->
    <div class="dv-stats-row">
      <UiPill size="md" tone="neutral">
        <template #leading><BookOpen :size="14" /></template>
        <strong>{{ studentStats.total }}</strong>&nbsp;devoirs
      </UiPill>
      <UiPill size="md" tone="success">
        <template #leading><CheckCircle2 :size="14" /></template>
        <strong>{{ studentStats.submitted }}</strong>&nbsp;rendu{{ studentStats.submitted > 1 ? 's' : '' }}
      </UiPill>
      <UiPill v-if="studentStats.pending > 0" size="md" tone="warning">
        <template #leading><Clock :size="14" /></template>
        <strong>{{ studentStats.pending }}</strong>&nbsp;à rendre
      </UiPill>
      <UiPill v-if="studentStats.urgent > 0" size="md" tone="danger">
        <template #leading><AlertTriangle :size="14" /></template>
        <strong>{{ studentStats.urgent }}</strong>&nbsp;urgent{{ studentStats.urgent > 1 ? 's' : '' }}
      </UiPill>
    </div>

    <!-- ── Prochaines échéances ────────────────────────────────────── -->
    <div v-if="nextExams.length || nextLivrables.length || nextSoutenances.length" class="sdv-next-section">
      <h4 class="dv-section-title"><Clock :size="14" /> Prochaines échéances</h4>
      <p class="dv-section-desc">Les devoirs à venir regroupés par type.</p>

      <div class="dv-next-grid">
        <!-- CCTL / Étude de cas -->
        <div v-if="nextExams.length" class="dv-next-card dv-next-card--exam">
          <div class="dv-next-card-header sdv-next-header--exam">
            <Award :size="16" />
            <span>CCTL &amp; Études de cas</span>
          </div>
          <div class="sdv-next-card-list">
            <div v-for="d in nextExams" :key="d.id" class="dv-next-item" @click="appStore.activeProject = d.category ?? null">
              <span class="dv-next-item-title">{{ d.title }}</span>
              <span class="deadline-badge" :class="deadlineClass(d.deadline)">{{ deadlineLabel(d.deadline) }}</span>
            </div>
          </div>
        </div>

        <!-- Livrables -->
        <div v-if="nextLivrables.length" class="dv-next-card dv-next-card--livrable">
          <div class="dv-next-card-header sdv-next-header--livrable">
            <FileText :size="16" />
            <span>Livrables</span>
          </div>
          <div class="sdv-next-card-list">
            <div v-for="d in nextLivrables" :key="d.id" class="dv-next-item" @click="appStore.activeProject = d.category ?? null">
              <span class="dv-next-item-title">{{ d.title }}</span>
              <span class="deadline-badge" :class="deadlineClass(d.deadline)">{{ deadlineLabel(d.deadline) }}</span>
            </div>
          </div>
        </div>

        <!-- Soutenances -->
        <div v-if="nextSoutenances.length" class="dv-next-card dv-next-card--soutenance">
          <div class="dv-next-card-header sdv-next-header--soutenance">
            <Mic :size="16" />
            <span>Soutenances</span>
          </div>
          <div class="sdv-next-card-list">
            <div v-for="d in nextSoutenances" :key="d.id" class="dv-next-item" @click="appStore.activeProject = d.category ?? null">
              <span class="dv-next-item-title">{{ d.title }}</span>
              <span class="deadline-badge" :class="deadlineClass(d.deadline)">{{ deadlineLabel(d.deadline) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Projets grid ────────────────────────────────────────────── -->
    <div class="sdv-section">
      <h4 class="dv-section-title"><FolderOpen :size="14" /> Projets</h4>
      <p class="dv-section-desc">Cliquez sur un projet pour voir vos devoirs en détail.</p>

      <div class="dv-proj-grid">
        <DevoirsProjectCard
          v-for="cat in studentCategories" :key="cat"
          :name="cat"
          :type-counts="studentProjectTypeCounts(cat)"
          :submitted="cachedProjectStats[cat].submitted"
          :total="cachedProjectStats[cat].total"
          :pct="cachedProjectStats[cat].pct"
          :devoir-count="cachedProjectStats[cat].devoirCount"
          :next-deadline="cachedProjectStats[cat].nextDeadline"
          :graded-count="cachedProjectStats[cat].gradedCount"
          :best-grade="cachedProjectStats[cat].bestGrade"
          @click="appStore.activeProject = cat"
        />
      </div>
    </div>
  </div>

  <!-- ══ VUE PROJET (un projet sélectionné) - groupes urgence + dépôt ══ -->
  <template v-else>
    <!-- Stats bar (sticky) -->
    <StudentStatsBar v-if="filteredDevoirs.length > 0" :stats="studentStats" class="sticky-stats" />

    <!-- Search & sort bar -->
    <div v-if="filteredDevoirs.length > 3" class="sdv-toolbar">
      <div class="sdv-search">
        <Search :size="13" class="sdv-search-icon" />
        <input
          type="text"
          class="sdv-search-input"
          placeholder="Rechercher un devoir..."
          :value="studentSearch"
          @input="$emit('update:studentSearch', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="sdv-sort">
        <ArrowUpDown :size="12" />
        <select
          class="sdv-sort-select"
          :value="studentSort"
          @change="$emit('update:studentSort', ($event.target as HTMLSelectElement).value as any)"
        >
          <option value="deadline">Par échéance</option>
          <option value="title">Par titre</option>
          <option value="type">Par type</option>
        </select>
      </div>
    </div>

    <!-- Fiche projet étudiant (filtre projet actif) -->
    <template v-if="appStore.activeProject && appStore.activePromoId">
      <StudentProjetFiche
        :project-key="appStore.activeProject"
        :promo-id="appStore.activePromoId"
      />
    </template>

    <!-- Groupes de devoirs (uniquement si PAS de projet selectionne) -->
    <div v-if="!appStore.activeProject" class="devoirs-grouped">
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
  </template>

  <!-- ═══ Kanbans de groupe ═══ -->
  <div v-if="isEnabled('kanban') && groupDevoirs.length && appStore.activeProject" class="sdv-kb-section">
    <div class="sdv-kb-header">
      <FolderOpen :size="14" />
      <span>Kanbans de groupe</span>
    </div>
    <div v-for="d in groupDevoirs" :key="d.id" class="sdv-kb-item">
      <button class="sdv-kb-item-toggle" @click="kanbanExpanded[d.id] = !kanbanExpanded[d.id]">
        <span class="sdv-kb-item-title">{{ d.title }}</span>
        <span class="sdv-kb-item-arrow">{{ kanbanExpanded[d.id] ? '▲' : '▼' }}</span>
      </button>
      <div v-if="kanbanExpanded[d.id]" class="sdv-kb-board">
        <KanbanBoard :travail-id="d.id" :group-id="d.group_id!" :read-only="false" />
      </div>
    </div>
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
  gap: 12px;
  max-width: 780px;
  margin: 0 auto;
  padding: 0 4px;
}

.devoirs-grouped {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 780px;
  margin: 0 auto;
  padding: 0 4px;
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

.sticky-stats { position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }

/* ── Toolbar (search + sort) ───────────────────────────────────────────────── */
.sdv-toolbar {
  display: flex; align-items: center; gap: 8px;
  max-width: 780px; margin: 0 auto 12px; padding: 0 4px;
}
.sdv-search {
  flex: 1; display: flex; align-items: center; gap: 6px;
  background: var(--bg-sidebar); border: 1px solid var(--border);
  border-radius: 8px; padding: 6px 10px;
  transition: border-color var(--t-fast);
}
.sdv-search:focus-within { border-color: var(--accent); }
.sdv-search-icon { color: var(--text-muted); flex-shrink: 0; }
.sdv-search-input {
  flex: 1; border: none; background: transparent;
  font-size: 12px; color: var(--text-primary);
  font-family: var(--font); outline: none;
}
.sdv-search-input::placeholder { color: var(--text-muted); }
.sdv-sort {
  display: flex; align-items: center; gap: 4px;
  color: var(--text-muted); flex-shrink: 0;
}
.sdv-sort-select {
  border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg-sidebar); color: var(--text-secondary);
  font-size: 11px; font-family: var(--font);
  padding: 4px 8px; cursor: pointer; outline: none;
}
.sdv-sort-select:focus { border-color: var(--accent); }

/* ── Student summary donut ──────────────────────────────────────────────── */
.sdv-summary-row {
  display: flex; align-items: center; gap: 16px;
  max-width: 780px; margin: 0 auto 8px; padding: 0 4px;
}
.sdv-donut-wrap {
  position: relative; width: 56px; height: 56px; flex-shrink: 0;
}
.sdv-donut { width: 100%; height: 100%; }
.sdv-donut-fill { transition: stroke-dashoffset .6s ease; }
.sdv-donut-label {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: var(--text-primary);
}
.sdv-summary-info { display: flex; flex-direction: column; gap: 2px; }
.sdv-summary-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.sdv-summary-desc { font-size: 12px; color: var(--text-muted); }

/* ── Student accueil specifics ───────────────────────────────────────────── */
.sdv-next-section { margin-bottom: 4px; }
.sdv-next-card-list { display: flex; flex-direction: column; gap: 8px; }
.sdv-next-header--exam      { color: var(--color-cctl, #9b87f5); }
.sdv-next-header--livrable  { color: var(--accent); }
.sdv-next-header--soutenance { color: var(--color-warning); }

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

/* ── Kanban de groupe ── */
.sdv-kb-section { display: flex; flex-direction: column; gap: 10px; padding: 16px 20px; border-top: 1px solid var(--border); }
.sdv-kb-header { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #3b82f6; }
.sdv-kb-item { border-radius: 8px; border: 1px solid var(--border); overflow: hidden; }
.sdv-kb-item-toggle {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 10px 14px; background: var(--bg-elevated);
  border: none; cursor: pointer; font-family: var(--font);
  text-align: left; transition: background .15s;
}
.sdv-kb-item-toggle:hover { background: var(--bg-hover); }
.sdv-kb-item-title { flex: 1; font-size: 13px; font-weight: 600; color: var(--text-primary); }
.sdv-kb-item-arrow { font-size: 11px; color: var(--text-muted); }
.sdv-kb-board { padding: 14px; background: var(--bg-main); }
</style>
