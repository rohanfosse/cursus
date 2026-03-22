/**
 * WidgetSoutenances.vue — Liste des prochaines soutenances.
 */
<script setup lang="ts">
import { Mic } from 'lucide-vue-next'
import { deadlineLabel, deadlineClass } from '@/utils/date'

export interface SoutenanceAction {
  id: number; title: string; deadline?: string; category?: string | null
}

const props = defineProps<{ soutenances: SoutenanceAction[] }>()
const emit = defineEmits<{ goToProject: [key: string] }>()
</script>

<template>
  <div v-if="soutenances.length" class="sa-card sa-next sa-next--soutenance">
    <div class="sa-card-header">
      <Mic :size="14" class="sa-card-icon sa-icon--soutenance" />
      <span class="sa-section-label">{{ soutenances.length > 1 ? 'Prochaines soutenances' : 'Prochaine soutenance' }}</span>
    </div>
    <div class="sa-next-list">
      <div v-for="s in soutenances" :key="s.id" class="sa-next-item" role="button" tabindex="0" :aria-label="'Voir la soutenance ' + s.title" @click="emit('goToProject', s.category ?? '')" @keydown.enter="emit('goToProject', s.category ?? '')">
        <span class="sa-next-title">{{ s.title }}</span>
        <span class="deadline-badge" :class="deadlineClass(s.deadline!)">{{ deadlineLabel(s.deadline!) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Base .sa-card, .sa-card-header, .sa-section-label, .sa-next-* styles in devoirs-shared.css */
.sa-next--soutenance { border-left: 3px solid var(--color-warning); }
.sa-icon--soutenance { color: var(--color-warning); }
</style>
