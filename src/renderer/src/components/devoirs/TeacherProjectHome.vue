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

  <div v-else-if="!teacherCategories.length" class="dh-empty">
    <BookOpen :size="48" class="dh-empty-icon" />
    <template v-if="!hasDevoirsAtAll">
      <h3>Aucun devoir pour cette promotion</h3>
      <p>Créez votre premier devoir pour commencer à organiser vos projets.</p>
    </template>
    <template v-else-if="!hasPublishedDevoirs">
      <h3>Aucun projet publié</h3>
      <p>Vos devoirs existent en brouillon. Publiez-les et associez-leur une catégorie pour les organiser.</p>
    </template>
    <template v-else>
      <h3>Aucun projet pour cette promotion</h3>
      <p>Les projets apparaîtront automatiquement quand vous créerez un devoir avec une catégorie.</p>
    </template>
    <button class="btn-primary dh-empty-btn" @click="modals.newDevoir = true">
      <PlusCircle :size="14" /> Créer un devoir
    </button>
  </div>

  <template v-else>
    <div class="dh-home">

      <!-- ── Résumé promo ──────────────────────────────────────────── -->
      <div class="dh-summary-row">
        <div class="dh-stat-pill">
          <BookOpen :size="14" />
          <strong>{{ travauxStore.ganttData.length }}</strong> devoirs
        </div>
        <div class="dh-stat-pill dh-pill-success">
          <BarChart2 :size="14" />
          <strong>{{ travauxStore.ganttData.filter(t => t.is_published).length }}</strong> publiés
        </div>
        <div v-if="globalToGrade > 0" class="dh-stat-pill dh-pill-warn">
          <AlertTriangle :size="14" />
          <strong>{{ globalToGrade }}</strong> à noter
        </div>
        <div v-if="globalDrafts > 0" class="dh-stat-pill dh-pill-muted">
          <FileText :size="14" />
          <strong>{{ globalDrafts }}</strong> brouillons
        </div>
      </div>

      <!-- ── Prochains événements par type ─────────────────────────── -->
      <div v-if="nextExams.length || nextLivrable.length || nextSoutenance.length" class="dh-next-section">
        <h4 class="dh-section-title"><Clock :size="14" /> Prochaines échéances</h4>
        <p class="dh-section-desc">Les devoirs à venir regroupés par type, pour anticiper votre planning.</p>

        <div class="dh-next-grid">
          <!-- CCTL / Étude de cas -->
          <div v-if="nextExams.length" class="dh-next-card dh-next-card--exam">
            <div class="dh-next-card-header">
              <Award :size="16" />
              <span>CCTL &amp; Études de cas</span>
            </div>
            <div class="dh-next-card-list">
              <div
                v-for="d in nextExams" :key="d.id"
                class="dh-next-item"
                @click="openDevoir(d.id)"
                @contextmenu="openCtxMenu($event, d)"
              >
                <span class="dh-next-item-title">{{ d.title }}</span>
                <span class="deadline-badge" :class="deadlineClass(d.deadline)">{{ deadlineLabel(d.deadline) }}</span>
              </div>
            </div>
          </div>

          <!-- Livrables -->
          <div v-if="nextLivrable.length" class="dh-next-card dh-next-card--livrable">
            <div class="dh-next-card-header">
              <FileText :size="16" />
              <span>Livrables</span>
            </div>
            <div class="dh-next-card-list">
              <div
                v-for="d in nextLivrable" :key="d.id"
                class="dh-next-item"
                @click="openDevoir(d.id)"
                @contextmenu="openCtxMenu($event, d)"
              >
                <span class="dh-next-item-title">{{ d.title }}</span>
                <span class="deadline-badge" :class="deadlineClass(d.deadline)">{{ deadlineLabel(d.deadline) }}</span>
              </div>
            </div>
          </div>

          <!-- Soutenances -->
          <div v-if="nextSoutenance.length" class="dh-next-card dh-next-card--soutenance">
            <div class="dh-next-card-header">
              <Mic :size="16" />
              <span>Soutenances</span>
            </div>
            <div class="dh-next-card-list">
              <div
                v-for="d in nextSoutenance" :key="d.id"
                class="dh-next-item"
                @click="openDevoir(d.id)"
                @contextmenu="openCtxMenu($event, d)"
              >
                <span class="dh-next-item-title">{{ d.title }}</span>
                <span class="deadline-badge" :class="deadlineClass(d.deadline)">{{ deadlineLabel(d.deadline) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Projets ───────────────────────────────────────────────── -->
      <div class="dh-section">
        <h4 class="dh-section-title"><FolderOpen :size="14" /> Projets</h4>
        <p class="dh-section-desc">Cliquez sur un projet pour voir ses devoirs en détail.</p>

        <div class="proj-grid">
          <div
            v-for="cat in teacherCategories" :key="cat"
            class="proj-card"
            @click="appStore.activeProject = cat"
          >
            <div class="proj-card-header">
              <span class="proj-card-name">{{ cat }}</span>
              <ChevronRight :size="14" class="proj-card-chevron" />
            </div>

            <!-- Types de devoirs dans ce projet -->
            <div class="proj-card-types">
              <span v-for="tl in projectTypeCounts(cat)" :key="tl.type" class="proj-type-pill" :class="`type-${tl.type}`">
                {{ tl.count }} {{ typeLabel(tl.type) }}
              </span>
            </div>

            <!-- Stats : masquer si 0/0 -->
            <div class="proj-card-stats-row">
              <template v-if="cachedProjectStats[cat].totalExpected > 0">
                <span>{{ cachedProjectStats[cat].totalDepots }}/{{ cachedProjectStats[cat].totalExpected }} soumis</span>
                <span v-if="cachedProjectStats[cat].toGrade > 0" class="proj-stat-warn">{{ cachedProjectStats[cat].toGrade }} à noter</span>
              </template>
              <span v-else class="proj-stat-info">Aucun dépôt attendu</span>
            </div>

            <!-- Barre de progression (seulement si des dépôts sont attendus) -->
            <div v-if="cachedProjectStats[cat].totalExpected > 0" class="proj-card-progress">
              <div class="proj-card-progress-fill" :style="{ width: cachedProjectStats[cat].pct + '%' }" />
            </div>

            <!-- Footer enrichi -->
            <div class="proj-card-footer">
              <span class="proj-card-total">{{ projectDevoirCount(cat) }} devoir{{ projectDevoirCount(cat) > 1 ? 's' : '' }}</span>
              <span v-if="cachedProjectStats[cat].drafts > 0" class="proj-card-drafts">{{ cachedProjectStats[cat].drafts }} brouillon{{ cachedProjectStats[cat].drafts > 1 ? 's' : '' }}</span>
              <span v-if="projectNextDeadline(cat)" class="proj-card-next deadline-badge" :class="deadlineClass(projectNextDeadline(cat)!)">
                <Clock :size="10" /> {{ deadlineLabel(projectNextDeadline(cat)!) }}
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </template>
</template>

<style scoped>
/* ── Accueil devoirs prof ────────────────────────────────────────────────────── */
.dh-home {
  padding: 24px 28px 40px;
  display: flex; flex-direction: column; gap: 24px;
}

/* ── Résumé promo (pills row) ──────────────────────────────────────────────── */
.dh-summary-row {
  display: flex; gap: 10px; flex-wrap: wrap;
}
.dh-stat-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 20px;
  font-size: 13px; font-weight: 600;
  background: var(--bg-elevated, rgba(255,255,255,.04));
  border: 1px solid var(--border);
  color: var(--text-primary);
}
.dh-pill-success { color: var(--color-success); border-color: rgba(46,204,113,.25); background: rgba(46,204,113,.08); }
.dh-pill-warn    { color: var(--color-warning); border-color: rgba(243,156,18,.25); background: rgba(243,156,18,.08); }
.dh-pill-muted   { color: var(--text-muted); }

/* ── Sections ──────────────────────────────────────────────────────────────── */
.dh-section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 15px; font-weight: 700; color: var(--text-primary);
  margin-bottom: 4px;
}
.dh-section-desc {
  font-size: 12px; color: var(--text-muted); margin-bottom: 14px; line-height: 1.4;
}

