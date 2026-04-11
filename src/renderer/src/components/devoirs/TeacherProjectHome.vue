/**
 * Accueil projets enseignant : cartes prochains événements par type,
 * résumé promo, grille de projets enrichie.
 */
<script setup lang="ts">
import { computed } from 'vue'
import {
  BookOpen, Clock, ChevronRight, PlusCircle, FolderOpen,
  FileText, Mic, Award, BarChart2, AlertTriangle,
} from 'lucide-vue-next'
import { useAppStore }     from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { useModalsStore }  from '@/stores/modals'
import { deadlineClass, deadlineLabel, formatDate } from '@/utils/date'
import { typeLabel, extractDuration } from '@/utils/devoir'
import DevoirsProjectCard from './DevoirsProjectCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { GanttRow } from '@/types'

const props = defineProps<{
  teacherCategories: string[]
  globalDrafts: number
  globalToGrade: number
  upcomingDevoirs: GanttRow[]
  projectDevoirCount: (cat: string) => number
  projectNextDeadline: (cat: string) => string | null
  projectTypeCounts: (cat: string) => { type: string; count: number }[]
  projectStats: (cat: string) => { totalDepots: number; totalExpected: number; pct: number; noted: number; toGrade: number; drafts: number }
  openDevoir: (id: number) => void
  openCtxMenu: (e: MouseEvent, d: GanttRow) => void
}>()

const appStore     = useAppStore()
const travauxStore = useTravauxStore()
const modals       = useModalsStore()

const hasDevoirsAtAll     = computed(() => travauxStore.ganttData.length > 0)
const hasPublishedDevoirs = computed(() => travauxStore.ganttData.some(t => t.is_published))

/** Cached projectStats per category */
const cachedProjectStats = computed(() => {
  const map: Record<string, ReturnType<typeof props.projectStats>> = {}
  for (const cat of props.teacherCategories) map[cat] = props.projectStats(cat)
  return map
})

// ── Prochains par type ──────────────────────────────────────────────────────
const now = Date.now()

const nextExams = computed(() =>
  travauxStore.ganttData
    .filter(t => t.is_published && (t.type === 'cctl' || t.type === 'etude_de_cas') && new Date(t.deadline).getTime() > now)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 3),
)

const nextLivrable = computed(() =>
  travauxStore.ganttData
    .filter(t => t.is_published && t.type === 'livrable' && new Date(t.deadline).getTime() > now)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 3),
)

const nextSoutenance = computed(() =>
  travauxStore.ganttData
    .filter(t => t.is_published && t.type === 'soutenance' && new Date(t.deadline).getTime() > now)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 3),
)
</script>

