<script setup lang="ts">
/**
 * Viewer single-file pour un fichier du snapshot. Charge le contenu via
 * le store (cache), detecte binary vs text, et applique highlight.js pour
 * la coloration syntaxique basee sur l'extension. Lazy : n'affiche rien
 * tant qu'aucun path n'est passe.
 */
import { ref, computed, watch } from 'vue'
import { FileText, Copy, Check, AlertCircle, Loader2, Download } from 'lucide-vue-next'
import hljs from 'highlight.js'
import { useLumenStore } from '@/stores/lumen'
import { useToast } from '@/composables/useToast'
import { formatBytes } from '@/utils/format'

interface Props {
  courseId: number
  path: string | null
}
const props = defineProps<Props>()

const lumenStore = useLumenStore()
const { showToast } = useToast()

type State = 'idle' | 'loading' | 'text' | 'binary' | 'error'
const state   = ref<State>('idle')
const content = ref<string>('')
const fileSize = ref<number>(0)

// ── Mapping extension → langage hljs ──────────────────────────────────────
const LANG_MAP: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  jsx: 'javascript',
  py: 'python',
  rb: 'ruby',
  java: 'java',
  c: 'c', h: 'c',
  cpp: 'cpp', cc: 'cpp', hpp: 'cpp',
  cs: 'csharp',
  go: 'go',
  rs: 'rust',
  php: 'php',
  kt: 'kotlin',
  swift: 'swift',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  json: 'json',
  yaml: 'yaml', yml: 'yaml',
  toml: 'ini',
  html: 'xml', xml: 'xml', svg: 'xml',
  css: 'css', scss: 'scss', less: 'less',
  sql: 'sql',
  md: 'markdown', markdown: 'markdown',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  vue: 'xml', svelte: 'xml',
}

function extFromPath(path: string): string {
  const name = path.split('/').pop() ?? ''
  if (name.toLowerCase() === 'dockerfile') return 'dockerfile'
  if (name.toLowerCase() === 'makefile') return 'makefile'
  return name.split('.').pop()?.toLowerCase() ?? ''
}

// HTML mis en cache pour eviter de re-highlight au hover/re-render.
const highlightedHtml = ref<string>('')

async function load(path: string) {
  state.value = 'loading'
  content.value = ''
  highlightedHtml.value = ''
  try {
    const entry = await lumenStore.fetchFileContent(props.courseId, path)
    if (!entry) {
      state.value = 'error'
      return
    }
    fileSize.value = entry.size
    if (entry.binary) {
      state.value = 'binary'
      return
    }
    content.value = entry.text
    // Highlight.js fallback sur highlightAuto si l'extension est inconnue
    const ext = extFromPath(path)
    const lang = LANG_MAP[ext]
    let html: string
    if (lang && hljs.getLanguage(lang)) {
      html = hljs.highlight(entry.text, { language: lang, ignoreIllegals: true }).value
    } else {
      html = hljs.highlightAuto(entry.text).value
    }
    highlightedHtml.value = html
    state.value = 'text'
  } catch {
    state.value = 'error'
  }
}

watch(
  () => props.path,
  (newPath) => {
    if (!newPath) {
      state.value = 'idle'
      content.value = ''
      highlightedHtml.value = ''
      return
    }
    load(newPath)
  },
  { immediate: true },
)

// ── Lignes numerotees (decoupe sur \n apres highlight) ───────────────────
// Highlight.js retourne du HTML — on split sur \n literal, ce qui preserve
// les tags span ouverts/fermes ligne par ligne. Pour les cas pathologiques
// (span qui enjambe plusieurs lignes), le rendu reste correct visuellement
// car chaque ligne referme implicitement ses tags au bord du <pre>.
const codeLines = computed<string[]>(() => {
  if (state.value !== 'text') return []
  // Si highlightedHtml est vide (cas tres court), fallback sur le texte brut
  const src = highlightedHtml.value || escapeHtml(content.value)
  return src.split('\n')
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]!))
}

// ── Copy contenu ──────────────────────────────────────────────────────────
const justCopied = ref(false)
async function copyContent() {
  if (state.value !== 'text') return
  try {
    await navigator.clipboard.writeText(content.value)
    justCopied.value = true
    setTimeout(() => { justCopied.value = false }, 1500)
  } catch {
    showToast('Copie echouee', 'error')
  }
}

const formatSize = formatBytes
</script>

