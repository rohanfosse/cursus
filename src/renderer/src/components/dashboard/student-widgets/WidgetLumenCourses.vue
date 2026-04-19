<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { BookOpen } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useLumenStore } from '@/stores/lumen'
import { useAppStore } from '@/stores/app'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import UiWidgetHeaderLink from '@/components/ui/UiWidgetHeaderLink.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const router = useRouter()
const lumenStore = useLumenStore()
const appStore = useAppStore()

onMounted(async () => {
  const pid = appStore.activePromoId
  if (pid) await lumenStore.fetchReposForPromo(pid)
})

const recentRepos = computed(() => {
  return [...lumenStore.repos]
    .filter((r) => r.manifest != null)
    .sort((a, b) => {
      const aT = a.lastSyncedAt ?? ''
      const bT = b.lastSyncedAt ?? ''
      return bT.localeCompare(aT)
    })
    .slice(0, 3)
})

function openLumen() {
  router.push('/lumen')
}
</script>

<template>
  <UiWidgetCard :icon="BookOpen" label="Cours Lumen">
    <template #header-extra>
      <UiWidgetHeaderLink @click="openLumen" />
    </template>

    <EmptyState v-if="recentRepos.length === 0" size="sm" tone="muted" title="Aucun cours disponible" />
    <ul v-else class="wlc-list">
      <li v-for="repo in recentRepos" :key="repo.id">
        <button type="button" class="wlc-item" @click="openLumen">
          <span class="wlc-item-title">{{ repo.manifest?.project ?? repo.fullName }}</span>
          <span class="wlc-item-meta">
            {{ repo.manifest?.chapters?.length ?? 0 }} chapitres
          </span>
        </button>
      </li>
    </ul>
  </UiWidgetCard>
</template>

<style scoped>
.wlc-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.wlc-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  padding: var(--space-sm) var(--space-sm);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  transition:
    background var(--motion-fast) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out);
}
.wlc-item:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
}
.wlc-item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.wlc-item-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wlc-item-meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
}
</style>
