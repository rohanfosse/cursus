/**
 * Branche étudiant de la vue Devoirs : stats bar, apercu projets, groupes urgence,
 * formulaires de dépôt, devoirs rendus.
 */
<script setup lang="ts">
import {
  CheckCircle2, Clock, Lock, AlertTriangle, Upload, Link2, X,
  FileText, Calendar, LayoutList, Award,
} from 'lucide-vue-next'
import { useAppStore }     from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { deadlineClass, deadlineLabel, formatDate } from '@/utils/date'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import { typeLabel, isExpired as _isExpired } from '@/utils/devoir'
import type { Devoir, Rubric } from '@/types'
import StudentProjetFiche from '@/components/projet/StudentProjetFiche.vue'

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
}>()

defineEmits<{
  (e: 'update:depositMode', v: 'file' | 'link'): void
  (e: 'update:depositLink', v: string): void
}>()

const appStore     = useAppStore()
const travauxStore = useTravauxStore()

function isExpired(deadline: string | null | undefined): boolean {
  return _isExpired(deadline, props.now)
}
</script>

<template>
  <!-- Stats bar -->
  <div
    v-if="filteredDevoirs.length > 0"
    class="student-stats-bar"
  >
    <div class="stat-chip stat-chip-neutral">
      <span class="stat-dot dot-neutral" />
      <strong>{{ studentStats.total }}</strong>&nbsp;total
    </div>
    <div class="stat-chip stat-chip-blue">
      <span class="stat-dot dot-blue" />
      <strong>{{ studentStats.pending }}</strong>&nbsp;à rendre
    </div>
    <div class="stat-chip stat-chip-red">
      <span class="stat-dot dot-red" />
      <strong>{{ studentStats.urgent }}</strong>&nbsp;urgent
    </div>
    <div class="stat-chip stat-chip-green">
      <span class="stat-dot dot-green" />
      <strong>{{ studentStats.submitted }}</strong>&nbsp;rendu{{ studentStats.submitted > 1 ? 's' : '' }}
    </div>
  </div>

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

  <!-- État vide -->
  <div v-else-if="filteredDevoirs.length === 0" class="empty-state-custom">
    <CheckCircle2 :size="48" class="empty-icon" />
    <h3>Aucun devoir assigné</h3>
    <p>Vos devoirs apparaîtront ici dès qu'un enseignant en créera.</p>
  </div>

  <!-- Aperçu par projet (sans filtre actif, plusieurs projets) -->
  <div v-else-if="!appStore.activeProject && studentProjectOverview.length > 1" class="student-project-overview">
    <button
      v-for="p in studentProjectOverview"
      :key="p.key"
      class="student-proj-card"
      @click="appStore.activeProject = p.key"
    >
      <span class="student-proj-label">{{ p.label }}</span>
      <span class="student-proj-stat">
        <span class="student-proj-submitted">{{ p.submitted }} rendu{{ p.submitted > 1 ? 's' : '' }}</span>
        <span v-if="p.pending" class="student-proj-pending"> · {{ p.pending }} à faire</span>
      </span>
      <div class="student-proj-bar">
        <div
          class="student-proj-bar-fill"
          :style="{ width: (p.total ? Math.round(p.submitted / p.total * 100) : 0) + '%' }"
        />
      </div>
    </button>
  </div>

  <!-- Groupes de devoirs -->
  <div v-else class="devoirs-grouped">

    <!-- EN RETARD -->
    <template v-if="studentGroups.overdue.length">
      <div class="group-header group-header--danger" title="Deadline dépassée - dépôt verrouillé">
        <Lock :size="12" /> En retard
        <span class="group-count">{{ studentGroups.overdue.length }}</span>
        <span class="group-subtitle">La deadline est dépassée - le dépôt n'est plus possible</span>
      </div>
      <div class="devoirs-list">
        <div v-for="t in studentGroups.overdue" :key="t.id" class="devoir-card devoir-card--overdue">
          <div class="devoir-card-header">
            <div class="devoir-card-meta">
              <span class="devoir-type-badge" :class="`type-${t.type}`">{{ typeLabel(t.type) }}</span>
              <span v-if="t.category" class="tag-badge">{{ parseCategoryIcon(t.category).label || t.category }}</span>
              <span v-if="t.channel_name" class="devoir-channel"># {{ t.channel_name }}</span>
            </div>
            <span class="deadline-badge" :class="deadlineClass(t.deadline)">
              <Clock :size="10" />{{ deadlineLabel(t.deadline) }}
            </span>
          </div>
          <h3 class="devoir-card-title">{{ t.title }}</h3>
          <p v-if="t.description" class="devoir-card-desc">{{ t.description }}</p>
          <p v-if="t.room" class="devoir-card-room">Salle {{ t.room }}</p>
          <div v-if="t.aavs" class="devoir-card-aavs"><span v-for="a in t.aavs.split('\n').filter(Boolean)" :key="a" class="aav-tag">{{ a.trim() }}</span></div>
          <div class="devoir-card-footer">
            <span class="devoir-deadline-date">Échéance : {{ formatDate(t.deadline) }}</span>
            <button class="btn-deposit-expired" disabled>
              <Lock :size="12" /> Délai expiré
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- URGENT -->
    <template v-if="studentGroups.urgent.length">
      <div class="group-header group-header--warning" title="Moins de 3 jours avant la deadline">
        <AlertTriangle :size="12" /> Urgent
        <span class="group-count">{{ studentGroups.urgent.length }}</span>
        <span class="group-subtitle">Moins de 3 jours avant la deadline</span>
      </div>
      <div class="devoirs-list">
        <div v-for="t in studentGroups.urgent" :key="t.id" class="devoir-card devoir-card--urgent">
          <div class="devoir-card-header">
            <div class="devoir-card-meta">
              <span class="devoir-type-badge" :class="`type-${t.type}`">{{ typeLabel(t.type) }}</span>
              <span v-if="t.category" class="tag-badge">{{ parseCategoryIcon(t.category).label || t.category }}</span>
              <span v-if="t.channel_name" class="devoir-channel"># {{ t.channel_name }}</span>
            </div>
            <span class="deadline-badge" :class="deadlineClass(t.deadline)">
              <Clock :size="10" />{{ deadlineLabel(t.deadline) }}
            </span>
          </div>
          <h3 class="devoir-card-title">{{ t.title }}</h3>
          <p v-if="t.description" class="devoir-card-desc">{{ t.description }}</p>
          <p v-if="t.room" class="devoir-card-room">Salle {{ t.room }}</p>
          <div v-if="t.aavs" class="devoir-card-aavs"><span v-for="a in t.aavs.split('\n').filter(Boolean)" :key="a" class="aav-tag">{{ a.trim() }}</span></div>
          <template v-if="depositingDevoirId === t.id">
            <div class="deposit-form">
              <div class="deposit-type-toggle">
                <button class="deposit-toggle-btn" :class="{ active: depositMode === 'file' }" @click="$emit('update:depositMode', 'file')">
                  <FileText :size="12" /> Fichier
                </button>
                <button class="deposit-toggle-btn" :class="{ active: depositMode === 'link' }" @click="$emit('update:depositMode', 'link')">
                  <Link2 :size="12" /> Lien URL
                </button>
              </div>
              <div v-if="depositMode === 'file'">
                <div v-if="depositFile" class="deposit-file-selected">
                  <CheckCircle2 :size="15" class="deposit-file-selected-icon" />
                  <span class="deposit-file-selected-name">{{ depositFileName }}</span>
                  <button class="deposit-file-selected-clear" type="button" @click.stop="clearDepositFile">
                    <X :size="12" />
                  </button>
                </div>
                <div v-else class="deposit-file-zone" @click="pickFile">
                  <Upload :size="20" class="deposit-file-zone-icon" />
                  <span class="deposit-file-zone-label">Cliquer pour choisir un fichier</span>
                  <span class="deposit-file-zone-hint">PDF, images, archives…</span>
                </div>
              </div>
              <input v-else :value="depositLink" class="form-input" placeholder="https://…" type="url" @input="$emit('update:depositLink', ($event.target as HTMLInputElement).value)" />
              <div v-if="rubricPreview" class="rubric-preview">
                <div class="rubric-preview-header">
                  <LayoutList :size="12" />
                  <span>{{ rubricPreview.title }}</span>
                </div>
                <div class="rubric-preview-criteria">
                  <div v-for="c in rubricPreview.criteria" :key="c.id" class="rubric-preview-criterion">
                    <span class="rubric-preview-label">{{ c.label }}</span>
                    <span class="rubric-preview-pts">/ {{ c.max_pts }} pt{{ c.max_pts > 1 ? 's' : '' }}</span>
                  </div>
                </div>
              </div>
              <div class="deposit-actions">
                <button class="btn-ghost btn-deposit-cancel" @click="cancelDeposit"><X :size="12" /> Annuler</button>
                <button
                  class="btn-primary btn-deposit-submit"
                  :disabled="depositing || isExpired(t.deadline) || (depositMode === 'file' ? !depositFile : !depositLink.trim())"
                  @click="submitDeposit(t)"
                >
                  <Upload :size="12" />
                  {{ depositing ? 'Dépôt…' : isExpired(t.deadline) ? 'Délai expiré' : 'Déposer' }}
                </button>
              </div>
            </div>
          </template>
          <div v-else class="devoir-card-footer">
            <span class="devoir-deadline-date">Échéance : {{ formatDate(t.deadline) }}</span>
            <button class="btn-primary btn-deposit" @click="startDeposit(t)">
              <Upload :size="12" /> Déposer
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- À RENDRE -->
    <template v-if="studentGroups.pending.length">
      <div class="group-header group-header--accent" title="Plus de 3 jours avant la deadline">
        <Clock :size="12" /> À rendre
        <span class="group-count">{{ studentGroups.pending.length }}</span>
        <span class="group-subtitle">Vous avez encore du temps, mais pensez-y</span>
      </div>
      <div class="devoirs-list">
        <div v-for="t in studentGroups.pending" :key="t.id" class="devoir-card devoir-card--pending">
          <div class="devoir-card-header">
            <div class="devoir-card-meta">
              <span class="devoir-type-badge" :class="`type-${t.type}`">{{ typeLabel(t.type) }}</span>
              <span v-if="t.category" class="tag-badge">{{ parseCategoryIcon(t.category).label || t.category }}</span>
              <span v-if="t.channel_name" class="devoir-channel"># {{ t.channel_name }}</span>
            </div>
            <span class="deadline-badge" :class="deadlineClass(t.deadline)">
              <Clock :size="10" />{{ deadlineLabel(t.deadline) }}
            </span>
          </div>
          <h3 class="devoir-card-title">{{ t.title }}</h3>
          <p v-if="t.description" class="devoir-card-desc">{{ t.description }}</p>
          <p v-if="t.room" class="devoir-card-room">Salle {{ t.room }}</p>
          <div v-if="t.aavs" class="devoir-card-aavs"><span v-for="a in t.aavs.split('\n').filter(Boolean)" :key="a" class="aav-tag">{{ a.trim() }}</span></div>
          <template v-if="depositingDevoirId === t.id">
            <div class="deposit-form">
              <div class="deposit-type-toggle">
                <button class="deposit-toggle-btn" :class="{ active: depositMode === 'file' }" @click="$emit('update:depositMode', 'file')">
                  <FileText :size="12" /> Fichier
                </button>
                <button class="deposit-toggle-btn" :class="{ active: depositMode === 'link' }" @click="$emit('update:depositMode', 'link')">
                  <Link2 :size="12" /> Lien URL
                </button>
              </div>
              <div v-if="depositMode === 'file'">
                <div v-if="depositFile" class="deposit-file-selected">
                  <CheckCircle2 :size="15" class="deposit-file-selected-icon" />
                  <span class="deposit-file-selected-name">{{ depositFileName }}</span>
                  <button class="deposit-file-selected-clear" type="button" @click.stop="clearDepositFile">
                    <X :size="12" />
                  </button>
                </div>
                <div v-else class="deposit-file-zone" @click="pickFile">
                  <Upload :size="20" class="deposit-file-zone-icon" />
                  <span class="deposit-file-zone-label">Cliquer pour choisir un fichier</span>
                  <span class="deposit-file-zone-hint">PDF, images, archives…</span>
                </div>
              </div>
              <input v-else :value="depositLink" class="form-input" placeholder="https://…" type="url" @input="$emit('update:depositLink', ($event.target as HTMLInputElement).value)" />
              <div v-if="rubricPreview" class="rubric-preview">
                <div class="rubric-preview-header">
                  <LayoutList :size="12" />
                  <span>{{ rubricPreview.title }}</span>
                </div>
                <div class="rubric-preview-criteria">
                  <div v-for="c in rubricPreview.criteria" :key="c.id" class="rubric-preview-criterion">
                    <span class="rubric-preview-label">{{ c.label }}</span>
                    <span class="rubric-preview-pts">/ {{ c.max_pts }} pt{{ c.max_pts > 1 ? 's' : '' }}</span>
                  </div>
                </div>
              </div>
              <div class="deposit-actions">
                <button class="btn-ghost btn-deposit-cancel" @click="cancelDeposit"><X :size="12" /> Annuler</button>
                <button
                  class="btn-primary btn-deposit-submit"
                  :disabled="depositing || isExpired(t.deadline) || (depositMode === 'file' ? !depositFile : !depositLink.trim())"
                  @click="submitDeposit(t)"
                >
                  <Upload :size="12" />
                  {{ depositing ? 'Dépôt…' : isExpired(t.deadline) ? 'Délai expiré' : 'Déposer' }}
                </button>
              </div>
            </div>
          </template>
          <div v-else class="devoir-card-footer">
            <span class="devoir-deadline-date">Échéance : {{ formatDate(t.deadline) }}</span>
            <button class="btn-primary btn-deposit" @click="startDeposit(t)">
              <Upload :size="12" /> Déposer
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- PRÉSENCE -->
    <template v-if="studentGroups.event.length">
      <div class="group-header group-header--purple">
        <Calendar :size="12" /> Présence requise
        <span class="group-count">{{ studentGroups.event.length }}</span>
      </div>
      <div class="devoirs-list">
        <div v-for="t in studentGroups.event" :key="t.id" class="devoir-card devoir-card--event">
          <div class="devoir-card-header">
            <div class="devoir-card-meta">
              <span class="devoir-type-badge" :class="`type-${t.type}`">{{ typeLabel(t.type) }}</span>
              <span v-if="t.category" class="tag-badge">{{ parseCategoryIcon(t.category).label || t.category }}</span>
              <span v-if="t.channel_name" class="devoir-channel"># {{ t.channel_name }}</span>
            </div>
            <span class="deadline-badge" :class="deadlineClass(t.deadline)">
              <Clock :size="10" />{{ deadlineLabel(t.deadline) }}
            </span>
          </div>
          <h3 class="devoir-card-title">{{ t.title }}</h3>
          <p v-if="t.description" class="devoir-card-desc">{{ t.description }}</p>
          <p v-if="t.room" class="devoir-card-room">Salle {{ t.room }}</p>
          <div v-if="t.aavs" class="devoir-card-aavs"><span v-for="a in t.aavs.split('\n').filter(Boolean)" :key="a" class="aav-tag">{{ a.trim() }}</span></div>
          <div class="devoir-presence-notice">
            <Calendar :size="14" class="devoir-presence-icon" />
            <span>Présence requise - pas de dépôt fichier</span>
          </div>
          <div class="devoir-card-footer">
            <span class="devoir-deadline-date">Date : {{ formatDate(t.deadline) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- RENDUS -->
    <template v-if="submittedDevoirs.length">
      <div class="group-header group-header--success" title="Devoirs soumis">
        <CheckCircle2 :size="12" /> Rendus
        <span class="group-count">{{ submittedDevoirs.length }} / {{ filteredDevoirs.length }}</span>
      </div>
      <div class="devoirs-list">
        <div v-for="t in submittedDevoirs" :key="t.id" class="devoir-card devoir-card--submitted">
          <div class="devoir-card-header">
            <div class="devoir-card-meta">
              <span class="devoir-type-badge" :class="`type-${t.type}`">{{ typeLabel(t.type) }}</span>
              <span v-if="t.category" class="tag-badge">{{ parseCategoryIcon(t.category).label || t.category }}</span>
              <span v-if="t.channel_name" class="devoir-channel"># {{ t.channel_name }}</span>
            </div>
            <span class="deadline-badge" :class="deadlineClass(t.deadline)">
              <Clock :size="10" />{{ deadlineLabel(t.deadline) }}
            </span>
          </div>
          <h3 class="devoir-card-title">{{ t.title }}</h3>
          <p v-if="t.description" class="devoir-card-desc">{{ t.description }}</p>
          <p v-if="t.room" class="devoir-card-room">Salle {{ t.room }}</p>
          <div v-if="t.aavs" class="devoir-card-aavs"><span v-for="a in t.aavs.split('\n').filter(Boolean)" :key="a" class="aav-tag">{{ a.trim() }}</span></div>
          <div class="devoir-submitted-info">
            <CheckCircle2 :size="14" />
            <span>Rendu déposé</span>
            <span v-if="t.note" class="devoir-graded-badge">Noté</span>
            <span v-else class="devoir-pending-badge">En attente de note</span>
          </div>
          <div v-if="t.note" class="devoir-grade-row">
            <Award :size="13" class="devoir-grade-icon" />
            <span class="devoir-grade-value">{{ t.note }}</span>
            <span v-if="t.feedback" class="devoir-grade-feedback">{{ t.feedback }}</span>
          </div>
        </div>
      </div>
    </template>

  </div>
</template>

<style scoped>
/* ── Barre de stats étudiant ─────────────────────────────────────────────── */
.student-stats-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.02);
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid transparent;
}
.stat-chip strong { font-weight: 700; }

