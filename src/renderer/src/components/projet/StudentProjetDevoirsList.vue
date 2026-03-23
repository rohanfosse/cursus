/** StudentProjetDevoirsList.vue - Grouped devoirs list (a rendre, evenements, rendus) */
<script setup lang="ts">
import { ref } from 'vue'
import {
  ChevronDown, ChevronRight, Clock, CalendarDays, Upload, X,
  FileText, Link2, CheckCircle2, Lock, Award, Users,
} from 'lucide-vue-next'
import { formatDate, deadlineClass, deadlineLabel } from '@/utils/date'
import type { Devoir } from '@/types'

const TYPE_LABELS: Record<string, string> = {
  livrable: 'Livrable', soutenance: 'Soutenance', cctl: 'CCTL',
  etude_de_cas: 'Etude de cas', memoire: 'Memoire', autre: 'Autre',
}

const props = defineProps<{
  devoirsPending: Devoir[]
  devoirsEvent: Devoir[]
  devoirsSubmitted: Devoir[]
  now: number
  // deposit state
  depositingDevoirId: number | null
  depositMode: 'file' | 'link'
  depositLink: string
  depositFile: string | null
  depositFileName: string | null
  depositing: boolean
  dragOver: boolean
}>()

const emit = defineEmits<{
  startDeposit: [t: Devoir]
  cancelDeposit: []
  pickFile: []
  clearDepositFile: []
  submitDeposit: [t: Devoir]
  'update:depositMode': [v: 'file' | 'link']
  'update:depositLink': [v: string]
  dragOver: [e: DragEvent]
  dragLeave: []
  drop: [e: DragEvent]
}>()

function isExpired(deadline: string)   { return props.now >= new Date(deadline).getTime() }
function isEventType(type: string)     { return type === 'soutenance' || type === 'cctl' }
function isOverdue(t: Devoir)          { return t.depot_id == null && !isEventType(t.type) && isExpired(t.deadline) }
function isUrgent(t: Devoir) {
  if (t.depot_id != null || isExpired(t.deadline) || isEventType(t.type)) return false
  return new Date(t.deadline).getTime() - props.now < 3 * 86_400_000
}

function hasFeedback(t: Devoir): boolean {
  return t.feedback != null && t.feedback.trim() !== ''
}

function gradeColor(note: string | null | undefined): string {
  const n = parseFloat(note ?? '')
  if (isNaN(n)) return 'grade-letter'
  if (n >= 16) return 'grade-a'
  if (n >= 12) return 'grade-b'
  if (n >= 8)  return 'grade-c'
  return 'grade-d'
}

const collapsedSections = ref<Record<string, boolean>>({})
function toggleSection(key: string) { collapsedSections.value[key] = !collapsedSections.value[key] }
</script>

