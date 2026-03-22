/** RexActivityForm — Formulaire de creation d'activite REX pour enseignants. */
<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { MessageSquare, Cloud, Star, FileText } from 'lucide-vue-next'

  type RexType = 'sondage_libre' | 'nuage' | 'echelle' | 'question_ouverte'

  const emit = defineEmits<{
    add: [payload: { type: RexType; title: string; max_words?: number; max_rating?: number }]
  }>()

  const selectedType = ref<RexType | null>(null)
  const title = ref('')
  const maxWords = ref(2)
  const maxRating = ref(5)

  const types: { value: RexType; label: string; icon: typeof MessageSquare }[] = [
    { value: 'sondage_libre', label: 'Sondage libre', icon: MessageSquare },
    { value: 'nuage',         label: 'Nuage de mots', icon: Cloud },
    { value: 'echelle',       label: 'Echelle',       icon: Star },
    { value: 'question_ouverte', label: 'Question ouverte', icon: FileText },
  ]

  const canSubmit = computed(() => selectedType.value && title.value.trim())

  function submit() {
    if (!canSubmit.value || !selectedType.value) return
    const payload: { type: RexType; title: string; max_words?: number; max_rating?: number } = {
      type: selectedType.value,
      title: title.value.trim(),
    }
    if (selectedType.value === 'nuage') payload.max_words = maxWords.value
    if (selectedType.value === 'echelle') payload.max_rating = maxRating.value
    emit('add', payload)
    title.value = ''
    selectedType.value = null
  }
</script>

<template>
  <div class="rex-form">
    <div class="rex-form-types">
      <button
        v-for="t in types"
        :key="t.value"
        class="rex-type-btn"
        :class="{ active: selectedType === t.value }"
        @click="selectedType = t.value"
      >
        <component :is="t.icon" :size="20" />
        <span>{{ t.label }}</span>
      </button>
    </div>

    <input
      v-model="title"
      type="text"
      class="rex-form-input"
      placeholder="Titre de l'activite..."
      @keydown.enter="submit"
    />

    <div v-if="selectedType === 'nuage'" class="rex-form-option">
      <span class="rex-form-option-label">Nombre de mots max :</span>
      <div class="rex-form-option-btns">
        <button v-for="n in [1, 2, 3]" :key="n" :class="{ active: maxWords === n }" @click="maxWords = n">{{ n }}</button>
      </div>
    </div>

    <div v-if="selectedType === 'echelle'" class="rex-form-option">
      <span class="rex-form-option-label">Echelle :</span>
      <div class="rex-form-option-btns">
        <button :class="{ active: maxRating === 5 }" @click="maxRating = 5">5 etoiles</button>
        <button :class="{ active: maxRating === 10 }" @click="maxRating = 10">10 slider</button>
      </div>
    </div>

    <button class="rex-form-submit" :disabled="!canSubmit" @click="submit">
      Ajouter
    </button>
  </div>
</template>

<style scoped>
.rex-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  background: rgba(13, 148, 136, 0.05);
  border: 1px solid rgba(13, 148, 136, 0.2);
  border-radius: 12px;
}
.rex-form-types {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.rex-type-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--border, rgba(255,255,255,.08));
  background: var(--bg-elevated, #1e1f21);
  color: var(--text-secondary, #aaa);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.4s ease;
  font-family: var(--font, inherit);
}
.rex-type-btn:hover {
  border-color: rgba(13, 148, 136, 0.35);
  color: #14b8a6;
}
.rex-type-btn.active {
  border-color: #0d9488;
  background: rgba(13, 148, 136, 0.12);
  color: #0d9488;
}
.rex-form-input {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border, rgba(255,255,255,.08));
  background: var(--bg-elevated, #1e1f21);
  color: var(--text-primary, #fff);
  font-size: 14px;
  font-family: var(--font, inherit);
  outline: none;
  transition: border-color 0.4s ease;
}
.rex-form-input:focus {
  border-color: #0d9488;
}
.rex-form-option {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rex-form-option-label {
  font-size: 13px;
  color: var(--text-secondary, #aaa);
}
.rex-form-option-btns {
  display: flex;
  gap: 6px;
}
.rex-form-option-btns button {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--border, rgba(255,255,255,.08));
  background: var(--bg-elevated, #1e1f21);
  color: var(--text-secondary, #aaa);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.4s ease;
  font-family: var(--font, inherit);
}
.rex-form-option-btns button.active {
  border-color: #0d9488;
  background: rgba(13, 148, 136, 0.12);
  color: #0d9488;
}
.rex-form-submit {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  background: #0d9488;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.4s ease;
  font-family: var(--font, inherit);
}
.rex-form-submit:hover:not(:disabled) {
  background: #14b8a6;
}
.rex-form-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
