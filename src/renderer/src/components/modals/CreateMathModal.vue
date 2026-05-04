<script setup lang="ts">
/**
 * CreateMathModal - editeur LaTeX pour la commande slash /math.
 *
 * Produit une formule encadree par `$...$` (inline) ou `$$...$$` (display),
 * rendue par le renderer chat via KaTeX (cf. utils/html.ts).
 *
 * Ergonomie :
 *  - Textarea monospace pour la saisie LaTeX, Tab = 2 espaces natif.
 *  - Mode inline vs display (toggle en haut), affecte la preview ET les
 *    delimiteurs markdown inseres.
 *  - Chips de formules courantes (racine, fraction, somme, integrale,
 *    matrice, ...) : clic = insere le squelette LaTeX au curseur.
 *  - Preview live KaTeX a chaque frappe (cache partage avec le renderer).
 *  - Ctrl+Enter = envoyer direct, Shift+Ctrl+Enter = inserer, Enter seul
 *    = saut de ligne dans la saisie (preserve l'UX editeur).
 */
import { ref, computed, watch, nextTick } from 'vue'
import { X, Sigma, Send } from 'lucide-vue-next'
import { renderChatKatex } from '@/utils/html'

interface Props {
  modelValue: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  'submit': [payload: { markdown: string }]
  'submit-send': [payload: { markdown: string }]
}>()

// ── Etat ──────────────────────────────────────────────────────────────────
type Mode = 'inline' | 'display'
const mode = ref<Mode>('inline')
const tex = ref('')
const texEl = ref<HTMLTextAreaElement | null>(null)

watch(() => props.modelValue, (open) => {
  if (!open) return
  mode.value = 'inline'
  tex.value = ''
  nextTick(() => texEl.value?.focus())
})

// ── Chips de formules courantes ──────────────────────────────────────────
// Chaque chip insere un squelette latex au curseur. Les `|` dans le snippet
// marquent la position du curseur apres insertion (simule le tab-stop des
// snippets IDE).
interface MathChip { id: string; label: string; latex: string; snippet: string }
const CHIPS: readonly MathChip[] = [
  { id: 'frac',  label: 'a/b',  latex: '\\frac{a}{b}',  snippet: '\\frac{|a|}{b}' },
  { id: 'sqrt', label: '√a',   latex: '\\sqrt{a}',     snippet: '\\sqrt{|a|}' },
  { id: 'pow',  label: 'a^n',   latex: 'a^{n}',         snippet: '|a|^{n}' },
  { id: 'sub',  label: 'a_n',   latex: 'a_{n}',         snippet: '|a|_{n}' },
  { id: 'sum',  label: 'Σ',     latex: '\\sum_{i=1}^{n} a_i', snippet: '\\sum_{|i=1|}^{n} a_i' },
  { id: 'int',  label: '∫',     latex: '\\int_a^b f(x) dx', snippet: '\\int_{|a|}^{b} f(x) \\, dx' },
  { id: 'lim',  label: 'lim',   latex: '\\lim_{x \\to 0}', snippet: '\\lim_{|x \\to 0|}' },
  { id: 'mat',  label: 'Matrice', latex: '\\begin{pmatrix}a & b\\\\c & d\\end{pmatrix}', snippet: '\\begin{pmatrix}\n  |a| & b \\\\\n  c & d\n\\end{pmatrix}' },
  { id: 'inf',  label: '∞',     latex: '\\infty',       snippet: '\\infty' },
  { id: 'vec',  label: 'vecteur', latex: '\\vec{v}',    snippet: '\\vec{|v|}' },
  { id: 'pi',   label: 'π',     latex: '\\pi',          snippet: '\\pi' },
  { id: 'approx', label: '≈',   latex: '\\approx',      snippet: '\\approx' },
]

function insertChip(chip: MathChip) {
  const el = texEl.value
  if (!el) { tex.value = chip.snippet.replace(/\|/g, ''); return }
  const start = el.selectionStart
  const end = el.selectionEnd
  // Si le chip snippet contient des barres |...|, on cible la zone entre
  // les deux premieres pour le selectionner apres insertion.
  const raw = chip.snippet
  const firstPipe = raw.indexOf('|')
  const secondPipe = raw.indexOf('|', firstPipe + 1)
  const cleaned = raw.replace(/\|/g, '')
  tex.value = tex.value.slice(0, start) + cleaned + tex.value.slice(end)
  nextTick(() => {
    if (firstPipe >= 0 && secondPipe > firstPipe) {
      // Selectionne la portion entre les 2 |, utilisateur peut la remplacer
      el.selectionStart = start + firstPipe
      el.selectionEnd = start + (secondPipe - 1)
    } else {
      const pos = start + cleaned.length
      el.selectionStart = el.selectionEnd = pos
    }
    el.focus()
  })
}

