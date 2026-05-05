<script setup lang="ts">
/**
 * LumenChapterEditor : edition inline d'un chapitre Lumen (markdown / tex).
 *
 * Encapsule l'experience d'edition : bandeau status, banners contextuels
 * (brouillon restaure / conflit GitHub), champ message de commit opt-in,
 * toolbar markdown, editeur CodeMirror, apercu live, drag-drop / paste
 * d'images (encodage base64 inline).
 *
 * Le composant s'appuie sur useChapterEdit pour l'etat (draft localStorage,
 * dirty flag, saveState granulaire, conflict detection). Le parent ne fait
 * qu'ouvrir / fermer le mode edition via la valeur d'editMode renvoyee par
 * useChapterEdit. Toute la logique UI vit ici.
 *
 * Refonte v2.283 — extrait de LumenChapterViewer pour reduire la taille du
 * parent (3000+ lignes -> ~2700) et regrouper toute la surface "edition"
 * en un seul composant testable independamment.
 */
import { ref } from 'vue'
import { Loader2, Save, Check, AlertTriangle, RotateCcw, RefreshCw, Pencil, Eye, Columns2, MessageSquare, CircleDot } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import LumenMarkdownToolbar, { type MarkdownAction } from '@/components/lumen/LumenMarkdownToolbar.vue'
import UiCodeEditor, { type CodeEditorActions } from '@/components/ui/UiCodeEditor.vue'
import type { EditSaveState } from '@/composables/useChapterEdit'

interface Props {
  /** Chemin affiche dans le bandeau (ex: chapters/01-intro.md). */
  path: string
  /** Type de chapitre — pilote l'extension TeX (plaintext) vs markdown. */
  chapterKind: 'markdown' | 'pdf' | 'tex' | 'ipynb'
  /** Etat d'edition issu de useChapterEdit (parent). */
  saving: boolean
  isDirty: boolean
  saveState: EditSaveState
  hasRestoredDraft: boolean
  previewHtml: string
}

