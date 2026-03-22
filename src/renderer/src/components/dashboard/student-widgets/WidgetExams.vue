/**
 * WidgetExams.vue - Liste des prochains CCTLs et études de cas.
 */
<script setup lang="ts">
import { Award } from 'lucide-vue-next'
import { deadlineLabel, deadlineClass } from '@/utils/date'
import { typeLabel } from '@/utils/devoir'

export interface ExamAction {
  id: number; title: string; deadline?: string; type?: string; category?: string | null
}

const props = defineProps<{ exams: ExamAction[] }>()
const emit = defineEmits<{ goToProject: [key: string] }>()
</script>

<template>
  <div v-if="exams.length" class="dashboard-card sa-card sa-next sa-next--exam">
    <div class="sa-card-header">
      <Award :size="14" class="sa-card-icon sa-icon--exam" />
      <span class="sa-section-label">{{ exams.length > 1 ? 'Prochaines épreuves' : 'Prochaine épreuve' }}</span>
    </div>
    <div class="sa-next-list">
      <div v-for="e in exams" :key="e.id" class="sa-next-item" role="button" tabindex="0" :aria-label="'Voir l\'épreuve ' + e.title" @click="emit('goToProject', e.category ?? '')" @keydown.enter="emit('goToProject', e.category ?? '')">
        <span class="sa-next-type devoir-type-badge" :class="`type-${e.type}`">{{ typeLabel(e.type ?? 'cctl') }}</span>
        <span class="sa-next-title">{{ e.title }}</span>
        <span class="deadline-badge" :class="deadlineClass(e.deadline!)">{{ deadlineLabel(e.deadline!) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Base .sa-card, .sa-card-header, .sa-section-label, .sa-next-* styles in devoirs-shared.css */
.sa-next--exam { border-left: 3px solid var(--color-cctl, #9b87f5); }
.sa-icon--exam { color: var(--color-cctl, #9b87f5); }
</style>
