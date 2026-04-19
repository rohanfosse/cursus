<script setup lang="ts">
import { ref, computed } from 'vue'
import { Award, FileText, Mic, ListChecks } from 'lucide-vue-next'
import { relativeTime } from '@/utils/date'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

interface Action {
  id: number
  title: string
  deadline?: string
  type?: string
  category?: string | null
  isOverdue?: boolean
}

const props = defineProps<{
  exams: Action[]
  livrables: Action[]
  soutenances: Action[]
}>()

const emit = defineEmits<{ goToProject: [key: string] }>()

type Tab = 'exams' | 'livrables' | 'soutenances'
const activeTab = ref<Tab>('exams')

const tabs = computed(() => [
  { id: 'exams' as Tab,       label: 'CCTLs',       icon: Award,    count: props.exams.length },
  { id: 'livrables' as Tab,   label: 'Livrables',   icon: FileText, count: props.livrables.length },
  { id: 'soutenances' as Tab, label: 'Soutenances', icon: Mic,      count: props.soutenances.length },
])

const activeItems = computed<Action[]>(() => {
  if (activeTab.value === 'exams') return props.exams
  if (activeTab.value === 'livrables') return props.livrables
  return props.soutenances
})

const totalCount = computed(() =>
  props.exams.length + props.livrables.length + props.soutenances.length,
)

function handleClick(action: Action) {
  if (action.category) emit('goToProject', action.category)
}
</script>

<template>
  <UiWidgetCard
    :icon="ListChecks"
    label="Échéances"
    aria-label="Échéances à venir"
  >
    <template v-if="totalCount > 0" #header-extra>
      <span class="we-count">{{ totalCount }}</span>
    </template>

    <nav class="we-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="we-tab"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" :size="11" />
        {{ tab.label }}
        <span v-if="tab.count > 0" class="we-tab-count">{{ tab.count }}</span>
      </button>
    </nav>

    <EmptyState v-if="activeItems.length === 0" size="sm" tone="muted" title="Aucune échéance à venir" />
    <ul v-else class="we-list">
      <li
        v-for="item in activeItems"
        :key="item.id"
        class="we-item"
        :class="{ overdue: item.isOverdue }"
        role="button"
        tabindex="0"
        @click="handleClick(item)"
        @keydown.enter="handleClick(item)"
        @keydown.space.prevent="handleClick(item)"
      >
        <span class="we-item-title">{{ item.title }}</span>
        <span v-if="item.deadline" class="we-item-deadline" :class="{ overdue: item.isOverdue }">
          {{ relativeTime(item.deadline) }}
        </span>
      </li>
    </ul>
  </UiWidgetCard>
</template>

<style scoped>
.we-count {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--accent);
  background: rgba(var(--accent-rgb), .12);
  padding: 1px 6px;
  border-radius: var(--radius);
}

.we-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid var(--border);
}
.we-tab {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 6px var(--space-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color var(--motion-fast) var(--ease-out), border-color var(--motion-fast) var(--ease-out);
}
.we-tab:hover { color: var(--text-secondary); }
.we-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
.we-tab:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.we-tab-count {
  font-size: var(--text-2xs);
  background: var(--bg-hover);
  padding: 0 var(--space-xs);
  border-radius: 8px;
}

.we-list {
  list-style: none;
  margin: 0;
  padding: var(--space-sm) 0 0;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.we-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out);
}
.we-item:hover { background: var(--bg-hover); }
.we-item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.we-item-title {
  font-size: var(--text-sm);
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.we-item-deadline {
  flex-shrink: 0;
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 2px var(--space-sm);
  border-radius: var(--radius);
  background: rgba(var(--accent-rgb), .1);
  color: var(--accent);
}
.we-item-deadline.overdue {
  background: rgba(var(--color-danger-rgb), .1);
  color: var(--color-danger);
}
</style>
