<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { TrendingUp } from 'lucide-vue-next'
import { useLumenStore } from '@/stores/lumen'
import { useAppStore } from '@/stores/app'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

interface CountRow { repo_id: number; path: string; readers: number }

const appStore = useAppStore()
const lumenStore = useLumenStore()
const counts = ref<CountRow[]>([])

onMounted(async () => {
  const pid = appStore.activePromoId
  if (!pid) return
  await lumenStore.fetchReposForPromo(pid)
  const resp = await window.api.getLumenReadCountsForPromo(pid) as { ok: boolean; data?: { counts: CountRow[] } }
  if (resp.ok && resp.data) counts.value = resp.data.counts
})

const top = computed(() => {
  return [...counts.value]
    .sort((a, b) => b.readers - a.readers)
    .slice(0, 5)
    .map((c) => {
      const repo = lumenStore.repos.find((r) => r.id === c.repo_id)
      const chapter = repo?.manifest?.chapters.find((ch) => ch.path === c.path)
      return {
        ...c,
        title: chapter?.title ?? c.path,
        repoName: repo?.manifest?.project ?? repo?.fullName ?? '',
      }
    })
})

const maxReaders = computed(() => top.value[0]?.readers ?? 1)
</script>

<template>
  <UiWidgetCard :icon="TrendingUp" label="Top chapitres lus">
    <EmptyState v-if="top.length === 0" size="sm" tone="muted" title="Aucune lecture enregistrée" />
    <ul v-else class="wltr-list">
      <li v-for="(item, i) in top" :key="`${item.repo_id}::${item.path}`">
        <div class="wltr-item">
          <span class="wltr-rank">{{ i + 1 }}</span>
          <div class="wltr-item-body">
            <span class="wltr-item-title">{{ item.title }}</span>
            <span class="wltr-item-repo">{{ item.repoName }}</span>
            <div class="wltr-bar-wrap">
              <div class="wltr-bar" :style="{ width: `${(item.readers / maxReaders) * 100}%` }" />
            </div>
          </div>
          <span class="wltr-readers">{{ item.readers }}</span>
        </div>
      </li>
    </ul>
  </UiWidgetCard>
</template>

<style scoped>
.wltr-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.wltr-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.wltr-rank {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-muted);
  width: 14px;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.wltr-item-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.wltr-item-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wltr-item-repo {
  font-size: var(--text-2xs);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wltr-bar-wrap {
  background: var(--bg-input);
  border-radius: 3px;
  overflow: hidden;
  height: 4px;
  margin-top: 3px;
}

.wltr-bar {
  background: var(--accent);
  height: 100%;
  transition: width var(--motion-slow) var(--ease-out);
}

.wltr-readers {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 20px;
  text-align: right;
}
</style>
