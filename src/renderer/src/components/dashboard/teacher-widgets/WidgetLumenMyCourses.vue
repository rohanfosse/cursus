<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { FolderGit2, AlertTriangle } from 'lucide-vue-next'
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

const topRepos = computed(() => {
  return [...lumenStore.repos]
    .sort((a, b) => (b.manifest?.chapters.length ?? 0) - (a.manifest?.chapters.length ?? 0))
    .slice(0, 4)
})

function openLumen() {
  router.push('/lumen')
}
</script>

<template>
  <UiWidgetCard :icon="FolderGit2" label="Mes cours Lumen">
    <template #header-extra>
      <UiWidgetHeaderLink @click="openLumen" />
    </template>

    <EmptyState
      v-if="topRepos.length === 0"
      size="sm"
      tone="muted"
      title="Aucun repo synchronisé"
      subtitle="Configure une organisation GitHub pour commencer."
    />
    <ul v-else class="wlmc-list">
      <li v-for="repo in topRepos" :key="repo.id">
        <button type="button" class="wlmc-item" @click="openLumen">
          <span class="wlmc-item-title">{{ repo.manifest?.project ?? repo.fullName }}</span>
          <span class="wlmc-item-meta">
            <AlertTriangle v-if="repo.manifestError" :size="11" class="wlmc-warn" />
            <span v-if="repo.manifest">{{ repo.manifest.chapters.length }} chapitres</span>
            <span v-else class="wlmc-warn-text">manifest invalide</span>
          </span>
        </button>
      </li>
    </ul>
  </UiWidgetCard>
</template>

<style scoped>
.wlmc-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.wlmc-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  padding: 7px var(--space-sm);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  transition:
    background var(--motion-fast) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out);
}
.wlmc-item:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
}
.wlmc-item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.wlmc-item-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wlmc-item-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: var(--text-xs);
  color: var(--text-muted);
}
.wlmc-warn,
.wlmc-warn-text { color: var(--color-warning); }
</style>
