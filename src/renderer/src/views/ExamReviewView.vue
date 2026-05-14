/**
 * ExamReviewView : vue prof post-mortem d'un examen surveille.
 *
 * Pour chaque etudiant ayant participe : code soumis (CodeMirror read-only),
 * timeline visuelle des evenements suspects (focus_loss, paste_blocked),
 * jalons (debut, soumission), et formulaire de notation (note + feedback)
 * qui reutilise l'infra depots existante.
 */
<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EditorView, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { python } from '@codemirror/lang-python'
import { ArrowLeft, AlertTriangle, ClipboardX, EyeOff, Clock, Save } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import type { Depot } from '@/types'

const route  = useRoute()
const router = useRouter()
const { showToast } = useToast()

const travailId = computed(() => Number(route.params.travailId))

interface Travail { id: number; title: string; description: string | null; exam_mode: number }
interface SummaryRow {
  student_id: number;
  focus_loss_count: number;
  paste_blocked_count: number;
  started_at: number | null;
  submitted_at: number | null;
  timed_out_at: number | null;
  last_event_at: number;
}
interface Event {
  id: number; type: string; ts: number; payload: unknown;
}

const travail   = ref<Travail | null>(null)
const depots    = ref<Depot[]>([])
const summary   = ref<Record<number, SummaryRow>>({})
const eventsByStudent = ref<Record<number, Event[]>>({})
const expandedStudentId = ref<number | null>(null)
const loading   = ref(true)
const errMsg    = ref('')

async function load() {
  loading.value = true
  try {
    const [tRes, dRes, sRes] = await Promise.all([
      window.api.getTravailById(travailId.value),
      window.api.getDepots(travailId.value),
      window.api.exam?.getSummary?.(travailId.value),
    ])
    if (!tRes?.ok || !tRes.data) { errMsg.value = 'Devoir introuvable.'; return }
    if (!(tRes.data as Travail).exam_mode) { errMsg.value = "Ce devoir n'est pas un examen surveille."; return }
    travail.value = tRes.data as Travail
    depots.value  = (dRes?.ok ? dRes.data : []) as Depot[]
    const sumRows = (sRes?.ok ? sRes.data : []) as SummaryRow[]
    const map: Record<number, SummaryRow> = {}
    for (const r of sumRows) map[r.student_id] = r
    summary.value = map
  } catch (e) {
    errMsg.value = e instanceof Error ? e.message : 'Erreur de chargement.'
  } finally {
    loading.value = false
  }
}

async function toggleStudent(studentId: number) {
  if (expandedStudentId.value === studentId) {
    expandedStudentId.value = null
    return
  }
  expandedStudentId.value = studentId
  if (!eventsByStudent.value[studentId]) {
    const res = await window.api.exam?.getEvents?.(travailId.value, studentId)
    eventsByStudent.value[studentId] = (res?.ok ? res.data : []) as Event[]
  }
  await nextTick()
  mountCode(studentId)
}

// ── CodeMirror read-only par etudiant ────────────────────────────────────
const editorRefs = ref<Record<number, HTMLDivElement | null>>({})
const editorViews: Record<number, EditorView> = {}
function mountCode(studentId: number) {
  const el = editorRefs.value[studentId]
  const depot = depots.value.find(d => d.student_id === studentId)
  if (!el || !depot) return
  if (editorViews[studentId]) return
  const state = EditorState.create({
    doc: depot.code_content ?? '',
    extensions: [
      lineNumbers(),
      python(),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.theme({
        '&': { height: '100%', fontSize: '13px' },
        '.cm-scroller': { fontFamily: 'ui-monospace, Menlo, Monaco, monospace' },
      }),
    ],
  })
  editorViews[studentId] = new EditorView({ state, parent: el })
}

watch(expandedStudentId, () => {
  // Cleanup des editeurs replies (evite les leaks si beaucoup d'etudiants)
  for (const sidStr of Object.keys(editorViews)) {
    const sid = Number(sidStr)
    if (sid !== expandedStudentId.value) {
      editorViews[sid]?.destroy()
      delete editorViews[sid]
    }
  }
})

// ── Notation ─────────────────────────────────────────────────────────────
const editingDepotId = ref<number | null>(null)
const noteInput      = ref('')
const feedbackInput  = ref('')
const saving         = ref(false)

