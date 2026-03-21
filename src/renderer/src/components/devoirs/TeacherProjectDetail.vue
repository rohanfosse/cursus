/**
 * Vue projet sélectionné (enseignant) : résumé projet, devoirs groupés par type avec cartes initiales/rattrapages.
 */
<script setup lang="ts">
import { BookOpen, Clock, Plus, Eye } from 'lucide-vue-next'
import { useAppStore }     from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { useModalsStore }  from '@/stores/modals'
import { deadlineClass, deadlineLabel } from '@/utils/date'
import { typeLabel, extractDuration } from '@/utils/devoir'
import type { GanttRow } from '@/types'
import type { UnifiedFlatRow } from '@/composables/useDevoirsTeacher'

const props = defineProps<{
  unifiedFlat: UnifiedFlatRow[]
  devoirsByType: { type: string; initiales: UnifiedFlatRow[]; rattrapages: UnifiedFlatRow[]; total: number }[]
  projectTypeCounts: (cat: string) => { type: string; count: number }[]
  projectStats: (cat: string) => { totalDepots: number; totalExpected: number; pct: number; noted: number; toGrade: number; drafts: number }
  projectNextDeadline: (cat: string) => string | null
  publishDevoir: (id: number, e: MouseEvent) => void
  publishAllDrafts: () => void
  addDevoirOfType: (type: string) => void
  openDevoir: (id: number) => void
  openCtxMenu: (e: MouseEvent, d: GanttRow | UnifiedFlatRow) => void
}>()

const appStore     = useAppStore()
const travauxStore = useTravauxStore()
const modals       = useModalsStore()
</script>

