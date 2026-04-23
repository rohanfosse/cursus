<script setup lang="ts">
/**
 * CreateChecklistModal - builder pour la commande slash /checklist.
 *
 * Cree une liste de taches markdown GFM (- [ ] / - [x]) cochable. Chaque
 * item est une paire (etat coche, texte). Le markdown genere est
 * interprete nativement par marked -- pas de dep supplementaire.
 *
 * Ergonomie :
 *  - Auto-focus sur le premier item a l'ouverture.
 *  - Enter dans un input = ajoute une tache en dessous (flow naturel,
 *    comme dans Notion / Linear).
 *  - Backspace sur un item vide = supprime l'item et focus le precedent.
 *  - Ctrl+Enter = envoie directement dans le canal (1 clic de moins).
 *  - Drag & drop non implemente en v1 (suffisant pour la plupart des
 *    cas ; les utilisateurs reordonnent a la main avec les boutons X).
 */
import { ref, computed, watch, nextTick } from 'vue'
import { X, ListChecks, Plus, Trash2, Send, Check } from 'lucide-vue-next'

interface Props {
  modelValue: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  'submit': [payload: { markdown: string }]
  'submit-send': [payload: { markdown: string }]
}>()

// ── Etat : chaque item = { text, done } ───────────────────────────────────
interface Item { text: string; done: boolean }
const items = ref<Item[]>([{ text: '', done: false }, { text: '', done: false }])
const itemRefs = ref<(HTMLInputElement | null)[]>([])

const MAX_ITEMS = 30

watch(() => props.modelValue, (open) => {
  if (!open) return
  items.value = [{ text: '', done: false }, { text: '', done: false }]
  nextTick(() => itemRefs.value[0]?.focus())
})

// ── Operations ────────────────────────────────────────────────────────────
function addItem(atIdx: number) {
  if (items.value.length >= MAX_ITEMS) return
  items.value.splice(atIdx + 1, 0, { text: '', done: false })
  nextTick(() => itemRefs.value[atIdx + 1]?.focus())
}
function removeItem(idx: number) {
  if (items.value.length <= 1) {
    items.value[idx] = { text: '', done: false }
    return
  }
  items.value.splice(idx, 1)
  const focusIdx = Math.max(0, idx - 1)
  nextTick(() => itemRefs.value[focusIdx]?.focus())
}
function toggleDone(idx: number) {
  items.value[idx].done = !items.value[idx].done
}

// ── Navigation clavier ────────────────────────────────────────────────────
function onItemKeydown(e: KeyboardEvent, idx: number) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    if (!canSubmit.value) return
    if (e.shiftKey) submit()
    else submitAndSend()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    addItem(idx)
    return
  }
  if (e.key === 'Backspace' && items.value[idx].text === '') {
    e.preventDefault()
    removeItem(idx)
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const next = itemRefs.value[idx + 1]
    if (next) next.focus()
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prev = itemRefs.value[idx - 1]
    if (prev) prev.focus()
    return
  }
}

// ── Paste multi-lignes : 1 ligne = 1 item (utile pour importer une liste) ─
function onItemPaste(e: ClipboardEvent, idx: number) {
  const text = e.clipboardData?.getData('text') ?? ''
  // On ne gere que les paste multi-ligne pour ne pas interferer avec un
  // paste classique d'une seule ligne (copie d'un mot depuis un PDF p.ex.).
  if (!text.includes('\n')) return
  e.preventDefault()
  // Chaque ligne non-vide devient un item. On preserve l'etat done si la
  // ligne commence par [x] (facultatif : ignore si mal forme).
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) return
  const parsed: Item[] = lines.map(l => {
    // Accepte "- [x] Foo", "[x] Foo", "x Foo", sinon non-coche.
    const m = l.match(/^(?:-\s*)?\[([x ])\]\s*(.+)$/i)
    if (m) return { done: m[1].toLowerCase() === 'x', text: m[2].trim() }
    // Supprime les puces markdown eventuelles
    const cleaned = l.replace(/^[-*]\s+/, '').trim()
    return { done: false, text: cleaned }
  })
  // Remplace l'item courant + inserer le reste apres. Borne MAX_ITEMS.
  items.value.splice(idx, 1, ...parsed.slice(0, MAX_ITEMS - idx))
  // Focus le dernier item insere
  const focusIdx = Math.min(idx + parsed.length - 1, items.value.length - 1, MAX_ITEMS - 1)
  nextTick(() => itemRefs.value[focusIdx]?.focus())
}

// ── Validation + markdown ─────────────────────────────────────────────────
const filledItems = computed(() => items.value.filter(i => i.text.trim().length > 0))
const canSubmit = computed(() => filledItems.value.length > 0)

