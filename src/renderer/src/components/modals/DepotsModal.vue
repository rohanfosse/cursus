<script setup lang="ts">
  import { computed, watch } from 'vue'
  import { AlertTriangle, Download, FileText, Link2, MessageSquare, X, LayoutList, Star } from 'lucide-vue-next'
  import { useTravauxStore } from '@/stores/travaux'
  import { useAppStore }     from '@/stores/app'
  import { useBatchGrading } from '@/composables/useBatchGrading'
  import { useDepotFeedbackBank } from '@/composables/useDepotFeedbackBank'
  import { useGithubCiStatus, CI_ICON, CI_TITLE } from '@/composables/useGithubCiStatus'
  import { useDepotStats } from '@/composables/useDepotStats'
  import { useDepotFilterSort } from '@/composables/useDepotFilterSort'
  import { useDepotInlineGrading, DEPOT_NOTES } from '@/composables/useDepotInlineGrading'
  import { useDepotActions, formatLateDelay } from '@/composables/useDepotActions'
  import { avatarColor, initials, formatGrade, gradeClass } from '@/utils/format'
  import { formatDate } from '@/utils/date'
  import Modal from '@/components/ui/Modal.vue'
  import EmptyState from '@/components/ui/EmptyState.vue'
  import DepotsStatsHeader from '@/components/modals/depots/DepotsStatsHeader.vue'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const travauxStore = useTravauxStore()
  const appStore     = useAppStore()

  // ── Mode notation rapide (batch) ────────────────────────────────────────
  const batch = useBatchGrading({
    depots: computed(() => travauxStore.depots),
    onSave: async (depotId, note, feedback) => {
      await travauxStore.setNote({ depotId, note: note || null })
      await travauxStore.setFeedback({ depotId, feedback: feedback || null })
    },
  })

  // Notation inline (note + feedback) — mutuellement exclusifs
  const {
    editingNoteId, noteInput,
    editingFeedbackId, feedbackInput,
    saving,
    startNote, saveNote,
    startFeedback, saveFeedback,
  } = useDepotInlineGrading()
  const NOTES = DEPOT_NOTES

  // Feedback bank (extracted composable)
  const fb = useDepotFeedbackBank()
  const { feedbackBank, customFeedback, newFeedbackText, showAddFeedback, addCustomFeedback, removeCustomFeedback } = fb

  function insertFeedback(text: string) {
    fb.insertFeedback(feedbackInput, text)
  }

  // GitHub CI status (extracted composable, limited to 5 requests)
  const { ciStatus, parseGithubRepo } = useGithubCiStatus(computed(() => travauxStore.depots))

  watch(() => props.modelValue, async (open) => {
    if (open && appStore.currentTravailId) {
      await travauxStore.openTravail(appStore.currentTravailId)
    }
  })

  // Stats + filtre/tri + actions (composables extraits)
  const depotsRef = computed(() => travauxStore.depots)
  const {
    totalStudents, notedCount, progressPct,
    gradeDistribution, modeGrade,
    submittedCount, ungradedCount,
  } = useDepotStats(depotsRef)

  const { searchQuery, sortMode, filtered: filteredDepots } = useDepotFilterSort(depotsRef)

  const {
    openDepot, downloadDepot,
    markAllD, exportCsv,
    openRubricEditor, openRubricScoring,
  } = useDepotActions()
  const formatLate = formatLateDelay
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="travauxStore.currentDevoir?.title ?? 'Dépôts'"
    max-width="820px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- Sous-titre + progression + stats + filtres + batch toggle -->
    <DepotsStatsHeader
      v-if="travauxStore.currentDevoir"
      :travail-type="travauxStore.currentDevoir.type"
      :deadline="travauxStore.currentDevoir.deadline"
      :total-students="totalStudents"
      :noted-count="notedCount"
      :progress-pct="progressPct"
      :submitted-count="submittedCount"
      :ungraded-count="ungradedCount"
      :grade-distribution="gradeDistribution"
      :mode-grade="modeGrade"
      :search-query="searchQuery"
      :sort-mode="sortMode"
      :batch-active="batch.active.value"
      @update:search-query="searchQuery = $event"
      @update:sort-mode="sortMode = $event"
      @toggle-batch="batch.toggle()"
    />

    <!-- ═══ MODE NOTATION RAPIDE (split view) ═══ -->
    <div v-if="batch.active.value" class="batch-split" @keydown="batch.handleKeydown">
      <!-- LEFT: Student list -->
      <div class="batch-list">
        <div class="batch-filter-row">
          <button
            v-for="f in (['all', 'ungraded', 'graded'] as const)"
            :key="f"
            class="batch-filter-btn"
            :class="{ active: batch.filter.value === f }"
            @click="batch.filter.value = f"
          >
            {{ f === 'all' ? 'Tous' : f === 'ungraded' ? 'Non notés' : 'Notés' }}
          </button>
        </div>
        <div class="batch-student-scroll">
          <button
            v-for="(d, i) in batch.filteredList.value"
            :key="d.id"
            class="batch-student-row"
            :class="{
              active: batch.activeIndex.value === i,
              'has-note': d.note != null,
            }"
            @click="batch.selectIndex(i)"
          >
            <div
              class="avatar"
              :style="{ background: avatarColor(d.student_name), width:'28px', height:'28px', fontSize:'10px', borderRadius:'6px' }"
            >{{ initials(d.student_name) }}</div>
            <span class="batch-student-name">{{ d.student_name }}</span>
            <span v-if="d.note" class="batch-student-grade" :class="gradeClass(d.note)">{{ d.note }}</span>
            <span v-else class="batch-student-grade grade-empty">-</span>
          </button>
        </div>
        <div class="batch-progress-bar">
          <ProgressBar :value="batch.progressPct.value" />
          <span class="batch-progress-label">{{ batch.gradedCount.value }}/{{ batch.totalCount.value }}</span>
        </div>
      </div>

      <!-- RIGHT: Active depot + grading -->
      <div class="batch-detail">
        <template v-if="batch.activeDepot.value">
          <div class="batch-detail-header">
            <div
              class="avatar"
              :style="{ background: avatarColor(batch.activeDepot.value.student_name), width:'40px', height:'40px', fontSize:'14px', borderRadius:'8px' }"
            >{{ initials(batch.activeDepot.value.student_name) }}</div>
            <div>
              <div class="batch-detail-name">{{ batch.activeDepot.value.student_name }}</div>
              <div class="batch-detail-meta">
                {{ batch.activeDepot.value.submitted_at ? formatDate(batch.activeDepot.value.submitted_at) : 'Pas de rendu' }}
                <span v-if="batch.activeDepot.value.late_seconds && batch.activeDepot.value.late_seconds > 0" class="depot-late-badge" style="margin-left:6px">
                  <AlertTriangle :size="9" /> {{ formatLate(batch.activeDepot.value.late_seconds) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Depot content -->
          <div v-if="batch.activeDepot.value.content || batch.activeDepot.value.file_name" class="batch-depot-content">
            <button class="depot-file-btn" @click="openDepot(batch.activeDepot.value!)">
              <component :is="batch.activeDepot.value.type === 'link' ? Link2 : FileText" :size="13" />
              {{ batch.activeDepot.value.type === 'file' ? (batch.activeDepot.value.file_name ?? batch.activeDepot.value.content) : batch.activeDepot.value.content }}
            </button>
          </div>
          <div v-else class="batch-no-depot">Aucun rendu déposé</div>

          <!-- Grade buttons -->
          <div class="batch-grade-row" :class="{ 'grade-saved': batch.savedFlash.value }">
            <button
              v-for="g in ['A', 'B', 'C', 'D']"
              :key="g"
              class="batch-grade-btn"
              :class="{ active: batch.pendingNote.value === g, [gradeClass(g)]: true }"
              @click="batch.setGrade(g as 'A' | 'B' | 'C' | 'D')"
            >{{ g }}</button>
          </div>

          <!-- Feedback -->
          <div class="batch-feedback-section">
            <div class="feedback-bank" style="margin-bottom:8px">
              <button
                v-for="fb in feedbackBank"
                :key="fb"
                class="feedback-bank-pill"
                type="button"
                @click="batch.pendingFeedback.value = batch.pendingFeedback.value ? batch.pendingFeedback.value.trimEnd() + ' ' + fb : fb"
              >{{ fb }}</button>
            </div>
            <textarea
              v-model="batch.pendingFeedback.value"
              class="form-textarea"
              rows="2"
              placeholder="Commentaire (optionnel)..."
              style="font-size:13px"
            />
          </div>

          <!-- Actions -->
          <div class="batch-actions">
            <button class="btn-primary" :disabled="batch.saving.value || !batch.pendingNote.value" @click="batch.saveAndNext()">
              Enregistrer et suivant
            </button>
            <button class="btn-ghost" :disabled="batch.saving.value || !batch.pendingNote.value" @click="batch.save()">
              Enregistrer
            </button>
          </div>

          <!-- Distribution -->
          <div v-if="batch.distribution.value.length" class="batch-dist">
            <span
              v-for="g in batch.distribution.value"
              :key="g.grade"
              class="grade-dist-pill"
              :class="gradeClass(g.grade)"
            >{{ g.grade }} <strong>{{ g.count }}</strong></span>
          </div>

          <!-- Keyboard hints -->
          <div class="batch-hints">
            <kbd>&uarr;</kbd><kbd>&darr;</kbd> naviguer
            <span class="batch-hint-sep">&middot;</span>
            <kbd>A</kbd><kbd>B</kbd><kbd>C</kbd><kbd>D</kbd> noter
            <span class="batch-hint-sep">&middot;</span>
            <kbd>Enter</kbd> sauver + suivant
            <span class="batch-hint-sep">&middot;</span>
            <kbd>Esc</kbd> quitter
          </div>
        </template>
        <div v-else class="batch-empty">Aucun étudiant dans ce filtre</div>
      </div>
    </div>

    <!-- ═══ MODE NORMAL (liste classique) ═══ -->
    <div v-if="!batch.active.value" class="depots-body">
      <EmptyState v-if="travauxStore.depots.length === 0" title="Aucun rendu depose" subtitle="Les etudiants n'ont pas encore soumis de travail." compact />

      <div
        v-for="d in filteredDepots"
        :key="d.id"
        class="depot-card"
        :class="{ 'has-note': d.note != null }"
      >
        <!-- Avatar + identité -->
        <div
          class="avatar"
          :style="{ background: avatarColor(d.student_name), width:'36px', height:'36px', fontSize:'12px', borderRadius:'8px' }"
        >
          {{ initials(d.student_name) }}
        </div>

        <div class="depot-card-body">
          <div class="depot-card-top">
            <span class="depot-student-name">{{ d.student_name }}</span>
            <span class="depot-date">{{ d.submitted_at ? formatDate(d.submitted_at) : '' }}</span>
            <span
              v-if="d.late_seconds && d.late_seconds > 0"
              class="depot-late-badge"
              :title="`Rendu en retard de ${formatLate(d.late_seconds)}`"
            >
              <AlertTriangle :size="9" /> {{ formatLate(d.late_seconds) }}
            </span>
          </div>

          <!-- Fichier / lien -->
          <div class="depot-file-row">
            <button class="depot-file-btn" @click="openDepot(d)">
              <component :is="d.type === 'link' ? Link2 : FileText" :size="12" />
              {{ d.type === 'file' ? (d.file_name ?? d.content) : d.content }}
            </button>
            <!-- Badge CI GitHub (#10) -->
            <span
              v-if="d.type === 'link' && parseGithubRepo(d.content) && ciStatus[d.content]"
              class="depot-ci-badge"
              :title="CI_TITLE[ciStatus[d.content]]"
            >{{ CI_ICON[ciStatus[d.content]] }}</span>
          </div>

          <!-- Feedback affiché -->
          <p v-if="d.feedback && editingFeedbackId !== d.id" class="depot-feedback-text">
            💬 {{ d.feedback }}
          </p>

          <!-- Formulaire feedback inline -->
          <div v-if="editingFeedbackId === d.id" class="depot-feedback-form">
            <!-- Banque de commentaires rapides (personnalisable) -->
            <div class="feedback-bank">
              <button
                v-for="fb in feedbackBank"
                :key="fb"
                class="feedback-bank-pill"
                :class="{ 'feedback-custom': customFeedback.includes(fb) }"
                type="button"
                @click="insertFeedback(fb)"
                @contextmenu.prevent="customFeedback.includes(fb) ? removeCustomFeedback(fb) : undefined"
                :title="customFeedback.includes(fb) ? 'Clic droit pour supprimer' : ''"
              >
                {{ fb }}
              </button>
              <button v-if="!showAddFeedback" class="feedback-bank-pill feedback-add-btn" type="button" @click="showAddFeedback = true">+ Ajouter</button>
            </div>
            <div v-if="showAddFeedback" class="feedback-add-form">
              <input v-model="newFeedbackText" class="form-input" placeholder="Nouveau commentaire rapide..." style="flex:1;font-size:12px" @keydown.enter.prevent="addCustomFeedback" />
              <button class="btn-primary" style="font-size:12px;padding:4px 10px" @click="addCustomFeedback">OK</button>
              <button class="btn-ghost" style="font-size:12px;padding:4px 6px" @click="showAddFeedback = false">&times;</button>
            </div>
            <textarea
              v-model="feedbackInput"
              class="form-textarea"
              rows="2"
              placeholder="Commentaire pour l'étudiant…"
              style="font-size:13px"
              @keydown.escape.prevent="editingFeedbackId = null"
              @keydown.ctrl.enter.prevent="saveFeedback(d)"
            />
            <div class="depot-feedback-actions">
              <button class="btn-ghost" style="font-size:12px" @click="editingFeedbackId = null">
                <X :size="11" /> Annuler
              </button>
              <button
                class="btn-primary"
                style="font-size:12px"
                :disabled="saving"
                @click="saveFeedback(d)"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>

        <!-- Zone de notation -->
        <div class="depot-card-actions">
          <!-- Note actuelle ou sélecteur -->
          <template v-if="editingNoteId === d.id">
            <div class="note-selector">
              <button
                v-for="n in NOTES"
                :key="n"
                class="note-btn"
                :class="{ active: noteInput === n, [gradeClass(n)]: true }"
                @click="noteInput = n"
              >
                {{ n }}
              </button>
            </div>
            <div style="display:flex;gap:6px;margin-top:6px" @keydown.enter.prevent="noteInput && saveNote(d)" @keydown.escape.prevent="editingNoteId = null">
              <button class="btn-ghost" style="font-size:11px;padding:3px 8px" @click="editingNoteId = null">
                Annuler
              </button>
              <button
                class="btn-primary"
                style="font-size:11px;padding:3px 8px"
                :disabled="saving || !noteInput"
                @click="saveNote(d)"
              >
                OK
              </button>
            </div>
          </template>
          <template v-else>
            <button
              class="note-display-btn"
              :class="d.note ? gradeClass(d.note) : 'grade-empty'"
              :title="d.note ? `Note : ${d.note}` : 'Cliquer pour noter'"
              @click="startNote(d)"
            >
              {{ d.note ? formatGrade(d.note) : '-' }}
            </button>
          </template>

          <!-- Bouton feedback -->
          <button
            class="btn-icon"
            title="Ajouter un commentaire"
            aria-label="Ajouter un commentaire"
            style="margin-top:4px"
            @click="startFeedback(d)"
          >
            <MessageSquare :size="13" />
          </button>

          <!-- Évaluer avec la grille (#8) -->
          <button
            class="btn-icon"
            title="Évaluer avec la grille de critères"
            aria-label="Évaluer avec la grille de critères"
            style="margin-top:4px"
            @click="openRubricScoring(d)"
          >
            <Star :size="13" />
          </button>

          <!-- Télécharger (fichier seulement) -->
          <button
            v-if="d.type === 'file'"
            class="btn-icon"
            title="Télécharger"
            aria-label="Télécharger"
            @click="downloadDepot(d)"
          >
            <Download :size="13" />
          </button>
        </div>
      </div>
    </div>

    <!-- Pied de modale -->
    <div class="depots-footer">
      <button class="btn-ghost" style="font-size:13px" @click="markAllD">
        Marquer non soumis → D
      </button>
      <div style="display:flex;gap:8px">
        <button class="btn-ghost" style="font-size:13px;display:flex;align-items:center;gap:5px" @click="openRubricEditor">
          <LayoutList :size="13" /> Grille
        </button>
        <button class="btn-ghost" style="font-size:13px" @click="exportCsv">
          Export CSV
        </button>
        <button class="btn-primary" style="font-size:13px" @click="emit('update:modelValue', false)">
          Fermer
        </button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
/* Sous-en-tête */
.depots-subheader {
  padding: 14px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 14px;
}

.depots-meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.depots-deadline {
  font-size: 12.5px;
  color: var(--text-muted);
}

.depots-progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.depots-progress-label {
  font-size: 12.5px;
  color: var(--text-secondary);
  white-space: nowrap;
}
.depots-progress-label strong { color: var(--text-primary); }

.depots-progress-pct {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 36px;
  text-align: right;
}

/* Corps */
.depots-body {
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
  max-height: 52vh;
}

/* Carte de dépôt */
.depot-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-elevated);
  transition: border-color .12s;
}
.depot-card.has-note { border-color: rgba(var(--accent-rgb),.25); }

.depot-card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.depot-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.depot-student-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  flex: 1;
}

.depot-date {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.depot-file-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.depot-file-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--accent);
  font-size: 12.5px;
  cursor: pointer;
  font-family: var(--font);
  padding: 0;
  text-align: left;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.depot-file-btn:hover { text-decoration: underline; }

.depot-ci-badge {
  font-size: 13px;
  flex-shrink: 0;
  cursor: default;
}

.depot-feedback-text {
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
  margin-top: 2px;
}

.depot-feedback-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.feedback-bank {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.feedback-bank-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border: 1px solid var(--border-input);
  border-radius: 20px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  font-family: var(--font);
  cursor: pointer;
  transition: background .1s, color .1s, border-color .1s;
  white-space: nowrap;
}
.feedback-bank-pill:hover {
  background: rgba(var(--accent-rgb),.1);
  color: var(--accent);
  border-color: rgba(var(--accent-rgb),.4);
}
.feedback-custom { border-style: dashed; }
.feedback-add-btn { border-style: dashed; opacity: .6; }
.feedback-add-btn:hover { opacity: 1; }
.feedback-add-form {
  display: flex; gap: 4px; align-items: center; margin-top: 4px;
}

.depot-feedback-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

/* Zone notation */
.depot-card-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  min-width: 68px;
}

