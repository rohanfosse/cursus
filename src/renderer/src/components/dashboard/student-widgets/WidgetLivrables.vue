/**
 * WidgetLivrables.vue — Liste des prochains livrables à rendre.
 */
<script setup lang="ts">
import { FileText } from 'lucide-vue-next'
import { deadlineLabel, deadlineClass } from '@/utils/date'

export interface LivrableAction {
  id: number; title: string; deadline?: string; category?: string | null
}

const props = defineProps<{ livrables: LivrableAction[] }>()
const emit = defineEmits<{ goToProject: [key: string] }>()
</script>

<template>
  <div v-if="livrables.length" class="sa-card sa-next sa-next--livrable">
    <div class="sa-card-header">
      <FileText :size="14" class="sa-card-icon sa-icon--livrable" />
      <span class="sa-section-label">{{ livrables.length > 1 ? 'Prochains livrables' : 'Prochain livrable' }}</span>
    </div>
    <div class="sa-next-list">
      <div v-for="l in livrables" :key="l.id" class="sa-next-item" role="button" tabindex="0" :aria-label="'Voir le livrable ' + l.title" @click="emit('goToProject', l.category ?? '')" @keydown.enter="emit('goToProject', l.category ?? '')">
        <span class="sa-next-title">{{ l.title }}</span>
        <span class="deadline-badge" :class="deadlineClass(l.deadline!)">{{ deadlineLabel(l.deadline!) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Base .sa-card, .sa-card-header, .sa-section-label, .sa-next-* styles in devoirs-shared.css */
.sa-next--livrable { border-left: 3px solid var(--accent); }
.sa-icon--livrable { color: var(--accent); }
</style>