.stat-chip-neutral { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.08); color: var(--text-secondary); }
.stat-chip-blue    { background: rgba(74, 144, 217, 0.12);  border-color: rgba(74, 144, 217, 0.2);   color: var(--accent-light); }
.stat-chip-red     { background: rgba(231, 76, 60, 0.12);   border-color: rgba(231, 76, 60, 0.2);    color: #ff7b6b; }
.stat-chip-green   { background: rgba(39, 174, 96, 0.12);   border-color: rgba(39, 174, 96, 0.2);    color: #5dd08a; }

.stat-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-neutral { background: var(--text-muted); }
.dot-blue    { background: var(--accent); }
.dot-red     { background: var(--color-danger); }
.dot-green   { background: var(--color-success); }

/* ── Aperçu projets étudiant ─────────────────────────────────────────────── */
.student-project-overview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 4px;
}

.student-proj-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-sidebar);
  cursor: pointer;
  text-align: left;
  font-family: var(--font);
  transition: background var(--t-fast), border-color var(--t-fast);
}
.student-proj-card:hover {
  background: var(--bg-hover);
  border-color: #9B87F5;
}

.student-proj-label { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.student-proj-stat  { font-size: 11px; color: var(--text-muted); }
.student-proj-submitted { color: var(--color-success); }
.student-proj-pending   { color: var(--color-warning); }

.student-proj-bar {
  height: 4px;
  border-radius: 4px;
  background: rgba(255,255,255,.08);
  overflow: hidden;
}
.student-proj-bar-fill {
  height: 100%;
  border-radius: 4px;
  background: var(--color-success);
  transition: width .3s ease;
}

/* ── Liste commune ────────────────────────────────────────────────────────── */
.devoirs-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 780px;
  margin: 0 auto;
}