function startEdit(depot: Depot) {
  editingDepotId.value = depot.id
  noteInput.value      = depot.note ?? ''
  feedbackInput.value  = depot.feedback ?? ''
}
async function saveGrade(depot: Depot) {
  saving.value = true
  try {
    if ((noteInput.value || '') !== (depot.note ?? '')) {
      await window.api.setNote({ depotId: depot.id, note: noteInput.value.trim() || null })
    }
    if ((feedbackInput.value || '') !== (depot.feedback ?? '')) {
      await window.api.setFeedback({ depotId: depot.id, feedback: feedbackInput.value.trim() || null })
    }
    depot.note     = noteInput.value.trim() || null
    depot.feedback = feedbackInput.value.trim() || null
    editingDepotId.value = null
    showToast('Note enregistree.', 'success')
  } catch (e) {
    showToast(e instanceof Error ? e.message : 'Echec enregistrement.', 'error')
  } finally {
    saving.value = false
  }
}

// ── Helpers UI ───────────────────────────────────────────────────────────
function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '?'
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60); const r = s % 60
  return `${m}m ${r.toString().padStart(2, '0')}s`
}
function formatDateTime(tsOrIso: number | string | null | undefined): string {
  if (tsOrIso == null) return '—'
  const d = typeof tsOrIso === 'number' ? new Date(tsOrIso) : new Date(tsOrIso)
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}
function eventDuration(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'durationMs' in payload) {
    return formatDuration(Number((payload as { durationMs: number }).durationMs))
  }
  return ''
}
function riskClass(s: SummaryRow | undefined): string {
  if (!s) return 'risk-none'
  const fl = s.focus_loss_count ?? 0
  const pb = s.paste_blocked_count ?? 0
  if (fl >= 5 || pb >= 3) return 'risk-high'
  if (fl >= 2 || pb >= 1) return 'risk-medium'
  return 'risk-low'
}

onMounted(load)
</script>

