/**
 * Carte devoir étudiant réutilisable : affiche le contenu du devoir,
 * le formulaire de dépôt inline, ou le statut rendu selon le variant.
 */
<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import {
  CheckCircle2, Clock, Lock, Upload,
  Calendar, Award, Bell, BellOff,
} from 'lucide-vue-next'
import { deadlineClass, deadlineLabel, formatDate, countdown } from '@/utils/date'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import { typeLabel }         from '@/utils/devoir'
import { useStudentReminders } from '@/composables/useStudentReminders'
import StudentDepositForm    from './StudentDepositForm.vue'
import LumenDevoirChapterHints from '@/components/lumen/LumenDevoirChapterHints.vue'
import type { Devoir, Rubric } from '@/types'

const props = defineProps<{
  devoir: Devoir
  variant: 'overdue' | 'urgent' | 'pending' | 'event' | 'submitted'
  expired: boolean
  // deposit state
  depositingDevoirId: number | null
  depositMode: 'file' | 'link'
  depositLink: string
  depositFile: string | null
  depositFileName: string | null
  depositing: boolean
  depositFileSize?: number | null
  rubricPreview: Rubric | null
  // deposit actions
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

const t = props.devoir
const showDepositForm = props.variant !== 'overdue' && props.variant !== 'event' && props.variant !== 'submitted'
const { addReminder, removeReminder, hasReminder } = useStudentReminders()

// ── Popover choix de rappel ──────────────────────────────────────────────
const reminderOpen = ref(false)
const REMINDER_OPTIONS: { hours: number; label: string }[] = [
  { hours: 1,  label: '1h avant' },
  { hours: 3,  label: '3h avant' },
  { hours: 24, label: '24h avant' },
  { hours: 72, label: '3 jours avant' },
]

function onReminderClick(ev: MouseEvent) {
  ev.stopPropagation()
  if (hasReminder(props.devoir.id)) {
    removeReminder(props.devoir.id)
    return
  }
  reminderOpen.value = !reminderOpen.value
  if (reminderOpen.value) document.addEventListener('click', closeReminder, { once: true })
}

function closeReminder() { reminderOpen.value = false }

function pickReminder(hours: number) {
  addReminder(props.devoir.id, props.devoir.title, props.devoir.deadline, hours)
  reminderOpen.value = false
}

onBeforeUnmount(() => document.removeEventListener('click', closeReminder))

/** Minimal markdown : **bold**, newlines → <br> */
function formatDesc(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}
</script>

<template>
  <div class="devoir-card" :class="`devoir-card--${variant}`">
    <!-- Header: type badge + deadline -->
    <div class="devoir-card-header">
      <div class="devoir-card-meta">
        <span class="devoir-type-badge" :class="`type-${devoir.type}`">{{ typeLabel(devoir.type) }}</span>
        <span v-if="devoir.category" class="tag-badge">{{ parseCategoryIcon(devoir.category).label || devoir.category }}</span>
        <span v-if="devoir.channel_name" class="devoir-channel"># {{ devoir.channel_name }}</span>
      </div>
      <div v-if="variant === 'pending' || variant === 'urgent'" class="devoir-reminder-wrap">
        <button
          class="devoir-reminder-btn"
          :class="{ active: hasReminder(devoir.id) }"
          :title="hasReminder(devoir.id) ? 'Annuler le rappel' : 'Programmer un rappel'"
          :aria-expanded="reminderOpen"
          @click="onReminderClick"
        >
          <BellOff v-if="hasReminder(devoir.id)" :size="12" />
          <Bell v-else :size="12" />
        </button>
        <div v-if="reminderOpen" class="devoir-reminder-popover" role="menu" @click.stop>
          <span class="devoir-reminder-popover-title">Me rappeler</span>
          <button
            v-for="opt in REMINDER_OPTIONS" :key="opt.hours"
            class="devoir-reminder-option"
            role="menuitem"
            @click="pickReminder(opt.hours)"
          >
            <Bell :size="10" /> {{ opt.label }}
          </button>
        </div>
      </div>
      <span class="deadline-badge" :class="deadlineClass(devoir.deadline)">
        <Clock :size="10" />{{ deadlineLabel(devoir.deadline) }}
      </span>
    </div>

    <!-- Body -->
    <h3 class="devoir-card-title">{{ devoir.title }}</h3>
    <p v-if="devoir.description" class="devoir-card-desc" v-html="formatDesc(devoir.description)" />
    <LumenDevoirChapterHints :travail-id="devoir.id" />
    <p v-if="devoir.room" class="devoir-card-room">Salle {{ devoir.room }}</p>
    <div v-if="devoir.aavs" class="devoir-card-aavs">
      <span v-for="a in devoir.aavs.split('\n').filter(Boolean)" :key="a" class="aav-tag">{{ a.trim() }}</span>
    </div>

    <!-- ── Variant: event ── -->
    <template v-if="variant === 'event'">
      <div class="devoir-presence-notice">
        <Calendar :size="14" class="devoir-presence-icon" />
        <span>Présence requise - pas de dépôt fichier</span>
      </div>
      <div class="devoir-card-footer">
        <span class="devoir-deadline-date">Date : {{ formatDate(devoir.deadline) }}</span>
      </div>
    </template>

    <!-- ── Variant: submitted ── -->
    <template v-else-if="variant === 'submitted'">
      <div class="devoir-submitted-info">
        <CheckCircle2 :size="14" />
        <span>Rendu déposé</span>
        <span v-if="devoir.note" class="devoir-graded-badge">Noté</span>
        <span v-else class="devoir-pending-badge">En attente de note</span>
      </div>
      <div v-if="devoir.note" class="devoir-grade-row">
        <Award :size="13" class="devoir-grade-icon" />
        <span class="devoir-grade-value" :class="`grade--${devoir.note.toString().charAt(0).toLowerCase()}`">{{ devoir.note }}</span>
        <span v-if="devoir.feedback" class="devoir-grade-feedback">{{ devoir.feedback }}</span>
      </div>
    </template>

    <!-- ── Variant: overdue ── -->
    <template v-else-if="variant === 'overdue'">
      <div class="devoir-card-footer">
        <span class="devoir-deadline-date">Échéance : {{ formatDate(devoir.deadline) }}</span>
        <button class="btn-deposit-expired" disabled>
          <Lock :size="12" /> Délai expiré
        </button>
      </div>
    </template>

    <!-- ── Variants with deposit: urgent / pending ── -->
    <template v-else-if="showDepositForm">
      <!-- Deposit form open -->
      <StudentDepositForm
        v-if="depositingDevoirId === devoir.id"
        :deposit-mode="depositMode"
        :deposit-link="depositLink"
        :deposit-file="depositFile"
        :deposit-file-name="depositFileName"
        :depositing="depositing"
        :expired="expired"
        :deposit-file-size="depositFileSize"
        :rubric-preview="rubricPreview"
        @update:deposit-mode="$emit('update:depositMode', $event)"
        @update:deposit-link="$emit('update:depositLink', $event)"
        @pick-file="pickFile"
        @clear-file="clearDepositFile"
        @cancel="cancelDeposit"
        @submit="submitDeposit(devoir)"
      />
      <!-- Default footer with deposit button -->
      <div v-else class="devoir-card-footer">
        <span class="devoir-deadline-date">Échéance : {{ formatDate(devoir.deadline) }}</span>
        <span class="devoir-countdown" :class="`countdown--${variant}`">
          <Clock :size="10" /> {{ countdown(devoir.deadline) }}
        </span>
        <button class="btn-primary btn-deposit" @click="startDeposit(devoir)">
          <Upload :size="12" /> Déposer
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* ── Carte étudiant ──────────────────────────────────────────────────────── */
.devoir-card {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-left-width: 4px;
  border-radius: 10px;
  padding: 16px;
  transition: border-color var(--t-base);
}
.devoir-card:hover { border-color: rgba(var(--accent-rgb), 0.3); }

.devoir-card--overdue   { border-left-color: var(--color-danger); }
.devoir-card--overdue:hover   { border-left-color: var(--color-danger); }
.devoir-card--urgent    { border-left-color: var(--color-warning); }
.devoir-card--urgent:hover    { border-left-color: var(--color-warning); }
.devoir-card--pending   { border-left-color: var(--accent); }
.devoir-card--pending:hover   { border-left-color: var(--accent); }
.devoir-card--submitted { border-left-color: var(--color-success); }
.devoir-card--submitted:hover { border-left-color: var(--color-success); border-color: rgba(var(--color-success-rgb), 0.3); }
.devoir-card--event     { border-left-color: var(--color-cctl); }
.devoir-card--event:hover     { border-left-color: var(--color-cctl); border-color: rgba(var(--color-cctl-rgb), 0.3); }

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

.devoir-reminder-wrap { position: relative; flex-shrink: 0; }
.devoir-reminder-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 6px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); cursor: pointer;
  transition: all .15s; flex-shrink: 0;
}
.devoir-reminder-btn:hover { background: var(--bg-hover); color: var(--accent); border-color: var(--accent); }
.devoir-reminder-btn.active { color: var(--accent); border-color: var(--accent); background: rgba(var(--accent-rgb),.08); }

