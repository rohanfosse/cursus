<script setup lang="ts">
/**
 * CreateCodeModal - builder pour la commande slash /code.
 *
 * Plutot que d'inserer un bloc ```js\n\n``` vide que l'utilisateur doit
 * remplir/corriger a la main, on propose :
 *  - Selecteur de langage visuel (11 langages courants + plaintext) qui
 *    s'aligne sur les langages reellement supportes par highlight.js dans
 *    utils/html.ts (sinon la preview serait fausse).
 *  - Editeur textarea monospace avec tab natif (indent 2 espaces).
 *  - Preview live colorisee via la meme librairie highlight.js utilisee
 *    pour le rendu final dans les messages -> WYSIWYG garanti.
 *  - Paste detect : si l'utilisateur colle du JSON / code evident, suggere
 *    le langage (heuristique simple).
 *
 * Emits submit { markdown } : la chaine markdown ```lang\n{code}\n``` prete
 * a inserer dans le textarea de message.
 */
import { ref, computed, watch, nextTick } from 'vue'
import { X, Code2, Send } from 'lucide-vue-next'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import sql from 'highlight.js/lib/languages/sql'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import cpp from 'highlight.js/lib/languages/cpp'

// Enregistrement idempotent (hljs ignore les doubles register). On duplique
// intentionnellement la conf de utils/html.ts pour garantir que ce composant
// fonctionne meme s'il est charge avant l'init renderer message.
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('java', java)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('cpp', cpp)

interface Props {
  modelValue: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  'submit': [payload: { markdown: string }]
  /** Envoi direct dans le canal (1 clic de moins, action la plus frequente). */
  'submit-send': [payload: { markdown: string }]
}>()

// ── Langages supportes ────────────────────────────────────────────────────
// `hljs` indique le nom interne highlight.js. `md` est la chaine inseree
// apres le backtick triple (`\`\`\`md\n...`) — on utilise un alias court et
// conventionnel (js/ts/py/sh) pour lisibilite du texte brut du message.
interface LangDef { id: string; md: string; hljs: string; label: string }
const LANGS: readonly LangDef[] = [
  { id: 'plaintext', md: 'plaintext', hljs: 'plaintext', label: 'Texte' },
  { id: 'js',        md: 'js',        hljs: 'javascript', label: 'JavaScript' },
  { id: 'ts',        md: 'ts',        hljs: 'typescript', label: 'TypeScript' },
  { id: 'python',    md: 'python',    hljs: 'python',     label: 'Python' },
  { id: 'java',      md: 'java',      hljs: 'java',       label: 'Java' },
  { id: 'cpp',       md: 'cpp',       hljs: 'cpp',        label: 'C / C++' },
  { id: 'html',      md: 'html',      hljs: 'xml',        label: 'HTML' },
  { id: 'css',       md: 'css',       hljs: 'css',        label: 'CSS' },
  { id: 'sql',       md: 'sql',       hljs: 'sql',        label: 'SQL' },
  { id: 'bash',      md: 'bash',      hljs: 'bash',       label: 'Bash' },
  { id: 'json',      md: 'json',      hljs: 'json',       label: 'JSON' },
]

// ── Etat ──────────────────────────────────────────────────────────────────
const selectedLang = ref<LangDef>(LANGS[1]) // JS par defaut
const code = ref('')
const codeEl = ref<HTMLTextAreaElement | null>(null)

// Reset a chaque ouverture
watch(() => props.modelValue, (open) => {
  if (!open) return
  selectedLang.value = LANGS[1]
  code.value = ''
  nextTick(() => codeEl.value?.focus())
})

function selectLang(lang: LangDef) {
  selectedLang.value = lang
  nextTick(() => codeEl.value?.focus())
}

