<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { CHANGELOG } from '@/data/changelog'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'

const STORAGE_KEY = 'cursus_changelog_seen'
const expanded = ref(false)
const lastSeenVersion = ref<string | null>(null)

const latest = computed(() => CHANGELOG[0] ?? null)
const isUnseen = computed(() => latest.value && lastSeenVersion.value !== latest.value.version)

onMounted(() => {
  try {
    lastSeenVersion.value = localStorage.getItem(STORAGE_KEY)
  } catch { /* storage disabled */ }
})

function markSeen() {
  if (!latest.value) return
  lastSeenVersion.value = latest.value.version
  try { localStorage.setItem(STORAGE_KEY, latest.value.version) } catch { /* quota */ }
}

function toggleExpanded() {
  expanded.value = !expanded.value
  if (expanded.value) markSeen()
}
</script>

<template>
  <UiWidgetCard
    :icon="Sparkles"
    label="Quoi de neuf"
    :tone="isUnseen ? 'accent' : 'none'"
    aria-label="Nouveautés Cursus"
  >
    <template v-if="latest" #header-extra>
      <span v-if="isUnseen" class="wac-dot" aria-label="Nouvelle version" />
      <span class="wac-version">v{{ latest.version }}</span>
    </template>

    <div v-if="latest" class="wac-body">
      <button
        type="button"
        class="wac-title"
        :aria-expanded="expanded"
        @click="toggleExpanded"
      >
        <span class="wac-title-text">{{ latest.title }}</span>
        <component :is="expanded ? ChevronUp : ChevronDown" :size="14" />
      </button>

      <ul v-if="expanded" class="wac-list">
        <li v-for="(h, i) in latest.highlights" :key="i" class="wac-item">{{ h }}</li>
      </ul>
    </div>
  </UiWidgetCard>
</template>

<style scoped>
.wac-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--accent);
}

.wac-version {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  color: var(--text-muted);
}

.wac-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.wac-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  width: 100%;
  padding: 4px 0;
  background: none;
  border: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.wac-title:hover { color: var(--accent); }
.wac-title:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.wac-title-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wac-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wac-item {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  line-height: 1.4;
  padding-left: var(--space-sm);
  position: relative;
}
.wac-item::before {
  content: '·';
  position: absolute;
  left: 0;
  color: var(--accent);
  font-weight: 700;
}
</style>