const markdownPreview = computed(() => {
  return filledItems.value
    .map(i => `- [${i.done ? 'x' : ' '}] ${i.text.trim()}`)
    .join('\n')
})

// Stats pour footer
const doneCount = computed(() => filledItems.value.filter(i => i.done).length)
const progressPct = computed(() =>
  filledItems.value.length === 0 ? 0
    : Math.round((doneCount.value / filledItems.value.length) * 100),
)

function close() { emit('update:modelValue', false) }

function submit() {
  if (!canSubmit.value) return
  emit('submit', { markdown: markdownPreview.value })
  close()
}
function submitAndSend() {
  if (!canSubmit.value) return
  emit('submit-send', { markdown: markdownPreview.value })
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="ccl-modal" role="dialog" aria-modal="true" aria-label="Créer une liste de tâches">
          <!-- Header -->
          <div class="ccl-header">
            <ListChecks :size="18" class="ccl-header-icon" />
            <div class="ccl-header-text">
              <h2 class="ccl-title">Liste de tâches</h2>
              <p class="ccl-sub">
                {{ filledItems.length }} tâche<template v-if="filledItems.length > 1">s</template>
                <template v-if="doneCount > 0"> · {{ doneCount }} déjà fait<template v-if="doneCount > 1">es</template> ({{ progressPct }}%)</template>
              </p>
            </div>
            <button class="btn-icon ccl-close" aria-label="Fermer" @click="close">
              <X :size="16" />
            </button>
          </div>

          <!-- Barre de progression (si >=1 fait) -->
          <div v-if="doneCount > 0" class="ccl-progress" :title="`${doneCount} / ${filledItems.length} tâches cochées`">
            <div class="ccl-progress-fill" :style="{ width: progressPct + '%' }" />
          </div>

          <!-- Body : liste d'items ──────────────────────────────────────── -->
          <div class="ccl-body">
            <div class="ccl-items">
              <div
                v-for="(item, idx) in items"
                :key="idx"
                class="ccl-item"
                :class="{ 'is-done': item.done }"
              >
                <!-- Checkbox custom (cliquable pour pre-cocher un item) -->
                <button
                  type="button"
                  class="ccl-check"
                  :class="{ 'is-checked': item.done }"
                  :aria-label="item.done ? 'Marquer comme non fait' : 'Marquer comme fait'"
                  :aria-pressed="item.done"
                  @click="toggleDone(idx)"
                >
                  <Check v-if="item.done" :size="12" aria-hidden="true" />
                </button>
                <input
                  :ref="(el) => itemRefs[idx] = (el as HTMLInputElement | null)"
                  v-model="items[idx].text"
                  type="text"
                  class="ccl-input"
                  :class="{ 'is-done': item.done }"
                  :placeholder="idx === 0 ? 'Que faut-il faire ?' : `Tâche ${idx + 1}`"
                  :aria-label="`Tâche ${idx + 1}`"
                  @keydown="onItemKeydown($event, idx)"
                  @paste="onItemPaste($event, idx)"
                />
                <button
                  type="button"
                  class="ccl-remove"
                  :aria-label="`Supprimer la tâche ${idx + 1}`"
                  title="Supprimer"
                  @click="removeItem(idx)"
                >
                  <Trash2 :size="12" />
                </button>
              </div>
            </div>

            <!-- Ajout d'une tache -->
            <button
              type="button"
              class="ccl-add-item"
              :disabled="items.length >= MAX_ITEMS"
              @click="addItem(items.length - 1)"
            >
              <Plus :size="13" /> Ajouter une tâche
            </button>

            <!-- Hints raccourcis clavier -->
            <div class="ccl-hints">
              <span><kbd>Enter</kbd> nouvelle tâche</span>
              <span><kbd>Backspace</kbd> (sur vide) supprimer</span>
              <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> envoyer</span>
              <span class="ccl-hint-muted">(collage multi-lignes = import en lot)</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="ccl-footer">
            <button class="btn-ghost" @click="close">Annuler</button>
            <button
              type="button"
              class="ccl-btn-secondary"
              :disabled="!canSubmit"
              title="Insérer dans le message pour ajouter du texte autour"
              @click="submit"
            >
              Insérer dans le message
            </button>
            <button
              type="button"
              class="ccl-btn-primary"
              :disabled="!canSubmit"
              title="Envoyer directement dans le canal"
              @click="submitAndSend"
            >
              <Send :size="14" /> Envoyer la liste
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
.ccl-modal {
  width: 100%;
  max-width: 560px;
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
.ccl-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}
.ccl-header-icon {
  color: var(--color-success);
  padding: 6px;
  width: 30px; height: 30px;
  border-radius: var(--radius-sm);
  background: rgba(var(--color-success-rgb), .12);
  flex-shrink: 0;
  box-sizing: content-box;
}
.ccl-header-text { flex: 1; min-width: 0; }
.ccl-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; }
.ccl-sub { font-size: 11.5px; color: var(--text-muted); margin: 2px 0 0; font-variant-numeric: tabular-nums; }
.ccl-close {
  width: 28px; height: 28px;
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
.ccl-close:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ── Barre de progression ──────────────────────────────────────────── */
.ccl-progress {
  height: 3px;
  background: var(--bg-active);
  overflow: hidden;
}
.ccl-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-success), color-mix(in srgb, var(--color-success) 70%, var(--accent)));
  transition: width var(--motion-base) var(--ease-out);
  box-shadow: 0 0 4px rgba(var(--color-success-rgb), .4);
}

