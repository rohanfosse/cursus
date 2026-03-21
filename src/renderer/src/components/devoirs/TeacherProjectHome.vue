/**
 * Accueil projets enseignant : résumé promo, prochains événements, grille de projets avec stats.
 */
<script setup lang="ts">
import { BookOpen, Clock, ChevronRight, PlusCircle } from 'lucide-vue-next'
import { useAppStore }     from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { useModalsStore }  from '@/stores/modals'
import { deadlineClass, deadlineLabel } from '@/utils/date'
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

// FolderOpen is not in base lucide-vue-next so we import it here
import { FolderOpen } from 'lucide-vue-next'
</script>

<template>
  <div v-if="travauxStore.loading" class="ut-loading">
    <div v-for="i in 4" :key="i" class="skel skel-line" style="height:100px;margin-bottom:10px;border-radius:10px" />
  </div>

  <div v-else-if="!teacherCategories.length" class="empty-state-custom">
    <BookOpen :size="48" class="empty-icon" />
    <h3>Aucun projet pour cette promotion</h3>
    <p>Les projets apparaîtront automatiquement quand vous créerez un devoir avec une catégorie.</p>
    <button class="btn-primary" style="margin-top:12px" @click="modals.newDevoir = true">
      <PlusCircle :size="14" /> Créer un devoir
    </button>
  </div>

  <template v-else>
    <div class="dh-home">

      <!-- Résumé promo -->
      <div class="dh-summary">
        <div class="dh-summary-stats">
          <div class="dh-stat">
            <span class="dh-stat-value">{{ travauxStore.ganttData.length }}</span>
            <span class="dh-stat-label">Devoirs</span>
          </div>
          <div class="dh-stat">
            <span class="dh-stat-value" style="color:var(--color-success)">{{ travauxStore.ganttData.filter(t => t.is_published).length }}</span>
            <span class="dh-stat-label">Publiés</span>
          </div>
          <div v-if="globalToGrade > 0" class="dh-stat">
            <span class="dh-stat-value" style="color:var(--color-warning)">{{ globalToGrade }}</span>
            <span class="dh-stat-label">À noter</span>
          </div>
          <div v-if="globalDrafts > 0" class="dh-stat">
            <span class="dh-stat-value" style="color:var(--text-muted)">{{ globalDrafts }}</span>
            <span class="dh-stat-label">Brouillons</span>
          </div>
        </div>
      </div>

      <!-- Prochains événements -->
      <div v-if="upcomingDevoirs.length" class="dh-section">
        <h4 class="dh-section-title"><Clock :size="14" /> Prochains événements</h4>
        <div class="dh-upcoming-cards">
          <div
            v-for="d in upcomingDevoirs"
            :key="d.id"
            class="dh-upcoming-card"
            @click="openDevoir(d.id)"
            @contextmenu="openCtxMenu($event, d)"
          >
            <div class="dh-upcoming-top">
              <span class="devoir-type-badge" :class="`type-${d.type}`">{{ typeLabel(d.type) }}</span>
              <span class="dh-upcoming-deadline deadline-badge" :class="deadlineClass(d.deadline)">{{ deadlineLabel(d.deadline) }}</span>
            </div>
            <span class="dh-upcoming-title">{{ d.title }}</span>
            <div class="dh-upcoming-meta">
              <span v-if="d.category" class="dh-upcoming-cat">{{ d.category }}</span>
              <span v-if="extractDuration(d.description)" class="dh-upcoming-dur">{{ extractDuration(d.description) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Projets -->
      <div class="dh-section">
        <h4 class="dh-section-title"><FolderOpen :size="14" /> Projets</h4>
        <div class="proj-grid">
          <div
            v-for="cat in teacherCategories"
            :key="cat"
            class="proj-card"
            @click="appStore.activeProject = cat"
          >
            <div class="proj-card-header">
              <span class="proj-card-name">{{ cat }}</span>
              <ChevronRight :size="14" class="proj-card-chevron" />
            </div>
            <div class="proj-card-types">
              <span v-for="tl in projectTypeCounts(cat)" :key="tl.type" class="proj-type-pill" :class="`type-${tl.type}`">
                {{ tl.count }} {{ typeLabel(tl.type) }}
              </span>
            </div>
            <div class="proj-card-stats-row">
              <span>{{ projectStats(cat).totalDepots }}/{{ projectStats(cat).totalExpected }} soumis</span>
              <span v-if="projectStats(cat).toGrade > 0" class="proj-stat-warn">{{ projectStats(cat).toGrade }} à noter</span>
            </div>
            <div class="proj-card-progress">
              <div class="proj-card-progress-fill" :style="{ width: projectStats(cat).pct + '%' }" />
            </div>
            <div class="proj-card-footer">
              <span class="proj-card-total">{{ projectDevoirCount(cat) }} devoir{{ projectDevoirCount(cat) > 1 ? 's' : '' }}</span>
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
/* ── Accueil devoirs prof ─────────────────────────────────────────────────── */
.dh-home { padding: 16px 20px; }

.dh-summary { margin-bottom: 20px; }
.dh-summary-stats { display: flex; gap: 16px; flex-wrap: wrap; }
.dh-stat {
  background: var(--bg-elevated, rgba(255,255,255,.03));
  border: 1px solid var(--border); border-radius: 10px;
  padding: 12px 20px; min-width: 80px; text-align: center;
}
.dh-stat-value { font-size: 22px; font-weight: 800; color: var(--text-primary); display: block; }
.dh-stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .4px; }

.dh-section { margin-bottom: 20px; }
.dh-section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 14px; font-weight: 700; color: var(--text-primary);
  margin-bottom: 10px;
}

