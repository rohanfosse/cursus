<script setup lang="ts">
/**
 * LumenNewChapterModal : modale de creation d'un chapitre .md dans un
 * repo Lumen. Etat + logique de save geres par useLumenNewChapter.
 */
import { X, Plus, Loader2 } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'

interface Props {
  modelValue: boolean
  sectionTitle: string | null
  title: string
  filename: string
  message: string
  path: string
  saving: boolean
  canCreate: boolean
}
interface Emits {
  (e: 'update:modelValue', v: boolean): void
  (e: 'update:title', v: string): void
  (e: 'update:filename', v: string): void
  (e: 'update:message', v: string): void
  (e: 'filename-input'): void
  (e: 'save'): void
  (e: 'close'): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<template>
  <Modal :model-value="modelValue" max-width="520px" @update:model-value="$emit('update:modelValue', $event)">
    <div class="lumen-new-chapter">
      <header class="lumen-new-head">
        <div>
          <h2 class="lumen-new-title">Nouveau chapitre</h2>
          <p v-if="sectionTitle" class="lumen-new-sub">
            dans <strong>{{ sectionTitle }}</strong>
          </p>
        </div>
        <button
          type="button"
          class="lumen-new-close"
          aria-label="Fermer"
          :disabled="saving"
          @click="$emit('close')"
        >
          <X :size="16" />
        </button>
      </header>
      <div class="lumen-new-body">
        <label class="lumen-new-label">
          Titre du chapitre
          <input
            :value="title"
            type="text"
            class="form-input"
            placeholder="Ex: Introduction aux routeurs"
            maxlength="200"
            @input="$emit('update:title', ($event.target as HTMLInputElement).value)"
            @keydown.enter.prevent="$emit('save')"
          />
        </label>
        <label class="lumen-new-label">
          Nom de fichier
          <input
            :value="filename"
            type="text"
            class="form-input"
            placeholder="introduction-routeurs.md"
            maxlength="200"
            @input="$emit('update:filename', ($event.target as HTMLInputElement).value); $emit('filename-input')"
          />
        </label>
        <p v-if="path" class="lumen-new-path">
          <span class="lumen-new-path-label">Chemin complet :</span>
          <code>{{ path }}</code>
        </p>
        <label class="lumen-new-label">
          Message de commit (optionnel)
          <input
            :value="message"
            type="text"
            class="form-input"
            :placeholder="`docs: add ${path || 'nouveau-chapitre.md'}`"
            maxlength="200"
            @input="$emit('update:message', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
      <footer class="lumen-new-foot">
        <button type="button" class="btn-ghost" :disabled="saving" @click="$emit('close')">
          Annuler
        </button>
        <button type="button" class="btn-cta" :disabled="!canCreate" @click="$emit('save')">
          <Loader2 v-if="saving" :size="14" class="spin" />
          <Plus v-else :size="14" />
          {{ saving ? 'Creation...' : 'Creer' }}
        </button>
      </footer>
    </div>
  </Modal>
</template>
