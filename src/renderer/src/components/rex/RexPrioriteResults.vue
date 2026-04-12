<!-- RexPrioriteResults.vue - Visualisation du classement Borda pour les activités priorité -->
<script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{
    rankings: { item: string; avgRank: number }[]
    total: number
  }>()

  const maxRank = computed(() => props.rankings.length)

  const RANK_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444', '#a855f6', '#3b82f6', '#14b8a6']
</script>

<template>
  <div class="rex-priorite">
    <div class="rex-priorite-total">{{ total }} reponse{{ total > 1 ? 's' : '' }}</div>
    <div class="rex-priorite-list">
      <div
        v-for="(r, i) in rankings"
        :key="r.item"
        class="rex-priorite-row"
      >
        <span class="rex-priorite-rank" :style="{ background: RANK_COLORS[i % RANK_COLORS.length] + '22', color: RANK_COLORS[i % RANK_COLORS.length] }">
          {{ i + 1 }}
        </span>
        <span class="rex-priorite-label">{{ r.item }}</span>
        <div class="rex-priorite-bar-track">
          <div
            class="rex-priorite-bar-fill"
            :style="{
              width: maxRank > 0 ? ((maxRank - r.avgRank) / maxRank * 100) + '%' : '0%',
              background: RANK_COLORS[i % RANK_COLORS.length],
            }"
          />
        </div>
        <span class="rex-priorite-avg">moy. {{ (r.avgRank + 1).toFixed(1) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rex-priorite {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}
.rex-priorite-total {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 600;
  text-align: center;
}
.rex-priorite-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rex-priorite-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.rex-priorite-rank {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 800;
  flex-shrink: 0;
}
.rex-priorite-label {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rex-priorite-bar-track {
  width: 100px;
  height: 8px;
  background: rgba(255,255,255,.04);
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}
.rex-priorite-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width .6s cubic-bezier(.25,.8,.25,1);
  min-width: 2px;
}
.rex-priorite-avg {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  min-width: 60px;
  text-align: right;
}
</style>