// ── Tab support natif (indent 2 espaces) ────────────────────────────────
function onTexKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const el = texEl.value
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const indent = '  '
    tex.value = tex.value.slice(0, start) + indent + tex.value.slice(end)
    nextTick(() => {
      el.selectionStart = el.selectionEnd = start + indent.length
    })
    return
  }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    if (!canSubmit.value) return
    if (e.shiftKey) submit()
    else submitAndSend()
  }
}

// ── Preview live ──────────────────────────────────────────────────────────
const previewHtml = computed(() => {
  const src = tex.value.trim()
  if (!src) return ''
  return renderChatKatex(src, mode.value === 'display')
})

// Detecte une erreur de parsing (KaTeX retourne un <code class="msg-math-error">)
const hasError = computed(() => previewHtml.value.includes('msg-math-error'))

// ── Validation / soumission ───────────────────────────────────────────────
const canSubmit = computed(() => tex.value.trim().length > 0)

function buildMarkdown(): string {
  const t = tex.value.trim()
  if (mode.value === 'display') return '$$' + t + '$$'
  return '$' + t + '$'
}

function close() { emit('update:modelValue', false) }

function submit() {
  if (!canSubmit.value) return
  emit('submit', { markdown: buildMarkdown() })
  close()
}
function submitAndSend() {
  if (!canSubmit.value) return
  emit('submit-send', { markdown: buildMarkdown() })
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="cmt-modal" role="dialog" aria-modal="true" aria-label="Insérer une formule mathématique">
          <!-- Header -->
          <div class="cmt-header">
            <Sigma :size="18" class="cmt-header-icon" />
            <div class="cmt-header-text">
              <h2 class="cmt-title">Formule mathématique</h2>
              <p class="cmt-sub">Syntaxe LaTeX, rendu KaTeX</p>
            </div>
            <button class="btn-icon cmt-close" aria-label="Fermer" @click="close">
              <X :size="16" />
            </button>
          </div>

          <!-- Toggle mode inline / display -->
          <div class="cmt-mode" role="radiogroup" aria-label="Mode d'affichage">
            <button
              type="button"
              role="radio"
              class="cmt-mode-btn"
              :class="{ 'is-active': mode === 'inline' }"
              :aria-checked="mode === 'inline'"
              @click="mode = 'inline'"
            >
              Inline <span class="cmt-mode-hint">($...$)</span>
            </button>
            <button
              type="button"
              role="radio"
              class="cmt-mode-btn"
              :class="{ 'is-active': mode === 'display' }"
              :aria-checked="mode === 'display'"
              @click="mode = 'display'"
            >
              Centré <span class="cmt-mode-hint">($$...$$)</span>
            </button>
          </div>

          <!-- Body : editeur + chips + preview -->
          <div class="cmt-body">
            <div class="cmt-field">
              <label class="cmt-label" for="cmt-tex">Formule LaTeX</label>
              <textarea
                id="cmt-tex"
                ref="texEl"
                v-model="tex"
                class="cmt-tex"
                rows="3"
                spellcheck="false"
                autocapitalize="off"
                autocorrect="off"
                placeholder="Ex : \frac{a}{b}  ou  \sum_{i=1}^{n} i = \frac{n(n+1)}{2}"
                @keydown="onTexKeydown"
              />
            </div>

            <!-- Chips de formules courantes (clic = insere snippet au curseur) -->
            <div class="cmt-field">
              <label class="cmt-label">Insérer une formule courante</label>
              <div class="cmt-chips">
                <button
                  v-for="c in CHIPS"
                  :key="c.id"
                  type="button"
                  class="cmt-chip"
                  :title="c.latex"
                  @click="insertChip(c)"
                >{{ c.label }}</button>
              </div>
            </div>

            <!-- Preview live (meme rendu que dans un message) -->
            <div class="cmt-field">
              <label class="cmt-label">Aperçu</label>
              <div
                class="cmt-preview"
                :class="[
                  `cmt-preview--${mode}`,
                  { 'cmt-preview--error': hasError },
                ]"
              >
                <div v-if="!tex.trim()" class="cmt-preview-empty">
                  L'aperçu apparaîtra ici
                </div>
                <!-- Le HTML KaTeX est genere localement et sur. On l'injecte. -->
                <!-- eslint-disable vue/no-v-html -->
                <div v-else class="cmt-preview-rendered" v-html="previewHtml" />
                <!-- eslint-enable vue/no-v-html -->
              </div>
              <p v-if="hasError" class="cmt-error-hint">Formule LaTeX invalide — vérifiez la syntaxe.</p>
            </div>

            <!-- Hints -->
            <div class="cmt-hints">
              <span><kbd>Tab</kbd> indenter</span>
              <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> envoyer</span>
              <span class="cmt-hint-muted">(les chips insèrent le squelette au curseur)</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="cmt-footer">
            <button class="btn-ghost" @click="close">Annuler</button>
            <button
              type="button"
              class="cmt-btn-secondary"
              :disabled="!canSubmit"
              title="Insérer dans le message en cours"
              @click="submit"
            >
              Insérer dans le message
            </button>
            <button
              type="button"
              class="cmt-btn-primary"
              :disabled="!canSubmit"
              title="Envoyer directement"
              @click="submitAndSend"
            >
              <Send :size="14" /> Envoyer la formule
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
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

