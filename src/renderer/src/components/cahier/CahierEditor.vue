/**
 * Editeur collaboratif TipTap WYSIWYG avec Yjs CRDT.
 * Delegue la config TipTap a useCahierEditor et le header a CahierEditorHeader.
 */
<script setup lang="ts">
import { computed, watch } from 'vue'
import { EditorContent } from '@tiptap/vue-3'
import { useCahierCollab } from '@/composables/useCahierCollab'
import { useCahierEditor } from '@/composables/useCahierEditor'
import { useCahierStore } from '@/stores/cahier'
import CahierEditorHeader from './CahierEditorHeader.vue'

const cahierStore = useCahierStore()
const cahierId = computed(() => cahierStore.activeCahierId)
const { ydoc, provider, connected, saving, saveError, connectedUsers, init, destroy } = useCahierCollab(cahierId)
const { editor } = useCahierEditor({ ydoc, provider })

const currentCahier = computed(() =>
  cahierStore.cahiers.find(c => c.id === cahierId.value),
)

watch(cahierId, async (id) => {
  if (!id) { destroy(); return }
  await init(id)
}, { immediate: true })

function onRename(newTitle: string) {
  if (cahierId.value) cahierStore.renameCahier(cahierId.value, newTitle)
}
</script>

<template>
  <div class="cahier-editor-wrap">
    <CahierEditorHeader
      :title="currentCahier?.title ?? ''"
      :connected-users="connectedUsers"
      :connected="connected"
      :saving="saving"
      :save-error="saveError"
      @back="cahierStore.closeCahier()"
      @rename="onRename"
    />

    <div class="cahier-editor-body">
      <EditorContent v-if="editor" :editor="editor" class="cahier-tiptap" />
      <div v-else class="cahier-loading">
        <div class="skel skel-line" style="width:60%;height:20px" />
        <div class="skel skel-line" style="width:80%;height:14px;margin-top:12px" />
        <div class="skel skel-line" style="width:45%;height:14px;margin-top:8px" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.cahier-editor-wrap {
  display: flex; flex-direction: column; height: 100%;
  background: var(--bg-main);
}

.cahier-editor-body {
  flex: 1; overflow-y: auto; padding: 24px 32px;
}

.cahier-tiptap {
  max-width: 700px; margin: 0 auto;
}

.cahier-tiptap :deep(.tiptap) {
  outline: none; min-height: 300px;
  font-size: 15px; line-height: 1.7;
  color: var(--text-primary);
}

.cahier-tiptap :deep(.tiptap p) { margin: 0 0 8px; }
.cahier-tiptap :deep(.tiptap h1) { font-size: 24px; font-weight: 700; margin: 24px 0 8px; }
.cahier-tiptap :deep(.tiptap h2) { font-size: 20px; font-weight: 700; margin: 20px 0 6px; }
.cahier-tiptap :deep(.tiptap h3) { font-size: 17px; font-weight: 600; margin: 16px 0 4px; }
.cahier-tiptap :deep(.tiptap ul),
.cahier-tiptap :deep(.tiptap ol) { padding-left: 24px; margin: 4px 0; }
.cahier-tiptap :deep(.tiptap blockquote) {
  border-left: 3px solid var(--accent);
  padding-left: 16px; margin: 8px 0;
  color: var(--text-secondary);
}
.cahier-tiptap :deep(.tiptap code) {
  background: var(--bg-active); padding: 1px 4px;
  border-radius: 3px; font-size: 13px;
}
.cahier-tiptap :deep(.tiptap pre) {
  background: var(--bg-active); padding: 12px 16px;
  border-radius: 8px; overflow-x: auto; font-size: 13px;
}

.cahier-tiptap :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left; height: 0;
  color: var(--text-muted); opacity: .5;
  pointer-events: none;
}

.cahier-tiptap :deep(.collaboration-cursor__caret) {
  position: relative; border-left: 2px solid;
  margin-left: -1px; margin-right: -1px;
  pointer-events: none; word-break: normal;
}
.cahier-tiptap :deep(.collaboration-cursor__label) {
  position: absolute; top: -1.4em; left: -1px;
  font-size: 10px; font-weight: 600;
  padding: 1px 4px; border-radius: 3px 3px 3px 0;
  color: #fff; white-space: nowrap;
  user-select: none; pointer-events: none;
}

.cahier-loading {
  max-width: 700px; margin: 0 auto; padding: 20px 0;
}

@media (max-width: 600px) {
  .cahier-editor-body { padding: 16px 12px; }
}
</style>
