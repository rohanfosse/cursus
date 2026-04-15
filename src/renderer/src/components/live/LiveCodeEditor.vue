/**
 * LiveCodeEditor : editeur CodeMirror 6 prof qui diffuse son code en temps reel
 * via socket.IO vers les etudiants. Debounce 300ms. Sauvegarde snapshot a la fermeture.
 */
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { Code2, Copy, Check } from 'lucide-vue-next'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
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
  { value: 'python', label: 'Python' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'plaintext', label: 'Texte brut' },
]

const language = ref(props.initialLanguage || 'javascript')
const content = ref(props.initialContent || '')
const editorRef = ref<HTMLDivElement | null>(null)
const copied = ref(false)
let view: EditorView | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

/** Dynamic language pack loader */
async function getLanguageExt(lang: string) {
  try {
    switch (lang) {
      case 'javascript': return (await import('@codemirror/lang-javascript')).javascript()
      case 'python':     return (await import('@codemirror/lang-python')).python()
      case 'html':       return (await import('@codemirror/lang-html')).html()
      case 'css':        return (await import('@codemirror/lang-css')).css()
      case 'sql':        return (await import('@codemirror/lang-sql')).sql()
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
      langExt,
      EditorView.theme({
        '&': { fontSize: '14px', height: '100%' },
        '.cm-scroller': { fontFamily: 'Menlo, Monaco, Consolas, monospace', overflow: 'auto' },
        '.cm-content': { caretColor: 'var(--accent)' },
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
  // Recreate editor with new language pack
  if (view) {
    view.destroy()
    view = null
  }
  await initEditor()
  // Broadcast language change
  window.api.emitLiveCodeUpdate(props.activityId, props.promoId, content.value, newLang)
}

async function copyCode() {
  await navigator.clipboard.writeText(content.value)
  copied.value = true
  showToast('Code copie !', 'success')
  setTimeout(() => { copied.value = false }, 1500)
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
  <div class="lce-wrap">
    <div class="lce-toolbar">
      <Code2 :size="14" class="lce-icon" />
      <select v-model="language" class="lce-lang" @change="changeLanguage(language)">
        <option v-for="l in LANGUAGES" :key="l.value" :value="l.value">{{ l.label }}</option>
      </select>
      <span class="lce-broadcast">
        <span class="lce-dot" /> Diffusion en direct
      </span>
      <button class="lce-copy" :title="copied ? 'Copie !' : 'Copier'" @click="copyCode">
        <Check v-if="copied" :size="13" />
        <Copy v-else :size="13" />
      </button>
    </div>
    <div ref="editorRef" class="lce-editor" />
  </div>
</template>

<style scoped>
.lce-wrap {
  display: flex; flex-direction: column; height: 100%;
  border: 1px solid var(--border); border-radius: 10px;
  overflow: hidden; background: var(--bg-sidebar);
}
.lce-toolbar {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}
.lce-icon { color: var(--accent); flex-shrink: 0; }
.lce-lang {
  font-size: 12px; font-family: var(--font);
  background: var(--bg-input); color: var(--text-primary);
  border: 1px solid var(--border-input); border-radius: 6px;
  padding: 4px 8px; cursor: pointer; outline: none;
}
.lce-broadcast {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 600; color: var(--color-success);
  padding: 2px 8px; border-radius: 10px;
  background: rgba(39,174,96,.1); margin-left: auto;
}
.lce-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-success); animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }
.lce-copy {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); cursor: pointer; transition: all .15s;
}
.lce-copy:hover { color: var(--accent); border-color: var(--accent); }

.lce-editor {
  flex: 1; overflow: hidden; min-height: 300px;
}
.lce-editor :deep(.cm-editor) { height: 100%; }
.lce-editor :deep(.cm-editor.cm-focused) { outline: none; }
</style>