.cmt-modal {
  width: 100%;
  max-width: 600px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--elevation-4);
  overflow: hidden;
}

.cmt-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}
.cmt-header-icon {
  color: #d35400;
  padding: 6px;
  width: 30px; height: 30px;
  border-radius: var(--radius-sm);
  background: rgba(211, 84, 0, .15);
  flex-shrink: 0;
  box-sizing: content-box;
}
.cmt-header-text { flex: 1; min-width: 0; }
.cmt-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; }
.cmt-sub { font-size: 11.5px; color: var(--text-muted); margin: 2px 0 0; }
.cmt-close {
  width: 28px; height: 28px;
  border: none; background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background var(--t-fast), color var(--t-fast);
}
.cmt-close:hover { background: var(--bg-hover); color: var(--text-primary); }

/* Mode toggle : segmented control */
.cmt-mode {
  display: flex;
  gap: 2px;
  padding: 6px 18px 8px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}
.cmt-mode-btn {
  flex: 1;
  padding: 7px 12px;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.cmt-mode-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.cmt-mode-btn.is-active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.cmt-mode-hint { font-weight: 500; opacity: .7; margin-left: 4px; font-variant-numeric: tabular-nums; }

.cmt-body {
  padding: 14px 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}
.cmt-field { display: flex; flex-direction: column; gap: 6px; }
.cmt-label {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .5px;
}

.cmt-tex {
  width: 100%;
  padding: 10px 12px;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  resize: vertical;
  tab-size: 2;
  min-height: 60px;
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
}
.cmt-tex:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .12);
}

/* Chips formules */
.cmt-chips {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
.cmt-chip {
  padding: 5px 11px;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.cmt-chip:hover {
  background: var(--bg-hover);
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), .45);
}

/* Preview */
.cmt-preview {
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border-input);
  background: var(--bg-elevated);
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-x: auto;
  font-size: 15px;
}
.cmt-preview--display { min-height: 90px; font-size: 17px; }
.cmt-preview--error { border-color: rgba(var(--color-danger-rgb), .4); background: rgba(var(--color-danger-rgb), .05); }
.cmt-preview-empty {
  font-size: 12.5px;
  color: var(--text-muted);
  font-style: italic;
}
.cmt-preview-rendered :deep(.katex) {
  color: var(--text-primary);
}
.cmt-preview-rendered :deep(.msg-math-error) {
  background: rgba(var(--color-danger-rgb), .12);
  color: var(--color-danger);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12px;
}
.cmt-error-hint {
  margin: 0;
  font-size: 11px;
  color: var(--color-danger);
  font-style: italic;
}

/* Hints */
.cmt-hints {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  font-size: 10.5px;
  color: var(--text-muted);
  padding-top: 2px;
}
.cmt-hints kbd {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9.5px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  font-family: var(--font);
  margin: 0 2px;
}
.cmt-hint-muted { opacity: .7; font-style: italic; }

/* Footer */
.cmt-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
}
.cmt-btn-secondary {
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
.cmt-btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-muted);
}
.cmt-btn-secondary:disabled { opacity: .45; cursor: not-allowed; }

.cmt-btn-primary {
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
.cmt-btn-primary:hover:not(:disabled) {
  background: var(--cta-hover);
  transform: translateY(-1px);
}
.cmt-btn-primary:disabled {
  opacity: .45;
  cursor: not-allowed;
  background: var(--bg-hover);
  color: var(--text-muted);
  border-color: var(--border);
  box-shadow: none;
}
</style>