.note-selector {
  display: flex;
  gap: 3px;
}

.note-btn {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  font-family: var(--font);
  color: var(--text-secondary);
  transition: all .1s;
}
.note-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.note-btn.active { border-color: transparent; color: #fff; }
.note-btn.active.grade-a { background: var(--color-success); }
.note-btn.active.grade-b { background: #27ae60; }
.note-btn.active.grade-c { background: var(--color-warning); }
.note-btn.active.grade-d { background: var(--color-danger); }
.note-btn.active.grade-na { background: var(--text-muted); }

.note-display-btn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1.5px solid var(--border-input);
  background: transparent;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  font-family: var(--font);
  transition: all .12s;
}
.note-display-btn:hover { background: var(--bg-hover); }
.note-display-btn.grade-empty { color: var(--text-muted); }
.note-display-btn.grade-a  { color: var(--color-success); border-color: var(--color-success); }
.note-display-btn.grade-b  { color: #27ae60; border-color: #27ae60; }
.note-display-btn.grade-c  { color: var(--color-warning); border-color: var(--color-warning); }
.note-display-btn.grade-d  { color: var(--color-danger); border-color: var(--color-danger); }
.note-display-btn.grade-na { color: var(--text-muted); }

/* Badge type travail */
.travail-type-badge {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .5px;
  padding: 2px 7px;
  border-radius: 4px;
}
.type-livrable     { background: rgba(var(--accent-rgb),.2);   color: var(--accent); }
.type-soutenance   { background: rgba(var(--color-warning-rgb),.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: var(--color-cctl); }
.type-etude_de_cas { background: rgba(var(--color-success-rgb),.2);    color: var(--color-success); }
.type-memoire      { background: rgba(var(--color-danger-rgb),.2);    color: var(--color-danger); }
.type-autre        { background: rgba(127,140,141,.2);  color: var(--color-autre); }

/* Distribution des notes (#3) */
.depots-grade-dist {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 2px;
}

.grade-dist-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  border: 1px solid transparent;
}
.grade-dist-pill.grade-a  { background: rgba(var(--color-success-rgb),.12);   color: var(--color-success); border-color: rgba(var(--color-success-rgb),.25); }
.grade-dist-pill.grade-b  { background: rgba(var(--color-success-rgb),.07);   color: #27ae60;              border-color: rgba(var(--color-success-rgb),.15); }
.grade-dist-pill.grade-c  { background: rgba(var(--color-warning-rgb),.12);  color: var(--color-warning); border-color: rgba(var(--color-warning-rgb),.25); }
.grade-dist-pill.grade-d  { background: rgba(var(--color-danger-rgb),.12);   color: var(--color-danger);  border-color: rgba(var(--color-danger-rgb),.25); }
.grade-dist-pill.grade-na { background: var(--bg-hover); color: var(--text-muted);    border-color: var(--border); }
.grade-dist-pill strong { font-weight: 800; }

.depots-quick-stats {
  display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;
}
.stat-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 11px; font-weight: 600; padding: 2px 8px;
  border-radius: 12px; border: 1px solid transparent;
}
.stat-total   { background: rgba(var(--accent-rgb),.12); color: var(--accent); border-color: rgba(var(--accent-rgb),.25); }
.stat-noted   { background: rgba(var(--color-success-rgb),.12);  color: var(--color-success); border-color: rgba(var(--color-success-rgb),.25); }
.stat-waiting { background: rgba(var(--color-warning-rgb),.12); color: var(--color-warning); border-color: rgba(var(--color-warning-rgb),.25); }
.stat-submitted { background: var(--bg-hover); color: var(--text-muted); border-color: var(--border); }
.stat-mode    { background: rgba(123,104,238,.12); color: var(--color-cctl); border-color: rgba(123,104,238,.25); }
.stat-badge strong { font-weight: 800; }

/* Search + sort */
.depots-search-row {
  display: flex; align-items: center; gap: 8px;
}
.depots-search-input-wrap {
  position: relative; flex: 1;
}
.depots-search-icon {
  position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
  color: var(--text-muted); pointer-events: none;
}
.depots-search-input {
  padding-left: 28px !important; font-size: 12.5px !important;
}
.depots-sort-btn {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; padding: 4px 10px; white-space: nowrap;
}

/* Bulk hint */
.depots-bulk-hint {
  font-size: 11.5px; color: var(--color-warning); font-weight: 600;
  padding: 4px 10px; border-radius: 6px;
  background: rgba(var(--color-warning-rgb),.08); border: 1px solid rgba(var(--color-warning-rgb),.2);
}

/* Badge retard (#7) */
.depot-late-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(var(--color-danger-rgb),.15);
  color: var(--color-danger);
  border: 1px solid rgba(var(--color-danger-rgb),.3);
  white-space: nowrap;
  flex-shrink: 0;
}

/* Footer */
.depots-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

/* ═══ Batch mode toggle ═══ */
.depots-batch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}