<template>
  <div v-if="travauxStore.loading" class="ut-loading">
    <div v-for="i in 5" :key="i" class="skel skel-line" style="height:36px;margin-bottom:4px;border-radius:6px" />
  </div>

  <div v-else-if="!unifiedFlat.length" class="empty-state-custom">
    <BookOpen :size="48" class="empty-icon" />
    <h3>Aucun devoir dans ce projet</h3>
    <p>Créez un devoir avec le bouton "Nouveau".</p>
  </div>

  <template v-else>
    <!-- Bloc résumé projet -->
    <div class="proj-summary">
      <h2 class="proj-summary-name">{{ appStore.activeProject }}</h2>
      <div class="proj-summary-pills">
        <span v-for="tl in projectTypeCounts(appStore.activeProject!)" :key="tl.type" class="proj-type-pill" :class="`type-${tl.type}`">
          {{ tl.count }} {{ typeLabel(tl.type) }}
        </span>
      </div>
      <div class="proj-summary-stats">
        <div class="proj-summary-progress">
          <div class="proj-summary-progress-bar">
            <div class="proj-summary-progress-fill" :style="{ width: projectStats(appStore.activeProject!).pct + '%' }" />
          </div>
          <span class="proj-summary-pct">{{ projectStats(appStore.activeProject!).pct }}% soumis</span>
        </div>
        <span class="proj-summary-stat">{{ projectStats(appStore.activeProject!).noted }} notés</span>
        <span v-if="projectStats(appStore.activeProject!).toGrade > 0" class="proj-summary-stat proj-stat-warn">{{ projectStats(appStore.activeProject!).toGrade }} à noter</span>
        <span v-if="projectNextDeadline(appStore.activeProject!)" class="proj-summary-stat">
          <Clock :size="11" /> {{ deadlineLabel(projectNextDeadline(appStore.activeProject!)!) }}
        </span>
        <button v-if="projectStats(appStore.activeProject!).drafts > 0" class="proj-summary-publish-btn" @click="publishAllDrafts">
          <Eye :size="12" /> Publier les {{ projectStats(appStore.activeProject!).drafts }} brouillon{{ projectStats(appStore.activeProject!).drafts > 1 ? 's' : '' }}
        </button>
      </div>
    </div>

    <!-- Devoirs par type -->
    <div class="dc-sections">
      <template v-for="group in devoirsByType" :key="group.type">
        <div class="dc-section" :class="`dc-section--${group.type}`">
          <div class="dc-section-header">
            <span class="devoir-type-badge" :class="`type-${group.type}`">{{ typeLabel(group.type) }}</span>
            <span class="dc-section-count">{{ group.total }}</span>
          </div>

          <!-- Cartes initiales -->
          <div class="dc-cards">
            <div
              v-for="t in group.initiales"
              :key="t.id"
              class="dc-card"
              :class="{ 'dc-card--draft': !t.is_published, [`dc-card--${group.type}`]: true }"
              @click="openDevoir(t.id)"
              @contextmenu="openCtxMenu($event, t)"
            >
              <div class="dc-card-top">
                <span class="dc-card-title">{{ t.title }}</span>
                <button v-if="!t.is_published" class="dc-publish-btn" title="Publier" @click="publishDevoir(t.id, $event)">
                  <Eye :size="12" />
                </button>
              </div>
              <div class="dc-card-meta">
                <span class="dc-card-date deadline-badge" :class="deadlineClass(t.deadline)">{{ deadlineLabel(t.deadline) }}</span>
                <span v-if="extractDuration(t.description)" class="dc-card-duration">{{ extractDuration(t.description) }}</span>
                <span v-if="t.room" class="dc-card-duration">{{ t.room }}</span>
              </div>
              <div v-if="t.hasSubmission && t.students_total > 0" class="dc-card-progress">
                <div class="dc-card-progress-fill" :style="{ width: Math.round((t.depots_count / t.students_total) * 100) + '%' }" />
              </div>
              <span v-if="!t.is_published" class="dc-card-draft-tag">Brouillon</span>
            </div>
          </div>

          <!-- Rattrapages -->
          <template v-if="group.rattrapages.length">
            <div class="dc-ratt-label">Rattrapages</div>
            <div class="dc-cards dc-cards--ratt">
              <div
                v-for="t in group.rattrapages"
                :key="t.id"
                class="dc-card dc-card--ratt"
                :class="{ 'dc-card--draft': !t.is_published, [`dc-card--${group.type}`]: true }"
                @click="openDevoir(t.id)"
                @contextmenu="openCtxMenu($event, t)"
              >
                <span class="dc-card-title">{{ t.title }}</span>
                <div class="dc-card-meta">
                  <span class="dc-card-date deadline-badge" :class="deadlineClass(t.deadline)">{{ deadlineLabel(t.deadline) }}</span>
                  <span v-if="extractDuration(t.description)" class="dc-card-duration">{{ extractDuration(t.description) }}</span>
                </div>
                <button v-if="!t.is_published" class="dc-publish-btn" title="Publier" @click="publishDevoir(t.id, $event)">
                  <Eye :size="12" />
                </button>
              </div>
            </div>
          </template>

          <!-- Bouton ajouter -->
          <button class="dc-add-btn" @click="addDevoirOfType(group.type)">
            <Plus :size="13" /> Ajouter {{ typeLabel(group.type).toLowerCase().startsWith('é') ? 'une' : 'un' }} {{ typeLabel(group.type) }}
          </button>
        </div>
      </template>

      <!-- Bouton ajouter si aucun type encore -->
      <button v-if="!devoirsByType.length" class="dc-add-btn dc-add-btn--first" @click="modals.newDevoir = true">
        <Plus :size="14" /> Créer un devoir
      </button>
    </div>
  </template>
</template>

