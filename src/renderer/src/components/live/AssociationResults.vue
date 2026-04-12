<!-- AssociationResults.vue - Visualisation des résultats pour les questions d'association -->
<script setup lang="ts">
  import { computed } from 'vue'
  import { CheckCircle2, XCircle } from 'lucide-vue-next'
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

  const ringRadius = 52
  const ringCircumference = 2 * Math.PI * ringRadius
  const ringOffset = computed(() => ringCircumference * (1 - successRate.value / 100))

  const ringColor = computed(() => {
    if (successRate.value >= 70) return '#22c55e'
    if (successRate.value >= 40) return '#eab308'
    return '#ef4444'
  })
</script>

<template>
  <div class="assoc-results">
    <div class="assoc-total">{{ total }} reponse{{ total > 1 ? 's' : '' }}</div>

    <div class="assoc-ring-area">
      <svg viewBox="0 0 120 120" class="assoc-ring">
        <circle cx="60" cy="60" :r="ringRadius" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10" />
        <circle
          cx="60" cy="60" :r="ringRadius" fill="none"
          :stroke="ringColor" stroke-width="10" stroke-linecap="round"
          :stroke-dasharray="ringCircumference" :stroke-dashoffset="ringOffset"
          transform="rotate(-90 60 60)"
          class="assoc-ring-fill"
        />
      </svg>
      <div class="assoc-ring-label">
        <span class="assoc-ring-pct">{{ successRate }}%</span>
        <span class="assoc-ring-sub">correct</span>
      </div>
    </div>

    <div class="assoc-stats">
      <div class="assoc-stat correct">
        <CheckCircle2 :size="18" />
        <span>{{ correctCount }} correct{{ correctCount > 1 ? 's' : '' }}</span>
      </div>
      <div class="assoc-stat wrong">
        <XCircle :size="18" />
        <span>{{ total - correctCount }} incorrect{{ (total - correctCount) > 1 ? 's' : '' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.assoc-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: 100%;
}
.assoc-total {
  font-size: 15px;
  color: var(--text-muted);
  font-weight: 600;
}
.assoc-ring-area {
  position: relative;
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.assoc-ring {
  width: 100%;
  height: 100%;
}
.assoc-ring-fill {
  transition: stroke-dashoffset 0.8s cubic-bezier(.25,.8,.25,1), stroke 0.4s;
}
.assoc-ring-label {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.assoc-ring-pct {
  font-size: 32px;
  font-weight: 900;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.assoc-ring-sub {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .5px;
}
.assoc-stats {
  display: flex;
  gap: 24px;
}
.assoc-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
}
.assoc-stat.correct { color: #22c55e; }
.assoc-stat.wrong { color: #ef4444; }
</style>
