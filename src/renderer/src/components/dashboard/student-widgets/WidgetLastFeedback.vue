<script setup lang="ts">
import { computed } from 'vue'
import { MessageSquare, ChevronRight } from 'lucide-vue-next'
import { gradeColor as getGradeColor } from '@/utils/grade'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

interface Feedback {
  title: string
  feedback: string
  note: string | null
  category: string | null
}

const props = defineProps<{
  feedback: Feedback | null
}>()

const emit = defineEmits<{
  goToProject: [key: string]
}>()

const gradeColor = computed(() => {
  if (!props.feedback?.note) return 'var(--text-muted)'
  return getGradeColor(props.feedback.note)
})

function handleClick() {
  if (props.feedback?.category) {
    emit('goToProject', props.feedback.category)
  }
}
</script>

<template>
  <UiWidgetCard
    v-if="feedback"
    :icon="MessageSquare"
    label="Dernier retour"
    interactive
    aria-label="Voir le dernier retour"
    :accent-color="gradeColor"
    @click="handleClick"
  >
    <template #header-extra>
      <ChevronRight :size="13" class="wlf-chevron" />
    </template>
    <div class="wlf-row">
      <span v-if="feedback.note" class="wlf-grade" :style="{ color: gradeColor }">
        {{ feedback.note.toUpperCase() }}
      </span>
      <h3 class="wlf-title">{{ feedback.title }}</h3>
    </div>
    <p class="wlf-text">{{ feedback.feedback }}</p>
  </UiWidgetCard>

  <UiWidgetCard
    v-else
    :icon="MessageSquare"
    label="Dernier retour"
  >
    <EmptyState size="sm" tone="muted" title="Aucun retour pour le moment" />
  </UiWidgetCard>
</template>

<style scoped>
.wlf-chevron { color: var(--text-muted); }

.wlf-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xs);
}

.wlf-grade {
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  font-weight: 800;
  flex-shrink: 0;
  line-height: 1;
}

.wlf-title {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.wlf-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

</style>