// ── Paste auto-detect : suggere le langage si JSON/HTML colle ─────────────
// Heuristique simple, fail-safe : si on n'est pas sur, on laisse le choix
// utilisateur. Ne tourne que si le textarea est vide (premier paste).
function onPaste(e: ClipboardEvent) {
  if (code.value.trim().length > 0) return
  const pasted = e.clipboardData?.getData('text') ?? ''
  const suggested = detectLanguage(pasted)
  if (suggested && suggested.id !== selectedLang.value.id) {
    // On laisse 0ms pour que le paste natif se fasse d'abord
    setTimeout(() => { selectedLang.value = suggested }, 0)
  }
}

function detectLanguage(text: string): LangDef | null {
  const s = text.trim()
  if (!s) return null
  // JSON : commence par { ou [ et se termine coherent
  if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
    try { JSON.parse(s); return LANGS.find(l => l.id === 'json') ?? null } catch { /* noop */ }
  }
  // HTML / JSX : balises ouvrantes < + fermantes >
  if (/^\s*<[a-zA-Z!][^>]*>/.test(s) && /<\/\w+>|\/>/.test(s)) {
    return LANGS.find(l => l.id === 'html') ?? null
  }
  // SQL : mots-cles typiques en tete
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(s)) {
    return LANGS.find(l => l.id === 'sql') ?? null
  }
  // Bash : shebang ou commandes shell typiques
  if (/^#!\/.*\/(bash|sh|zsh)/.test(s) || /^\s*(cd|ls|mkdir|rm|sudo|chmod|chown|grep|find|curl|wget|ssh)\s/m.test(s)) {
    return LANGS.find(l => l.id === 'bash') ?? null
  }
  // Python : imports, def, print() / f-strings
  if (/^\s*(import\s|from\s+\w+\s+import|def\s+\w+\(|class\s+\w+[\(:]|print\()/m.test(s)) {
    return LANGS.find(l => l.id === 'python') ?? null
  }
  // TypeScript : types / interfaces / annotations
  if (/\b(interface|type)\s+\w+\s*[{=]|:\s*(string|number|boolean|any|unknown)\b/m.test(s)) {
    return LANGS.find(l => l.id === 'ts') ?? null
  }
  return null
}

// ── Tab support natif dans le textarea (indent 2 espaces) ────────────────
// Sans ce handler, Tab sortirait du textarea (comportement navigateur).
// Comme c'est un builder de code, on privilegie l'indentation.
function onCodeKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const el = codeEl.value
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const indent = '  '
    code.value = code.value.slice(0, start) + indent + code.value.slice(end)
    nextTick(() => {
      el.selectionStart = el.selectionEnd = start + indent.length
    })
    return
  }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    if (!canSubmit.value) return
    // Shift+Ctrl+Enter : insere sans envoyer (flow ancien, pour texte autour).
    // Ctrl+Enter seul : envoie directement dans le canal (action par defaut,
    // coherente avec le modal /tableau).
    if (e.shiftKey) submit()
    else submitAndSend()
  }
}

// ── Preview highlight.js (live) ───────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
}
const highlightedHtml = computed(() => {
  if (!code.value) return ''
  const lang = selectedLang.value.hljs
  try {
    if (lang === 'plaintext') return escapeHtml(code.value)
    return hljs.highlight(code.value, { language: lang }).value
  } catch { return escapeHtml(code.value) }
})

// ── Validation / soumission ───────────────────────────────────────────────
const canSubmit = computed(() => code.value.trim().length > 0)

function close() { emit('update:modelValue', false) }

/** Construit le markdown final, nettoie les lignes vides haut/bas et les
 *  trailing spaces par ligne (garde l'indentation interne intacte). */
function buildMarkdown(): string {
  const cleaned = code.value
    .replace(/^\s*\n+/, '')
    .replace(/\n+\s*$/, '')
    .split('\n')
    .map(l => l.replace(/\s+$/, ''))
    .join('\n')
  return '```' + selectedLang.value.md + '\n' + cleaned + '\n```'
}

function submit() {
  if (!canSubmit.value) return
  emit('submit', { markdown: buildMarkdown() })
  close()
}
/** Envoie directement dans le canal (skip le textarea). */
function submitAndSend() {
  if (!canSubmit.value) return
  emit('submit-send', { markdown: buildMarkdown() })
  close()
}

