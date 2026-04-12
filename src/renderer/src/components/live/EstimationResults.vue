<!-- EstimationResults.vue - Visualisation des résultats pour les questions d'estimation -->
<script setup lang="ts">
  import { computed } from 'vue'
  import { Target, TrendingUp, Users } from 'lucide-vue-next'
  import type { LiveResults } from '@/types'

  const props = defineProps<{
    results: LiveResults
  }>()

  const total = computed(() => props.results.totalResponses ?? 0)
  const correctCount = computed(() => props.results.correctCount ?? 0)

  const successRate = computed(() => {
    if (!total.value) return 0
    return Math.round(correctCount.value / total.value * 100)
  })

  // Build histogram bins from values
  const histogram = computed(() => {
    const vals = props.results.values ?? []
    if (vals.length === 0) return []
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const range = max - min || 1
    const binCount = Math.min(10, Math.max(3, Math.ceil(vals.length / 2)))
    const binSize = range / binCount
    const bins: { label: string; count: number; hasTarget: boolean }[] = []
    const target = props.results.target
    const margin = props.results.margin ?? 0

    for (let i = 0; i < binCount; i++) {
      const lo = min + i * binSize
      const hi = lo + binSize
      const count = vals.filter(v => i === binCount - 1 ? v >= lo && v <= hi : v >= lo && v < hi).length
      const midpoint = (lo + hi) / 2
      const hasTarget = target !== undefined && midpoint >= target - margin && midpoint <= target + margin
      bins.push({
        label: Number.isInteger(lo) && Number.isInteger(hi) ? `${lo}-${hi}` : `${lo.toFixed(1)}-${hi.toFixed(1)}`,
        count,
        hasTarget,
      })
    }
    return bins
  })

  const maxBinCount = computed(() => Math.max(1, ...histogram.value.map(b => b.count)))
</script>

<template>
  <div class="est-results">
    <div class="est-total">{{ total }} reponse{{ total > 1 ? 's' : '' }}</div>

    <!-- Key metrics -->
    <div class="est-metrics">
      <div v-if="results.target !== undefined" class="est-metric">
        <Target :size="18" class="est-metric-icon target" />
        <div class="est-metric-body">
          <span class="est-metric-value">{{ results.target }}</span>
          <span class="est-metric-label">Cible (± {{ results.margin ?? 0 }})</span>
        </div>
      </div>
      <div v-if="results.average !== undefined" class="est-metric">
        <TrendingUp :size="18" class="est-metric-icon avg" />
        <div class="est-metric-body">
          <span class="est-metric-value">{{ results.average }}</span>
          <span class="est-metric-label">Moyenne</span>
        </div>
      </div>
      <div class="est-metric">
        <Users :size="18" class="est-metric-icon success" />
        <div class="est-metric-body">
          <span class="est-metric-value">{{ successRate }}%</span>
          <span class="est-metric-label">Dans la marge</span>
        </div>
      </div>
    </div>

    <!-- Histogram -->
    <div v-if="histogram.length > 0" class="est-histogram">
      <div
        v-for="(bin, i) in histogram"
        :key="i"
        class="est-hist-col"
        :title="`${bin.label}: ${bin.count} reponse(s)`"
      >
        <div class="est-hist-bar-wrap">
          <div
            class="est-hist-bar"
            :class="{ 'on-target': bin.hasTarget }"
            :style="{ height: (bin.count / maxBinCount * 100) + '%' }"
          />
        </div>
        <span class="est-hist-label">{{ bin.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.est-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: 100%;
}
.est-total {
  font-size: 15px;
  color: var(--text-muted);
  font-weight: 600;
}
.est-metrics {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}
.est-metric {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  min-width: 140px;
}
.est-metric-icon.target { color: #f59e0b; }
.est-metric-icon.avg { color: #3b82f6; }
.est-metric-icon.success { color: #22c55e; }
.est-metric-body {
  display: flex;
  flex-direction: column;
}
.est-metric-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.est-metric-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}
.est-histogram {
  display: flex;
  gap: 4px;
  align-items: flex-end;
  min-height: 120px;
  width: 100%;
  max-width: 500px;
  padding-top: 8px;
}
.est-hist-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.est-hist-bar-wrap {
  width: 100%;
  height: 100px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.est-hist-bar {
  width: 70%;
  border-radius: 4px 4px 0 0;
  background: rgba(74,144,217,.6);
  transition: height .6s cubic-bezier(.25,.8,.25,1);
  min-height: 2px;
}
.est-hist-bar.on-target {
  background: #22c55e;
}
.est-hist-label {
  font-size: 8px;
  color: var(--text-muted);
  white-space: nowrap;
  text-align: center;
}
</style>