<template>
  <div v-if="travauxStore.loading" class="dh-loading">
    <div v-for="i in 4" :key="i" class="skel skel-line" style="height:100px;margin-bottom:10px;border-radius:10px" />
  </div>

  <EmptyState
    v-else-if="!teacherCategories.length"
    size="lg"
    :icon="BookOpen"
    :title="!hasDevoirsAtAll
      ? 'Aucun devoir pour cette promotion'
      : !hasPublishedDevoirs
        ? 'Aucun projet publié'
        : 'Aucun projet pour cette promotion'"
    :subtitle="!hasDevoirsAtAll
      ? 'Créez votre premier devoir pour commencer à organiser vos projets.'
      : !hasPublishedDevoirs
        ? 'Vos devoirs existent en brouillon. Publiez-les et associez-leur une catégorie pour les organiser.'
        : 'Les projets apparaîtront automatiquement quand vous créerez un devoir avec une catégorie.'"
  >
    <button class="btn-primary" @click="modals.newDevoir = true">
      <PlusCircle :size="14" /> Créer un devoir
    </button>
  </EmptyState>

  <template v-else>
    <div class="dv-page">

      <!-- ── Résumé promo ──────────────────────────────────────────── -->
      <div class="dv-stats-row">
        <div class="dv-stat-pill">
          <BookOpen :size="14" />
          <strong>{{ travauxStore.ganttData.length }}</strong> devoirs
        </div>
        <div class="dv-stat-pill dv-stat-pill--success">
          <BarChart2 :size="14" />
          <strong>{{ travauxStore.ganttData.filter(t => t.is_published).length }}</strong> publiés
        </div>
        <div v-if="globalToGrade > 0" class="dv-stat-pill dv-stat-pill--warn">
          <AlertTriangle :size="14" />
          <strong>{{ globalToGrade }}</strong> à noter
        </div>
        <div v-if="globalDrafts > 0" class="dv-stat-pill dv-stat-pill--muted">
          <FileText :size="14" />
          <strong>{{ globalDrafts }}</strong> brouillons
        </div>
      </div>

      <!-- ── Prochains événements par type ─────────────────────────── -->
      <div v-if="nextExams.length || nextLivrable.length || nextSoutenance.length" class="dh-next-section">
        <h4 class="dv-section-title"><Clock :size="14" /> Prochaines échéances</h4>
        <p class="dv-section-desc">Les devoirs à venir regroupés par type, pour anticiper votre planning.</p>

        <div class="dv-next-grid">
          <!-- CCTL / Étude de cas -->
          <div v-if="nextExams.length" class="dv-next-card dv-next-card--exam">
            <div class="dv-next-card-header dh-next-header--exam">
              <Award :size="16" />
              <span>CCTL &amp; Études de cas</span>
            </div>
            <div class="dh-next-card-list">
              <div
                v-for="d in nextExams" :key="d.id"
                class="dv-next-item"
                @click="openDevoir(d.id)"
                @contextmenu="openCtxMenu($event, d)"
              >
                <span class="dv-next-item-title">{{ d.title }}</span>
                <span class="deadline-badge" :class="deadlineClass(d.deadline)">{{ deadlineLabel(d.deadline) }}</span>
              </div>
            </div>
          </div>

          <!-- Livrables -->
          <div v-if="nextLivrable.length" class="dv-next-card dv-next-card--livrable">
            <div class="dv-next-card-header dh-next-header--livrable">
              <FileText :size="16" />
              <span>Livrables</span>
            </div>
            <div class="dh-next-card-list">
              <div
                v-for="d in nextLivrable" :key="d.id"
                class="dv-next-item"
                @click="openDevoir(d.id)"
                @contextmenu="openCtxMenu($event, d)"
              >
                <span class="dv-next-item-title">{{ d.title }}</span>
                <span class="deadline-badge" :class="deadlineClass(d.deadline)">{{ deadlineLabel(d.deadline) }}</span>
              </div>
            </div>
          </div>

          <!-- Soutenances -->
          <div v-if="nextSoutenance.length" class="dv-next-card dv-next-card--soutenance">
            <div class="dv-next-card-header dh-next-header--soutenance">
              <Mic :size="16" />
              <span>Soutenances</span>
            </div>
            <div class="dh-next-card-list">
              <div
                v-for="d in nextSoutenance" :key="d.id"
                class="dv-next-item"
                @click="openDevoir(d.id)"
                @contextmenu="openCtxMenu($event, d)"
              >
                <span class="dv-next-item-title">{{ d.title }}</span>
                <span class="deadline-badge" :class="deadlineClass(d.deadline)">{{ deadlineLabel(d.deadline) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Projets ───────────────────────────────────────────────── -->
      <div class="dh-section">
        <h4 class="dv-section-title"><FolderOpen :size="14" /> Projets</h4>
        <p class="dv-section-desc">Cliquez sur un projet pour voir ses devoirs en détail.</p>

        <div class="dv-proj-grid">
          <DevoirsProjectCard
            v-for="cat in teacherCategories" :key="cat"
            :name="cat"
            :type-counts="projectTypeCounts(cat)"
            :submitted="cachedProjectStats[cat].totalDepots"
            :total="cachedProjectStats[cat].totalExpected"
            :pct="cachedProjectStats[cat].pct"
            :to-grade="cachedProjectStats[cat].toGrade"
            :drafts="cachedProjectStats[cat].drafts"
            :devoir-count="projectDevoirCount(cat)"
            :next-deadline="projectNextDeadline(cat)"
            @click="appStore.activeProject = cat"
          />
        </div>
      </div>

    </div>
  </template>
</template>

<style scoped>
/* ── Teacher-specific styles (header colors, loading, empty button) ──────── */
.dh-next-section { margin-bottom: 4px; }
.dh-next-card-list { display: flex; flex-direction: column; gap: 8px; }
.dh-next-header--exam      { color: var(--color-cctl, #9b87f5); }
.dh-next-header--livrable  { color: var(--accent); }
.dh-next-header--soutenance { color: var(--color-warning); }

.dh-loading { padding: 24px 28px; }
.dh-empty-btn { margin-top: 16px; }
</style>