/* ── Groupes urgence étudiant ─────────────────────────────────────────────── */
.devoirs-grouped {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 780px;
  margin: 0 auto;
}

.group-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 4px;
}
.group-subtitle {
  width: 100%;
  font-size: 11.5px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  color: var(--text-muted);
  margin-top: -2px;
}

.group-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.1);
  color: inherit;
}

.group-header--danger  { color: var(--color-danger); }
.group-header--warning { color: var(--color-warning); }
.group-header--accent  { color: var(--accent-light); }
.group-header--success { color: var(--color-success); }
.group-header--purple  { color: #9b87f5; }

/* ── Carte étudiant ──────────────────────────────────────────────────────── */
.devoir-card {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-left-width: 4px;
  border-radius: 10px;
  padding: 16px;
  transition: border-color var(--t-base);
}
.devoir-card:hover { border-color: rgba(74, 144, 217, 0.3); }

.devoir-card--overdue   { border-left-color: var(--color-danger); }
.devoir-card--overdue:hover   { border-left-color: var(--color-danger); }
.devoir-card--urgent    { border-left-color: var(--color-warning); }
.devoir-card--urgent:hover    { border-left-color: var(--color-warning); }
.devoir-card--pending   { border-left-color: var(--accent); }
.devoir-card--pending:hover   { border-left-color: var(--accent); }
.devoir-card--submitted { border-left-color: var(--color-success); }
.devoir-card--submitted:hover { border-left-color: var(--color-success); border-color: rgba(39, 174, 96, 0.3); }
.devoir-card--event     { border-left-color: #9b87f5; }
.devoir-card--event:hover     { border-left-color: #9b87f5; border-color: rgba(155, 135, 245, 0.3); }

.devoir-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.devoir-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.devoir-channel { font-size: 11px; color: var(--text-muted); }

.devoir-card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.devoir-card-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.devoir-card-room { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
.devoir-card-aavs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.aav-tag {
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(74,144,217,.12);
  color: var(--accent);
  white-space: nowrap;
}

/* Présence requise */
.devoir-presence-notice {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 600;
  color: #9b87f5;
  background: rgba(155, 135, 245, 0.1);
  border: 1px solid rgba(155, 135, 245, 0.25);
  padding: 6px 12px;
  border-radius: 6px;
  margin-top: 8px;
  margin-bottom: 8px;
}
.devoir-presence-icon { flex-shrink: 0; }

/* Statut rendu */
.devoir-submitted-info {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-success);
  margin-top: 8px;
}
.devoir-graded-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(46,204,113,.15);
  color: var(--color-success);
  margin-left: 4px;
}
.devoir-pending-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(255,255,255,.08);
  color: var(--text-muted);
  margin-left: 4px;
}

/* Grade dans la carte rendu (étudiant) */
.devoir-grade-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12.5px;
}
.devoir-grade-icon { color: var(--accent-light); flex-shrink: 0; }
.devoir-grade-value { font-weight: 700; color: var(--accent-light); }
.devoir-grade-feedback { color: var(--text-secondary); font-style: italic; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.devoir-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.devoir-deadline-date { font-size: 12px; color: var(--text-muted); }

.btn-deposit-expired {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid rgba(231, 76, 60, 0.3);
  border-radius: var(--radius-sm);
  background: rgba(231, 76, 60, 0.08);
  color: var(--color-danger);
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font);
  cursor: not-allowed;
  opacity: 0.75;
}

