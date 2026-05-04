<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import {
    CheckCircle2, Clock, FileText, Link2, Award, Download, AlertTriangle,
  } from 'lucide-vue-next'
  import { useTravauxStore } from '@/stores/travaux'
  import { useAppStore }     from '@/stores/app'
  import { useToast }        from '@/composables/useToast'
  import { useConfirm }      from '@/composables/useConfirm'
  import { useApi }          from '@/composables/useApi'
  import { avatarColor }     from '@/utils/format'
  import { formatDate }      from '@/utils/date'
  import Modal from '@/components/ui/Modal.vue'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const travauxStore  = useTravauxStore()
  const appStore      = useAppStore()
  const { showToast } = useToast()
  const { confirm }   = useConfirm()
  const { api }       = useApi()

  // ── Données suivi (tous les étudiants, rendu ou non) ──────────────────────
  interface SuiviRow {
    student_id:          number
    student_name:        string
    avatar_initials:     string
    photo_data:          string | null
    depot_id:            number | null
    file_name:           string | null
    link_url:            string | null
    note:                string | null
    feedback:            string | null
    submitted_at:        string | null
    travail_group_name:  string | null
  }

  const rows    = ref<SuiviRow[]>([])
  const loading = ref(false)

  // ── Note inline ───────────────────────────────────────────────────────────
  const editingNote    = ref<number | null>(null)  // depot_id
  const pendingNote    = ref('')
  const editingFeedback = ref<number | null>(null)
  const pendingFeedback = ref('')
  const saving          = ref(false)

  watch(() => props.modelValue, async (open) => {
    if (open && appStore.currentTravailId) {
      loading.value = true
      try {
        rows.value = await api<SuiviRow[]>(() => window.api.getTravauxSuivi(appStore.currentTravailId!) as unknown as Promise<{ ok: boolean; data?: SuiviRow[] }>) ?? []
      } finally {
        loading.value = false
      }
    }
  })

  const submitted = computed(() => rows.value.filter((r) => r.submitted_at))
  const pct       = computed(() => rows.value.length ? Math.round(submitted.value.length / rows.value.length * 100) : 0)

  // Sorted: unsubmitted first for quick review, then by name
  const sortedRows = computed(() =>
    [...rows.value].sort((a, b) => {
      if (!a.submitted_at && b.submitted_at) return -1
      if (a.submitted_at && !b.submitted_at) return 1
      return a.student_name.localeCompare(b.student_name)
    }),
  )

  function startEditNote(r: SuiviRow) {
    editingNote.value    = r.depot_id
    pendingNote.value    = r.note ?? ''
    editingFeedback.value = null
  }

  function startEditFeedback(r: SuiviRow) {
    editingFeedback.value = r.depot_id
    pendingFeedback.value = r.feedback ?? ''
    editingNote.value     = null
  }

  async function saveNote(r: SuiviRow) {
    if (!r.depot_id) return
    saving.value = true
    try {
      await api(() => window.api.setNote({ depotId: r.depot_id!, note: pendingNote.value.trim() || null }), 'grade')
      r.note           = pendingNote.value.trim() || null
      editingNote.value = null
    } finally {
      saving.value = false
    }
  }

  async function saveFeedback(r: SuiviRow) {
    if (!r.depot_id) return
    saving.value = true
    try {
      await api(() => window.api.setFeedback({ depotId: r.depot_id!, feedback: pendingFeedback.value.trim() || null }), 'feedback')
      r.feedback           = pendingFeedback.value.trim() || null
      editingFeedback.value = null
    } finally {
      saving.value = false
    }
  }

  async function handleExportCsv() {
    if (!appStore.currentTravailId) return
    const res = await window.api.exportCsv(appStore.currentTravailId)
    if (res?.ok && res.data) showToast(`Export CSV : ${res.data}`, 'success')
    else if (!res?.ok) showToast('Erreur lors de l\'export.')
  }

  async function handleMarkD() {
    if (!appStore.currentTravailId) return
    if (!await confirm('Marquer tous les non-rendus avec la note D ?', 'warning', 'Confirmer')) return
    await travauxStore.markNonSubmittedAsD(appStore.currentTravailId)
    // Recharger le suivi
    rows.value = await api<SuiviRow[]>(() => window.api.getTravauxSuivi(appStore.currentTravailId!) as unknown as Promise<{ ok: boolean; data?: SuiviRow[] }>) ?? []
    showToast('Non-rendus marqués D.', 'info')
  }
</script>