/* ── Body ────────────────────────────────────────────────────────────── */
.ccl-body {
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.ccl-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* ── Ligne d'item ───────────────────────────────────────────────────── */
.ccl-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 4px 6px;
  border-radius: var(--radius-sm);
  transition: background var(--t-fast);
}
.ccl-item:hover { background: var(--bg-hover); }

/* Checkbox custom : design discret, s'illumine au hover/check */
.ccl-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  flex-shrink: 0;
  background: var(--bg-input);
  border: 1.5px solid var(--border-input);
  border-radius: 5px;
  color: #fff;
  cursor: pointer;
  transition:
    background var(--t-fast),
    border-color var(--t-fast),
    transform .12s cubic-bezier(.34, 1.56, .64, 1);
}
.ccl-check:hover {
  border-color: var(--color-success);
  transform: scale(1.08);
}
.ccl-check.is-checked {
  background: var(--color-success);
  border-color: var(--color-success);
}
.ccl-check.is-checked:hover { filter: brightness(1.08); }

/* Input texte : discret, se revele au hover/focus */
.ccl-input {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  font-family: var(--font);
  font-size: 13.5px;
  line-height: 1.4;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  transition: border-color var(--t-fast), background var(--t-fast);
}
.ccl-input::placeholder { color: var(--text-muted); }
.ccl-input:hover:not(:focus) { border-color: var(--border); }
.ccl-input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--bg-input);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .1);
}
/* Tache cochee : texte raye + atenuation */
.ccl-input.is-done {
  text-decoration: line-through;
  color: var(--text-muted);
  opacity: .75;
}

/* Bouton supprimer : visible au hover de la ligne */
.ccl-remove {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition:
    opacity var(--t-fast),
    background var(--t-fast),
    color var(--t-fast),
    border-color var(--t-fast);
}
.ccl-item:hover .ccl-remove,
.ccl-remove:focus-visible { opacity: 1; }
.ccl-remove:hover {
  color: var(--color-danger);
  background: rgba(var(--color-danger-rgb), .1);
  border-color: rgba(var(--color-danger-rgb), .25);
}

/* ── Bouton "Ajouter une tache" ──────────────────────────────────────── */
.ccl-add-item {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  margin-top: 2px;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: 1px dashed var(--border-input);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.ccl-add-item:hover:not(:disabled) {
  color: var(--accent);
  background: rgba(var(--accent-rgb), .08);
  border-color: var(--accent);
  border-style: solid;
}
.ccl-add-item:disabled { opacity: .45; cursor: not-allowed; }

/* ── Hints raccourcis clavier ────────────────────────────────────────── */
.ccl-hints {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  font-size: 10.5px;
  color: var(--text-muted);
  padding-top: 4px;
  border-top: 1px dashed var(--border);
}
.ccl-hints kbd {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 9.5px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  font-family: var(--font);
  margin: 0 2px;
}
.ccl-hint-muted { opacity: .7; font-style: italic; width: 100%; text-align: center; }

/* ── Footer ──────────────────────────────────────────────────────────── */
.ccl-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
}
.ccl-btn-secondary {
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
.ccl-btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-muted);
}
.ccl-btn-secondary:disabled { opacity: .45; cursor: not-allowed; }

.ccl-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  border: 1px solid var(--accent);
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .12);
  transition: background var(--t-fast), transform var(--t-fast);
}
.ccl-btn-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 88%, black);
  transform: translateY(-1px);
}
.ccl-btn-primary:disabled {
  opacity: .45;
  cursor: not-allowed;
  background: var(--bg-hover);
  color: var(--text-muted);
  border-color: var(--border);
  box-shadow: none;
}
</style>