interface Emits {
  (e: 'save'): void
  (e: 'exit'): void
  (e: 'reload-from-remote'): void
  (e: 'discard-draft'): void
  (e: 'update:draft', value: string): void
  (e: 'update:message', value: string): void
  (e: 'update:previewOpen', value: boolean): void
  (e: 'update:showCommitMessage', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// v-model two-way bindings : on definit des proxy via defineModel pour
// rester compatible avec Vue 3.4+ (v-model multi-arguments).
const draft = defineModel<string>('draft', { required: true })
const message = defineModel<string>('message', { required: true })
const previewOpen = defineModel<boolean>('previewOpen', { required: true })
const showCommitMessage = defineModel<boolean>('showCommitMessage', { required: true })

const { showToast } = useToast()
const { confirm: confirmDialog } = useConfirm()

// Ref vers l'UiCodeEditor : permet d'appeler imperatively les actions
// markdown (wrap, prefix, insert) depuis la toolbar. Type importe pour
// rester aligne avec les methodes reellement exposees par defineExpose.
const editorRef = ref<CodeEditorActions | null>(null)

// ── Handlers locaux ─────────────────────────────────────────────────────

async function handleDiscardDraft(): Promise<void> {
  const ok = await confirmDialog({
    message: 'Annuler toutes les modifications non publiees ? Le brouillon local sera supprime.',
    variant: 'danger',
    confirmLabel: 'Supprimer le brouillon',
  })
  if (ok) emit('discard-draft')
}

async function handleReload(): Promise<void> {
  if (props.isDirty) {
    const ok = await confirmDialog({
      message: 'Recharger depuis GitHub remplacera ton brouillon. Continuer ?',
      variant: 'warning',
      confirmLabel: 'Recharger',
    })
    if (!ok) return
  }
  emit('reload-from-remote')
}

// Toolbar markdown : route chaque action vers l'editeur via la ref.
// Placeholders en francais pour qu'ils servent de petites legendes
// utiles dans l'apercu si le prof ne tape rien dessus.
function handleToolbarAction(kind: MarkdownAction): void {
  const editor = editorRef.value
  if (!editor) return
  switch (kind) {
    case 'bold':      editor.wrapSelection('**', '**', 'gras'); break
    case 'italic':    editor.wrapSelection('*', '*', 'italique'); break
    case 'code':      editor.wrapSelection('`', '`', 'code'); break
    case 'h2':        editor.prefixLines('## ', 'Titre'); break
    case 'h3':        editor.prefixLines('### ', 'Titre'); break
    case 'ul':        editor.prefixLines('- ', 'item'); break
    case 'ol':        editor.prefixLines('1. ', 'item'); break
    case 'quote':     editor.prefixLines('> ', 'citation'); break
    case 'link':      editor.wrapSelection('[', '](https://)', 'texte du lien'); break
    case 'image':     editor.insertAtCursor('![description](https://)'); break
    case 'codeblock': editor.insertBlock('```\ncode\n```'); break
    case 'hr':        editor.insertBlock('---'); break
  }
}

// Encodage base64 inline (data URL). Strategie volontairement simple : pas
// de pipeline d'upload server-side a maintenir. Limite raisonnable pour
// eviter de bourrer les commits GitHub avec des MB d'image base64.
const IMAGE_SOFT_LIMIT_KB = 500
const IMAGE_HARD_LIMIT_KB = 2000

function handlePasteImage(file: File): void {
  const sizeKB = Math.round(file.size / 1024)
  if (sizeKB > IMAGE_HARD_LIMIT_KB) {
    showToast(`Image trop volumineuse (${sizeKB}KB), reduis la avant de l'inserer`, 'error')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = String(reader.result ?? '')
    if (!dataUrl) return
    const baseName = (file.name || 'image').replace(/\.[a-z0-9]+$/i, '')
    const alt = baseName || 'image'
    editorRef.value?.insertAtCursor(`![${alt}](${dataUrl})`)
    if (sizeKB > IMAGE_SOFT_LIMIT_KB) {
      showToast(`Image inseree (${sizeKB}KB) — pense a la compresser pour alleger le commit`, 'info')
    } else {
      showToast('Image inseree dans le chapitre', 'success')
    }
  }
  reader.onerror = () => { showToast('Lecture de l\'image impossible', 'error') }
  reader.readAsDataURL(file)
}
</script>

<template>
  <div class="lumen-chapter-editor">
    <!-- Bandeau status + actions principales -->
    <header class="lumen-edit-bar">
      <div class="lumen-edit-bar-left">
        <Pencil :size="13" class="lumen-edit-bar-icon" />
        <span class="lumen-edit-bar-path" :title="path">{{ path }}</span>
        <span
          class="lumen-edit-status"
          :class="`lumen-edit-status--${saveState}`"
          role="status"
          aria-live="polite"
        >
          <template v-if="saveState === 'saving'">
            <Loader2 :size="11" class="spin" /> Publication…
          </template>
          <template v-else-if="saveState === 'saved'">
            <Check :size="11" /> Publie sur GitHub
          </template>
          <template v-else-if="saveState === 'conflict'">
            <AlertTriangle :size="11" /> Conflit GitHub
          </template>
          <template v-else-if="saveState === 'error'">
            <AlertTriangle :size="11" /> Echec — reessaie
          </template>
          <template v-else-if="saveState === 'dirty'">
            <CircleDot :size="11" /> Brouillon enregistre
          </template>
        </span>
      </div>
      <div class="lumen-edit-bar-right">
        <button
          type="button"
          class="lumen-edit-bar-icon-btn"
          :class="{ active: showCommitMessage }"
          :title="showCommitMessage ? 'Masquer le message de commit' : 'Personnaliser le message de commit'"
          :disabled="saving"
          aria-label="Message de commit"
          @click="showCommitMessage = !showCommitMessage"
        >
          <MessageSquare :size="14" />
        </button>
        <button
          type="button"
          class="lumen-edit-bar-icon-btn"
          :class="{ active: previewOpen }"
          :title="previewOpen ? 'Masquer l\'apercu' : 'Afficher l\'apercu'"
          :disabled="saving"
          aria-label="Apercu"
          :aria-pressed="previewOpen"
          @click="previewOpen = !previewOpen"
        >
          <Columns2 :size="14" />
        </button>
        <button
          type="button"
          class="lumen-edit-bar-btn lumen-edit-bar-btn--ghost"
          :disabled="saving"
          @click="$emit('exit')"
        >
          Quitter
        </button>
        <button
          type="button"
          class="lumen-edit-bar-btn lumen-edit-bar-btn--primary"
          :disabled="saving || !isDirty"
          :title="isDirty ? 'Publier sur GitHub (Ctrl+S)' : 'Aucune modification'"
          @click="$emit('save')"
        >
          <Loader2 v-if="saving" :size="14" class="spin" />
          <Save v-else :size="14" />
          {{ saving ? 'Publication…' : 'Publier' }}
        </button>
      </div>
    </header>

    <!-- Banner brouillon restaure (apres une session interrompue) -->
    <div v-if="hasRestoredDraft" class="lumen-edit-banner lumen-edit-banner--info">
      <RotateCcw :size="14" />
      <span>Brouillon restaure depuis ta derniere session (non publie sur GitHub)</span>
      <button
        type="button"
        class="lumen-edit-banner-action"
        @click="handleDiscardDraft"
      >Annuler les modifications</button>
    </div>

    <!-- Banner conflit Git (sha desynchronise) -->
    <div v-if="saveState === 'conflict'" class="lumen-edit-banner lumen-edit-banner--warning">
      <AlertTriangle :size="14" />
      <span>Le chapitre a ete modifie sur GitHub depuis ton ouverture. Recharge avant de republier.</span>
      <button
        type="button"
        class="lumen-edit-banner-action"
        @click="handleReload"
      ><RefreshCw :size="12" /> Recharger</button>
    </div>

    <!-- Message de commit personnalise (cache par defaut) -->
    <div v-if="showCommitMessage" class="lumen-edit-commit-row">
      <input
        v-model="message"
        type="text"
        class="lumen-edit-commit-input"
        :placeholder="`docs(${path}): edition`"
        maxlength="200"
      />
      <span class="lumen-edit-commit-help">Optionnel — par defaut le commit est nomme automatiquement.</span>
    </div>

    <!-- Toolbar markdown (cachee en mode TeX, peu pertinent) -->
    <LumenMarkdownToolbar
      v-if="chapterKind === 'markdown'"
      @action="handleToolbarAction"
    />

    <!-- Editeur + apercu -->
    <div class="lumen-edit-body" :class="{ 'lumen-edit-body--split': previewOpen }">
      <div class="lumen-edit-pane lumen-edit-pane--editor">
        <UiCodeEditor
          ref="editorRef"
          v-model="draft"
          :language="chapterKind === 'tex' ? 'plaintext' : 'markdown'"
          autofocus
          @paste-image="handlePasteImage"
          @save="$emit('save')"
        />
      </div>
      <div v-if="previewOpen" class="lumen-edit-pane lumen-edit-pane--preview">
        <div class="lumen-edit-pane-label">
          <Eye :size="11" /> Apercu
        </div>
        <div class="lumen-edit-preview markdown-body" v-html="previewHtml" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ════════════════════════════════════════════════════════════════════════
   EDITION INLINE — design v2.283
   Layout 5 zones empilees : bar status / banners / commit-msg / toolbar /
   body split (editeur + apercu). Inspiration GitHub web + Notion.
   ══════════════════════════════════════════════════════════════════════ */
.lumen-chapter-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* Bandeau du haut : path + statut + actions */
.lumen-edit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: 8px 16px;
  background: var(--bg-main);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  z-index: 5;
}
.lumen-edit-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.lumen-edit-bar-icon { color: var(--accent); flex-shrink: 0; }
.lumen-edit-bar-path {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 360px;
}
.lumen-edit-bar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* Indicateur d'etat : code couleur explicite */
.lumen-edit-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  transition: opacity var(--motion-fast) var(--ease-out);
}
.lumen-edit-status--idle { display: none; }
.lumen-edit-status--dirty {
  color: var(--text-muted);
  background: var(--bg-hover);
}
.lumen-edit-status--dirty :deep(svg) { color: var(--color-warning); }
.lumen-edit-status--saving {
  color: var(--accent);
  background: rgba(var(--accent-rgb), .12);
}
.lumen-edit-status--saved {
  color: var(--color-success);
  background: rgba(var(--color-success-rgb), .12);
}
.lumen-edit-status--conflict,
.lumen-edit-status--error {
  color: var(--color-warning);
  background: rgba(var(--color-warning-rgb), .14);
}