/* ── Prochaines échéances (3 cartes par type) ──────────────────────────────── */
.dh-next-section { margin-bottom: 4px; }
.dh-next-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.dh-next-card {
  border-radius: 12px; padding: 16px;
  border: 1px solid var(--border);
  background: var(--bg-elevated, rgba(255,255,255,.03));
}
.dh-next-card--exam      { border-left: 3px solid #9b87f5; }
.dh-next-card--livrable  { border-left: 3px solid var(--accent); }
.dh-next-card--soutenance { border-left: 3px solid var(--color-warning); }

.dh-next-card-header {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; font-weight: 700; color: var(--text-primary);
  margin-bottom: 12px;
}
.dh-next-card--exam .dh-next-card-header      { color: #9b87f5; }
.dh-next-card--livrable .dh-next-card-header   { color: var(--accent); }
.dh-next-card--soutenance .dh-next-card-header { color: var(--color-warning); }

.dh-next-card-list { display: flex; flex-direction: column; gap: 8px; }
.dh-next-item {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 8px 10px; border-radius: 8px; cursor: pointer;
  background: rgba(255,255,255,.02);
  transition: background .15s;
}
.dh-next-item:hover { background: rgba(255,255,255,.06); }
.dh-next-item-title {
  font-size: 13px; font-weight: 500; color: var(--text-primary);
  flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Projets grid ──────────────────────────────────────────────────────────── */
.proj-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.proj-card {
  background: var(--bg-elevated, rgba(255,255,255,.03));
  border: 1px solid var(--border);
  border-radius: 12px; padding: 18px; cursor: pointer;
  transition: border-color .15s, background .15s, transform .1s;
}
.proj-card:hover {
  border-color: var(--accent); background: rgba(74,144,217,.04);
  transform: translateY(-1px);
}
.proj-card-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.proj-card-name { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.proj-card-chevron { color: var(--text-muted); opacity: .4; transition: opacity .15s; }
.proj-card:hover .proj-card-chevron { opacity: 1; color: var(--accent); }

.proj-card-types { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 12px; }
.proj-type-pill {
  font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px;
}

.proj-card-stats-row {
  display: flex; gap: 10px; font-size: 12px; color: var(--text-muted); margin-bottom: 8px; flex-wrap: wrap;
}
.proj-stat-warn { color: var(--color-warning); font-weight: 600; }
.proj-stat-info { color: var(--text-muted); font-style: italic; font-size: 11px; }

.proj-card-progress {
  height: 4px; border-radius: 2px; background: rgba(255,255,255,.06); overflow: hidden; margin-bottom: 12px;
}
.proj-card-progress-fill {
  height: 100%; background: var(--color-success); border-radius: 2px; transition: width .4s;
}

.proj-card-footer {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  font-size: 12px; color: var(--text-muted);
}
.proj-card-total { font-weight: 600; }
.proj-card-drafts { color: var(--text-muted); font-style: italic; }
.proj-card-next { font-size: 10px; margin-left: auto; }

/* ── Badges de type ──────────────────────────────────────────────────────── */
.devoir-type-badge {
  font-size: 10px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.5px; padding: 2px 7px; border-radius: 4px;
}
.type-livrable     { background: rgba(74,144,217,.15);   color: var(--accent); }
.type-soutenance   { background: rgba(243,156,18,.15);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.15);  color: #9b87f5; }
.type-etude_de_cas { background: rgba(39,174,96,.15);    color: var(--color-success); }
.type-memoire      { background: rgba(231,76,60,.15);    color: #e74c3c; }
.type-autre        { background: rgba(127,140,141,.15);  color: #95a5a6; }

/* ── Loading & Empty ─────────────────────────────────────────────────────── */
.dh-loading { padding: 24px 28px; }
.dh-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 80px 20px; text-align: center;
}
.dh-empty-icon { color: var(--text-muted); opacity: .25; margin-bottom: 20px; }
.dh-empty h3 { font-size: 17px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
.dh-empty p { font-size: 13px; color: var(--text-muted); max-width: 340px; line-height: 1.5; }
.dh-empty-btn { margin-top: 16px; }

@media (max-width: 600px) {
  .dh-home { padding: 16px; }
  .dh-next-grid { grid-template-columns: 1fr; }
  .proj-grid { grid-template-columns: 1fr; }
}
</style>
