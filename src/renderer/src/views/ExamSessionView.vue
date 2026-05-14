/**
 * ExamSessionView : interface plein ecran de passage d'examen surveille.
 *
 * Layout : enonce Markdown a gauche, editeur CodeMirror a droite, timer
 * en haut. Auto-save local (localStorage) toutes les 10s pour survivre
 * a un crash app. Soumission via /api/depots avec type='code'.
 *
 * Le verrouillage Electron (plein ecran force, paste bloque, focus loss
 * logue) est branche par le commit suivant via window.api.exam.*. Cette
 * vue tente d'appeler ces APIs si elles existent, sinon no-op (graceful).
 */
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import { Lock, Clock, Send, AlertTriangle } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app'

const route  = useRoute()
const router = useRouter()
const { showToast } = useToast()
const appStore = useAppStore()

const travailId = computed(() => Number(route.params.travailId))

// ── Etat ─────────────────────────────────────────────────────────────────
type Phase = 'loading' | 'ready' | 'in_progress' | 'submitted' | 'timeout' | 'error'

interface Travail {
  id: number
  title: string
  description: string | null
  starter_code: string | null
  exam_mode: number
  deadline: string
  duration_min?: number | null
}

const phase   = ref<Phase>('loading')
const travail = ref<Travail | null>(null)
const errMsg  = ref('')
const code    = ref('')
const startedAtMs   = ref<number | null>(null)
const durationMs    = ref<number>(60 * 60_000) // fallback : 1h si pas de duree dans la description
const now           = ref<number>(Date.now())

let nowTimer:  ReturnType<typeof setInterval> | null = null
let saveTimer: ReturnType<typeof setInterval> | null = null

const elapsedMs       = computed(() => startedAtMs.value ? now.value - startedAtMs.value : 0)
const timeRemainingMs = computed(() => Math.max(0, durationMs.value - elapsedMs.value))
const isExpired       = computed(() => phase.value === 'in_progress' && timeRemainingMs.value === 0)

const timerLabel = computed(() => {
  const s = Math.ceil(timeRemainingMs.value / 1000)
  const m = Math.floor(s / 60); const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
})
const timerCritical = computed(() => timeRemainingMs.value > 0 && timeRemainingMs.value < 60_000) // < 1min

const descriptionHtml = computed(() => {
  if (!travail.value?.description) return ''
  // marked() peut etre sync ou async selon les versions ; on force sync.
  const html = marked.parse(travail.value.description, { async: false }) as string
  return html
})

// ── CodeMirror ───────────────────────────────────────────────────────────
const editorEl = ref<HTMLDivElement | null>(null)
const editorView = shallowRef<EditorView | null>(null)

function mountEditor(initialContent: string) {
  if (!editorEl.value) return
  const state = EditorState.create({
    doc: initialContent,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      python(),
      EditorView.updateListener.of((v) => {
        if (v.docChanged) code.value = v.state.doc.toString()
      }),
      EditorView.theme({
        '&': { height: '100%', fontSize: '13.5px' },
        '.cm-scroller': { fontFamily: 'ui-monospace, Menlo, Monaco, monospace' },
      }),
    ],
  })
  editorView.value = new EditorView({ state, parent: editorEl.value })
}

// ── Persistance locale (anti-crash) ──────────────────────────────────────
const draftKey = computed(() => `cursus.exam.draft.${travailId.value}.${appStore.currentUser?.id ?? 'anon'}`)
const stateKey = computed(() => `cursus.exam.state.${travailId.value}.${appStore.currentUser?.id ?? 'anon'}`)

