<script lang="ts">
/**
 * Interface imperative exposee aux parents via ref + defineExpose. Importer
 * ce type plutot que de le redeclarer cote consommateur, pour rester en
 * phase avec les methodes reellement exposees.
 */
export interface CodeEditorActions {
  wrapSelection: (before: string, after?: string, placeholder?: string) => void
  prefixLines: (prefix: string, placeholder?: string) => void
  insertAtCursor: (text: string) => void
  insertBlock: (block: string) => void
  focus: () => void
}
</script>

<script setup lang="ts">
  /**
   * Editeur de code base sur CodeMirror 6 (v2.67).
   *
   * Wrapper minimal autour de CodeMirror : on cree un EditorView attache a
   * un container ref, on emit `update:modelValue` a chaque changement, et
   * on synchronise la valeur externe -> editor sans creer de boucle infinie.
   *
   * v2.283 : expose des actions imperative pour la toolbar markdown (wrap,
   * insert, prefixLines, focus). Drag-drop / paste d'images detectes et
   * remontes via @paste-image (le parent decide quoi faire — base64 inline
   * ou upload).
   */
  import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { EditorState } from '@codemirror/state'
  import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view'
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
  import { syntaxHighlighting, HighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language'
  import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
  import { markdown } from '@codemirror/lang-markdown'
  import { tags as t } from '@lezer/highlight'

  type Language = 'markdown' | 'plaintext'

  const props = withDefaults(defineProps<{
    modelValue: string
    language?: Language
    height?: string
    readonly?: boolean
    /** Si true, focus l'editeur a son montage. */
    autofocus?: boolean
  }>(), {
    language: 'markdown',
    height: '100%',
    readonly: false,
    autofocus: false,
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
    (e: 'paste-image', file: File): void
    (e: 'save'): void
  }>()

  const containerRef = ref<HTMLDivElement | null>(null)
  let view: EditorView | null = null
  // Garde anti-boucle : quand on dispatch un transaction depuis le watch
  // externe, on ne veut pas re-emit update:modelValue qui re-trigger le watch.
  let suppressEmit = false

  // Theme inline aligne sur les tokens Cursus (dark base). On utilise
  // EditorView.theme() pour generer un theme CodeMirror sur mesure plutot
  // que d'importer @codemirror/theme-one-dark (~30KB de plus).
  /**
   * Highlight style custom (v2.288). On n'utilise plus `defaultHighlightStyle`
   * qui est calibre pour fond clair — sur le bg sombre `--bg-input` certains
   * tokens markdown (heading, monospace, list) sortaient quasi noir-sur-noir
   * et l'editeur paraissait vide. Ici on applique des couleurs explicites
   * tirees de la palette indigo/landing, lisibles en dark ET acceptables en
   * light grace a la base color qui suit le theme.
   *
   * Couvre les tags les plus frequents en markdown (heading, emphasis, strong,
   * link, monospace, list, quote, processingInstruction). Les autres tombent
   * sur la couleur de base via le theme.
   */
  const cursusHighlight = HighlightStyle.define([
    { tag: t.heading,                color: 'var(--accent-light, #A5B4FC)', fontWeight: '700' },
    { tag: t.heading1,               color: 'var(--accent-light, #A5B4FC)', fontWeight: '700' },
    { tag: t.heading2,               color: 'var(--accent-light, #A5B4FC)', fontWeight: '700' },
    { tag: t.heading3,               color: 'var(--accent-light, #A5B4FC)', fontWeight: '600' },
    { tag: t.strong,                 fontWeight: '700' },
    { tag: t.emphasis,               fontStyle: 'italic' },
    { tag: t.link,                   color: 'var(--accent, #818CF8)', textDecoration: 'underline' },
    { tag: t.url,                    color: 'var(--accent, #818CF8)' },
    { tag: t.quote,                  color: 'var(--text-secondary, #CBD5E1)', fontStyle: 'italic' },
    { tag: t.monospace,              color: 'var(--accent-light, #A5B4FC)' },
    { tag: t.list,                   color: 'var(--accent, #818CF8)' },
    { tag: t.atom,                   color: 'var(--cta, #34D399)' },
    { tag: t.processingInstruction,  color: 'var(--text-muted, #94A3B8)' },
    { tag: t.contentSeparator,       color: 'var(--text-muted, #94A3B8)' },
  ])

  const cursusTheme = EditorView.theme({
    '&': {
      backgroundColor: 'var(--bg-input)',
      color: 'var(--text-primary)',
      fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
      fontSize: '13px',
      height: '100%',
    },
    '.cm-content': {
      caretColor: 'var(--accent)',
      padding: '12px 0',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--accent)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(var(--accent-rgb),.25)',
    },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--text-muted)',
      borderRight: '1px solid var(--border, rgba(255,255,255,.1))',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(var(--accent-rgb),.08)',
      color: 'var(--accent)',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255,255,255,.025)',
    },
    '.cm-selectionMatch': {
      backgroundColor: 'rgba(var(--accent-rgb),.18)',
    },
    '&.cm-focused': {
      outline: 'none',
    },
  }, { dark: true })

  function buildExtensions() {
    const exts = [
      lineNumbers(),
      highlightActiveLine(),
      drawSelection(),
      bracketMatching(),
      indentOnInput(),
      history(),
      highlightSelectionMatches(),
      syntaxHighlighting(cursusHighlight, { fallback: true }),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
        // Ctrl+S / Cmd+S : intercepte par le parent via @save (le keymap
        // CodeMirror prevaut sur le keydown global du document).
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => { emit('save'); return true },
        },
      ]),
      cursusTheme,
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return
        if (suppressEmit) return
        emit('update:modelValue', update.state.doc.toString())
      }),
    ]
    if (props.language === 'markdown') exts.push(markdown())
    if (props.readonly) exts.push(EditorState.readOnly.of(true))
    return exts
  }

  // ── Actions imperative exposees via defineExpose ───────────────────────
  // Permet a la toolbar markdown (parent) d'appliquer des transformations
  // sur la selection sans dupliquer la logique CodeMirror dans chaque bouton.

  /**
   * Entoure la selection avec `before` / `after`. Si selection vide, insere
   * `before + placeholder + after` et place le curseur sur le placeholder.
   * Si la selection est deja entouree, retire les marqueurs (toggle).
   */
  function wrapSelection(before: string, after: string = before, placeholder = ''): void {
    if (!view) return
    const { from, to } = view.state.selection.main
    const selected = view.state.doc.sliceString(from, to)
    // Toggle : si la selection englobe deja les marqueurs, on les retire.
    if (
      selected.startsWith(before) && selected.endsWith(after)
      && selected.length >= before.length + after.length
    ) {
      const inner = selected.slice(before.length, selected.length - after.length)
      view.dispatch({
        changes: { from, to, insert: inner },
        selection: { anchor: from, head: from + inner.length },
      })
      view.focus()
      return
    }
    const inner = selected || placeholder
    const insert = `${before}${inner}${after}`
    const cursorStart = from + before.length
    const cursorEnd = cursorStart + inner.length
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: cursorStart, head: cursorEnd },
    })
    view.focus()
  }

  /**
   * Prefixe chaque ligne de la selection par `prefix`. Si selection vide,
   * prefixe la ligne du curseur. Toggle : retire le prefix si toutes les
   * lignes le portent deja.
   */
  function prefixLines(prefix: string, placeholder = ''): void {
    if (!view) return
    const { from, to } = view.state.selection.main
    const startLine = view.state.doc.lineAt(from)
    const endLine = view.state.doc.lineAt(to)
    const lines: string[] = []
    for (let n = startLine.number; n <= endLine.number; n++) {
      lines.push(view.state.doc.line(n).text)
    }
    const allHavePrefix = lines.every((l) => l.startsWith(prefix))
    const newLines = allHavePrefix
      ? lines.map((l) => l.slice(prefix.length))
      : lines.map((l) => `${prefix}${l || placeholder}`)
    const insert = newLines.join('\n')
    view.dispatch({
      changes: { from: startLine.from, to: endLine.to, insert },
      selection: { anchor: startLine.from, head: startLine.from + insert.length },
    })
    view.focus()
  }

  /**
   * Insere `text` a la position du curseur, remplace la selection courante.
   * Curseur place a la fin du texte insere.
   */
  function insertAtCursor(text: string): void {
    if (!view) return
    const { from, to } = view.state.selection.main
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    })
    view.focus()
  }

  /**
   * Insere un bloc en debut de la ligne suivante (ex: code fence). Si la
   * ligne courante n'est pas vide, on saute une ligne avant.
   */
  function insertBlock(block: string): void {
    if (!view) return
    const { from } = view.state.selection.main
    const line = view.state.doc.lineAt(from)
    const needsNewline = line.text.length > 0
    const insert = (needsNewline ? '\n\n' : '') + block + '\n'
    const insertPos = line.to
    const cursor = insertPos + insert.length
    view.dispatch({
      changes: { from: insertPos, to: insertPos, insert },
      selection: { anchor: cursor },
    })
    view.focus()
  }

  function focus(): void {
    view?.focus()
  }

  defineExpose({ wrapSelection, prefixLines, insertAtCursor, insertBlock, focus })

  // ── Drag-drop / paste images ───────────────────────────────────────────
  // On capte les fichiers images au niveau du container et on les remonte
  // au parent via @paste-image. Le parent decide de la strategie (data URL
  // pour un fallback simple, upload server-side pour les gros fichiers).

  function isImageFile(file: File): boolean {
    return file.type.startsWith('image/')
  }

  function onDrop(e: DragEvent): void {
    if (!e.dataTransfer?.files?.length) return
    const files = Array.from(e.dataTransfer.files).filter(isImageFile)
    if (!files.length) return
    e.preventDefault()
    files.forEach((f) => emit('paste-image', f))
  }

  function onDragOver(e: DragEvent): void {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault()
    }
  }

  function onPaste(e: ClipboardEvent): void {
    if (!e.clipboardData?.files?.length) return
    const files = Array.from(e.clipboardData.files).filter(isImageFile)
    if (!files.length) return
    e.preventDefault()
    files.forEach((f) => emit('paste-image', f))
  }

  onMounted(() => {
    if (!containerRef.value) return
    view = new EditorView({
      state: EditorState.create({
        doc: props.modelValue,
        extensions: buildExtensions(),
      }),
      parent: containerRef.value,
    })
    if (props.autofocus) {
      // nextTick non necessaire : EditorView est synchrone dans le DOM.
      view.focus()
    }
    containerRef.value.addEventListener('drop', onDrop)
    containerRef.value.addEventListener('dragover', onDragOver)
    containerRef.value.addEventListener('paste', onPaste)
  })

  onBeforeUnmount(() => {
    if (containerRef.value) {
      containerRef.value.removeEventListener('drop', onDrop)
      containerRef.value.removeEventListener('dragover', onDragOver)
      containerRef.value.removeEventListener('paste', onPaste)
    }
    view?.destroy()
    view = null
  })

  // Synchronise valeur externe -> editor sans creer de boucle. On compare
  // au contenu courant pour eviter de re-dispatch un transaction inutile
  // (qui couterait un re-render et casserait la position du curseur).
  watch(() => props.modelValue, (next) => {
    if (!view) return
    const current = view.state.doc.toString()
    if (current === next) return
    suppressEmit = true
    view.dispatch({
      changes: { from: 0, to: current.length, insert: next },
    })
    suppressEmit = false
  })
</script>

<template>
  <div
    ref="containerRef"
    class="ui-code-editor"
    :style="{ height }"
  />
</template>

<style scoped>
.ui-code-editor {
  width: 100%;
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-input);
  display: flex;
  flex-direction: column;
}
.ui-code-editor :deep(.cm-editor) {
  flex: 1;
  height: 100%;
}
.ui-code-editor :deep(.cm-scroller) {
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace !important;
}
</style>
