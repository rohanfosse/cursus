/**
 * WidgetLastFeedback.vue - Dernier retour d'un devoir avec note colorée.
 */
<script setup lang="ts">
import { computed } from 'vue'
import { MessageSquare, ChevronRight } from 'lucide-vue-next'

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
  const n = props.feedback.note.toUpperCase().trim()
  if (n === 'A') return '#4ade80'
  if (n === 'B') return '#60a5fa'
  if (n === 'C') return '#f59e0b'
  if (n === 'D') return '#ef4444'
  return 'var(--text-muted)'
})

const borderColor = computed(() => gradeColor.value)

function handleClick() {
  if (props.feedback?.category) {
    emit('goToProject', props.feedback.category)
  }
}
</script>

<template>
  <div
    v-if="feedback"
    class="dashboard-card sa-card sa-feedback"
    :style="{ borderLeftColor: borderColor }"
    role="button"
    tabindex="0"
    aria-label="Voir le dernier retour"
    @click="handleClick"
    @keydown.enter="handleClick"
  >
    <div class="sa-card-header">
      <MessageSquare :size="14" class="sa-card-icon" />
      <span class="sa-section-label">Dernier retour</span>
      <ChevronRight :size="13" class="sa-chevron" />
    </div>
    <div class="sa-feedback-row">
      <span v-if="feedback.note" class="sa-feedback-grade" :style="{ color: gradeColor }">
        {{ feedback.note.toUpperCase() }}
      </span>
      <h3 class="sa-feedback-title">{{ feedback.title }}</h3>
    </div>
    <p class="sa-feedback-text">{{ feedback.feedback }}</p>
  </div>

  <div v-else class="dashboard-card sa-card sa-feedback sa-feedback--empty">
    <div class="sa-card-header">
      <MessageSquare :size="14" class="sa-card-icon" />
      <span class="sa-section-label">Dernier retour</span>
    </div>
    <p class="sa-feedback-empty">Aucun retour pour le moment</p>
  </div>
</template>

<style scoped>
/* Base card: .dashboard-card from dashboard-shared.css + .sa-card from devoirs-shared.css */

.sa-feedback { cursor: pointer; border-left: 3px solid transparent; }
.sa-feedback--empty { cursor: default; }

.sa-feedback-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.sa-feedback-grade {
  font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace;
  font-size: 18px;
  font-weight: 800;
  flex-shrink: 0;
  line-height: 1;
}

.sa-feedback-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sa-feedback-text {
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.sa-feedback-empty {
  font-size: 12.5px;
  color: var(--text-muted);
  margin: 0;
  opacity: .7;
}
</style>