.btn-batch-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--t-fast);
}

.btn-batch-toggle:hover { border-color: var(--accent); color: var(--accent); }
.btn-batch-toggle.active { background: var(--accent); color: #fff; border-color: var(--accent); }

/* ═══ Batch split view ═══ */
.batch-split {
  display: flex;
  flex-direction: row;
  height: 480px;
  overflow: hidden;
}

.batch-list {
  width: 35%;
  min-width: 200px;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

.batch-filter-row {
  display: flex;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.batch-filter-btn {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--t-fast);
}

.batch-filter-btn:hover { border-color: var(--accent); }
.batch-filter-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

.batch-student-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.batch-student-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  width: 100%;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  text-align: left;
  transition: background var(--t-fast);
}

.batch-student-row:hover { background: var(--bg-hover); }
.batch-student-row.active { background: rgba(var(--accent-rgb, 99,102,241), 0.08); }
.batch-student-row.has-note .batch-student-name { opacity: 0.6; }

.batch-student-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.batch-student-grade {
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
}

.batch-progress-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid var(--border);
}

.batch-progress-label { font-size: 11px; color: var(--text-muted); white-space: nowrap; }

/* ═══ Batch detail (right panel) ═══ */
.batch-detail {
  flex: 1;
  padding: 16px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.batch-detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.batch-detail-name { font-size: 16px; font-weight: 700; }
.batch-detail-meta { font-size: 12px; color: var(--text-muted); }

.batch-depot-content { padding: 8px 0; }

.batch-no-depot {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  background: var(--bg-hover);
  border-radius: 8px;
}

.batch-grade-row {
  display: flex;
  gap: 8px;
  transition: background 300ms;
}

.batch-grade-row.grade-saved {
  animation: flashGreen 600ms ease;
}

@keyframes flashGreen {
  0% { background: rgba(var(--color-success-rgb),0.15); }
  100% { background: transparent; }
}

.batch-grade-btn {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 800;
  border: 2px solid var(--border);
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--t-fast);
}

