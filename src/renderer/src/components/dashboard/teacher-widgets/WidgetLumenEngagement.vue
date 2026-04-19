<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Activity } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const appStore = useAppStore()
const stats = ref<{ repos: number; reads: number } | null>(null)

onMounted(async () => {
  const pid = appStore.activePromoId
  if (!pid) return
  const resp = await window.api.getLumenStatsForPromo(pid) as { ok: boolean; data?: { repos: number; reads: number } }
  if (resp.ok && resp.data) stats.value = resp.data
})
</script>

<template>
  <UiWidgetCard :icon="Activity" label="Engagement Lumen">
    <EmptyState v-if="!stats" size="sm" tone="muted" title="Aucune donnée" />
    <div v-else class="wle-metrics">
      <div class="wle-metric">
        <span class="wle-value">{{ stats.repos }}</span>
        <span class="wle-label">Repos</span>
      </div>
      <div class="wle-metric">
        <span class="wle-value">{{ stats.reads }}</span>
        <span class="wle-label">Lectures</span>
      </div>
    </div>
  </UiWidgetCard>
</template>

<style scoped>
.wle-metrics {
  display: flex;
  gap: var(--space-lg);
  justify-content: space-around;
  align-items: center;
  padding: var(--space-sm) 0;
}

.wle-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.wle-value {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.wle-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