// ── Stats utiles affichees en bas ─────────────────────────────────────────
const lineCount = computed(() => code.value.split('\n').length)
const charCount = computed(() => code.value.length)
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="ccd-modal" role="dialog" aria-modal="true" aria-label="Créer un bloc de code">
          <!-- Header -->
          <div class="ccd-header">
            <Code2 :size="18" class="ccd-header-icon" />
            <div class="ccd-header-text">
              <h2 class="ccd-title">Bloc de code</h2>
              <p class="ccd-sub">Coloration syntaxique selon le langage</p>
            </div>
            <button class="btn-icon ccd-close" aria-label="Fermer" @click="close">
              <X :size="16" />
            </button>
          </div>

          <!-- Selecteur de langage (chips horizontales) -->
          <div class="ccd-langs" role="radiogroup" aria-label="Langage du bloc">
            <button
              v-for="lang in LANGS"
              :key="lang.id"
              type="button"
              role="radio"
              class="ccd-lang"
              :class="{ 'is-active': selectedLang.id === lang.id }"
              :aria-checked="selectedLang.id === lang.id"
              :title="lang.label"
              @click="selectLang(lang)"
            >{{ lang.label }}</button>
          </div>

          <!-- Body : editeur + preview en deux colonnes (stacke en mobile) -->
          <div class="ccd-body">
            <!-- Editeur -->
            <div class="ccd-panel ccd-panel--editor">
              <div class="ccd-panel-head">
                <span class="ccd-panel-label">Code</span>
                <span class="ccd-panel-stats" aria-live="polite">
                  {{ lineCount }} ligne<template v-if="lineCount > 1">s</template>
                  · {{ charCount }} car<template v-if="charCount > 1">.</template>
                </span>
              </div>
              <textarea
                ref="codeEl"
                v-model="code"
                class="ccd-editor"
                spellcheck="false"
                autocapitalize="off"
                autocorrect="off"
                :placeholder="`Collez ou saisissez votre code ${selectedLang.label} ici…`"
                @keydown="onCodeKeydown"
                @paste="onPaste"
              />
            </div>

            <!-- Preview -->
            <div class="ccd-panel ccd-panel--preview">
              <div class="ccd-panel-head">
                <span class="ccd-panel-label">Aperçu</span>
                <span class="ccd-panel-lang-tag">{{ selectedLang.md }}</span>
              </div>
              <div v-if="code.trim()" class="code-block ccd-preview">
                <span class="code-lang">{{ selectedLang.md }}</span>
                <pre><code class="hljs" :class="`language-${selectedLang.hljs}`" v-html="highlightedHtml" /></pre>
              </div>
              <div v-else class="ccd-preview-empty">
                <Code2 :size="28" />
                <p>L'aperçu apparaîtra ici au fur et à mesure de votre saisie.</p>
              </div>
            </div>
          </div>

          <!-- Hints raccourcis clavier -->
          <div class="ccd-hints">
            <span><kbd>Tab</kbd> indenter (2 espaces)</span>
            <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> envoyer directement</span>
            <span class="ccd-hint-muted">(collage = détection auto du langage)</span>
          </div>

          <!-- Footer : CTA primaire = envoyer direct (1 clic),
               secondaire = inserer pour ajouter du texte autour. -->
          <div class="ccd-footer">
            <button class="btn-ghost" @click="close">Annuler</button>
            <button
              type="button"
              class="ccd-btn-secondary"
              :disabled="!canSubmit"
              title="Insérer dans le message pour ajouter du texte autour"
              @click="submit"
            >
              Insérer dans le message
            </button>
            <button
              type="button"
              class="ccd-btn-primary"
              :disabled="!canSubmit"
              title="Envoyer directement dans le canal"
              @click="submitAndSend"
            >
              <Send :size="14" /> Envoyer le bloc
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Overlay ─────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, .45);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}
.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity var(--motion-fast) var(--ease-out); }
.modal-fade-enter-from,
.modal-fade-leave-to { opacity: 0; }

