/** StudentProjetDevoirsList.vue — Grouped devoirs list (a rendre, evenements, rendus) */
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
