<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Notebook, Plus } from 'lucide-vue-next'
import { useCahierStore } from '@/stores/cahier'
import { relativeTime } from '@/utils/date'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import UiWidgetHeaderLink from '@/components/ui/UiWidgetHeaderLink.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const router = useRouter()
const cahierStore = useCahierStore()

onMounted(async () => {
  if (!cahierStore.cahiers.length) await cahierStore.fetchCahiers()
})

// Top 3 cahiers, tries par derniere modif.
const recent = computed(() => {
  return [...cahierStore.cahiers]
    .sort((a, b) => (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at))
    .slice(0, 3)
})

function openCahier(id: number) {
  cahierStore.openCahier(id)
  router.push('/documents')
}

function goToCahiers() {
  router.push('/documents')
}

async function createCahier() {
  const id = await cahierStore.createCahier('Nouveau cahier')
  if (id) openCahier(id)
}
</script>

<template>
  <UiWidgetCard
    :icon="Notebook"
    label="Cahiers collaboratifs"
    aria-label="Cahiers collaboratifs"
  >
    <template #header-extra>
      <UiWidgetHeaderLink @click="goToCahiers" />
    </template>

    <EmptyState
      v-if="!recent.length"
      size="sm"
      tone="muted"
      title="Aucun cahier"
    >
      <button type="button" class="wch-create" @click="createCahier">
        <Plus :size="12" /> Créer un cahier
      </button>
    </EmptyState>

    <ul v-else class="wch-list">
      <li v-for="c in recent" :key="c.id">
        <button type="button" class="wch-item" @click="openCahier(c.id)">
          <span class="wch-title">{{ c.title || 'Sans titre' }}</span>
          <span class="wch-meta">
            <span v-if="c.author_name">{{ c.author_name }} ·</span>
            {{ relativeTime(c.updated_at ?? c.created_at) }}
          </span>
        </button>
      </li>
    </ul>
  </UiWidgetCard>
</template>

<style scoped>
.wch-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.wch-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  padding: var(--space-sm);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  transition:
    background var(--motion-fast) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out);
}
.wch-item:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
}
.wch-item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.wch-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wch-meta {
  font-size: var(--text-2xs);
  color: var(--text-muted);
}

.wch-create {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 4px var(--space-md);
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--motion-fast) var(--ease-out);
}
.wch-create:hover { opacity: .9; }
.wch-create:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