<template>
  <!-- A rendre (overdue + urgent + pending) -->
  <template v-if="devoirsPending.length">
    <div class="spf-section-label spf-section-toggle" @click="toggleSection('pending')">
      <component :is="collapsedSections.pending ? ChevronRight : ChevronDown" :size="12" />
      <Clock :size="12" /> A rendre
      <span class="spf-section-count">{{ devoirsPending.length }}</span>
    </div>
    <div v-show="!collapsedSections.pending" class="spf-devoir-list">
      <div
        v-for="t in devoirsPending"
        :key="t.id"
        class="spf-devoir-card"
        :class="{ 'spf-card--overdue': isOverdue(t), 'spf-card--urgent': isUrgent(t) }"
      >
        <div class="spf-card-top">
          <span class="spf-type-badge" :class="`type-${t.type}`">{{ TYPE_LABELS[t.type] ?? t.type }}</span>
          <span class="spf-card-title">{{ t.title }}</span>
          <span class="spf-deadline-badge" :class="deadlineClass(t.deadline)">
            <Clock :size="9" />{{ deadlineLabel(t.deadline) }}
          </span>
        </div>
        <div class="spf-card-sub">
          <span class="spf-card-date">
            {{ isOverdue(t) ? 'Delai expire' : 'Echeance : ' + formatDate(t.deadline) }}
          </span>
          <span v-if="t.group_name" class="spf-card-group"><Users :size="10" /> {{ t.group_name }}</span>
        </div>
        <p v-if="t.description" class="spf-card-desc">{{ t.description }}</p>

        <!-- Formulaire de depot -->
        <template v-if="depositingDevoirId === t.id">
          <div class="spf-deposit-form">
            <div class="spf-deposit-toggle">
              <button class="spf-toggle-btn" :class="{ active: depositMode === 'file' }" @click="emit('update:depositMode', 'file')">
                <FileText :size="12" /> Fichier
              </button>
              <button class="spf-toggle-btn" :class="{ active: depositMode === 'link' }" @click="emit('update:depositMode', 'link')">
                <Link2 :size="12" /> Lien
              </button>
            </div>
            <div v-if="depositMode === 'file'">
              <div v-if="depositFile" class="spf-file-selected">
                <CheckCircle2 :size="14" class="spf-file-ok" />
                <span class="spf-file-name">{{ depositFileName }}</span>
                <button class="spf-file-clear" @click.stop="emit('clearDepositFile')"><X :size="11" /></button>
              </div>
              <div
                v-else
                class="spf-file-zone"
                :class="{ 'spf-file-zone--drag': dragOver }"
                @click="emit('pickFile')"
                @dragover="emit('dragOver', $event)"
                @dragleave="emit('dragLeave')"
                @drop="emit('drop', $event)"
              >
                <Upload :size="18" class="spf-file-zone-icon" />
                <span>{{ dragOver ? 'Relacher pour deposer' : 'Glisser un fichier ou cliquer' }}</span>
              </div>
            </div>
            <input v-else :value="depositLink" class="form-input" placeholder="https://..." type="url" @input="emit('update:depositLink', ($event.target as HTMLInputElement).value)" />
            <div class="spf-deposit-actions">
              <button class="btn-ghost" @click="emit('cancelDeposit')"><X :size="12" /> Annuler</button>
              <button
                class="btn-primary"
                :disabled="depositing || (depositMode === 'file' ? !depositFile : !depositLink.trim())"
                @click="emit('submitDeposit', t)"
              >
                <Upload :size="12" />{{ depositing ? 'Depot...' : 'Deposer' }}
              </button>
            </div>
          </div>
        </template>
        <div v-else class="spf-card-actions">
          <button v-if="isOverdue(t)" class="spf-btn-expired" disabled>
            <Lock :size="12" /> Delai expire
          </button>
          <button v-else class="btn-primary spf-btn-deposit" @click="emit('startDeposit', t)">
            <Upload :size="12" /> Deposer
          </button>
        </div>
      </div>
    </div>
  </template>

  <!-- Evenements (soutenance / CCTL) -->
  <template v-if="devoirsEvent.length">
    <div class="spf-section-label spf-section-toggle" style="margin-top:16px" @click="toggleSection('events')">
      <component :is="collapsedSections.events ? ChevronRight : ChevronDown" :size="12" />
      <CalendarDays :size="12" /> Evenements
      <span class="spf-section-count">{{ devoirsEvent.length }}</span>
    </div>
    <div v-show="!collapsedSections.events" class="spf-devoir-list">
      <div v-for="t in devoirsEvent" :key="t.id" class="spf-devoir-card spf-card--event">
        <div class="spf-card-top">
          <span class="spf-type-badge" :class="`type-${t.type}`">{{ TYPE_LABELS[t.type] ?? t.type }}</span>
          <span class="spf-card-title">{{ t.title }}</span>
          <span class="spf-deadline-badge" :class="deadlineClass(t.deadline)">
            <Clock :size="9" />{{ deadlineLabel(t.deadline) }}
          </span>
        </div>
        <div class="spf-card-sub">
          <span class="spf-card-date">{{ formatDate(t.deadline) }}</span>
        </div>
        <p v-if="t.description" class="spf-card-desc">{{ t.description }}</p>
        <div class="spf-event-notice">
          <CalendarDays :size="13" /> Presence requise
        </div>
      </div>
    </div>
  </template>

  <!-- Rendus -->
  <template v-if="devoirsSubmitted.length">
    <div class="spf-section-label spf-section-toggle" style="margin-top:16px" @click="toggleSection('submitted')">
      <component :is="collapsedSections.submitted ? ChevronRight : ChevronDown" :size="12" />
      <CheckCircle2 :size="12" /> Rendus
      <span class="spf-section-count">{{ devoirsSubmitted.length }}</span>
    </div>
    <div v-show="!collapsedSections.submitted" class="spf-devoir-list">
      <div v-for="t in devoirsSubmitted" :key="t.id" class="spf-devoir-card spf-card--done">
        <div class="spf-card-top">
          <span class="spf-type-badge" :class="`type-${t.type}`">{{ TYPE_LABELS[t.type] ?? t.type }}</span>
          <span class="spf-card-title">{{ t.title }}</span>
          <span v-if="hasFeedback(t)" class="badge-new">Nouveau feedback</span>
          <CheckCircle2 :size="14" class="spf-done-check" />
        </div>
        <div class="spf-card-sub">
          <span class="spf-card-date">Echeance : {{ formatDate(t.deadline) }}</span>
        </div>
        <!-- Note + feedback -->
        <div v-if="t.note" class="spf-grade-row">
          <span class="spf-grade-badge" :class="gradeColor(t.note)">{{ t.note }}</span>
          <span v-if="t.feedback" class="spf-feedback-text">{{ t.feedback }}</span>
        </div>
        <div v-else class="spf-grade-pending">
          <Award :size="12" /> En attente de notation
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped>
/* ── Section headers ── */
.spf-section-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .06em;
  color: var(--text-muted); margin-bottom: 6px;
}
.spf-section-toggle { cursor: pointer; user-select: none; }
.spf-section-toggle:hover { color: var(--text-secondary); }
.spf-section-count {
  font-size: 10px; font-weight: 600;
  background: var(--bg-hover); padding: 1px 5px;
  border-radius: 8px; color: var(--text-muted);
}

