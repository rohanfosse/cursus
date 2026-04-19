<script setup lang="ts">
import { Award } from 'lucide-vue-next'
import { deadlineLabel, deadlineClass } from '@/utils/date'
import { typeLabel } from '@/utils/devoir'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

export interface ExamAction {
  id: number; title: string; deadline?: string; type?: string; category?: string | null
}

defineProps<{ exams: ExamAction[] }>()
const emit = defineEmits<{ goToProject: [key: string] }>()
</script>

<template>
  <UiWidgetCard
    :icon="Award"
    label="CCTLs & Études de cas"
    accent-color="var(--color-cctl)"
  >
    <div v-if="exams.length" class="sa-next-list">
      <div
        v-for="e in exams"
        :key="e.id"
        class="sa-next-item"
        role="button"
        tabindex="0"
        :aria-label="'Voir l\'épreuve ' + e.title"
        @click="emit('goToProject', e.category ?? '')"
        @keydown.enter="emit('goToProject', e.category ?? '')"
        @keydown.space.prevent="emit('goToProject', e.category ?? '')"
      >
        <span class="sa-next-type devoir-type-badge" :class="`type-${e.type}`">{{ typeLabel(e.type ?? 'cctl') }}</span>
        <span class="sa-next-title">{{ e.title }}</span>
        <span v-if="e.deadline" class="deadline-badge" :class="deadlineClass(e.deadline)">{{ deadlineLabel(e.deadline) }}</span>
      </div>
    </div>
    <EmptyState v-else size="sm" tone="muted" title="Aucun CCTL ou étude de cas à venir" />
  </UiWidgetCard>
</template>