.btn-deposit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  font-size: 12px;
}

/* ── Formulaire de dépôt inline ──────────────────────────────────────────── */
.deposit-form {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-input);
  border-radius: 8px;
  padding: 14px;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.deposit-type-toggle {
  display: flex;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
  align-self: flex-start;
}

.deposit-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
  font-family: var(--font);
}
.deposit-toggle-btn.active             { background: var(--accent); color: #fff; }
.deposit-toggle-btn:hover:not(.active) { color: var(--text-primary); }

.deposit-file-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 14px;
  border: 1.5px dashed var(--border-input);
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: border-color var(--t-fast), background var(--t-fast);
}
.deposit-file-zone:hover {
  border-color: var(--accent);
  background: var(--accent-subtle);
}

.deposit-file-zone-icon       { color: var(--text-muted); margin-bottom: 2px; }
.deposit-file-zone:hover .deposit-file-zone-icon { color: var(--accent); }
.deposit-file-zone-label      { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
.deposit-file-zone-hint       { font-size: 11px; color: var(--text-muted); opacity: .7; }

.deposit-file-selected {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1.5px solid #27AE60;
  border-radius: 8px;
  background: rgba(39, 174, 96, 0.08);
}

.deposit-file-selected-icon { color: #27AE60; flex-shrink: 0; }

.deposit-file-selected-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deposit-file-selected-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  border-radius: 4px;
  flex-shrink: 0;
  transition: color var(--t-fast), background var(--t-fast);
}
.deposit-file-selected-clear:hover { color: #ff6b6b; background: rgba(231, 76, 60, 0.12); }

.deposit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-deposit-submit { font-size: 12px; padding: 6px 14px; }
.btn-deposit-cancel { font-size: 12px; padding: 6px 12px; }

/* ── Aperçu grille d'évaluation ──────────────────────────────────────────── */
.rubric-preview {
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.rubric-preview-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--text-muted);
}

.rubric-preview-criteria { display: flex; flex-direction: column; }

.rubric-preview-criterion {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 10px;
  font-size: 12px;
  border-bottom: 1px solid var(--border);
}
.rubric-preview-criterion:last-child { border-bottom: none; }

.rubric-preview-label {
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rubric-preview-pts {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
  margin-left: 8px;
}

/* ── Badges de type ──────────────────────────────────────────────────────── */
.devoir-type-badge {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border-radius: 4px;
}

.type-livrable     { background: rgba(74,144,217,.2);   color: var(--accent); }
.type-soutenance   { background: rgba(243,156,18,.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: #9b87f5; }
.type-etude_de_cas { background: rgba(39,174,96,.2);    color: var(--color-success); }
.type-memoire      { background: rgba(231,76,60,.2);    color: #e74c3c; }
.type-autre        { background: rgba(127,140,141,.2);  color: #95a5a6; }

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
  opacity: 0.35;
  margin-bottom: 16px;
}

.empty-state-custom h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.empty-state-custom p {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 320px;
  line-height: 1.5;
}
</style>