.devoir-reminder-popover {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 30;
  display: flex; flex-direction: column; gap: 2px;
  min-width: 140px; padding: 6px;
  border: 1px solid var(--border); border-radius: 8px;
  background: var(--bg-modal, var(--bg-elevated));
  box-shadow: 0 6px 20px rgba(0,0,0,.35);
}
.devoir-reminder-popover-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px;
  color: var(--text-muted); padding: 2px 8px 4px;
}
.devoir-reminder-option {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px; border-radius: 4px;
  border: none; background: transparent;
  color: var(--text-secondary); font-family: var(--font);
  font-size: 12px; text-align: left; cursor: pointer;
  transition: background .12s, color .12s;
}
.devoir-reminder-option:hover { background: var(--bg-hover); color: var(--accent); }

.devoir-card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 6px;
  line-height: 1.3;
}

.devoir-card-desc {
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.6;
  margin: 0 0 10px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.devoir-card-desc :deep(strong) {
  color: var(--text-secondary);
  font-weight: 600;
}
.devoir-card-room { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
.devoir-card-aavs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.aav-tag {
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(var(--accent-rgb),.12);
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
  color: var(--color-cctl);
  background: rgba(var(--color-cctl-rgb), 0.1);
  border: 1px solid rgba(var(--color-cctl-rgb), 0.25);
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
  background: rgba(var(--color-success-rgb),.15);
  color: var(--color-success);
  margin-left: 4px;
}
.devoir-pending-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--bg-active);
  color: var(--text-muted);
  margin-left: 4px;
}

