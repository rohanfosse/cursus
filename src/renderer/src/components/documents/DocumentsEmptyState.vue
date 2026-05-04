<script setup lang="ts">
/**
 * DocumentsEmptyState : etat vide de la vue Documents.
 * Adapte le message selon (student vs teacher) et (recherche active vs pas).
 */
import { FolderOpen, Upload, Plus } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useDocumentsStore } from '@/stores/documents'

defineEmits<{ (e: 'add'): void }>()

const appStore = useAppStore()
const docStore = useDocumentsStore()
</script>

<template>
  <div class="docs-empty">
    <FolderOpen :size="40" class="docs-empty-icon" />
    <p class="docs-empty-title">Aucun document</p>
    <p class="docs-empty-sub">
      {{ docStore.searchQuery
        ? 'Aucun resultat pour cette recherche. Essayez d\'autres mots-cles.'
        : appStore.isStudent
          ? 'Aucun document pour le moment. Les documents seront ajoutes par votre responsable.'
          : 'Ce canal ne contient pas encore de document.'
      }}
    </p>
    <p v-if="appStore.isTeacher && !docStore.searchQuery" class="docs-empty-hint">
      <Upload :size="14" />
      Glissez un fichier ici ou cliquez Ajouter
    </p>
    <button v-if="appStore.isTeacher && !docStore.searchQuery" class="btn-cta" @click="$emit('add')">
      <Plus :size="14" /> Ajouter un document
    </button>
  </div>
</template>
