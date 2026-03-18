<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { AlertTriangle, Download, FileText, Link2, MessageSquare, X, LayoutList, Star } from 'lucide-vue-next'
  import { useTravauxStore } from '@/stores/travaux'
  import { useAppStore }     from '@/stores/app'
  import { useModalsStore }  from '@/stores/modals'
  import { useToast }        from '@/composables/useToast'
  import { useOpenExternal } from '@/composables/useOpenExternal'
  import { avatarColor, initials, formatGrade, gradeClass } from '@/utils/format'
  import { formatDate } from '@/utils/date'
  import Modal from '@/components/ui/Modal.vue'
  import type { Depot } from '@/types'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const travauxStore = useTravauxStore()
  const appStore     = useAppStore()
  const modals       = useModalsStore()
  const { showToast }    = useToast()
  const { openExternal } = useOpenExternal()

  // ── Notation inline ───────────────────────────────────────────────────────
  const editingNoteId     = ref<number | null>(null)
  const noteInput         = ref('')
  const editingFeedbackId = ref<number | null>(null)
  const feedbackInput     = ref('')
  const saving            = ref(false)

  const NOTES = ['A', 'B', 'C', 'D', 'NA']

  const FEEDBACK_BANK = [
    'Excellent travail, bravo !',
    'Bonne structure et organisation',
    'Code insuffisamment commenté',
    'Rendu incomplet',
    'Hors sujet par rapport aux consignes',
    'À retravailler et soumettre à nouveau',
    'Manque de profondeur dans l\'analyse',
    'Bon effort, quelques ajustements nécessaires',
  ]

  function insertFeedback(text: string) {
    feedbackInput.value = feedbackInput.value
      ? feedbackInput.value.trimEnd() + ' ' + text
      : text
  }

  watch(() => props.modelValue, async (open) => {
    if (open && appStore.currentTravailId) {
      await travauxStore.openTravail(appStore.currentTravailId)
    }
  })

  // ── Statistiques ─────────────────────────────────────────────────────────
  const totalStudents = computed(() => travauxStore.depots.length)
  const notedCount    = computed(() => travauxStore.depots.filter((d) => d.note != null).length)
  const progressPct   = computed(() =>
    totalStudents.value ? Math.round((notedCount.value / totalStudents.value) * 100) : 0,
  )

  // ── Analytics #3 : distribution des notes ────────────────────────────────
  const GRADE_ORDER = ['A', 'B', 'C', 'D', 'NA']
  const gradeDistribution = computed(() => {
    const counts: Record<string, number> = {}
    for (const d of travauxStore.depots) {
      if (d.note) counts[d.note] = (counts[d.note] ?? 0) + 1
    }
    return GRADE_ORDER
      .filter((g) => counts[g])
      .map((g) => ({ grade: g, count: counts[g] }))
  })

  // ── Helpers retard #7 ─────────────────────────────────────────────────────
  function formatLate(seconds: number): string {
    if (seconds <= 0) return ''
    const h = Math.floor(seconds / 3600)
    const d = Math.floor(h / 24)
    if (d >= 1) return `+${d}j ${h % 24}h`
    return `+${h}h${Math.floor((seconds % 3600) / 60)}min`
  }

  // ── Actions note ─────────────────────────────────────────────────────────
  function startNote(d: Depot) {
    editingNoteId.value = d.id
    noteInput.value     = d.note ?? ''
    editingFeedbackId.value = null
  }

  async function saveNote(d: Depot) {
    saving.value = true
    try {
      await travauxStore.setNote({ depotId: d.id, note: noteInput.value })
      editingNoteId.value = null
      showToast('Note enregistrée', 'success')
    } finally {
      saving.value = false
    }
  }

  // ── Actions feedback ──────────────────────────────────────────────────────
  function startFeedback(d: Depot) {
    editingFeedbackId.value = d.id
    feedbackInput.value     = d.feedback ?? ''
    editingNoteId.value = null
  }

  async function saveFeedback(d: Depot) {
    saving.value = true
    try {
      await travauxStore.setFeedback({ depotId: d.id, feedback: feedbackInput.value })
      editingFeedbackId.value = null
      showToast('Commentaire enregistré', 'success')
    } finally {
      saving.value = false
    }
  }

  // ── Ouvrir / télécharger ─────────────────────────────────────────────────
  async function openDepot(d: Depot) {
    if (d.type === 'link') {
      await openExternal(d.content)
    } else {
      await window.api.openPath(d.content)
    }
  }

  async function downloadDepot(d: Depot) {
    if (d.type === 'file') {
      await window.api.downloadFile(d.content)
    }
  }

  // ── Marquer tout D ────────────────────────────────────────────────────────
  async function markAllD() {
    if (!appStore.currentTravailId) return
    await travauxStore.markNonSubmittedAsD(appStore.currentTravailId)
    showToast('Rendus manquants marqués D', 'success')
  }

  // ── Export CSV ────────────────────────────────────────────────────────────
  async function exportCsv() {
    if (!appStore.currentTravailId) return
    const res = await window.api.exportCsv(appStore.currentTravailId)
    if (res?.ok && res.data) showToast(`Export : ${res.data}`, 'success')
  }

  // ── Rubric ────────────────────────────────────────────────────────────────
  function openRubricEditor() {
    appStore.rubricDepotId = null
    modals.rubric = true
  }

  function openRubricScoring(d: Depot) {
    appStore.rubricDepotId = d.id
    modals.rubric = true
  }

  // ── GitHub CI (#10) ───────────────────────────────────────────────────────
  type CiState = 'success' | 'failure' | 'pending' | 'unknown'
  const ciStatus = ref<Record<string, CiState>>({})

  function parseGithubRepo(url: string): { owner: string; repo: string } | null {
    try {
      const u = new URL(url)
      if (!u.hostname.endsWith('github.com')) return null
      const parts = u.pathname.replace(/^\//, '').split('/')
      if (parts.length < 2) return null
      return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') }
    } catch { return null }
  }

  async function fetchCiStatus(url: string) {
    const gh = parseGithubRepo(url)
    if (!gh) return
    if (ciStatus.value[url] !== undefined) return  // déjà chargé
    ciStatus.value[url] = 'pending'
    try {
      const apiUrl = `https://api.github.com/repos/${gh.owner}/${gh.repo}/commits/HEAD/status`
      const res = await fetch(apiUrl, { headers: { Accept: 'application/vnd.github+json' } })
      if (!res.ok) { ciStatus.value[url] = 'unknown'; return }
      const json = await res.json() as { state: string }
      ciStatus.value[url] = (json.state === 'success' ? 'success' : json.state === 'failure' || json.state === 'error' ? 'failure' : 'pending') as CiState
    } catch {
      ciStatus.value[url] = 'unknown'
    }
  }

  const CI_ICON: Record<CiState, string> = {
    success: '✅', failure: '❌', pending: '🔄', unknown: '❓',
  }
  const CI_TITLE: Record<CiState, string> = {
    success: 'CI : succès', failure: 'CI : échec', pending: 'CI : en cours', unknown: 'CI : statut inconnu',
  }

  // Charger CI pour tous les dépôts de type link avec URL GitHub
  watch(() => travauxStore.depots, (depots) => {
    for (const d of depots) {
      if (d.type === 'link') fetchCiStatus(d.content)
    }
  }, { immediate: true })
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="travauxStore.currentDevoir?.title ?? 'Dépôts'"
    max-width="820px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- Sous-titre + progression -->
    <div v-if="travauxStore.currentDevoir" class="depots-subheader">
      <div class="depots-meta-row">
        <span class="travail-type-badge" :class="`type-${travauxStore.currentDevoir.type}`">
          {{ travauxStore.currentDevoir.type }}
        </span>
        <span class="depots-deadline">
          Échéance : {{ formatDate(travauxStore.currentDevoir.deadline) }}
        </span>
      </div>

      <div class="depots-progress-row">
        <span class="depots-progress-label">
          <strong>{{ notedCount }}</strong> / {{ totalStudents }} noté{{ notedCount > 1 ? 's' : '' }}
        </span>
        <div class="linear-progress" style="flex:1">
          <div class="linear-progress-fill" :style="{ width: progressPct + '%' }" />
        </div>
        <span class="depots-progress-pct">{{ progressPct }} %</span>
      </div>

      <!-- Distribution des notes (#3) -->
      <div v-if="gradeDistribution.length" class="depots-grade-dist">
        <span
          v-for="g in gradeDistribution"
          :key="g.grade"
          class="grade-dist-pill"
          :class="gradeClass(g.grade)"
          :title="`${g.count} étudiant${g.count > 1 ? 's' : ''} — ${g.grade}`"
        >
          {{ g.grade }} <strong>{{ g.count }}</strong>
        </span>
      </div>
    </div>

    <!-- Liste des dépôts -->
    <div class="depots-body">
      <div v-if="travauxStore.depots.length === 0" class="empty-hint" style="padding:32px 0">
        <p>Aucun rendu déposé pour l'instant.</p>
      </div>

      <div
        v-for="d in travauxStore.depots"
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
            <span class="depot-date">{{ formatDate(d.submitted_at) }}</span>
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
            <!-- Banque de commentaires rapides -->
            <div class="feedback-bank">
              <button
                v-for="fb in FEEDBACK_BANK"
                :key="fb"
                class="feedback-bank-pill"
                type="button"
                @click="insertFeedback(fb)"
              >
                {{ fb }}
              </button>
            </div>
            <textarea
              v-model="feedbackInput"
              class="form-textarea"
              rows="2"
              placeholder="Commentaire pour l'étudiant…"
              style="font-size:13px"
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
            <div style="display:flex;gap:6px;margin-top:6px">
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
              {{ d.note ? formatGrade(d.note) : '—' }}
            </button>
          </template>

          <!-- Bouton feedback -->
          <button
            class="btn-icon"
            title="Ajouter un commentaire"
            style="margin-top:4px"
            @click="startFeedback(d)"
          >
            <MessageSquare :size="13" />
          </button>

          <!-- Évaluer avec la grille (#8) -->
          <button
            class="btn-icon"
            title="Évaluer avec la grille de critères"
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
  background: rgba(255,255,255,.03);
  transition: border-color .12s;
}
.depot-card.has-note { border-color: rgba(74,144,217,.25); }

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
  background: rgba(74,144,217,.1);
  color: var(--accent);
  border-color: rgba(74,144,217,.4);
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
.type-livrable     { background: rgba(74,144,217,.2);   color: var(--accent); }
.type-soutenance   { background: rgba(243,156,18,.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: #9b87f5; }
.type-etude_de_cas { background: rgba(39,174,96,.2);    color: var(--color-success); }
.type-memoire      { background: rgba(231,76,60,.2);    color: #e74c3c; }
.type-autre        { background: rgba(127,140,141,.2);  color: #95a5a6; }

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
.grade-dist-pill.grade-a  { background: rgba(39,174,96,.12);   color: var(--color-success); border-color: rgba(39,174,96,.25); }
.grade-dist-pill.grade-b  { background: rgba(39,174,96,.07);   color: #27ae60;              border-color: rgba(39,174,96,.15); }
.grade-dist-pill.grade-c  { background: rgba(243,156,18,.12);  color: var(--color-warning); border-color: rgba(243,156,18,.25); }
.grade-dist-pill.grade-d  { background: rgba(231,76,60,.12);   color: var(--color-danger);  border-color: rgba(231,76,60,.25); }
.grade-dist-pill.grade-na { background: rgba(255,255,255,.05); color: var(--text-muted);    border-color: var(--border); }
.grade-dist-pill strong { font-weight: 800; }

/* Badge retard (#7) */
.depot-late-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(231,76,60,.15);
  color: var(--color-danger);
  border: 1px solid rgba(231,76,60,.3);
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
</style>
