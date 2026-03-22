/**
 * SidebarNextAction — Shows the single most urgent devoir or a "tout est à jour" card.
 */
<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle, ArrowRight } from 'lucide-vue-next'
import { deadlineLabel, deadlineClass } from '@/utils/date'

interface Action {
  id: number
  title: string
  type: string
  category: string | null
  deadline: string
  isOverdue: boolean
}

const props = defineProps<{ action: Action | null }>()
const emit = defineEmits<{
  'open-devoir': [id: number]
  'navigate-devoirs': []
}>()

const borderColor = computed(() => {
  if (!props.action) return 'transparent'
  const dc = deadlineClass(props.action.deadline)
  if (dc === 'deadline-passed') return '#ef4444'
  if (dc === 'deadline-critical') return '#f59e0b'
  if (dc === 'deadline-soon') return '#fbbf24'
  return 'var(--accent, #6366f1)'
})

const countdownLabel = computed(() => {
  if (!props.action) return ''
  return deadlineLabel(props.action.deadline)
})
</script>

<template>
  <div class="sb-next-action-wrap">
    <!-- Has action -->
    <button
      v-if="action"
      class="sb-next-action"
      :style="{ borderLeftColor: borderColor }"
      @click="emit('open-devoir', action.id)"
    >
      <div class="sb-next-action-top">
        <span class="sb-next-action-title">{{ action.title }}</span>
        <ArrowRight :size="12" class="sb-next-action-arrow" />
      </div>
      <div class="sb-next-action-meta">
        <span v-if="action.category" class="sb-next-action-cat">{{ action.category }}</span>
        <span class="sb-next-action-deadline" :class="{ overdue: action.isOverdue }">
          {{ countdownLabel }}
        </span>
      </div>
    </button>

    <!-- All done -->
    <div v-else class="sb-next-action sb-next-action-done">
      <CheckCircle :size="14" class="sb-done-icon" />
      <span class="sb-done-text">Tout est à jour</span>
    </div>

    <button class="sb-next-action-link" @click="emit('navigate-devoirs')">
      Voir tous les devoirs
    </button>
  </div>
</template>

<style scoped>
.sb-next-action-wrap {
  padding: 0 10px;
  margin-bottom: 6px;
}

.sb-next-action {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  border: none;
  border-left: 3px solid transparent;
  cursor: pointer;
  font-family: var(--font);
  color: var(--text-primary);
  text-align: left;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.sb-next-action:hover {
  background: rgba(255, 255, 255, 0.06);
}

.sb-next-action-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.sb-next-action-title {
  font-size: 12.5px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.sb-next-action-arrow {
  flex-shrink: 0;
  opacity: 0.4;
}

.sb-next-action-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
}

.sb-next-action-cat {
  font-size: 10px;
  color: var(--text-muted);
  padding: 1px 5px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 4px;
}

.sb-next-action-deadline {
  font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace;
  font-size: 10px;
  color: var(--text-muted);
}
.sb-next-action-deadline.overdue {
  color: #f87171;
}

/* All done state */
.sb-next-action-done {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  cursor: default;
  border-left-color: rgba(74, 222, 128, 0.4);
}
.sb-done-icon {
  color: #4ade80;
  flex-shrink: 0;
}
.sb-done-text {
  font-size: 12.5px;
  color: #4ade80;
  opacity: 0.9;
}

.sb-next-action-link {
  display: block;
  width: 100%;
  margin-top: 4px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  font-family: var(--font);
  font-size: 10px;
  color: var(--text-muted);
  text-align: right;
  opacity: 0.7;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.sb-next-action-link:hover {
  opacity: 1;
  color: var(--accent, #6366f1);
}
</style>