/* Grade dans la carte rendu */
.devoir-grade-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12.5px;
}
.devoir-grade-icon { color: var(--accent-light); flex-shrink: 0; }
.devoir-grade-value { font-weight: 700; color: var(--accent-light); padding: 1px 8px; border-radius: 8px; font-size: 13px; }
.grade--a { background: rgba(var(--color-success-rgb),.15); color: var(--color-success); }
.grade--b { background: rgba(var(--accent-rgb),.15); color: var(--accent); }
.grade--c { background: rgba(var(--color-warning-rgb),.15); color: var(--color-warning); }
.grade--d { background: rgba(var(--color-danger-rgb),.15); color: var(--color-danger); }
.devoir-grade-feedback { color: var(--text-secondary); font-style: italic; flex: 1; line-height: 1.4; }
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .8s linear infinite; }

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
  border: 1px solid rgba(var(--color-danger-rgb), 0.3);
  border-radius: var(--radius-sm);
  background: rgba(var(--color-danger-rgb), 0.08);
  color: var(--color-danger);
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font);
  cursor: not-allowed;
  opacity: 0.75;
}

.devoir-countdown {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}
.countdown--urgent { background: rgba(var(--color-warning-rgb),.12); color: var(--color-warning); }
.countdown--pending { background: rgba(var(--accent-rgb),.1); color: var(--accent-light); }

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
  border: 1.5px solid var(--color-success);
  border-radius: 8px;
  background: rgba(var(--color-success-rgb), 0.08);
}

.deposit-file-selected-icon { color: var(--color-success); flex-shrink: 0; }

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
.deposit-file-selected-clear:hover { color: #ff6b6b; background: rgba(var(--color-danger-rgb), 0.12); }

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
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border-radius: 4px;
}

.type-livrable     { background: rgba(var(--accent-rgb),.2);   color: var(--accent); }
.type-soutenance   { background: rgba(var(--color-warning-rgb),.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: var(--color-cctl); }
.type-etude_de_cas { background: rgba(var(--color-success-rgb),.2);    color: var(--color-success); }
.type-memoire      { background: rgba(var(--color-danger-rgb),.2);    color: var(--color-danger); }
.type-autre        { background: rgba(127,140,141,.2);  color: var(--color-autre); }

@media (max-width: 500px) {
  .devoir-card { padding: 12px 10px; }
  .deposit-form { padding: 10px; }
}
</style>