/* Boutons icone (toggle preview / commit message) */
.lumen-edit-bar-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out);
}
.lumen-edit-bar-icon-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.lumen-edit-bar-icon-btn.active {
  background: rgba(var(--accent-rgb), .14);
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), .35);
}
.lumen-edit-bar-icon-btn:disabled { opacity: .4; cursor: not-allowed; }
.lumen-edit-bar-icon-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* Boutons texte : Quitter (ghost) + Publier (primary, accent fort) */
.lumen-edit-bar-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s ease;
}
.lumen-edit-bar-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.lumen-edit-bar-btn--ghost {
  background: transparent;
  color: var(--text-secondary);
}
.lumen-edit-bar-btn--ghost:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.lumen-edit-bar-btn--primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .08);
}
.lumen-edit-bar-btn--primary:hover:not(:disabled) {
  filter: brightness(1.08);
  box-shadow: 0 2px 6px rgba(var(--accent-rgb), .25);
}
.lumen-edit-bar-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* Banners contextuels */
.lumen-edit-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.lumen-edit-banner--info {
  background: rgba(var(--accent-rgb), .08);
  color: var(--accent);
  border-bottom-color: rgba(var(--accent-rgb), .2);
}
.lumen-edit-banner--warning {
  background: rgba(var(--color-warning-rgb), .12);
  color: var(--color-warning);
  border-bottom-color: rgba(var(--color-warning-rgb), .35);
}
.lumen-edit-banner > svg { flex-shrink: 0; }
.lumen-edit-banner > span { flex: 1; }
.lumen-edit-banner-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
  color: inherit;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out);
  flex-shrink: 0;
}
.lumen-edit-banner-action:hover { background: rgba(0, 0, 0, .08); }
.lumen-edit-banner-action:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* Champ message de commit (opt-in) */
.lumen-edit-commit-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.lumen-edit-commit-input {
  width: 100%;
  padding: 6px 10px;
  font-size: 13px;
  font-family: var(--font-mono);
  background: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  outline: none;
  transition: border-color var(--motion-fast) var(--ease-out);
}
.lumen-edit-commit-input:focus { border-color: var(--accent); }
.lumen-edit-commit-input::placeholder { color: var(--text-muted); }
.lumen-edit-commit-help {
  font-size: 11px;
  color: var(--text-muted);
}

