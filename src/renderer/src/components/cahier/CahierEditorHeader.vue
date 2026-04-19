/**
 * Header du CahierEditor : bouton retour, titre editable, liste collaborateurs, statut save.
 */
<script setup lang="ts">
import { ref, watch } from 'vue'
import { ArrowLeft, Save, Users, Pencil, AlertTriangle } from 'lucide-vue-next'
import type { CollabUser } from '@/composables/useCahierCollab'

const props = defineProps<{
  title: string
  connectedUsers: CollabUser[]
  connected: boolean
  saving: boolean
  saveError: string | null
}>()

const emit = defineEmits<{
  back: []
  rename: [title: string]
}>()

const editing = ref(false)
const titleInput = ref('')

watch(() => props.title, (t) => { if (!editing.value) titleInput.value = t })

function startRenaming() {
  editing.value = true
  titleInput.value = props.title
}

function commit() {
  const trimmed = titleInput.value.trim()
  if (trimmed && trimmed !== props.title) emit('rename', trimmed)
  editing.value = false
}
</script>

<template>
  <div class="cahier-editor-header">
    <button class="cahier-back-btn" @click="emit('back')">
      <ArrowLeft :size="16" />
    </button>
    <div class="cahier-title-area">
      <template v-if="editing">
        <input
          v-model="titleInput"
          class="cahier-title-input"
          @keydown.enter="commit"
          @keydown.escape="editing = false"
          @blur="commit"
        />
      </template>
      <template v-else>
        <h2 class="cahier-title" @click="startRenaming">
          {{ title || 'Sans titre' }}
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
      <span v-if="saveError" class="cahier-save-error" :title="saveError">
        <AlertTriangle :size="11" /> Echec sauvegarde
      </span>
      <span v-else-if="saving" class="cahier-saving">
        <Save :size="11" /> Sauvegarde...
      </span>
      <span v-else-if="connected" class="cahier-saved">Sauvegarde auto</span>
    </div>
  </div>
</template>

<style scoped>
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
.cahier-save-error {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--danger, #ef4444); font-weight: 500;
  cursor: help;
}
</style>
