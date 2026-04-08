<script setup lang="ts">
import {
  Bold, Italic, Strikethrough, Code,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, CheckSquare,
  Link2, Image, Table2, Minus,
} from 'lucide-vue-next'

interface Emits {
  (e: 'action', type: string): void
}
defineEmits<Emits>()
</script>

<template>
  <div class="lumen-toolbar" role="toolbar" aria-label="Mise en forme markdown">
    <button class="lumen-tb-btn" aria-label="Titre 1" title="Titre 1 (Ctrl+1)" @click="$emit('action', 'h1')"><Heading1 :size="16" /></button>
    <button class="lumen-tb-btn" aria-label="Titre 2" title="Titre 2 (Ctrl+2)" @click="$emit('action', 'h2')"><Heading2 :size="16" /></button>
    <button class="lumen-tb-btn" aria-label="Titre 3" title="Titre 3 (Ctrl+3)" @click="$emit('action', 'h3')"><Heading3 :size="16" /></button>
    <span class="lumen-tb-sep" aria-hidden="true" />
    <button class="lumen-tb-btn" aria-label="Gras" title="Gras (Ctrl+B)" @click="$emit('action', 'bold')"><Bold :size="15" /></button>
    <button class="lumen-tb-btn" aria-label="Italique" title="Italique (Ctrl+I)" @click="$emit('action', 'italic')"><Italic :size="15" /></button>
    <button class="lumen-tb-btn" aria-label="Barré" title="Barré" @click="$emit('action', 'strike')"><Strikethrough :size="15" /></button>
    <span class="lumen-tb-sep" aria-hidden="true" />
    <button class="lumen-tb-btn" aria-label="Liste à puces" title="Liste à puces" @click="$emit('action', 'ul')"><List :size="16" /></button>
    <button class="lumen-tb-btn" aria-label="Liste numérotée" title="Liste numérotée" @click="$emit('action', 'ol')"><ListOrdered :size="16" /></button>
    <button class="lumen-tb-btn" aria-label="Liste à cocher" title="Liste à cocher" @click="$emit('action', 'task')"><CheckSquare :size="15" /></button>
    <button class="lumen-tb-btn" aria-label="Citation" title="Citation" @click="$emit('action', 'quote')"><Quote :size="15" /></button>
    <span class="lumen-tb-sep" aria-hidden="true" />
    <button class="lumen-tb-btn" aria-label="Code en ligne" title="Code inline (Ctrl+E)" @click="$emit('action', 'code')"><Code :size="15" /></button>
    <button class="lumen-tb-btn lumen-tb-btn--wide" aria-label="Bloc de code" title="Bloc de code" @click="$emit('action', 'codeblock')">
      <span class="lumen-tb-codemark" aria-hidden="true">```</span>
    </button>
    <span class="lumen-tb-sep" aria-hidden="true" />
    <button class="lumen-tb-btn" aria-label="Lien" title="Lien (Ctrl+K)" @click="$emit('action', 'link')"><Link2 :size="15" /></button>
    <button class="lumen-tb-btn" aria-label="Image" title="Image" @click="$emit('action', 'image')"><Image :size="15" /></button>
    <button class="lumen-tb-btn" aria-label="Tableau" title="Tableau" @click="$emit('action', 'table')"><Table2 :size="15" /></button>
    <button class="lumen-tb-btn" aria-label="Ligne de séparation" title="Ligne de séparation" @click="$emit('action', 'hr')"><Minus :size="15" /></button>
  </div>
</template>

<style scoped>
.lumen-toolbar {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 6px 20px;
  background: var(--bg, #f8fafc);
  border-bottom: 1px solid var(--border, rgba(0, 0, 0, .08));
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.lumen-toolbar::-webkit-scrollbar { display: none; }

.lumen-tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px; height: 36px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--text-2, #64748b);
  cursor: pointer;
  transition: all 150ms ease;
  flex-shrink: 0;
}
.lumen-tb-btn:hover {
  background: var(--bg-card, #fff);
  color: #b45309;
}
.lumen-tb-btn:focus-visible {
  outline: 2px solid #b45309;
  outline-offset: 1px;
  z-index: 1;
}
.lumen-tb-btn--wide { width: auto; padding: 0 10px; }
.lumen-tb-codemark {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.lumen-tb-sep {
  width: 1px;
  height: 18px;
  background: var(--border, rgba(0, 0, 0, .1));
  margin: 0 5px;
  flex-shrink: 0;
}
</style>
