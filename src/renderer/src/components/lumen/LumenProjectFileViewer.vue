<script setup lang="ts">
/**
 * Viewer single-file pour un fichier du snapshot. Charge le contenu via
 * le store (cache), detecte binary vs text, et applique highlight.js pour
 * la coloration syntaxique basee sur l'extension. Lazy : n'affiche rien
 * tant qu'aucun path n'est passe.
 */
import { ref, computed, watch, nextTick, onBeforeUnmount, onMounted } from 'vue'
import { FileText, Copy, Check, AlertCircle, Loader2, Download, FileCode, Eye, Search, X, ChevronUp, ChevronDown } from 'lucide-vue-next'
import hljs from 'highlight.js'
import { useLumenStore } from '@/stores/lumen'
import { useToast } from '@/composables/useToast'
import { formatBytes } from '@/utils/format'
import { renderMarkdown } from '@/utils/markdown'

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

// Toggle markdown : quand on ouvre un .md, on affiche le rendu par defaut
// (plus lisible pour un README). Un bouton permet de basculer vers le
// source brut pour voir la syntaxe markdown.
const renderMarkdownPreview = ref<boolean>(false)
const isMarkdown = computed(() => {
  if (!props.path) return false
  const ext = extFromPath(props.path)
  return ext === 'md' || ext === 'markdown'
})
const renderedMarkdownHtml = computed(() => {
  if (!isMarkdown.value || state.value !== 'text') return ''
  return renderMarkdown(content.value)
})

// Breadcrumb : segments du chemin pour affichage dans le header.
const breadcrumb = computed<string[]>(() => {
  if (!props.path) return []
  return props.path.split('/').filter(Boolean)
})

// Nombre de lignes dans le fichier texte (affiche dans le header)
const lineCount = computed<number | null>(() => {
  if (state.value !== 'text') return null
  return content.value.split('\n').length
})

// ── In-file search (Ctrl+F) ──────────────────────────────────────────────
const searchBarOpen = ref(false)
const fileSearchQuery = ref('')
const fileSearchInputRef = ref<HTMLInputElement | null>(null)
const rootElRef = ref<HTMLElement | null>(null)

/**
 * Indices de lignes (1-based) qui matchent la requete courante.
 * Recalcule automatiquement sur changement de query ou de contenu.
 */
const fileSearchMatches = computed<number[]>(() => {
  const q = fileSearchQuery.value.trim()
  if (!q || state.value !== 'text') return []
  const lower = q.toLowerCase()
  const matches: number[] = []
  // Scan sur le texte brut (pas sur le HTML colorise) — plus simple
  const lines = content.value.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(lower)) matches.push(i + 1)
  }
  return matches
})
const currentMatchIndex = ref(0)

