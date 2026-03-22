/**
 * WidgetExams.vue — Liste des prochains CCTLs et études de cas.
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
  <div v-if="exams.length" class="sa-card sa-next sa-next--exam">
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
.sa-card {
  background: rgba(255,255,255,.03); border: 1px solid var(--border);
  border-radius: 12px; padding: 16px 18px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.sa-card:hover { background: rgba(255,255,255,.045); }
.sa-card-header { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.sa-card-icon { color: var(--text-muted); flex-shrink: 0; }
.sa-section-label {
  text-transform: uppercase; letter-spacing: .08em; font-size: 10px;
  font-weight: 700; color: var(--text-muted); flex: 1;
}
.sa-next--exam { border-left: 3px solid var(--color-cctl, #9b87f5); }
.sa-icon--exam { color: var(--color-cctl, #9b87f5); }
.sa-next-list { display: flex; flex-direction: column; gap: 6px; }
.sa-next-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 8px;
  background: rgba(255,255,255,.02); cursor: pointer;
  transition: background .15s cubic-bezier(0.4, 0, 0.2, 1);
}
.sa-next-item:hover { background: rgba(255,255,255,.06); }
.sa-next-title {
  flex: 1; font-size: 13px; font-weight: 500; color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
</style>