/* ── Modal ───────────────────────────────────────────────────────────── */
.ccd-modal {
  width: 100%;
  max-width: 860px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--elevation-4);
  overflow: hidden;
}

/* ── Header ──────────────────────────────────────────────────────────── */
.ccd-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}
.ccd-header-icon {
  color: var(--accent);
  padding: 6px;
  width: 30px; height: 30px;
  border-radius: var(--radius-sm);
  background: rgba(var(--accent-rgb), .12);
  flex-shrink: 0;
  box-sizing: content-box;
}
.ccd-header-text { flex: 1; min-width: 0; }
.ccd-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; }
.ccd-sub { font-size: 11.5px; color: var(--text-muted); margin: 2px 0 0; }
.ccd-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background var(--t-fast), color var(--t-fast);
}
.ccd-close:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ── Selecteur de langage ────────────────────────────────────────────── */
.ccd-langs {
  display: flex;
  gap: 5px;
  overflow-x: auto;
  padding: 10px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
  scrollbar-width: thin;
}
.ccd-lang {
  flex-shrink: 0;
  font-family: var(--font);
  font-size: 11.5px;
  font-weight: 600;
  padding: 5px 11px;
  border-radius: var(--radius-lg);
  background: var(--bg-main);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.ccd-lang:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-input);
}
.ccd-lang.is-active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

/* ── Body : editeur + preview cote a cote ────────────────────────────── */
.ccd-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--border);
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.ccd-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-main);
}
.ccd-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
}
.ccd-panel-label { color: var(--text-muted); }
.ccd-panel-stats {
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.ccd-panel-lang-tag {
  text-transform: none;
  letter-spacing: 0;
  padding: 1px 7px;
  border-radius: var(--radius);
  background: rgba(var(--accent-rgb), .15);
  color: var(--accent);
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
}

/* Editeur textarea */
.ccd-editor {
  flex: 1;
  width: 100%;
  min-height: 240px;
  padding: 14px 16px;
  background: var(--bg-input);
  color: var(--text-primary);
  border: none;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  resize: none;
  tab-size: 2;
  outline: none;
}
.ccd-editor::placeholder { color: var(--text-muted); opacity: .7; }
.ccd-editor:focus { background: var(--bg-main); }

/* Preview */
.ccd-preview {
  margin: 12px;
  overflow: auto;
  max-height: 100%;
}
.ccd-preview-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
}
.ccd-preview-empty svg { opacity: .35; }
.ccd-preview-empty p { margin: 0; font-size: 12.5px; max-width: 260px; line-height: 1.5; }

/* ── Hints raccourcis clavier ────────────────────────────────────────── */
.ccd-hints {
  display: flex;
  gap: 14px;
  justify-content: center;
  font-size: 10.5px;
  color: var(--text-muted);
  flex-wrap: wrap;
  padding: 8px 18px;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
}
.ccd-hints kbd {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9.5px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  font-family: var(--font);
  margin: 0 2px;
}
.ccd-hint-muted { opacity: .7; font-style: italic; }

/* ── Footer ──────────────────────────────────────────────────────────── */
.ccd-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
}

.ccd-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-input);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.ccd-btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-muted);
}
.ccd-btn-secondary:disabled { opacity: .45; cursor: not-allowed; }

.ccd-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  background: var(--cta);
  color: #fff;
  border: 1px solid var(--cta);
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .12);
  transition: background var(--t-fast), transform var(--t-fast);
}
.ccd-btn-primary:hover:not(:disabled) {
  background: var(--cta-hover);
  transform: translateY(-1px);
}
.ccd-btn-primary:disabled {
  opacity: .45;
  cursor: not-allowed;
  background: var(--bg-hover);
  color: var(--text-muted);
  border-color: var(--border);
  box-shadow: none;
}

/* ── Responsive (stack vertical sur mobile) ──────────────────────────── */
@media (max-width: 720px) {
  .ccd-body { grid-template-columns: 1fr; }
  .ccd-editor { min-height: 180px; }
}
</style>
