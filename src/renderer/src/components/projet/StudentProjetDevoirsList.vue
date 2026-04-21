/** StudentProjetDevoirsList.vue - Grouped devoirs list (a rendre, evenements, rendus) */
<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ChevronDown, ChevronRight, Clock, CalendarDays, Upload, X,
  FileText, Link2, CheckCircle2, Lock, Award, Users, ExternalLink, Loader2,
} from 'lucide-vue-next'
import { formatDate, deadlineClass, deadlineLabel } from '@/utils/date'
import { numericGradeClass } from '@/utils/grade'
import { isEventType } from '@/utils/devoir'
import type { Devoir } from '@/types'

/** Formate une taille de fichier en unites lisibles (1.3 MB, 42 KB, ...). */
function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

const TYPE_LABELS: Record<string, string> = {
  livrable: 'Livrable', soutenance: 'Soutenance', cctl: 'CCTL',
  etude_de_cas: 'Étude de cas', memoire: 'Mémoire', autre: 'Autre',
}

/** Minimal markdown : **bold** + newlines */
function formatDesc(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
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
  depositFileSize?: number | null
  depositing: boolean
  uploading?: boolean
  dragOver: boolean
}>()

const emit = defineEmits<{
  startDeposit: [t: Devoir]
  cancelDeposit: []
  pickFile: []
  clearDepositFile: []
  submitDeposit: [t: Devoir]
  openDepot: [t: Devoir]
  'update:depositMode': [v: 'file' | 'link']
  'update:depositLink': [v: string]
  dragOver: [e: DragEvent]
  dragLeave: []
  drop: [e: DragEvent]
}>()

function isExpired(deadline: string)   { return props.now >= new Date(deadline).getTime() }
function isOverdue(t: Devoir)          { return t.depot_id == null && !isEventType(t.type) && isExpired(t.deadline) }
function isUrgent(t: Devoir) {
  if (t.depot_id != null || isExpired(t.deadline) || isEventType(t.type)) return false
  return new Date(t.deadline).getTime() - props.now < 3 * 86_400_000
}

function hasFeedback(t: Devoir): boolean {
  return t.feedback != null && t.feedback.trim() !== ''
}

function gradeColor(note: string | null | undefined): string {
  return numericGradeClass(note)
}

const collapsedSections = ref<Record<string, boolean>>({})
function toggleSection(key: string) { collapsedSections.value[key] = !collapsedSections.value[key] }

// Validation cote client de l'etat du bouton "Deposer" — desactive si :
//  - upload en cours (fichier en chargement)
//  - soumission en cours
//  - mode file sans fichier OU mode link avec champ vide
const submitDisabled = computed(() => {
  if (props.depositing || props.uploading) return true
  if (props.depositMode === 'file') return !props.depositFile
  return !props.depositLink.trim()
})

// Raccourci clavier Ctrl+Enter dans le formulaire : submit
// (Escape pour annuler est gere par le @keydown.escape sur le champ)
function onFormKeydown(e: KeyboardEvent, t: Devoir): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('cancelDeposit')
    return
  }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !submitDisabled.value) {
    e.preventDefault()
    emit('submitDeposit', t)
  }
}
</script>