.batch-grade-btn:hover { border-color: currentColor; transform: translateY(-2px); }
.batch-grade-btn.active.grade-a { background: var(--color-grade-a); color: #fff; border-color: transparent; }
.batch-grade-btn.active.grade-b { background: var(--color-grade-b); color: #fff; border-color: transparent; }
.batch-grade-btn.active.grade-c { background: var(--color-grade-c); color: #fff; border-color: transparent; }
.batch-grade-btn.active.grade-d { background: var(--color-grade-d); color: #fff; border-color: transparent; }

.batch-feedback-section { display: flex; flex-direction: column; }

.batch-actions {
  display: flex;
  gap: 8px;
}

.batch-actions .btn-primary { font-size: 13px; padding: 8px 16px; }
.batch-actions .btn-ghost { font-size: 13px; padding: 8px 16px; }

.batch-dist {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.batch-hints {
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.batch-hints kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  font-size: 10px;
  font-family: var(--font-mono, monospace);
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.batch-hint-sep { color: var(--border); margin: 0 2px; }

.batch-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 14px;
}

/* Responsive: stack vertically */
@media (max-width: 768px) {
  .batch-split { flex-direction: column; height: auto; }
  .batch-list { width: 100%; max-height: 200px; border-right: none; border-bottom: 1px solid var(--border); }
}
</style>