/* Editeur + apercu */
.lumen-edit-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.lumen-edit-pane--editor {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}
.lumen-edit-pane--editor :deep(.ui-code-editor) {
  flex: 1;
  height: auto !important;
  min-height: 0;
  border-radius: 0;
  border: none;
  border-right: 1px solid var(--border);
}
.lumen-edit-body:not(.lumen-edit-body--split) .lumen-edit-pane--editor :deep(.ui-code-editor) {
  border-right: none;
}
.lumen-edit-body--split .lumen-edit-pane--editor {
  flex: 1 1 50%;
}
.lumen-edit-body--split .lumen-edit-pane--preview {
  flex: 1 1 50%;
}
.lumen-edit-pane--preview {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-main);
  overflow-y: auto;
}
.lumen-edit-pane-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--text-muted);
  padding: 8px 16px 4px;
  flex-shrink: 0;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}
.lumen-edit-preview {
  padding: 16px 24px;
  flex: 1;
  overflow-y: auto;
}

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Mobile / petits ecrans : on empile editeur et apercu verticalement */
@media (max-width: 900px) {
  .lumen-edit-bar-path { display: none; }
  .lumen-edit-body--split { flex-direction: column; }
  .lumen-edit-body--split .lumen-edit-pane--preview {
    border-top: 1px solid var(--border);
    max-height: 40%;
  }
  .lumen-edit-pane--editor :deep(.ui-code-editor) { border-right: none; }
}
</style>
