<script setup lang="ts">
  /**
   * Editeur de code base sur CodeMirror 6 (v2.67).
   *
   * Wrapper minimal autour de CodeMirror : on cree un EditorView attache a
   * un container ref, on emit `update:modelValue` a chaque changement, et
   * on synchronise la valeur externe → editor sans creer de boucle infinie.
   *
   * Theme dark aligne sur les tokens Cursus (background `--bg-input`, etc.).
   * Pas de theme switching dynamique : si l'app passe en theme clair, le
   * code reste lisible mais pas autant qu'avec un theme adapte. On verra
   * plus tard si necessaire.
   *
   * Mode markdown par defaut. Mode plaintext pour les fichiers non-md.
   */
  import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { EditorState } from '@codemirror/state'
  import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view'
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
  import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language'
  import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
  import { markdown } from '@codemirror/lang-markdown'

  type Language = 'markdown' | 'plaintext'

  const props = withDefaults(defineProps<{
    modelValue: string
    language?: Language
    height?: string
    readonly?: boolean
  }>(), {
    language: 'markdown',
    height: '60vh',
    readonly: false,
  })

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
  }>()

  const containerRef = ref<HTMLDivElement | null>(null)
  let view: EditorView | null = null
  // Garde anti-boucle : quand on dispatch un transaction depuis le watch
  // externe, on ne veut pas re-emit update:modelValue qui re-trigger le watch.
  let suppressEmit = false

  // Theme inline aligne sur les tokens Cursus (dark base). On utilise
  // EditorView.theme() pour generer un theme CodeMirror sur mesure plutot
  // que d'importer @codemirror/theme-one-dark (~30KB de plus).
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
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
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

  onMounted(() => {
    if (!containerRef.value) return
    view = new EditorView({
      state: EditorState.create({
        doc: props.modelValue,
        extensions: buildExtensions(),
      }),
      parent: containerRef.value,
    })
  })

  onBeforeUnmount(() => {
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
