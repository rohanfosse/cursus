<!-- RexMatriceResults.vue - Visualisation multi-critères avec barres de progression -->
<script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{
    criteria: { name: string; average: number }[]
    maxRating: number
    total: number
  }>()

  const CRITERIA_COLORS = ['#0d9488', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#ef4444', '#6366f1']
</script>

<template>
  <div class="rex-matrice">
    <div class="rex-matrice-total">{{ total }} reponse{{ total > 1 ? 's' : '' }}</div>
    <div class="rex-matrice-grid">
      <div
        v-for="(c, i) in criteria"
        :key="c.name"
        class="rex-matrice-row"
      >
        <span class="rex-matrice-label">{{ c.name }}</span>
        <div class="rex-matrice-bar-track">
          <div
            class="rex-matrice-bar-fill"
            :style="{
              width: maxRating > 0 ? (c.average / maxRating * 100) + '%' : '0%',
              background: CRITERIA_COLORS[i % CRITERIA_COLORS.length],
            }"
          />
        </div>
        <span class="rex-matrice-avg" :style="{ color: CRITERIA_COLORS[i % CRITERIA_COLORS.length] }">
          {{ c.average.toFixed(1) }}
        </span>
        <span class="rex-matrice-max">/ {{ maxRating }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rex-matrice {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}
.rex-matrice-total {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 600;
  text-align: center;
}
.rex-matrice-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rex-matrice-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rex-matrice-label {
  width: 120px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rex-matrice-bar-track {
  flex: 1;
  height: 20px;
  background: rgba(255,255,255,.04);
  border-radius: 6px;
  overflow: hidden;
}
.rex-matrice-bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width .6s cubic-bezier(.25,.8,.25,1);
  min-width: 2px;
}
.rex-matrice-avg {
  font-size: 18px;
  font-weight: 800;
  min-width: 36px;
  text-align: right;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.rex-matrice-max {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}
</style>
