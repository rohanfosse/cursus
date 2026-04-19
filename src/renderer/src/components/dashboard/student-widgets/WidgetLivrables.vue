<script setup lang="ts">
import { FileText } from 'lucide-vue-next'
import { deadlineLabel, deadlineClass } from '@/utils/date'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

export interface LivrableAction {
  id: number; title: string; deadline?: string; category?: string | null
}

defineProps<{ livrables: LivrableAction[] }>()
const emit = defineEmits<{ goToProject: [key: string] }>()
</script>

<template>
  <UiWidgetCard
    :icon="FileText"
    :label="livrables.length > 1 ? 'Prochains livrables' : 'Livrables'"
    tone="accent"
  >
    <div v-if="livrables.length" class="sa-next-list">
      <div
        v-for="l in livrables"
        :key="l.id"
        class="sa-next-item"
        role="button"
        tabindex="0"
        :aria-label="'Voir le livrable ' + l.title"
        @click="emit('goToProject', l.category ?? '')"
        @keydown.enter="emit('goToProject', l.category ?? '')"
        @keydown.space.prevent="emit('goToProject', l.category ?? '')"
      >
        <span class="sa-next-title">{{ l.title }}</span>
        <span v-if="l.deadline" class="deadline-badge" :class="deadlineClass(l.deadline)">{{ deadlineLabel(l.deadline) }}</span>
      </div>
    </div>
    <EmptyState v-else size="sm" tone="muted" title="Aucun livrable à venir" />
  </UiWidgetCard>
</template>