.spf-devoir-list { display: flex; flex-direction: column; gap: 8px; }

/* ── Card ── */
.spf-devoir-card {
  border: 1px solid var(--border); border-radius: 8px;
  padding: 12px 14px; background: var(--bg-elevated);
  display: flex; flex-direction: column; gap: 6px;
  transition: background var(--t-fast);
}
.spf-card--overdue { border-color: rgba(231,76,60,.3); background: rgba(231,76,60,.04); }
.spf-card--urgent  { border-color: rgba(243,156,18,.3); background: rgba(243,156,18,.04); }
.spf-card--event   { border-color: rgba(155,135,245,.25); background: rgba(155,135,245,.04); }
.spf-card--done    { opacity: .75; }

.spf-card-top { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.spf-type-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; flex-shrink: 0; }
.type-livrable     { background: rgba(74,144,217,.2);   color: var(--accent); }
.type-soutenance   { background: rgba(243,156,18,.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: var(--color-cctl); }
.type-etude_de_cas { background: rgba(39,174,96,.2);    color: var(--color-success); }
.type-memoire      { background: rgba(231,76,60,.2);    color: var(--color-danger); }
.type-autre        { background: rgba(127,140,141,.2);  color: var(--color-autre); }

.spf-card-title { flex: 1; font-size: 13.5px; font-weight: 600; color: var(--text-primary); min-width: 0; }
.spf-deadline-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; font-weight: 600; padding: 2px 6px;
  border-radius: 8px; flex-shrink: 0;
}
.deadline-ok       { background: rgba(39,174,96,.1);  color: var(--color-success); }
.deadline-warning  { background: rgba(243,156,18,.1); color: #F39C12; }
.deadline-soon     { background: rgba(243,156,18,.12); color: var(--color-warning); }
.deadline-critical,
.deadline-passed   { background: rgba(231,76,60,.12); color: #ff7b6b; }

.spf-card-sub { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.spf-card-date  { font-size: 11px; color: var(--text-muted); }
.spf-card-group { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: var(--color-cctl); }
.spf-card-desc  { font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.4; }

/* ── Done ── */
.spf-done-check { color: var(--color-success); margin-left: auto; flex-shrink: 0; }
.badge-new {
  font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 8px;
  background: rgba(74,144,217,.15); color: var(--accent);
}

/* ── Grade ── */
.spf-grade-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.spf-grade-badge { font-size: 13px; font-weight: 700; padding: 3px 10px; border-radius: 6px; flex-shrink: 0; }
.grade-a { background: rgba(39,174,96,.15); color: var(--color-success); }
.grade-b { background: rgba(74,144,217,.15); color: var(--accent); }
.grade-c { background: rgba(243,156,18,.15); color: var(--color-warning); }
.grade-d { background: rgba(231,76,60,.15); color: var(--color-danger); }
.grade-letter { background: rgba(155,135,245,.15); color: var(--color-cctl); }

.spf-feedback-text { font-size: 11.5px; font-style: italic; color: var(--text-secondary); flex: 1; }
.spf-grade-pending { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-muted); font-style: italic; }

/* ── Event ── */
.spf-event-notice {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; color: var(--color-cctl);
  background: rgba(155,135,245,.08); padding: 4px 10px;
  border-radius: 6px; width: fit-content;
}

/* ── Actions ── */
.spf-card-actions { display: flex; justify-content: flex-end; }
.spf-btn-deposit { font-size: 12px; padding: 5px 12px; display: inline-flex; align-items: center; gap: 5px; }
.spf-btn-expired {
  font-size: 11px; padding: 4px 10px;
  border: 1px solid var(--border); border-radius: 6px;
  background: transparent; color: var(--text-muted);
  cursor: not-allowed; display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font);
}

/* ── Deposit form ── */
.spf-deposit-form {
  display: flex; flex-direction: column; gap: 10px;
  padding: 12px; background: var(--bg-elevated);
  border-radius: 8px; border: 1px solid var(--border-input);
}
.spf-deposit-toggle { display: flex; gap: 4px; }
.spf-toggle-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border: 1px solid var(--border-input);
  border-radius: 5px; background: transparent; color: var(--text-muted);
  font-size: 11.5px; font-family: var(--font); cursor: pointer; transition: all .15s;
}
.spf-toggle-btn.active { border-color: var(--color-cctl); background: rgba(155,135,245,.12); color: var(--color-cctl); }
.spf-file-zone {
  border: 2px dashed var(--border-input); border-radius: 8px;
  padding: 20px; display: flex; flex-direction: column;
  align-items: center; gap: 6px; cursor: pointer;
  color: var(--text-muted); font-size: 12px;
  transition: border-color var(--t-fast), background var(--t-fast);
}
.spf-file-zone:hover { border-color: var(--color-cctl); background: rgba(155,135,245,.05); }
.spf-file-zone--drag { border-color: var(--color-cctl); background: rgba(155,135,245,.10); border-style: solid; }
.spf-file-zone-icon { opacity: .5; }
.spf-file-selected {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: rgba(39,174,96,.06);
  border: 1px solid rgba(39,174,96,.2); border-radius: 6px;
}
.spf-file-ok { color: var(--color-success); flex-shrink: 0; }
.spf-file-name { flex: 1; font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.spf-file-clear {
  background: transparent; border: none; color: var(--text-muted);
  cursor: pointer; padding: 2px; display: flex; align-items: center;
  border-radius: 4px; flex-shrink: 0; transition: color var(--t-fast);
}
.spf-file-clear:hover { color: var(--color-danger); }
.spf-deposit-actions { display: flex; justify-content: flex-end; gap: 6px; }
</style>