function openFileSearch() {
  if (state.value !== 'text') return
  searchBarOpen.value = true
  currentMatchIndex.value = 0
  nextTick(() => fileSearchInputRef.value?.focus())
}
function closeFileSearch() {
  searchBarOpen.value = false
  fileSearchQuery.value = ''
  currentMatchIndex.value = 0
}
function nextMatch() {
  if (fileSearchMatches.value.length === 0) return
  currentMatchIndex.value = (currentMatchIndex.value + 1) % fileSearchMatches.value.length
  scrollToCurrentMatch()
}
function prevMatch() {
  if (fileSearchMatches.value.length === 0) return
  const len = fileSearchMatches.value.length
  currentMatchIndex.value = (currentMatchIndex.value - 1 + len) % len
  scrollToCurrentMatch()
}
function scrollToCurrentMatch() {
  nextTick(() => {
    const line = fileSearchMatches.value[currentMatchIndex.value]
    if (!line || !rootElRef.value) return
    const el = rootElRef.value.querySelector<HTMLElement>(`[data-line="${line}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

function onFileSearchKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); closeFileSearch() }
  else if (e.key === 'Enter') {
    e.preventDefault()
    if (e.shiftKey) prevMatch(); else nextMatch()
  }
}

// Reset search index quand on change de fichier
watch(() => props.path, () => {
  if (searchBarOpen.value) closeFileSearch()
})

// Raccourci global Ctrl+F / Cmd+F : ouvre la search bar uniquement si le
// focus est dans le viewer (ne casse pas le Ctrl+F navigateur ailleurs).
function onGlobalKey(e: KeyboardEvent) {
  const isFind = (e.key === 'f' || e.key === 'F') && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey
  if (!isFind || !rootElRef.value) return
  const active = document.activeElement
  if (active instanceof Node && !rootElRef.value.contains(active)) return
  e.preventDefault()
  openFileSearch()
}
onMounted(() => { window.addEventListener('keydown', onGlobalKey) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onGlobalKey) })

// Marqueur sur la ligne active du match (pour style CSS)
const currentMatchLine = computed(() => fileSearchMatches.value[currentMatchIndex.value] ?? null)

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
    // Par defaut, rendu markdown active sur les .md pour un meilleur
    // onboarding du README ; l'utilisateur peut basculer via le toggle.
    const ext = extFromPath(newPath)
    renderMarkdownPreview.value = ext === 'md' || ext === 'markdown'
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
  <div ref="rootElRef" class="viewer" tabindex="-1">
    <!-- Header : breadcrumb + actions -->
    <header v-if="path" class="viewer-head">
      <FileText :size="13" class="viewer-head-icon" />
      <nav class="viewer-head-breadcrumb" :aria-label="`Chemin du fichier : ${path}`">
        <span
          v-for="(seg, i) in breadcrumb"
          :key="i"
          class="viewer-head-seg"
          :class="{ 'viewer-head-seg--last': i === breadcrumb.length - 1 }"
        >
          <span class="viewer-head-seg-label">{{ seg }}</span>
          <span v-if="i < breadcrumb.length - 1" class="viewer-head-sep">/</span>
        </span>
      </nav>
      <span class="viewer-head-size">
        <span v-if="lineCount !== null">{{ lineCount }} L ·</span>
        {{ formatSize(fileSize) }}
      </span>
      <button
        v-if="isMarkdown && state === 'text'"
        type="button"
        class="viewer-copy-btn viewer-md-toggle"
        :title="renderMarkdownPreview ? 'Voir la source markdown' : 'Voir le rendu markdown'"
        :aria-label="renderMarkdownPreview ? 'Afficher la source' : 'Afficher le rendu'"
        :aria-pressed="renderMarkdownPreview"
        @click="renderMarkdownPreview = !renderMarkdownPreview"
      >
        <FileCode v-if="renderMarkdownPreview" :size="13" />
        <Eye v-else :size="13" />
      </button>
      <button
        v-if="state === 'text' && !isMarkdown || (isMarkdown && !renderMarkdownPreview)"
        type="button"
        class="viewer-copy-btn"
        title="Rechercher dans le fichier (Ctrl+F)"
        aria-label="Rechercher dans le fichier"
        @click="openFileSearch"
      >
        <Search :size="13" />
      </button>
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

    <!-- Barre de recherche in-file -->
    <div v-if="searchBarOpen" class="viewer-search">
      <Search :size="12" class="viewer-search-icon" />
      <input
        ref="fileSearchInputRef"
        v-model="fileSearchQuery"
        type="text"
        class="viewer-search-input"
        placeholder="Rechercher dans le fichier…"
        aria-label="Rechercher dans le fichier"
        @keydown="onFileSearchKey"
      />
      <span class="viewer-search-count" v-if="fileSearchQuery">
        {{ fileSearchMatches.length === 0 ? 'Aucun resultat' : `${currentMatchIndex + 1} / ${fileSearchMatches.length}` }}
      </span>
      <button type="button" class="viewer-search-btn" title="Precedent (Shift+Enter)" aria-label="Match precedent" :disabled="fileSearchMatches.length === 0" @click="prevMatch">
        <ChevronUp :size="13" />
      </button>
      <button type="button" class="viewer-search-btn" title="Suivant (Enter)" aria-label="Match suivant" :disabled="fileSearchMatches.length === 0" @click="nextMatch">
        <ChevronDown :size="13" />
      </button>
      <button type="button" class="viewer-search-btn" title="Fermer (Esc)" aria-label="Fermer la recherche" @click="closeFileSearch">
        <X :size="13" />
      </button>
    </div>

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

      <!-- Markdown rendu : priorite sur le code source pour les .md -->
      <div
        v-else-if="state === 'text' && isMarkdown && renderMarkdownPreview"
        class="viewer-md"
        v-html="renderedMarkdownHtml"
      />

      <!-- Texte avec numeros de ligne et coloration -->
      <div v-else-if="state === 'text'" class="viewer-code-wrap">
        <pre class="viewer-code"><code class="hljs"><span
          v-for="(line, i) in codeLines"
          :key="i"
          class="viewer-code-line"
          :class="{
            'viewer-code-line--match': fileSearchMatches.includes(i + 1),
            'viewer-code-line--current': currentMatchLine === i + 1,
          }"
          :data-line="i + 1"
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

/* Breadcrumb : segments du chemin avec separateur /.
 * Regles de troncature : les dossiers intermediaires peuvent etre
 * tronques (flex-shrink: 1 + min-width: 0) mais le nom de fichier
 * (viewer-head-seg--last) reste toujours entier (flex-shrink: 0).
 * Lecture naturelle gauche→droite, pas de RTL. */
.viewer-head-breadcrumb {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  overflow: hidden;
  white-space: nowrap;
}
.viewer-head-seg {
  display: inline-flex;
  align-items: center;
  color: var(--text-muted);
  flex-shrink: 1;
  min-width: 0;
}
.viewer-head-seg-label {
  overflow: hidden;
  text-overflow: ellipsis;
}
.viewer-head-seg--last {
  flex-shrink: 0;  /* Nom de fichier : jamais tronque */
}
.viewer-head-seg--last .viewer-head-seg-label {
  color: var(--text-primary);
  font-weight: 600;
}
.viewer-head-sep {
  margin: 0 5px;
  color: var(--text-muted);
  opacity: 0.5;
  flex-shrink: 0;
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
.viewer-md-toggle[aria-pressed="true"] { color: var(--accent); }

/* Barre de recherche in-file */
.viewer-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}
.viewer-search-icon { color: var(--text-muted); flex-shrink: 0; }
.viewer-search-input {
  flex: 1;
  background: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: 4px;
  padding: 4px 8px;
  font-family: inherit;
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
}
.viewer-search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-subtle); }
.viewer-search-count {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 70px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.viewer-search-btn {
  background: none;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 3px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 120ms ease;
}
.viewer-search-btn:hover:not(:disabled) { color: var(--accent); background: var(--bg-hover); }
.viewer-search-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Markdown rendu : reutilise les styles prose du reader a petite echelle */
.viewer-md {
  padding: 18px 22px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--text-primary);
  max-width: 760px;
  margin: 0 auto;
}
.viewer-md :deep(h1) { font-size: 22px; font-weight: 800; margin: 24px 0 12px; }
.viewer-md :deep(h1):first-child { margin-top: 0; }
.viewer-md :deep(h2) { font-size: 18px; font-weight: 700; margin: 22px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
.viewer-md :deep(h3) { font-size: 16px; font-weight: 700; margin: 18px 0 8px; }
.viewer-md :deep(p) { margin: 0 0 14px; }
.viewer-md :deep(ul),
.viewer-md :deep(ol) { margin: 0 0 14px; padding-left: 24px; }
.viewer-md :deep(li) { margin: 4px 0; }
.viewer-md :deep(a) {
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px solid var(--accent-subtle);
}
.viewer-md :deep(code) {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.88em;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-input);
}
.viewer-md :deep(pre.lumen-code) {
  margin: 14px 0;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  overflow-x: auto;
  font-size: 12.5px;
}
.viewer-md :deep(pre.lumen-code code) { background: transparent; border: none; padding: 0; }
.viewer-md :deep(blockquote) {
  margin: 12px 0;
  padding: 6px 14px;
  border-left: 3px solid var(--accent);
  background: var(--accent-subtle);
  color: var(--text-secondary);
}
.viewer-md :deep(table) {
  border-collapse: collapse;
  margin: 14px 0;
  font-size: 12.5px;
}
.viewer-md :deep(th),
.viewer-md :deep(td) {
  padding: 6px 10px;
  border: 1px solid var(--border);
}
.viewer-md :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
}

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
.viewer-code-line--match { background: rgba(255, 215, 0, 0.08); }
.viewer-code-line--current {
  background: rgba(255, 215, 0, 0.22);
  box-shadow: inset 2px 0 0 #e6a700;
}
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