<template>
  <div class="viewer">
    <!-- Header : path + actions -->
    <header v-if="path" class="viewer-head">
      <FileText :size="13" class="viewer-head-icon" />
      <span class="viewer-head-path" :title="path">{{ path }}</span>
      <span class="viewer-head-size">{{ formatSize(fileSize) }}</span>
      <button
        v-if="state === 'text'"
        type="button"
        class="viewer-copy-btn"
        :title="justCopied ? 'Copie' : 'Copier le contenu'"
        :aria-label="justCopied ? 'Contenu copie' : 'Copier le contenu du fichier'"
        @click="copyContent"
      >
        <Check v-if="justCopied" :size="13" />
        <Copy v-else :size="13" />
      </button>
    </header>

    <!-- Corps -->
    <div class="viewer-body">
      <!-- Empty state : aucun fichier selectionne -->
      <div v-if="state === 'idle'" class="viewer-empty">
        <FileText :size="28" class="viewer-empty-icon" />
        <p>Clique sur un fichier dans l'arborescence pour voir son contenu.</p>
      </div>

      <!-- Loading -->
      <div v-else-if="state === 'loading'" class="viewer-loading">
        <Loader2 :size="18" class="viewer-spinner" />
        <span>Chargement…</span>
      </div>

      <!-- Erreur -->
      <div v-else-if="state === 'error'" class="viewer-error">
        <AlertCircle :size="18" />
        <span>Impossible de charger le fichier.</span>
      </div>

      <!-- Fichier binaire -->
      <div v-else-if="state === 'binary'" class="viewer-binary">
        <Download :size="28" class="viewer-binary-icon" />
        <p>Fichier binaire — telecharge le zip pour le recuperer.</p>
        <p class="viewer-binary-meta">{{ formatSize(fileSize) }}</p>
      </div>

      <!-- Texte avec numeros de ligne et coloration -->
      <div v-else-if="state === 'text'" class="viewer-code-wrap">
        <pre class="viewer-code"><code class="hljs"><span
          v-for="(line, i) in codeLines"
          :key="i"
          class="viewer-code-line"
        ><span class="viewer-code-ln">{{ i + 1 }}</span><span class="viewer-code-content" v-html="line || ' '" /></span></code></pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.viewer {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-input);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.viewer-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-secondary);
}
.viewer-head-icon { color: var(--text-muted); flex-shrink: 0; }
.viewer-head-path {
  flex: 1;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  direction: rtl; /* ellipsize en debut de chemin pour garder le nom */
  text-align: left;
}
.viewer-head-size {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.viewer-copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 120ms ease;
}
.viewer-copy-btn:hover { color: var(--accent); background: var(--bg-hover); }

.viewer-body {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.viewer-empty, .viewer-loading, .viewer-error, .viewer-binary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px 20px;
  color: var(--text-muted);
  text-align: center;
  font-size: 13px;
  min-height: 140px;
}
.viewer-empty-icon, .viewer-binary-icon { opacity: 0.4; }
.viewer-binary-meta { font-size: 11px; font-variant-numeric: tabular-nums; opacity: 0.6; }

.viewer-spinner { animation: viewer-spin 0.8s linear infinite; }
@keyframes viewer-spin { to { transform: rotate(360deg); } }

.viewer-error { color: var(--color-danger, #d9534f); }

/* ── Code display ─────────────────────────────────────────────────────── */
.viewer-code-wrap { display: flex; min-height: 0; }
.viewer-code {
  margin: 0;
  padding: 0;
  flex: 1;
  min-width: 0;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13px;
  line-height: 1.55;
  background: transparent;
  overflow-x: auto;
}
.viewer-code :deep(code.hljs) {
  display: block;
  padding: 8px 0;
  background: transparent;
}
.viewer-code-line {
  display: flex;
  align-items: flex-start;
  white-space: pre;
}
.viewer-code-line:hover { background: var(--bg-hover); }
.viewer-code-ln {
  flex-shrink: 0;
  display: inline-block;
  width: 48px;
  padding: 0 10px 0 0;
  text-align: right;
  color: var(--text-muted);
  opacity: 0.55;
  font-size: 11px;
  user-select: none;
  border-right: 1px solid var(--border);
  margin-right: 12px;
  line-height: inherit;
}
.viewer-code-content {
  display: inline-block;
  flex: 1;
  min-width: 0;
}

@media (prefers-reduced-motion: reduce) {
  .viewer-spinner { animation: none; }
}
</style>
