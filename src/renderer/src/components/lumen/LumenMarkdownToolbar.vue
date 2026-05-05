<script setup lang="ts">
/**
 * LumenMarkdownToolbar : barre d'outils minimale au-dessus de l'editeur
 * markdown. Couvre les ~10 actions les plus frequentes (bold, italic, H2,
 * H3, code inline, code-block, lien, image, listes, citation).
 *
 * Chaque bouton emit @action avec un type discriminant. Le parent route
 * vers les methodes exposees par UiCodeEditor (wrapSelection, prefixLines,
 * insertBlock).
 *
 * Design : bandeau fin (32px), icones lucide 14px, separateurs verticaux
 * subtils. Reste sticky en haut de la pane editeur. Mobile : flex-wrap.
 */
import {
  Bold, Italic, Heading2, Heading3, Code,
  Link2, Image as ImageIcon, List, ListOrdered, Quote, Code2, Minus,
} from 'lucide-vue-next'

export type MarkdownAction =
  | 'bold' | 'italic' | 'h2' | 'h3'
  | 'code' | 'codeblock' | 'link' | 'image'
  | 'ul' | 'ol' | 'quote' | 'hr'

interface Emits {
  (e: 'action', kind: MarkdownAction): void
}
defineEmits<Emits>()

interface BtnSpec {
  kind: MarkdownAction
  icon: typeof Bold
  label: string
  /** Pour pause-cafe : groupe visuel separe par un | */
  group: number
}

const buttons: BtnSpec[] = [
  { kind: 'h2',        icon: Heading2,    label: 'Titre 2',           group: 1 },
  { kind: 'h3',        icon: Heading3,    label: 'Titre 3',           group: 1 },
  { kind: 'bold',      icon: Bold,        label: 'Gras (Ctrl+B)',     group: 2 },
  { kind: 'italic',    icon: Italic,      label: 'Italique (Ctrl+I)', group: 2 },
  { kind: 'code',      icon: Code,        label: 'Code',              group: 2 },
  { kind: 'link',      icon: Link2,       label: 'Lien',              group: 3 },
  { kind: 'image',     icon: ImageIcon,   label: 'Image',             group: 3 },
  { kind: 'ul',        icon: List,        label: 'Liste a puces',     group: 4 },
  { kind: 'ol',        icon: ListOrdered, label: 'Liste numerotee',   group: 4 },
  { kind: 'quote',     icon: Quote,       label: 'Citation',          group: 5 },
  { kind: 'codeblock', icon: Code2,       label: 'Bloc de code',      group: 5 },
  { kind: 'hr',        icon: Minus,       label: 'Separateur',        group: 5 },
]
</script>

<template>
  <div class="lumen-md-toolbar" role="toolbar" aria-label="Mise en forme markdown">
    <template v-for="(btn, i) in buttons" :key="btn.kind">
      <span
        v-if="i > 0 && btn.group !== buttons[i - 1].group"
        class="lumen-md-toolbar-sep"
        aria-hidden="true"
      />
      <button
        type="button"
        class="lumen-md-toolbar-btn"
        :title="btn.label"
        :aria-label="btn.label"
        @click="$emit('action', btn.kind)"
      >
        <component :is="btn.icon" :size="14" />
      </button>
    </template>
  </div>
</template>

<style scoped>
.lumen-md-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.lumen-md-toolbar-sep {
  display: inline-block;
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 4px;
}
.lumen-md-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out);
}
.lumen-md-toolbar-btn:hover {
  background: var(--bg-hover);
  color: var(--accent);
}
.lumen-md-toolbar-btn:active {
  background: rgba(var(--accent-rgb), .14);
}
.lumen-md-toolbar-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
  border-color: var(--accent);
}
</style>