<template>
  <!-- A rendre (overdue + urgent + pending) -->
  <template v-if="devoirsPending.length">
    <div
      class="spf-section-label spf-section-toggle"
      tabindex="0"
      role="button"
      :aria-expanded="!collapsedSections.pending"
      @click="toggleSection('pending')"
      @keydown.enter.space.prevent="toggleSection('pending')"
    >
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
            {{ isOverdue(t) ? 'Date dépassée' : 'Échéance : ' + formatDate(t.deadline) }}
          </span>
          <span v-if="t.group_name" class="spf-card-group"><Users :size="10" /> {{ t.group_name }}</span>
        </div>
        <p v-if="t.description" class="spf-card-desc" v-html="formatDesc(t.description)" />

        <!-- Formulaire de depot -->
        <template v-if="depositingDevoirId === t.id">
          <div class="spf-deposit-form" @keydown="onFormKeydown($event, t)">
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
                <span v-if="depositFileSize" class="spf-file-size">{{ formatFileSize(depositFileSize) }}</span>
                <button class="spf-file-clear" :disabled="depositing || uploading" @click.stop="emit('clearDepositFile')"><X :size="11" /></button>
              </div>
              <div
                v-else
                class="spf-file-zone"
                :class="{ 'spf-file-zone--drag': dragOver, 'spf-file-zone--loading': uploading }"
                role="button"
                tabindex="0"
                :aria-label="uploading ? 'Chargement du fichier en cours' : 'Zone de dépôt de fichier. Cliquer ou glisser un fichier'"
                :aria-busy="uploading"
                @click="!uploading && emit('pickFile')"
                @keydown.enter.space.prevent="!uploading && emit('pickFile')"
                @dragover="emit('dragOver', $event)"
                @dragleave="emit('dragLeave')"
                @drop="emit('drop', $event)"
              >
                <Loader2 v-if="uploading" :size="18" class="spf-file-zone-icon spf-upload-spin" />
                <Upload v-else :size="18" class="spf-file-zone-icon" />
                <span>{{ uploading ? 'Chargement…' : dragOver ? 'Relâcher pour déposer' : 'Glisser un fichier ou cliquer' }}</span>
                <span class="spf-file-zone-hint">Max 50 Mo · .exe, .bat, .sh refusés</span>
              </div>
            </div>
            <input
              v-else
              :value="depositLink"
              class="form-input"
              placeholder="https://..."
              type="url"
              autofocus
              @input="emit('update:depositLink', ($event.target as HTMLInputElement).value)"
            />
            <div class="spf-deposit-actions">
              <span class="spf-deposit-hint">
                <kbd>Esc</kbd> annuler · <kbd>Ctrl</kbd>+<kbd>↵</kbd> déposer
              </span>
              <button class="btn-ghost" @click="emit('cancelDeposit')"><X :size="12" /> Annuler</button>
              <button
                class="btn-primary"
                :disabled="submitDisabled"
                @click="emit('submitDeposit', t)"
              >
                <Upload :size="12" />{{ depositing ? 'Dépôt…' : 'Déposer' }}
              </button>
            </div>
          </div>
        </template>
        <div v-else class="spf-card-actions">
          <button v-if="isOverdue(t)" class="spf-btn-expired" disabled>
            <Lock :size="12" /> Date dépassée
          </button>
          <button v-else class="btn-primary spf-btn-deposit" @click="emit('startDeposit', t)">
            <Upload :size="12" /> Déposer
          </button>
        </div>
      </div>
    </div>
  </template>

  <!-- Evenements (soutenance / CCTL) -->
  <template v-if="devoirsEvent.length">
    <div
      class="spf-section-label spf-section-toggle"
      style="margin-top:16px"
      tabindex="0"
      role="button"
      :aria-expanded="!collapsedSections.events"
      @click="toggleSection('events')"
      @keydown.enter.space.prevent="toggleSection('events')"
    >
      <component :is="collapsedSections.events ? ChevronRight : ChevronDown" :size="12" />
      <CalendarDays :size="12" /> Événements
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
        <p v-if="t.description" class="spf-card-desc" v-html="formatDesc(t.description)" />
        <div class="spf-event-notice">
          <CalendarDays :size="13" /> Présence requise
        </div>
      </div>
    </div>
  </template>

  <!-- Rendus -->
  <template v-if="devoirsSubmitted.length">
    <div
      class="spf-section-label spf-section-toggle"
      style="margin-top:16px"
      tabindex="0"
      role="button"
      :aria-expanded="!collapsedSections.submitted"
      @click="toggleSection('submitted')"
      @keydown.enter.space.prevent="toggleSection('submitted')"
    >
      <component :is="collapsedSections.submitted ? ChevronRight : ChevronDown" :size="12" />
      <CheckCircle2 :size="12" /> Rendus
      <span class="spf-section-count">{{ devoirsSubmitted.length }}</span>
    </div>
    <div v-show="!collapsedSections.submitted" class="spf-devoir-list">
      <div v-for="t in devoirsSubmitted" :key="t.id" class="spf-devoir-card spf-card--done">
        <div class="spf-card-top">
          <span class="spf-type-badge" :class="`type-${t.type}`">{{ TYPE_LABELS[t.type] ?? t.type }}</span>
          <span class="spf-card-title">{{ t.title }}</span>
          <span v-if="hasFeedback(t) && !t.note" class="badge-new">Nouveau feedback</span>
          <CheckCircle2 :size="14" class="spf-done-check" />
        </div>
        <div class="spf-card-sub">
          <span class="spf-card-date">Échéance : {{ formatDate(t.deadline) }}</span>
          <button
            type="button"
            class="spf-view-depot"
            title="Ouvrir mon dépôt"
            @click.stop="emit('openDepot', t)"
          ><ExternalLink :size="11" /> Voir mon dépôt</button>
          <!-- Remplacer : possible tant que la deadline n'est pas passee. L'API
               fait un upsert, donc re-deposer ecrase proprement l'ancien depot. -->
          <button
            v-if="!isExpired(t.deadline) && !t.note"
            type="button"
            class="spf-view-depot spf-replace-btn"
            title="Remplacer mon dépôt (tant que la date n'est pas passée)"
            @click.stop="emit('startDeposit', t)"
          ><Upload :size="11" /> Remplacer</button>
        </div>
        <!-- Formulaire de depot (affichable aussi pour un remplacement) -->
        <template v-if="depositingDevoirId === t.id">
          <div class="spf-deposit-form" @keydown="onFormKeydown($event, t)">
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
                <span v-if="depositFileSize" class="spf-file-size">{{ formatFileSize(depositFileSize) }}</span>
                <button class="spf-file-clear" :disabled="depositing || uploading" @click.stop="emit('clearDepositFile')"><X :size="11" /></button>
              </div>
              <div
                v-else
                class="spf-file-zone"
                :class="{ 'spf-file-zone--drag': dragOver, 'spf-file-zone--loading': uploading }"
                role="button"
                tabindex="0"
                :aria-label="uploading ? 'Chargement du fichier en cours' : 'Zone de dépôt de fichier. Cliquer ou glisser un fichier'"
                :aria-busy="uploading"
                @click="!uploading && emit('pickFile')"
                @keydown.enter.space.prevent="!uploading && emit('pickFile')"
                @dragover="emit('dragOver', $event)"
                @dragleave="emit('dragLeave')"
                @drop="emit('drop', $event)"
              >
                <Loader2 v-if="uploading" :size="18" class="spf-file-zone-icon spf-upload-spin" />
                <Upload v-else :size="18" class="spf-file-zone-icon" />
                <span>{{ uploading ? 'Chargement…' : dragOver ? 'Relâcher pour déposer' : 'Glisser un fichier ou cliquer' }}</span>
                <span class="spf-file-zone-hint">Max 50 Mo · .exe, .bat, .sh refusés</span>
              </div>
            </div>
            <input
              v-else
              :value="depositLink"
              class="form-input"
              placeholder="https://..."
              type="url"
              @input="emit('update:depositLink', ($event.target as HTMLInputElement).value)"
            />
            <div class="spf-deposit-actions">
              <span class="spf-deposit-hint">
                <kbd>Esc</kbd> annuler · <kbd>Ctrl</kbd>+<kbd>↵</kbd> remplacer
              </span>
              <button class="btn-ghost" @click="emit('cancelDeposit')"><X :size="12" /> Annuler</button>
              <button
                class="btn-primary"
                :disabled="submitDisabled"
                @click="emit('submitDeposit', t)"
              >
                <Upload :size="12" />{{ depositing ? 'Remplacement…' : 'Remplacer' }}
              </button>
            </div>
          </div>
        </template>
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