<style scoped>
/* ── Résumé projet ──────────────────────────────────────────────────────── */
.proj-summary {
  padding: 16px 20px; border-bottom: 1px solid var(--border); margin-bottom: 8px;
}
.proj-summary-name { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
.proj-summary-pills { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 10px; }
.proj-summary-stats {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  font-size: 12px; color: var(--text-secondary);
}
.proj-summary-progress { display: flex; align-items: center; gap: 6px; }
.proj-summary-progress-bar { width: 80px; height: 5px; border-radius: 3px; background: rgba(255,255,255,.08); overflow: hidden; }
.proj-summary-progress-fill { height: 100%; background: var(--color-success); border-radius: 3px; }
.proj-summary-pct { font-weight: 600; }
.proj-summary-publish-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px;
  background: rgba(46,204,113,.1); color: var(--color-success);
  border: 1px solid rgba(46,204,113,.25); cursor: pointer; font-family: var(--font);
  transition: all var(--t-fast);
}
.proj-summary-publish-btn:hover { background: rgba(46,204,113,.2); }
.proj-summary-stat { display: flex; align-items: center; gap: 3px; }
.proj-stat-warn { color: var(--color-warning); font-weight: 600; }

.proj-type-pill {
  font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px;
}

/* ── Cartes devoirs par type ─────────────────────────────────────────────── */
.dc-sections { padding: 0 20px 20px; }
.dc-section {
  margin-bottom: 20px;
  border: 1px solid var(--border); border-radius: 10px;
  padding: 14px; background: rgba(255,255,255,.015);
}
.dc-section-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
}
.dc-section-count {
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  background: rgba(255,255,255,.06); padding: 1px 6px; border-radius: 8px;
}

.dc-cards {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px; margin-bottom: 8px;
}
.dc-cards--ratt { opacity: .65; }

.dc-card {
  padding: 10px 12px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--border); background: rgba(255,255,255,.02);
  transition: all var(--t-fast); position: relative;
}
.dc-card:hover { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.15); }
.dc-card--draft { border-style: dashed; opacity: .7; }
.dc-card--cctl { border-left: 3px solid #a569bd; }
.dc-card--soutenance { border-left: 3px solid var(--color-warning); }
.dc-card--etude_de_cas { border-left: 3px solid var(--color-success); }
.dc-card--livrable { border-left: 3px solid var(--accent); }
.dc-card--memoire { border-left: 3px solid #e74c3c; }
.dc-card--autre { border-left: 3px solid #95a5a6; }

.dc-card-top { display: flex; align-items: flex-start; gap: 6px; }
.dc-card-title { font-size: 12px; font-weight: 600; color: var(--text-primary); flex: 1; line-height: 1.3; }
.dc-card-meta { display: flex; align-items: center; gap: 5px; margin-top: 6px; }
.dc-card-date { font-size: 10px; }
.dc-card-duration { font-size: 10px; color: var(--text-muted); background: rgba(255,255,255,.05); padding: 1px 5px; border-radius: 6px; }
.dc-card-progress {
  height: 2px; border-radius: 1px; background: rgba(255,255,255,.06);
  margin-top: 6px; overflow: hidden;
}
.dc-card-progress-fill { height: 100%; background: var(--color-success); border-radius: 1px; }

.dc-card-draft-tag {
  position: absolute; top: 4px; right: 4px;
  font-size: 8px; font-weight: 700; text-transform: uppercase;
  padding: 1px 4px; border-radius: 3px;
  background: rgba(255,255,255,.06); color: var(--text-muted); border: 1px dashed var(--border-input);
}

.dc-publish-btn {
  background: none; border: none; cursor: pointer; padding: 2px;
  color: var(--text-muted); transition: color var(--t-fast);
}
.dc-publish-btn:hover { color: var(--color-success); }

.dc-ratt-label {
  font-size: 10px; font-weight: 700; color: var(--color-warning);
  text-transform: uppercase; letter-spacing: .3px;
  padding: 4px 0 2px; border-top: 1px dashed var(--border); margin-top: 4px;
}

.dc-add-btn {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; color: var(--accent);
  background: none; border: 1px dashed var(--border-input); border-radius: 6px;
  padding: 6px 12px; cursor: pointer; font-family: var(--font);
  transition: all var(--t-fast); margin-top: 6px;
}
.dc-add-btn:hover { background: rgba(74,144,217,.06); border-color: var(--accent); }
.dc-add-btn--first { padding: 14px; justify-content: center; font-size: 13px; }

@media (max-width: 600px) {
  .dc-cards { grid-template-columns: 1fr; }
}

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