function loadLocalDraft(): string | null {
  try { return localStorage.getItem(draftKey.value) } catch { return null }
}
function saveLocalDraft() {
  try { localStorage.setItem(draftKey.value, code.value) } catch { /* quota */ }
}
function loadLocalState(): { startedAtMs: number } | null {
  try {
    const raw = localStorage.getItem(stateKey.value)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function saveLocalState() {
  try {
    if (startedAtMs.value) localStorage.setItem(stateKey.value, JSON.stringify({ startedAtMs: startedAtMs.value }))
  } catch { /* quota */ }
}
function clearLocalState() {
  try { localStorage.removeItem(draftKey.value); localStorage.removeItem(stateKey.value) } catch { /* */ }
}

// ── Parsing de la duree depuis la description ────────────────────────────
// MVP : "Duree : 20 min" est dans la description auto-generee (cf.
// NewDevoirModal.buildDescription). On parse au regex. En v2, une colonne
// duration_min dediee evitera la fragilite.
function parseDurationFromDescription(desc: string | null): number {
  if (!desc) return 60 * 60_000
  const m = desc.match(/Dur[ée]e\s*:\s*(\d+)\s*min/i)
  if (m) return Number(m[1]) * 60_000
  return 60 * 60_000
}

// ── API ──────────────────────────────────────────────────────────────────
async function loadTravail() {
  try {
    const res = await window.api.getTravailById(travailId.value)
    if (!res?.ok || !res.data) {
      phase.value = 'error'; errMsg.value = 'Devoir introuvable.'
      return
    }
    const t = res.data as Travail
    if (!t.exam_mode) {
      phase.value = 'error'; errMsg.value = "Ce devoir n'est pas un examen surveille."
      return
    }
    travail.value = t
    durationMs.value = t.duration_min ? t.duration_min * 60_000 : parseDurationFromDescription(t.description)
    phase.value = 'ready'
  } catch (e) {
    phase.value = 'error'; errMsg.value = (e instanceof Error ? e.message : 'Erreur de chargement.')
  }
}

async function startExam() {
  if (phase.value !== 'ready' || !travail.value) return
  // Reprise apres crash : si on a un state local pour ce travail+user, on reprend.
  const prevState = loadLocalState()
  const prevDraft = loadLocalDraft()
  const isRecovery = prevState && prevDraft != null
  startedAtMs.value = prevState?.startedAtMs ?? Date.now()
  const initial = isRecovery ? prevDraft : (travail.value.starter_code ?? '')
  code.value = initial
  mountEditor(initial)
  saveLocalState()
  phase.value = 'in_progress'
  // Verrouillage Electron (commit suivant) ; no-op si l'API n'existe pas encore.
  try { await window.api?.exam?.enterKiosk?.(travailId.value) } catch { /* */ }
  // Log de l'event "start" cote serveur (commit 5) ; no-op si endpoint absent.
  try {
    await window.api?.exam?.logEvent?.({
      travailId: travailId.value,
      type:      isRecovery ? 'crash_recovered' : 'exam_start',
      ts:        Date.now(),
      payload:   isRecovery ? { resumedFromMs: startedAtMs.value } : null,
    })
  } catch { /* */ }
}

async function submitExam(reason: 'manual' | 'timeout' = 'manual') {
  if (phase.value !== 'in_progress' || !travail.value) return
  // Stop timers tout de suite pour ne pas double-soumettre si le user clique 2x.
  if (saveTimer) clearInterval(saveTimer); saveTimer = null
  saveLocalDraft()
  try {
    const res = await window.api.addDepot({
      travail_id: travail.value.id,
      student_id: appStore.currentUser?.id,
      type:       'code',
      content:    code.value,
      file_name:  travail.value.title,
    })
    if (!res?.ok) throw new Error(res?.error ?? 'Echec de la soumission.')
    try {
      await window.api?.exam?.logEvent?.({
        travailId: travail.value.id,
        type:      reason === 'timeout' ? 'exam_timeout' : 'exam_submit',
        ts:        Date.now(),
        payload:   { codeLength: code.value.length },
      })
    } catch { /* */ }
    phase.value = reason === 'timeout' ? 'timeout' : 'submitted'
    clearLocalState()
    try { await window.api?.exam?.exitKiosk?.() } catch { /* */ }
    showToast(reason === 'timeout' ? 'Temps ecoule — code soumis automatiquement.' : 'Examen soumis.', 'success')
  } catch (e) {
    showToast((e instanceof Error ? e.message : 'Echec de la soumission.'), 'error')
    // On reactive le timer de sauvegarde si la submission rate (l'etudiant peut retenter).
    saveTimer = setInterval(saveLocalDraft, 10_000)
  }
}

function leaveExam() {
  if (phase.value === 'submitted' || phase.value === 'timeout') {
    router.replace({ name: 'devoirs' })
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadTravail()
  nowTimer  = setInterval(() => {
    now.value = Date.now()
    if (isExpired.value) void submitExam('timeout')
  }, 1000)
  saveTimer = setInterval(saveLocalDraft, 10_000)
})

onBeforeUnmount(() => {
  if (nowTimer)  clearInterval(nowTimer)
  if (saveTimer) clearInterval(saveTimer)
  editorView.value?.destroy()
  // Si l'etudiant quitte la vue sans soumettre (ferme l'app), on garde le state
  // local pour reprise au prochain mount. clearLocalState n'est appele qu'apres
  // submit reussi.
  try { void window.api?.exam?.exitKiosk?.() } catch { /* */ }
})
</script>

<template>
  <div class="exam-shell">
    <!-- ── Loading / Error ───────────────────────────────────────────── -->
    <div v-if="phase === 'loading'" class="exam-state">Chargement de l'examen…</div>

    <div v-else-if="phase === 'error'" class="exam-state exam-state--error">
      <AlertTriangle :size="24" />
      <p>{{ errMsg || 'Erreur inattendue.' }}</p>
      <button class="btn-primary" @click="router.replace({ name: 'devoirs' })">Retour</button>
    </div>

    <!-- ── Brief / Ready ─────────────────────────────────────────────── -->
    <div v-else-if="phase === 'ready'" class="exam-brief">
      <h1 class="exam-brief-title">
        <Lock :size="18" /> {{ travail?.title }}
      </h1>
      <div class="exam-brief-meta">
        <span><Clock :size="13" /> {{ Math.round(durationMs / 60_000) }} min</span>
      </div>
      <div class="exam-brief-rules">
        <p><strong>Avant de commencer :</strong></p>
        <ul>
          <li>Une fois demarre, l'app passe en plein ecran verrouille.</li>
          <li>Le copier-coller depuis une autre application est bloque.</li>
          <li>Toute sortie du focus (Alt+Tab, autre fenetre) sera enregistree.</li>
          <li>Le code est sauvegarde localement toutes les 10s : si l'app crashe, tu pourras reprendre.</li>
          <li>A la fin du chrono, le code est soumis automatiquement.</li>
        </ul>
      </div>
      <button class="btn-primary exam-brief-start" @click="startExam">
        Demarrer l'examen
      </button>
    </div>

    <!-- ── In progress ───────────────────────────────────────────────── -->
    <div v-else-if="phase === 'in_progress'" class="exam-grid">
      <header class="exam-header">
        <div class="exam-title"><Lock :size="14" /> {{ travail?.title }}</div>
        <div class="exam-timer" :class="{ critical: timerCritical }">
          <Clock :size="14" /> {{ timerLabel }}
        </div>
        <button class="btn-primary exam-submit" @click="submitExam('manual')">
          <Send :size="14" /> Soumettre
        </button>
      </header>

      <section class="exam-statement">
        <div class="exam-statement-body" v-html="descriptionHtml" />
      </section>

      <section class="exam-editor">
        <div ref="editorEl" class="exam-editor-cm" />
      </section>
    </div>

    <!-- ── Submitted / Timeout ───────────────────────────────────────── -->
    <div v-else class="exam-state exam-state--ok">
      <p v-if="phase === 'timeout'">⏱ Temps ecoule. Ton code a ete soumis automatiquement.</p>
      <p v-else>✓ Examen soumis. Ton enseignant pourra le consulter.</p>
      <button class="btn-primary" @click="leaveExam">Retour aux devoirs</button>
    </div>
  </div>
</template>

<style scoped>
.exam-shell {
  position: fixed; inset: 0;
  background: var(--bg-app);
  color: var(--text-primary);
  display: flex; flex-direction: column;
  z-index: 9000;
}

.exam-state {
  margin: auto; display: flex; flex-direction: column;
  align-items: center; gap: 16px; padding: 32px;
}
.exam-state--error { color: var(--danger, #c33); }

/* Brief */
.exam-brief {
  max-width: 640px; margin: auto;
  display: flex; flex-direction: column; gap: 16px;
  padding: 32px; background: var(--bg-elevated);
  border-radius: var(--radius); border: 1px solid var(--border);
}
.exam-brief-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 20px; }
.exam-brief-meta  { display: flex; gap: 16px; font-size: 13px; color: var(--text-muted); }
.exam-brief-rules ul { margin: 8px 0 0; padding-left: 20px; line-height: 1.7; font-size: 13.5px; }
.exam-brief-start { align-self: flex-start; padding: 10px 20px; font-size: 14px; }

/* Grid in progress */
.exam-grid {
  display: grid;
  grid-template-rows: 48px 1fr;
  grid-template-columns: minmax(280px, 38%) 1fr;
  height: 100%;
}
.exam-header {
  grid-column: 1 / -1;
  display: flex; align-items: center; gap: 16px;
  padding: 0 16px; background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}
.exam-title { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 14px; }
.exam-timer {
  margin-left: auto;
  display: flex; align-items: center; gap: 6px;
  font-variant-numeric: tabular-nums; font-weight: 600;
  padding: 6px 12px; border-radius: var(--radius-sm);
  background: rgba(var(--accent-rgb), .08);
}
.exam-timer.critical { background: rgba(220, 50, 50, .15); color: #d33; }
.exam-submit { display: inline-flex; align-items: center; gap: 6px; }

.exam-statement {
  overflow: auto; padding: 16px 20px;
  border-right: 1px solid var(--border);
  background: var(--bg-elevated);
}
.exam-statement-body { line-height: 1.7; font-size: 14px; }
.exam-statement-body :deep(pre) {
  padding: 10px 12px; border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, .25);
  font-family: ui-monospace, Menlo, Monaco, monospace; font-size: 12.5px;
  overflow-x: auto;
}
.exam-statement-body :deep(code) {
  font-family: ui-monospace, Menlo, Monaco, monospace; font-size: 12.5px;
}

.exam-editor { display: flex; flex-direction: column; min-height: 0; }
.exam-editor-cm { flex: 1; min-height: 0; }
.exam-editor-cm :deep(.cm-editor) { height: 100%; }
</style>
