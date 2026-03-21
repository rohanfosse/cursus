/**
 * Carte devoir étudiant réutilisable : affiche le contenu du devoir,
 * le formulaire de dépôt inline, ou le statut rendu selon le variant.
 */
<script setup lang="ts">
import {
  CheckCircle2, Clock, Lock, Upload, Link2, X,
  FileText, Calendar, LayoutList, Award,
} from 'lucide-vue-next'
import { deadlineClass, deadlineLabel, formatDate } from '@/utils/date'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import { typeLabel }         from '@/utils/devoir'
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
      <span class="deadline-badge" :class="deadlineClass(devoir.deadline)">
        <Clock :size="10" />{{ deadlineLabel(devoir.deadline) }}
      </span>
    </div>

    <!-- Body -->
    <h3 class="devoir-card-title">{{ devoir.title }}</h3>
    <p v-if="devoir.description" class="devoir-card-desc">{{ devoir.description }}</p>
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
        <span class="devoir-grade-value">{{ devoir.note }}</span>
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
      <template v-if="depositingDevoirId === devoir.id">
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
              :disabled="depositing || expired || (depositMode === 'file' ? !depositFile : !depositLink.trim())"
              @click="submitDeposit(devoir)"
            >
              <Upload :size="12" />
              {{ depositing ? 'Dépôt…' : expired ? 'Délai expiré' : 'Déposer' }}
            </button>
          </div>
        </div>
      </template>
      <!-- Default footer with deposit button -->
      <div v-else class="devoir-card-footer">
        <span class="devoir-deadline-date">Échéance : {{ formatDate(devoir.deadline) }}</span>
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

/* Grade dans la carte rendu */
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
</style>
