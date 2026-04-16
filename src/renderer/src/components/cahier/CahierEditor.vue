/**
 * Editeur collaboratif TipTap WYSIWYG avec Yjs CRDT.
 * Affiche les curseurs des collaborateurs et sauvegarde automatiquement.
 */
<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import Placeholder from '@tiptap/extension-placeholder'
import { ArrowLeft, Save, Users, Pencil } from 'lucide-vue-next'
import { useCahierCollab } from '@/composables/useCahierCollab'
import { useCahierStore } from '@/stores/cahier'
import { useAppStore } from '@/stores/app'

const cahierStore = useCahierStore()
const appStore = useAppStore()

const cahierId = computed(() => cahierStore.activeCahierId)
const { ydoc, provider, connected, saving, connectedUsers, init, destroy } = useCahierCollab(cahierId)

const editingTitle = ref(false)
const titleInput = ref('')
const currentCahier = computed(() =>
  cahierStore.cahiers.find(c => c.id === cahierId.value),
)

const editor = useEditor({
  extensions: [
    StarterKit,
    Placeholder.configure({ placeholder: 'Commencez a ecrire...' }),
    ...(ydoc.value ? [
      Collaboration.configure({ document: ydoc.value }),
      CollaborationCaret.configure({
        provider: provider.value,
        user: {
          name: appStore.currentUser?.name ?? 'Anonyme',
          color: '#3b82f6',
        },
      }),
    ] : []),
  ],
  editable: true,
})

// Initialize Yjs when cahierId changes
watch(cahierId, async (id) => {
  if (!id) { destroy(); return }
  await init(id)

  // Reconfigure editor with Yjs
  if (editor.value && ydoc.value) {
    editor.value.destroy()
  }
}, { immediate: false })

onMounted(async () => {
  if (cahierId.value) {
    await init(cahierId.value)
  }
})

onBeforeUnmount(() => {
  editor.value?.destroy()
  destroy()
})

function goBack() {
  cahierStore.closeCahier()
}

function startRenaming() {
  editingTitle.value = true
  titleInput.value = currentCahier.value?.title ?? ''
}

async function saveTitle() {
  if (cahierId.value && titleInput.value.trim()) {
    await cahierStore.renameCahier(cahierId.value, titleInput.value.trim())
  }
  editingTitle.value = false
}
</script>

<template>
  <div class="cahier-editor-wrap">
    <!-- Header -->
    <div class="cahier-editor-header">
      <button class="cahier-back-btn" @click="goBack">
        <ArrowLeft :size="16" />
      </button>
      <div class="cahier-title-area">
        <template v-if="editingTitle">
          <input
            v-model="titleInput"
            class="cahier-title-input"
            @keydown.enter="saveTitle"
            @keydown.escape="editingTitle = false"
            @blur="saveTitle"
          />
        </template>
        <template v-else>
          <h2 class="cahier-title" @click="startRenaming">
            {{ currentCahier?.title ?? 'Sans titre' }}
            <Pencil :size="12" class="cahier-title-edit" />
          </h2>
        </template>
      </div>
      <div class="cahier-header-right">
        <div v-if="connectedUsers.length > 1" class="cahier-users">
          <Users :size="13" />
          <span>{{ connectedUsers.length }}</span>
          <div class="cahier-user-dots">
            <span
              v-for="u in connectedUsers.slice(0, 5)"
              :key="u.userId"
              class="cahier-user-dot"
              :style="{ background: u.color }"
              :title="u.name"
            />
          </div>
        </div>
        <span v-if="saving" class="cahier-saving">
          <Save :size="11" /> Sauvegarde...
        </span>
        <span v-else-if="connected" class="cahier-saved">Sauvegarde auto</span>
      </div>
    </div>

    <!-- Editor -->
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

.cahier-editor-header {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; border-bottom: 1px solid var(--border);
  background: var(--bg-sidebar); flex-shrink: 0;
}

.cahier-back-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 8px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-secondary); cursor: pointer;
  transition: all .15s;
}
.cahier-back-btn:hover { background: var(--bg-hover); color: var(--accent); border-color: var(--accent); }

.cahier-title-area { flex: 1; min-width: 0; }
.cahier-title {
  font-size: 16px; font-weight: 700; color: var(--text-primary);
  cursor: pointer; display: flex; align-items: center; gap: 6px;
  margin: 0;
}
.cahier-title-edit { opacity: 0; transition: opacity .15s; color: var(--text-muted); }
.cahier-title:hover .cahier-title-edit { opacity: 1; }

.cahier-title-input {
  font-size: 16px; font-weight: 700; color: var(--text-primary);
  background: transparent; border: none; border-bottom: 2px solid var(--accent);
  outline: none; font-family: var(--font); width: 100%; padding: 2px 0;
}

.cahier-header-right {
  display: flex; align-items: center; gap: 10px; flex-shrink: 0;
}

.cahier-users {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; color: var(--text-muted);
}

.cahier-user-dots { display: flex; gap: 2px; }
.cahier-user-dot {
  width: 8px; height: 8px; border-radius: 50%;
  border: 1px solid var(--bg-sidebar);
}

.cahier-saving {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--text-muted); font-style: italic;
}
.cahier-saved {
  font-size: 11px; color: var(--text-muted); opacity: .6;
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

/* Placeholder */
.cahier-tiptap :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left; height: 0;
  color: var(--text-muted); opacity: .5;
  pointer-events: none;
}

/* Collaboration cursors */
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