<style>
/* Styles spf-* herites du parent (StudentProjetFiche.vue, non-scoped) */
/* Seuls les styles specifiques a ce composant restent ici */
.spf-section-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .06em;
  color: var(--text-muted); margin-bottom: 6px;
}
.spf-section-toggle { cursor: pointer; user-select: none; }
.spf-section-toggle:hover { color: var(--text-secondary); }
.spf-section-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 3px;
}
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
/* Date depassee : bordure neutre dashed + fond tres subtil. Evite la panique
   rouge sans masquer le signal (la card reste visuellement distincte). */
.spf-card--overdue { border-color: var(--border-input); border-style: dashed; background: var(--bg-hover); }
.spf-card--urgent  { border-color: rgba(var(--color-warning-rgb),.3); background: rgba(var(--color-warning-rgb),.04); }
.spf-card--event   { border-color: rgba(var(--color-cctl-rgb),.25); background: rgba(var(--color-cctl-rgb),.04); }
.spf-card--done    { opacity: .75; }

.spf-card-top { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.spf-type-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; flex-shrink: 0; }
.type-livrable     { background: rgba(var(--accent-rgb),.2);   color: var(--accent); }
.type-soutenance   { background: rgba(var(--color-warning-rgb),.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: var(--color-cctl); }
.type-etude_de_cas { background: rgba(var(--color-success-rgb),.2);    color: var(--color-success); }
.type-memoire      { background: rgba(var(--color-danger-rgb),.2);    color: var(--color-danger); }
.type-autre        { background: rgba(127,140,141,.2);  color: var(--color-autre); }

.spf-card-title { flex: 1; font-size: 13.5px; font-weight: 600; color: var(--text-primary); min-width: 0; }
.spf-deadline-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; font-weight: 600; padding: 2px 6px;
  border-radius: 8px; flex-shrink: 0;
}
.deadline-ok       { background: rgba(var(--color-success-rgb),.1);  color: var(--color-success); }
.deadline-warning  { background: rgba(var(--color-warning-rgb),.1); color: #F39C12; }
.deadline-soon     { background: rgba(var(--color-warning-rgb),.12); color: var(--color-warning); }
.deadline-critical { background: rgba(var(--color-danger-rgb),.12); color: #ff7b6b; }
/* Dates passees : neutre (anti-anxiogene), coherent avec l'app globale */
.deadline-passed   { background: var(--bg-hover); color: var(--text-muted); }

.spf-card-sub { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.spf-card-date  { font-size: 11px; color: var(--text-muted); }
.spf-card-group { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: var(--color-cctl); }
.spf-card-desc  { font-size: 12px; color: var(--text-muted); margin: 0; line-height: 1.4; }

/* ── Done ── */
.spf-done-check { color: var(--color-success); margin-left: auto; flex-shrink: 0; }
.badge-new {
  font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 8px;
  background: rgba(var(--accent-rgb),.15); color: var(--accent);
}

/* ── Grade ── */
.spf-grade-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.spf-grade-badge { font-size: 13px; font-weight: 700; padding: 3px 10px; border-radius: 6px; flex-shrink: 0; }
.grade-a { background: rgba(var(--color-success-rgb),.15); color: var(--color-success); }
.grade-b { background: rgba(var(--accent-rgb),.15); color: var(--accent); }
.grade-c { background: rgba(var(--color-warning-rgb),.15); color: var(--color-warning); }
.grade-d { background: rgba(var(--color-danger-rgb),.15); color: var(--color-danger); }
.grade-letter { background: rgba(var(--color-cctl-rgb),.15); color: var(--color-cctl); }

.spf-feedback-text { font-size: 11.5px; font-style: italic; color: var(--text-secondary); flex: 1; }
.spf-grade-pending { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-muted); font-style: italic; }

/* ── Event ── */
.spf-event-notice {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; color: var(--color-cctl);
  background: rgba(var(--color-cctl-rgb),.08); padding: 4px 10px;
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
.spf-toggle-btn.active { border-color: var(--color-cctl); background: rgba(var(--color-cctl-rgb),.12); color: var(--color-cctl); }
.spf-file-zone {
  border: 2px dashed var(--border-input); border-radius: 8px;
  padding: 20px; display: flex; flex-direction: column;
  align-items: center; gap: 6px; cursor: pointer;
  color: var(--text-muted); font-size: 12px;
  transition: border-color var(--t-fast), background var(--t-fast);
}
.spf-file-zone:hover { border-color: var(--color-cctl); background: rgba(var(--color-cctl-rgb),.05); }
.spf-file-zone:focus-visible { outline: 2px solid var(--color-cctl); outline-offset: 2px; border-color: var(--color-cctl); }
.spf-file-zone--drag { border-color: var(--color-cctl); background: rgba(var(--color-cctl-rgb),.10); border-style: solid; }
.spf-file-zone-icon { opacity: .5; }
.spf-file-selected {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: rgba(var(--color-success-rgb),.06);
  border: 1px solid rgba(var(--color-success-rgb),.2); border-radius: 6px;
}
.spf-file-ok { color: var(--color-success); flex-shrink: 0; }
.spf-file-name { flex: 1; font-size: 12px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.spf-file-clear {
  background: transparent; border: none; color: var(--text-muted);
  cursor: pointer; padding: 2px; display: flex; align-items: center;
  border-radius: 4px; flex-shrink: 0; transition: color var(--t-fast);
}
.spf-file-clear:hover { color: var(--color-danger); }
.spf-deposit-actions { display: flex; justify-content: flex-end; gap: 6px; align-items: center; }
.spf-deposit-hint {
  flex: 1;
  font-size: 10.5px;
  color: var(--text-muted);
  letter-spacing: .02em;
}
.spf-deposit-hint kbd {
  font-family: var(--font-mono, 'SF Mono', Consolas, monospace);
  font-size: 10px;
  padding: 1px 5px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  margin: 0 1px;
}

.spf-file-size {
  font-size: 10.5px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  padding: 0 4px;
  flex-shrink: 0;
}

.spf-file-zone--loading {
  cursor: progress;
  opacity: .85;
  border-style: solid;
}
.spf-upload-spin { animation: spf-spin 1s linear infinite; }
@keyframes spf-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.spf-file-zone-hint {
  font-size: 10px;
  color: var(--text-muted);
  opacity: .7;
  margin-top: 2px;
}

/* Lien "Voir mon dépôt" : discret, inline dans la ligne des sous-infos */
.spf-view-depot {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: transparent;
  border: none;
  color: var(--accent);
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background var(--t-fast), color var(--t-fast);
}
.spf-view-depot:hover { background: rgba(var(--accent-rgb), .1); color: var(--accent-hover, var(--accent)); }
/* Contourne l'opacite .75 de .spf-card--done pour garder les liens lisibles */
.spf-card--done .spf-view-depot { opacity: 1.33; filter: none; }

/* Bouton "Remplacer" : meme style que "Voir mon depot" mais couleur warning
   plus subtile pour signaler que c'est une action modificatrice. */
.spf-replace-btn {
  color: var(--color-warning);
}
.spf-replace-btn:hover {
  background: rgba(var(--color-warning-rgb), .12);
  color: var(--color-warning);
}
</style>
