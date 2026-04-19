<script setup lang="ts">
import { Mic } from 'lucide-vue-next'
import { deadlineLabel, deadlineClass } from '@/utils/date'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

export interface SoutenanceAction {
  id: number; title: string; deadline?: string; category?: string | null
}

defineProps<{ soutenances: SoutenanceAction[] }>()
const emit = defineEmits<{ goToProject: [key: string] }>()
</script>

<template>
  <UiWidgetCard
    :icon="Mic"
    :label="soutenances.length > 1 ? 'Prochaines soutenances' : 'Soutenances'"
    tone="warning"
  >
    <div v-if="soutenances.length" class="sa-next-list">
      <div
        v-for="s in soutenances"
        :key="s.id"
        class="sa-next-item"
        role="button"
        tabindex="0"
        :aria-label="'Voir la soutenance ' + s.title"
        @click="emit('goToProject', s.category ?? '')"
        @keydown.enter="emit('goToProject', s.category ?? '')"
        @keydown.space.prevent="emit('goToProject', s.category ?? '')"
      >
        <span class="sa-next-title">{{ s.title }}</span>
        <span v-if="s.deadline" class="deadline-badge" :class="deadlineClass(s.deadline)">{{ deadlineLabel(s.deadline) }}</span>
      </div>
    </div>
    <EmptyState v-else size="sm" tone="muted" title="Aucune soutenance à venir" />
  </UiWidgetCard>
</template>