<template>
  <Modal :model-value="modelValue" title="Suivi du travail" max-width="760px" @update:model-value="emit('update:modelValue', $event)">
    <div class="suivi-body">

      <!-- Infos salle et AAVs -->
      <div v-if="travauxStore.currentDevoir?.room || travauxStore.currentDevoir?.aavs" class="suivi-meta">
        <span v-if="travauxStore.currentDevoir?.room" class="suivi-room">Salle {{ travauxStore.currentDevoir.room }}</span>
        <span v-for="a in (travauxStore.currentDevoir?.aavs ?? '').split('\n').filter(Boolean)" :key="a" class="suivi-aav">{{ a.trim() }}</span>
      </div>

      <!-- Barre de progression -->
      <div class="suivi-progress-header">
        <div class="suivi-progress-labels">
          <span class="suivi-progress-title">Progression des rendus</span>
          <span class="suivi-progress-pct">{{ submitted.length }} / {{ rows.length }} - {{ pct }}%</span>
        </div>
        <div class="suivi-progress-track">
          <div class="suivi-progress-fill" :style="{ width: `${pct}%` }" />
        </div>
      </div>

      <!-- Chargement -->
      <div v-if="loading" class="suivi-loading">
        <div v-for="i in 4" :key="i" class="skel-suivi-row">
          <div class="skel skel-avatar skel-avatar-sm" />
          <div class="skel skel-line skel-w50" />
          <div class="skel skel-line skel-w30" style="margin-left:auto" />
        </div>
      </div>

      <!-- Liste des étudiants -->
      <div v-else-if="rows.length" class="suivi-table">
        <div
          v-for="r in sortedRows"
          :key="r.student_id"
          class="suivi-row"
          :class="{ 'suivi-row--submitted': !!r.submitted_at }"
        >
          <!-- Avatar -->
          <div
            class="suivi-avatar"
            :style="{ background: r.photo_data ? 'transparent' : avatarColor(r.student_name) }"
          >
            <img v-if="r.photo_data" :src="r.photo_data" :alt="r.student_name" class="suivi-avatar-img" />
            <span v-else>{{ r.avatar_initials }}</span>
          </div>

          <!-- Status icon -->
          <span class="suivi-status-icon" :class="r.submitted_at ? 'suivi-status--ok' : 'suivi-status--pending'">
            <CheckCircle2 v-if="r.submitted_at" :size="14" />
            <Clock v-else :size="14" />
          </span>

          <!-- Nom + groupe -->
          <div class="suivi-info">
            <span class="suivi-student-name">{{ r.student_name }}</span>
            <span v-if="r.travail_group_name" class="suivi-group-tag">{{ r.travail_group_name }}</span>
          </div>

          <!-- Fichier déposé -->
          <div v-if="r.submitted_at" class="suivi-file">
            <Link2 v-if="r.link_url" :size="11" class="suivi-file-icon" />
            <FileText v-else :size="11" class="suivi-file-icon" />
            <span class="suivi-file-name">{{ r.file_name ?? r.link_url ?? '-' }}</span>
            <span class="suivi-file-date">{{ formatDate(r.submitted_at) }}</span>
          </div>
          <div v-else class="suivi-not-submitted">
            <Clock :size="12" />
            Non rendu
          </div>

          <!-- Note & feedback (édition inline) -->
          <div v-if="r.depot_id" class="suivi-note-section">
            <!-- Note -->
            <template v-if="editingNote === r.depot_id">
              <input
                v-model="pendingNote"
                class="suivi-note-input"
                placeholder="Note…"
                @keyup.enter="saveNote(r)"
                @keyup.esc="editingNote = null"
              />
              <button class="btn-cta suivi-save-btn" :disabled="saving" @click="saveNote(r)">✓</button>
              <button class="btn-ghost suivi-save-btn" @click="editingNote = null">✕</button>
            </template>
            <button v-else class="suivi-note-badge" :class="r.note ? 'has-note' : 'no-note'" @click="startEditNote(r)">
              <Award :size="11" />
              {{ r.note ?? 'Noter' }}
            </button>

            <!-- Feedback -->
            <template v-if="editingFeedback === r.depot_id">
              <input
                v-model="pendingFeedback"
                class="suivi-feedback-input"
                placeholder="Commentaire…"
                @keyup.enter="saveFeedback(r)"
                @keyup.esc="editingFeedback = null"
              />
              <button class="btn-cta suivi-save-btn" :disabled="saving" @click="saveFeedback(r)">✓</button>
              <button class="btn-ghost suivi-save-btn" @click="editingFeedback = null">✕</button>
            </template>
            <button v-else-if="r.note" class="suivi-feedback-btn" @click="startEditFeedback(r)">
              {{ r.feedback ? '✎ ' + r.feedback : '+ Commentaire' }}
            </button>
          </div>
          <div v-else class="suivi-note-section" />
        </div>
      </div>

      <!-- État vide -->
      <div v-else class="suivi-empty">
        <AlertTriangle :size="28" class="suivi-empty-icon" />
        <p>Aucun étudiant trouvé pour ce travail.</p>
      </div>

    </div>

    <!-- Footer -->
    <div class="modal-footer suivi-footer">
      <span class="suivi-footer-stat">
        <CheckCircle2 :size="13" style="color:var(--color-success)" />
        {{ submitted.length }} rendu{{ submitted.length > 1 ? 's' : '' }} sur {{ rows.length }}
      </span>
      <div class="suivi-footer-actions">
        <button class="btn-ghost" style="display:flex;align-items:center;gap:6px;font-size:12px" @click="handleExportCsv">
          <Download :size="13" /> Exporter CSV
        </button>
        <button class="btn-danger" style="font-size:12px" @click="handleMarkD">
          Non rendus → D
        </button>
        <button class="btn-ghost" @click="emit('update:modelValue', false)">Fermer</button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.suivi-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 260px;
}