/* Prochains événements */
.dh-upcoming-cards { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; }
.dh-upcoming-card {
  flex-shrink: 0; width: 200px;
  background: var(--bg-elevated, rgba(255,255,255,.03));
  border: 1px solid var(--border); border-radius: 10px;
  padding: 12px; cursor: pointer;
  transition: all var(--t-fast);
}
.dh-upcoming-card:hover { border-color: var(--accent); background: rgba(74,144,217,.04); }
.dh-upcoming-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.dh-upcoming-deadline { font-size: 10px; }
.dh-upcoming-title {
  font-size: 13px; font-weight: 600; color: var(--text-primary);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; line-height: 1.3; margin-bottom: 6px;
}
.dh-upcoming-meta { display: flex; gap: 6px; flex-wrap: wrap; }
.dh-upcoming-cat {
  font-size: 10px; color: var(--text-muted);
  background: rgba(255,255,255,.05); padding: 1px 6px; border-radius: 4px;
}
.dh-upcoming-dur {
  font-size: 10px; color: var(--text-muted);
  background: rgba(255,255,255,.05); padding: 1px 5px; border-radius: 6px;
}

@media (max-width: 600px) {
  .dh-upcoming-cards { flex-direction: column; }
  .dh-upcoming-card { width: 100%; }
}

/* Projets grid */
.proj-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.proj-card {
  background: var(--bg-elevated, rgba(255,255,255,.03));
  border: 1px solid var(--border);
  border-radius: 10px; padding: 16px; cursor: pointer;
  transition: border-color var(--t-fast), background var(--t-fast), transform .1s;
}
.proj-card:hover {
  border-color: var(--accent); background: rgba(74,144,217,.04);
  transform: translateY(-1px);
}
.proj-card-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.proj-card-name { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.proj-card-chevron { color: var(--text-muted); opacity: .4; transition: opacity var(--t-fast); }
.proj-card:hover .proj-card-chevron { opacity: 1; color: var(--accent); }
.proj-card-types { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 10px; }
.proj-type-pill {
  font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px;
}
.proj-card-stats-row {
  display: flex; gap: 8px; font-size: 11px; color: var(--text-muted); margin-bottom: 8px; flex-wrap: wrap;
}
.proj-stat-warn { color: var(--color-warning); font-weight: 600; }

.proj-card-progress {
  height: 3px; border-radius: 2px; background: rgba(255,255,255,.06); overflow: hidden; margin-bottom: 10px;
}
.proj-card-progress-fill {
  height: 100%; background: var(--color-success); border-radius: 2px; transition: width .4s;
}

.proj-card-footer {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; color: var(--text-muted);
}
.proj-card-total { font-weight: 500; }
.proj-card-next { font-size: 10px; }

/* ── Badges de type ──────────────────────────────────────────────────────── */
.devoir-type-badge {
  font-size: 10px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.5px; padding: 2px 7px; border-radius: 4px;
}
.type-livrable     { background: rgba(74,144,217,.2);   color: var(--accent); }
.type-soutenance   { background: rgba(243,156,18,.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: #9b87f5; }
.type-etude_de_cas { background: rgba(39,174,96,.2);    color: var(--color-success); }
.type-memoire      { background: rgba(231,76,60,.2);    color: #e74c3c; }
.type-autre        { background: rgba(127,140,141,.2);  color: #95a5a6; }

/* ── Shared ──────────────────────────────────────────────────────────────── */
.ut-loading { padding: 20px; }

.empty-state-custom {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 60px 20px; text-align: center;
}
.empty-icon { color: var(--text-muted); opacity: 0.35; margin-bottom: 16px; }
.empty-state-custom h3 { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
.empty-state-custom p { font-size: 13px; color: var(--text-muted); max-width: 320px; line-height: 1.5; }
</style>
