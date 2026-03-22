/**
 * Overlay drag & drop + barre de confirmation pour déposer un fichier.
 * Réutilisable dans toutes les vues (Messages, Documents, Devoirs).
 */
<script setup lang="ts">
import { ref } from 'vue'
import { Upload, X, FileText } from 'lucide-vue-next'
import type { DroppedFile } from '@/composables/useFileDrop'

const props = defineProps<{
  isDragOver: boolean
  pendingFile: DroppedFile | null
  uploading: boolean
}>()

const emit = defineEmits<{
  confirm: [name: string, category: string]
  cancel: []
}>()

const editName = ref('')
const editCat  = ref('')

function onConfirm() {
  emit('confirm', editName.value, editCat.value)
}

// Sync name when pendingFile changes
import { watch } from 'vue'
watch(() => props.pendingFile, (f) => {
  if (f) { editName.value = f.name; editCat.value = '' }
})
</script>

<template>
  <!-- Overlay visuel pendant le drag -->
  <Transition name="drop-fade">
    <div v-if="isDragOver" class="drop-overlay">
      <div class="drop-overlay-content">
        <Upload :size="32" />
        <span>Déposez votre fichier ici</span>
      </div>
    </div>
  </Transition>

  <!-- Barre de confirmation après le drop -->
  <Transition name="drop-bar">
    <div v-if="pendingFile" class="drop-bar">
      <FileText :size="16" class="drop-bar-icon" />
      <input
        v-model="editName"
        class="drop-bar-input"
        placeholder="Nom du document"
        @keydown.enter="onConfirm"
        @keydown.escape="emit('cancel')"
      />
      <input
        v-model="editCat"
        class="drop-bar-input drop-bar-cat"
        placeholder="Catégorie (optionnel)"
        @keydown.enter="onConfirm"
      />
      <button class="drop-bar-btn drop-bar-ok" :disabled="uploading" @click="onConfirm">
        {{ uploading ? 'Envoi…' : 'Ajouter' }}
      </button>
      <button class="drop-bar-btn drop-bar-cancel" @click="emit('cancel')">
        <X :size="14" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.drop-overlay {
  position: absolute; inset: 0; z-index: 50;
  background: rgba(74,144,217,.08);
  border: 2px dashed var(--accent);
  border-radius: var(--radius);
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.drop-overlay-content {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  color: var(--accent); font-size: 15px; font-weight: 600;
}

.drop-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; background: var(--bg-elevated);
  border: 1px solid var(--border); border-radius: 8px;
  margin: 8px 16px;
}
.drop-bar-icon { color: var(--accent); flex-shrink: 0; }
.drop-bar-input {
  flex: 1; min-width: 0; padding: 5px 8px; font-size: 12px;
  background: var(--bg-input); border: 1px solid var(--border-input);
  border-radius: 6px; color: var(--text-primary); font-family: var(--font);
}
.drop-bar-input:focus { border-color: var(--accent); outline: none; }
.drop-bar-cat { max-width: 140px; }
.drop-bar-btn {
  padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;
  cursor: pointer; font-family: var(--font); border: none;
}
.drop-bar-ok { background: var(--accent); color: #fff; }
.drop-bar-ok:hover { opacity: .9; }
.drop-bar-ok:disabled { opacity: .5; cursor: not-allowed; }
.drop-bar-cancel { background: rgba(255,255,255,.06); color: var(--text-muted); }
.drop-bar-cancel:hover { background: rgba(255,255,255,.1); }

.drop-fade-enter-active, .drop-fade-leave-active { transition: opacity .2s; }
.drop-fade-enter-from, .drop-fade-leave-to { opacity: 0; }
.drop-bar-enter-active { transition: all .2s ease; }
.drop-bar-leave-active { transition: all .15s ease; }
.drop-bar-enter-from { opacity: 0; transform: translateY(-8px); }
.drop-bar-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
