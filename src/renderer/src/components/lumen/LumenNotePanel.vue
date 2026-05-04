<script setup lang="ts">
/**
 * Panneau "Mes notes" prive a un etudiant pour un chapitre Lumen.
 * Persiste automatiquement le contenu (debounce 1.5s) dans la table
 * lumen_chapter_notes. Identifie le chapitre par (repoId, path).
 *
 * Un seul etudiant voit sa propre note (aucune visibilite prof / pair).
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { NotebookPen, Trash2, Check, Loader2, AlertCircle, RotateCcw, Copy } from 'lucide-vue-next'
import { useLumenStore } from '@/stores/lumen'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { relativeTime } from '@/utils/date'

interface Props {
  repoId: number
  path: string
}
const props = defineProps<Props>()

const lumenStore = useLumenStore()
const { showToast } = useToast()
const { confirm: confirmDialog } = useConfirm()

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const draft       = ref<string>('')
const saveState   = ref<SaveState>('idle')
const lastSavedAt = ref<string | null>(null)
const initialized = ref(false)

const MAX_CHARS = 10_000
const WARN_THRESHOLD = 8_000
const nearLimit = computed(() => draft.value.length >= WARN_THRESHOLD)
const atLimit = computed(() => draft.value.length >= MAX_CHARS)

async function loadNote() {
  initialized.value = false
  const note = await lumenStore.fetchChapterNote(props.repoId, props.path)
  draft.value = note?.content ?? ''
  lastSavedAt.value = note?.updated_at ?? null
  initialized.value = true
}

onMounted(loadNote)
watch(() => [props.repoId, props.path], loadNote)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

// Contenu a sauvegarder en cas de retry (dernier draft avant echec)
let pendingContent: string | null = null

watch(draft, (newVal) => {
  if (!initialized.value) return
  if (newVal.length >= MAX_CHARS) {
    showToast('Limite de 10 000 caracteres atteinte', 'info')
    return
  }
  scheduleSave(newVal)
})

function scheduleSave(content: string) {
  if (debounceTimer) clearTimeout(debounceTimer)
  pendingContent = content
  saveState.value = 'saving'
  debounceTimer = setTimeout(() => doSave(content), 1500)
}

async function doSave(content: string) {
  try {
    await lumenStore.saveChapterNote(props.repoId, props.path, content)
    lastSavedAt.value = new Date().toISOString()
    pendingContent = null
    saveState.value = 'saved'
    setTimeout(() => {
      if (saveState.value === 'saved') saveState.value = 'idle'
    }, 1200)
  } catch {
    saveState.value = 'error'
  }
}

function retrySave() {
  if (pendingContent != null) {
    doSave(pendingContent)
  } else {
    doSave(draft.value)
  }
}

async function copyNotes() {
  try {
    await navigator.clipboard.writeText(draft.value)
    showToast('Notes copiees dans le presse-papiers', 'success')
  } catch {
    showToast('Impossible de copier', 'error')
  }
}

async function handleDelete() {
  if (!draft.value.trim() && !lastSavedAt.value) return
  if (!(await confirmDialog('Supprimer definitivement cette note ?', 'danger', 'Supprimer'))) return
  await lumenStore.deleteChapterNoteAction(props.repoId, props.path)
  draft.value = ''
  lastSavedAt.value = null
  saveState.value = 'idle'
  showToast('Note supprimee', 'info')
}
</script>

<template>
  <aside class="lumen-note-panel">
    <header class="lumen-note-head">
      <NotebookPen :size="14" />
      <span class="lumen-note-label">Mes notes</span>
      <span class="lumen-note-state" :class="`state-${saveState}`">
        <Loader2 v-if="saveState === 'saving'" :size="11" class="spin" />
        <Check v-else-if="saveState === 'saved'" :size="11" />
        <button
          v-else-if="saveState === 'error'"
          type="button"
          class="lumen-note-retry"
          title="Reessayer la sauvegarde"
          @click="retrySave"
        >
          <AlertCircle :size="11" /> Echec
          <RotateCcw :size="10" />
        </button>
        <template v-else-if="lastSavedAt">{{ relativeTime(lastSavedAt) }}</template>
      </span>
      <button
        v-if="draft.length > 0 || lastSavedAt"
        type="button"
        class="lumen-note-delete"
        title="Supprimer la note"
        @click="handleDelete"
      >
        <Trash2 :size="12" />
      </button>
    </header>

    <textarea
      v-model="draft"
      class="lumen-note-textarea"
      placeholder="Tes notes sur ce chapitre..."
      :maxlength="MAX_CHARS"
      spellcheck="true"
    />

    <footer class="lumen-note-foot">
      <button
        v-if="draft.length > 0"
        type="button"
        class="lumen-note-copy"
        title="Copier les notes"
        @click="copyNotes"
      >
        <Copy :size="10" /> Copier
      </button>
      <span class="lumen-note-count" :class="{ 'near-limit': nearLimit, 'at-limit': atLimit }">
        {{ draft.length }} / {{ MAX_CHARS }}
      </span>
    </footer>
  </aside>
</template>

<style scoped>
.lumen-note-panel {
  width: 320px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  background: var(--bg-sidebar, var(--bg-secondary));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* v2.275 : sous 1200px, l'outline (220) + notes (320) + body 760 max
   = 1300 minimum. On masque les notes pour rendre la lecture
   prioritaire. Le contenu des notes est toujours sauvegarde, juste
   non-visible (regression d'usage acceptable vs ecran serre).
   Cf. Notion qui hide la sidebar a <1000px. */
@media (max-width: 1200px) {
  .lumen-note-panel { display: none; }
}

.lumen-note-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}
.lumen-note-label { flex: 1; }

.lumen-note-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
}
.state-saving { color: var(--accent); }
.state-saved  { color: var(--success, #4caf50); }
.state-error  { color: var(--danger); }

.lumen-note-retry {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--danger);
  cursor: pointer;
  font-size: inherit;
  padding: 0;
}
.lumen-note-retry:hover { text-decoration: underline; }

.lumen-note-delete {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-xs);
}
.lumen-note-delete:hover { color: var(--danger); background: var(--bg-hover); }

.lumen-note-textarea {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.55;
  padding: 16px;
  transition: box-shadow var(--motion-fast) var(--ease-out);
}
.lumen-note-textarea:focus {
  box-shadow: inset 0 0 0 2px rgba(var(--accent-rgb), .35);
}

.lumen-note-foot {
  padding: 6px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.lumen-note-copy {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 3px;
  transition: color var(--t-fast) ease;
}
.lumen-note-copy:hover { color: var(--accent); }
.lumen-note-count {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  transition: color var(--t-fast) ease;
}
.lumen-note-count.near-limit { color: var(--warning, #f59e0b); font-weight: 600; }
.lumen-note-count.at-limit { color: var(--danger); font-weight: 700; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
