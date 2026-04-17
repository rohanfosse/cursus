<!-- QcmResults.vue - Barres horizontales animées pour les résultats QCM avec mise en valeur des bonnes réponses -->
<script setup lang="ts">
  import { computed } from 'vue'
  import { CheckCircle2 } from 'lucide-vue-next'
  import type { LiveResults, LiveActivity } from '@/types'

  const props = defineProps<{
    results: LiveResults
    activity?: LiveActivity | null
  }>()

  const COLORS = ['#4a90d9', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
  const CORRECT_COLOR = '#22c55e'

  const maxCount = computed(() =>
    Math.max(1, ...(props.results.data ?? []).map(d => d.count)),
  )

  const correctIndices = computed<number[]>(() => {
    if (!props.activity?.correct_answers) return []
    try {
      const parsed = JSON.parse(props.activity.correct_answers as unknown as string)
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  })

  function isCorrect(index: number): boolean {
    return correctIndices.value.includes(index)
  }

  function barColor(i: number): string {
    // Only highlight correct when activity is closed (results phase)
    if (correctIndices.value.length > 0 && isCorrect(i)) return CORRECT_COLOR
    return COLORS[i % COLORS.length]
  }
</script>

<template>
  <div class="qcm-results">
    <div class="qcm-total">{{ results.totalResponses ?? 0 }} reponse{{ (results.totalResponses ?? 0) > 1 ? 's' : '' }}</div>
    <div
      v-for="(row, i) in (results.data ?? [])" :key="row.option ?? i"
      class="qcm-row"
      :class="{ 'qcm-correct': isCorrect(row.index ?? i) }"
      :style="{ animationDelay: `${i * 80}ms` }"
    >
      <div class="qcm-label">
        <CheckCircle2 v-if="isCorrect(row.index ?? i)" :size="16" class="qcm-check" />
        {{ row.option ?? `Option ${(row.index ?? i) + 1}` }}
      </div>
      <div class="qcm-bar-track">
        <div
          class="qcm-bar-fill"
          :style="{ width: `${(row.count / maxCount) * 100}%`, background: barColor(row.index ?? i), transitionDelay: `${i * 80}ms` }"
        />
      </div>
      <div class="qcm-count">{{ row.count }}</div>
      <div v-if="row.percent != null" class="qcm-pct">{{ Math.round(row.percent) }}%</div>
    </div>
  </div>
</template>

<style scoped>
.qcm-results {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}
.qcm-total {
  font-size: 15px;
  color: var(--text-muted);
  font-weight: 600;
  text-align: center;
}
.qcm-row {
  display: grid;
  grid-template-columns: 180px 1fr 50px 50px;
  align-items: center;
  gap: 12px;
  padding: 2px 0;
  border-radius: 6px;
  transition: background .2s;
  animation: qcm-row-in .4s ease-out both;
}
@keyframes qcm-row-in {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}
.qcm-row.qcm-correct {
  background: rgba(34,197,94,.06);
}
.qcm-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
  justify-content: flex-end;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qcm-check {
  color: #22c55e;
  flex-shrink: 0;
}
.qcm-bar-track {
  height: 36px;
  background: var(--bg-hover);
  border-radius: 8px;
  overflow: hidden;
}
.qcm-bar-fill {
  height: 100%;
  border-radius: 8px;
  transition: width .6s cubic-bezier(.34,1.56,.64,1);
  min-width: 4px;
}
.qcm-count {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  text-align: center;
}
.qcm-pct {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
  text-align: center;
}
</style>
