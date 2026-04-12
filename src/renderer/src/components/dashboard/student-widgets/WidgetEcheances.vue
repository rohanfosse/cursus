<script setup lang="ts">
/**
 * Widget unifie Echeances (v2.97) — fusionne les 3 anciens widgets
 * CCTLs, Livrables et Soutenances dans un seul bloc avec onglets.
 */
import { ref, computed } from 'vue'
import { Award, FileText, Mic, ListChecks } from 'lucide-vue-next'
import { relativeTime } from '@/utils/date'

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
  { id: 'soutenances' as Tab, label: 'Soutenances',  icon: Mic,      count: props.soutenances.length },
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
  <div class="we">
    <header class="we-head">
      <ListChecks :size="14" />
      <span class="we-title">Echeances</span>
      <span v-if="totalCount > 0" class="we-count">{{ totalCount }}</span>
    </header>

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

    <div v-if="activeItems.length === 0" class="we-empty">
      Aucune echeance a venir
    </div>
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
      >
        <span class="we-item-title">{{ item.title }}</span>
        <span v-if="item.deadline" class="we-item-deadline" :class="{ overdue: item.isOverdue }">
          {{ relativeTime(item.deadline) }}
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.we {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.we-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}
.we-count {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  padding: 1px 6px;
  border-radius: 10px;
}
@supports not (color: color-mix(in srgb, white, black)) {
  .we-count { background: var(--bg-hover); }
}

.we-tabs {
  display: flex;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
}
.we-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.we-tab:hover { color: var(--text-secondary); }
.we-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
.we-tab-count {
  font-size: 10px;
  background: var(--bg-hover);
  padding: 0 4px;
  border-radius: 8px;
}

.we-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 12px;
  padding: 16px;
}

.we-list {
  list-style: none;
  margin: 0;
  padding: 8px 12px;
  flex: 1;
  overflow-y: auto;
}
.we-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.we-item:hover { background: var(--bg-hover); }
.we-item-title {
  font-size: 13px;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.we-item-deadline {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
}
@supports not (color: color-mix(in srgb, white, black)) {
  .we-item-deadline { background: var(--bg-hover); }
}
.we-item-deadline.overdue {
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  color: var(--danger);
}
@supports not (color: color-mix(in srgb, white, black)) {
  .we-item-deadline.overdue { background: var(--bg-hover); }
}
</style>
