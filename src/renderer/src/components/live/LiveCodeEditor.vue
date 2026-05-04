/**
 * LiveCodeEditor : editeur CodeMirror 6 prof qui diffuse son code en temps reel
 * via socket.IO vers les etudiants. Debounce 300ms. Sauvegarde snapshot a la fermeture.
 */
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Code2, Copy, Check, Maximize2, Minimize2 } from 'lucide-vue-next'
import { EditorView } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { basicSetup } from 'codemirror'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  activityId: number
  promoId: number
  initialContent?: string | null
  initialLanguage?: string | null
}>()

const emit = defineEmits<{
  (e: 'content-change', content: string): void
  (e: 'language-change', lang: string): void
}>()

const { showToast } = useToast()

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'json', label: 'JSON' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C / C++' },
  { value: 'plaintext', label: 'Texte brut' },
]

const language = ref(props.initialLanguage || 'javascript')
const content = ref(props.initialContent || '')
const editorRef = ref<HTMLDivElement | null>(null)
const copied = ref(false)
const fullscreen = ref(false)
function toggleFullscreen() { fullscreen.value = !fullscreen.value }
let view: EditorView | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const langCompartment = new Compartment()

/** Dynamic language pack loader (CodeMirror). JSON, Java, C++ retombent en plaintext cote editeur
 *  mais restent colores cote viewer (highlight.js supporte tout). */
async function getLanguageExt(lang: string) {
  try {
    switch (lang) {
      case 'javascript': return (await import('@codemirror/lang-javascript')).javascript()
      case 'typescript': return (await import('@codemirror/lang-javascript')).javascript({ typescript: true })
      case 'python':     return (await import('@codemirror/lang-python')).python()
      case 'html':       return (await import('@codemirror/lang-html')).html()
      case 'css':        return (await import('@codemirror/lang-css')).css()
      case 'sql':        return (await import('@codemirror/lang-sql')).sql()
      case 'markdown':   return (await import('@codemirror/lang-markdown')).markdown()
      // java, cpp, json : pas de pack installe — editeur en plaintext, coloration uniquement cote viewer
      default: return []
    }
  } catch {
    return []
  }
}

function broadcast(text: string) {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    window.api.emitLiveCodeUpdate(props.activityId, props.promoId, text, language.value)
    emit('content-change', text)
  }, 300)
}

async function initEditor() {
  if (!editorRef.value) return
  const langExt = await getLanguageExt(language.value)

  const state = EditorState.create({
    doc: content.value,
    extensions: [
      basicSetup,
      langCompartment.of(langExt),
      EditorView.theme({
        '&': { fontSize: '14px', height: '100%', background: '#1e1e2e' },
        '.cm-scroller': { fontFamily: 'Menlo, Monaco, Consolas, monospace', overflow: 'auto' },
        '.cm-content': { caretColor: '#89b4fa', color: '#cdd6f4' },
        '.cm-cursor': { borderColor: '#89b4fa' },
        '.cm-activeLine': { background: 'rgba(137,180,250,.06)' },
        '.cm-gutters': { background: '#181825', color: '#6c7086', border: 'none' },
        '.cm-activeLineGutter': { background: 'rgba(137,180,250,.1)', color: '#89b4fa' },
        '.cm-selectionBackground': { background: 'rgba(137,180,250,.2) !important' },
        '&.cm-focused .cm-selectionBackground': { background: 'rgba(137,180,250,.25) !important' },
      }),
      EditorView.updateListener.of((upd) => {
        if (upd.docChanged) {
          const text = upd.state.doc.toString()
          content.value = text
          broadcast(text)
        }
      }),
    ],
  })
  view = new EditorView({ state, parent: editorRef.value })
}

async function changeLanguage(newLang: string) {
  language.value = newLang
  emit('language-change', newLang)
  // Swap language via compartment (preserves cursor, undo history)
  if (view) {
    const langExt = await getLanguageExt(newLang)
    view.dispatch({ effects: langCompartment.reconfigure(langExt) })
  }
  window.api.emitLiveCodeUpdate(props.activityId, props.promoId, content.value, newLang)
}

const lineCount = computed(() => content.value.split('\n').length)

async function copyCode() {
  try {
    await navigator.clipboard.writeText(content.value)
    copied.value = true
    showToast('Code copie !', 'success')
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    showToast('Impossible de copier', 'error')
  }
}

onMounted(() => { initEditor() })

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  view?.destroy()
})

watch(() => props.activityId, async () => {
  if (view) { view.destroy(); view = null }
  content.value = props.initialContent || ''
  language.value = props.initialLanguage || 'javascript'
  await initEditor()
})

// Exposer le contenu pour la sauvegarde du snapshot
defineExpose({ getContent: () => content.value, getLanguage: () => language.value })
</script>

<template>
  <div class="lce-wrap" :class="{ 'lce-fullscreen': fullscreen }">
    <div class="lce-toolbar">
      <Code2 :size="14" class="lce-icon" />
      <select v-model="language" class="lce-lang" @change="changeLanguage(language)">
        <option v-for="l in LANGUAGES" :key="l.value" :value="l.value">{{ l.label }}</option>
      </select>
      <span class="lce-broadcast">
        <span class="lce-dot" /> Diffusion en direct
      </span>
      <span class="lce-lines">{{ lineCount }} ligne{{ lineCount > 1 ? 's' : '' }}</span>
      <button class="lce-copy" :title="copied ? 'Copie !' : 'Copier'" @click="copyCode">
        <Check v-if="copied" :size="13" />
        <Copy v-else :size="13" />
      </button>
      <button class="lce-copy" :title="fullscreen ? 'Quitter plein ecran' : 'Plein ecran'" @click="toggleFullscreen">
        <Minimize2 v-if="fullscreen" :size="13" />
        <Maximize2 v-else :size="13" />
      </button>
    </div>
    <div ref="editorRef" class="lce-editor" />
  </div>
</template>

<style scoped>
.lce-wrap {
  display: flex; flex-direction: column; height: 100%;
  border: 1px solid var(--border); border-radius: var(--radius);
  overflow: hidden; background: var(--bg-sidebar);
}
.lce-wrap.lce-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  border-radius: 0;
  border: none;
}
.lce-toolbar {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}
.lce-icon { color: var(--live-code, var(--color-live)); flex-shrink: 0; }
.lce-lang {
  font-size: 12px; font-family: var(--font);
  background: var(--bg-input); color: var(--text-primary);
  border: 1px solid var(--border-input); border-radius: var(--radius-sm);
  padding: 4px 8px; cursor: pointer; outline: none;
}
.lce-broadcast {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 600; color: var(--color-success);
  padding: 2px 8px; border-radius: var(--radius);
  background: rgba(39,174,96,.1); margin-left: auto;
}
.lce-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-success); animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }
.lce-lines {
  font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums;
}
.lce-copy {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); cursor: pointer; transition: all .15s;
}
.lce-copy:hover {
  color: var(--live-code, var(--color-live));
  border-color: var(--live-code, var(--color-live));
}

.lce-editor {
  flex: 1; overflow: hidden; min-height: 300px;
}
.lce-editor :deep(.cm-editor) { height: 100%; }
.lce-editor :deep(.cm-editor.cm-focused) { outline: none; }
</style>