<template>
  <div class="exam-review">
    <header class="exam-review-header">
      <button class="btn-ghost" @click="router.back()"><ArrowLeft :size="14" /> Retour</button>
      <h1>Resultats - {{ travail?.title ?? 'Examen' }}</h1>
    </header>

    <div v-if="loading" class="exam-review-state">Chargement…</div>
    <div v-else-if="errMsg" class="exam-review-state exam-review-state--error">
      <AlertTriangle :size="18" /> {{ errMsg }}
    </div>
    <div v-else-if="depots.length === 0" class="exam-review-state">
      Aucun rendu pour cet examen.
    </div>
    <ul v-else class="exam-review-list">
      <li
        v-for="depot in depots" :key="depot.id"
        class="exam-review-row" :class="riskClass(summary[depot.student_id])"
      >
        <!-- En-tete cliquable -->
        <button type="button" class="exam-review-row-header" @click="toggleStudent(depot.student_id)">
          <span class="student-name">{{ depot.student_name }}</span>
          <span class="badges">
            <span v-if="summary[depot.student_id]?.timed_out_at" class="badge badge--timeout">
              <Clock :size="11" /> Temps ecoule
            </span>
            <span v-if="summary[depot.student_id]?.focus_loss_count" class="badge badge--focus">
              <EyeOff :size="11" /> {{ summary[depot.student_id].focus_loss_count }} sortie(s)
            </span>
            <span v-if="summary[depot.student_id]?.paste_blocked_count" class="badge badge--paste">
              <ClipboardX :size="11" /> {{ summary[depot.student_id].paste_blocked_count }} paste(s)
            </span>
            <span v-if="depot.note" class="badge badge--graded">Note : {{ depot.note }}</span>
          </span>
          <span class="submitted-at">Rendu : {{ formatDateTime(depot.submitted_at) }}</span>
        </button>

        <!-- Contenu deplie -->
        <div v-if="expandedStudentId === depot.student_id" class="exam-review-body">
          <!-- Code soumis -->
          <section class="exam-review-code-section">
            <h3>Code soumis</h3>
            <div
              :ref="(el) => editorRefs[depot.student_id] = (el as HTMLDivElement | null)"
              class="exam-review-code"
            />
          </section>

          <!-- Timeline + notation -->
          <section class="exam-review-side">
            <h3>Evenements</h3>
            <ul v-if="eventsByStudent[depot.student_id]?.length" class="exam-review-timeline">
              <li
                v-for="ev in eventsByStudent[depot.student_id]" :key="ev.id"
                class="exam-review-event" :class="`event--${ev.type}`"
              >
                <span class="event-ts">{{ formatDateTime(ev.ts) }}</span>
                <span class="event-type">{{ ev.type.replace(/_/g, ' ') }}</span>
                <span v-if="eventDuration(ev.payload)" class="event-dur">{{ eventDuration(ev.payload) }}</span>
              </li>
            </ul>
            <p v-else class="exam-review-empty">Aucun event suspect.</p>

            <h3 style="margin-top:18px">Notation</h3>
            <div v-if="editingDepotId === depot.id" class="exam-review-grade-edit">
              <input v-model="noteInput" type="text" maxlength="10" placeholder="Note (ex: A, B, 15/20)" class="exam-review-input" />
              <textarea v-model="feedbackInput" placeholder="Feedback (optionnel)" class="exam-review-input" rows="3" />
              <div class="exam-review-grade-actions">
                <button class="btn-ghost" :disabled="saving" @click="editingDepotId = null">Annuler</button>
                <button class="btn-primary" :disabled="saving" @click="saveGrade(depot)">
                  <Save :size="13" /> {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
                </button>
              </div>
            </div>
            <div v-else class="exam-review-grade-view">
              <p><strong>Note :</strong> {{ depot.note ?? 'Non notee' }}</p>
              <p v-if="depot.feedback"><strong>Feedback :</strong> {{ depot.feedback }}</p>
              <button class="btn-ghost" @click="startEdit(depot)">{{ depot.note ? 'Modifier' : 'Noter' }}</button>
            </div>
          </section>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.exam-review { max-width: 1100px; margin: 0 auto; padding: 24px; }
.exam-review-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.exam-review-header h1 { margin: 0; font-size: 18px; }
.exam-review-state { padding: 24px; text-align: center; color: var(--text-muted); }
.exam-review-state--error { color: var(--danger, #c33); display: flex; align-items: center; justify-content: center; gap: 8px; }

.exam-review-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.exam-review-row {
  border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--bg-elevated); overflow: hidden;
}
.exam-review-row.risk-medium { border-left: 3px solid #e6a23c; }
.exam-review-row.risk-high   { border-left: 3px solid #d33; }
.exam-review-row.risk-low    { border-left: 3px solid #67c23a; }
.exam-review-row.risk-none   { border-left: 3px solid var(--border); }

.exam-review-row-header {
  width: 100%; display: grid; grid-template-columns: minmax(180px, 1fr) auto auto;
  align-items: center; gap: 12px;
  padding: 12px 16px; background: none; border: none; cursor: pointer;
  text-align: left; font-family: var(--font); color: var(--text-primary);
}
.exam-review-row-header:hover { background: rgba(var(--accent-rgb), .04); }
.student-name { font-weight: 600; font-size: 14px; }
.badges { display: flex; gap: 6px; flex-wrap: wrap; }
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;
  background: rgba(0, 0, 0, .08);
}
.badge--focus   { background: rgba(230, 162, 60, .15);  color: #b07a18; }
.badge--paste   { background: rgba(220, 50, 50, .15);   color: #b32d2d; }
.badge--timeout { background: rgba(150, 150, 150, .2);  color: #555; }
.badge--graded  { background: rgba(var(--accent-rgb), .15); color: var(--accent); }
.submitted-at { font-size: 12px; color: var(--text-muted); }

.exam-review-body {
  display: grid; grid-template-columns: 1fr 320px; gap: 16px;
  padding: 12px 16px 16px; border-top: 1px solid var(--border);
}
.exam-review-code-section h3, .exam-review-side h3 { margin: 0 0 8px; font-size: 13px; }
.exam-review-code { height: 320px; border: 1px solid var(--border); border-radius: var(--radius-sm); }
.exam-review-code :deep(.cm-editor) { height: 100%; }

.exam-review-timeline { list-style: none; padding: 0; margin: 0; max-height: 180px; overflow-y: auto; }
.exam-review-event {
  display: grid; grid-template-columns: 110px 1fr auto; gap: 8px;
  padding: 4px 8px; font-size: 12px; border-bottom: 1px dashed var(--border);
}
.event--focus_loss    .event-type { color: #b07a18; }
.event--paste_blocked .event-type { color: #b32d2d; }
.event--exam_timeout  .event-type { color: #555; font-weight: 600; }
.event-ts { color: var(--text-muted); }
.event-dur { color: var(--text-muted); font-variant-numeric: tabular-nums; }
.exam-review-empty { font-size: 12px; color: var(--text-muted); font-style: italic; }

.exam-review-grade-edit, .exam-review-grade-view { display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.exam-review-input {
  padding: 8px 10px; border-radius: var(--radius-sm); font-size: 12.5px;
  border: 1px solid var(--border-input); background: var(--bg-input);
  color: var(--text-primary); font-family: var(--font);
}
.exam-review-grade-actions { display: flex; gap: 8px; justify-content: flex-end; }
</style>