/* ── Meta (salle + AAVs) ── */
.suivi-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 16px 0;
  align-items: center;
}
.suivi-room {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}
.suivi-aav {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: var(--radius);
  background: rgba(var(--accent-rgb),.12);
  color: var(--accent);
}

/* ── Barre de progression ── */
.suivi-progress-header {
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.suivi-progress-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.suivi-progress-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.suivi-progress-pct {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-light);
}

.suivi-progress-track {
  height: 6px;
  background: var(--bg-active);
  border-radius: var(--radius-xs);
  overflow: hidden;
}

.suivi-progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: var(--radius-xs);
  transition: width var(--motion-slow) var(--ease-out);
}

/* ── Loading ── */
.suivi-loading {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 20px;
}

.skel-suivi-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

/* ── Table étudiants ── */
.suivi-table {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: 420px;
  overflow-y: auto;
}

.suivi-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  transition: background var(--t-fast);
  min-height: 52px;
}
.suivi-row:hover { background: var(--bg-elevated); }
.suivi-row--submitted { /* no special bg needed */ }

.suivi-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  overflow: hidden;
}
.suivi-avatar-img { width: 100%; height: 100%; object-fit: cover; }

.suivi-status-icon { flex-shrink: 0; display: flex; align-items: center; }
.suivi-status--ok { color: var(--color-success, #22c55e); }
.suivi-status--pending { color: var(--text-muted); opacity: .5; }

.suivi-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 120px;
  flex-shrink: 0;
}

.suivi-student-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.suivi-group-tag {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  white-space: nowrap;
  align-self: flex-start;
}

.suivi-file {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.suivi-file-icon { color: var(--text-muted); flex-shrink: 0; }

.suivi-file-name {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.suivi-file-date {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.suivi-not-submitted {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
}

/* ── Note inline ── */
.suivi-note-section {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  min-width: 130px;
  justify-content: flex-end;
}

.suivi-note-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 20px;
  border: none;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all .12s;
}

.suivi-note-badge.has-note {
  background: rgba(var(--accent-rgb),.18);
  color: var(--accent-light);
}
.suivi-note-badge.has-note:hover { background: rgba(var(--accent-rgb),.28); }

.suivi-note-badge.no-note {
  background: var(--bg-hover);
  color: var(--text-muted);
}
.suivi-note-badge.no-note:hover { background: var(--bg-active); color: var(--text-secondary); }

.suivi-note-input,
.suivi-feedback-input {
  width: 80px;
  padding: 4px 8px;
  font-size: 12px;
  background: var(--bg-input, var(--border));
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font);
  outline: none;
}
.suivi-note-input:focus-visible,
.suivi-feedback-input:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }
.suivi-note-input:focus,
.suivi-feedback-input:focus { border-color: var(--accent); }
.suivi-feedback-input { width: 120px; }

.suivi-save-btn {
  padding: 3px 7px;
  font-size: 12px;
  min-width: 0;
}

.suivi-feedback-btn {
  font-size: 11px;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font);
  font-style: italic;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 4px;
  border-radius: var(--radius-xs);
  transition: color var(--t-fast), background var(--t-fast);
}
.suivi-feedback-btn:hover { color: var(--text-secondary); background: var(--bg-hover); }

/* ── Empty ── */
.suivi-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  color: var(--text-muted);
  font-size: 13px;
}
.suivi-empty-icon { opacity: .4; }

/* ── Footer ── */
.suivi-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.suivi-footer-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.suivi-footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
