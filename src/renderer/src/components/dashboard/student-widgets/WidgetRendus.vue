<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Inbox, ChevronRight } from 'lucide-vue-next'
import { useTravauxStore } from '@/stores/travaux'
import { typeLabel } from '@/utils/devoir'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const router = useRouter()
const travauxStore = useTravauxStore()

// Devoirs rendus mais pas encore notes par le prof.
const pending = computed(() =>
  travauxStore.devoirs
    .filter(d => d.depot_id != null && d.note == null)
    .slice(0, 5),
)

const totalPending = computed(() => travauxStore.devoirs.filter(d => d.depot_id != null && d.note == null).length)

function goToDevoirs() {
  router.push('/devoirs')
}
</script>

<template>
  <UiWidgetCard
    :icon="Inbox"
    label="Rendus en attente de note"
    interactive
    aria-label="Voir mes devoirs en attente de note"
    @click="goToDevoirs"
  >
    <template v-if="totalPending > 0" #header-extra>
      <span class="wr-count">{{ totalPending }}</span>
      <ChevronRight :size="13" class="wr-chevron" />
    </template>

    <EmptyState
      v-if="!pending.length"
      size="sm"
      tone="muted"
      title="Tout est noté"
    />

    <ul v-else class="wr-list">
      <li v-for="d in pending" :key="d.id" class="wr-item">
        <span class="wr-type">{{ typeLabel(d.type) }}</span>
        <span class="wr-title">{{ d.title }}</span>
      </li>
    </ul>
  </UiWidgetCard>
</template>

<style scoped>
.wr-count {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--accent);
  background: rgba(var(--accent-rgb), .12);
  padding: 1px 6px;
  border-radius: var(--radius);
  font-variant-numeric: tabular-nums;
}
.wr-chevron { color: var(--text-muted); }

.wr-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.wr-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding: 4px 0;
}

.wr-type {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  background: var(--bg-input);
  color: var(--text-muted);
  text-transform: uppercase;
  flex-shrink: 0;
  letter-spacing: 0.03em;
}

.wr-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
}
</style>
