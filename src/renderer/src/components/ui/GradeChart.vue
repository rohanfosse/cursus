<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ grades: number[] }>()

const BUCKETS = [
  { label: '0 – 7',   min: 0,  max: 7,  color: '#E74C3C' },
  { label: '8 – 9',   min: 8,  max: 9,  color: '#E67E22' },
  { label: '10 – 11', min: 10, max: 11, color: '#F39C12' },
  { label: '12 – 13', min: 12, max: 13, color: '#4A90D9' },
  { label: '14 – 20', min: 14, max: 20, color: '#27AE60' },
]

const counts = computed(() =>
  BUCKETS.map((b) => ({
    ...b,
    count: props.grades.filter((g) => g >= b.min && g <= b.max).length,
  })),
)

const maxCount = computed(() => Math.max(1, ...counts.value.map((b) => b.count)))

const avg = computed(() => {
  if (!props.grades.length) return null
  const sum = props.grades.reduce((a, b) => a + b, 0)
  return Math.round((sum / props.grades.length) * 10) / 10
})
</script>

<template>
  <div class="grade-chart">
    <div v-if="!grades.length" class="grade-chart-empty">Aucune note disponible</div>
    <template v-else>
      <div v-for="b in counts" :key="b.label" class="grade-row">
        <span class="grade-label">{{ b.label }}</span>
        <div class="grade-bar-wrap">
          <div class="grade-bar-bg" :style="{ background: b.color }" />
          <div
            class="grade-bar-fill"
            :style="{
              width: (b.count / maxCount * 100) + '%',
              background: b.color,
            }"
          />
        </div>
        <span class="grade-count" :style="{ color: b.count ? b.color : 'var(--text-muted)' }">
          {{ b.count }}
        </span>
      </div>
      <div class="grade-avg">Moy. classe : <strong>{{ avg }}/20</strong></div>
    </template>
  </div>
</template>

<style scoped>
.grade-chart { display: flex; flex-direction: column; gap: 5px; width: 100%; }
.grade-chart-empty { font-size: 11.5px; color: var(--text-muted); font-style: italic; padding: 6px 0; }

.grade-row {
  display: grid;
  grid-template-columns: 52px 1fr 24px;
  align-items: center;
  gap: 8px;
}

.grade-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
  text-align: right;
}

.grade-bar-wrap {
  position: relative;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
}

.grade-bar-bg {
  position: absolute;
  inset: 0;
  opacity: .1;
  border-radius: 6px;
}

.grade-bar-fill {
  position: absolute;
  top: 0; left: 0; bottom: 0;
  border-radius: 6px;
  transition: width .4s cubic-bezier(.34, 1.56, .64, 1);
  min-width: 4px;
}

.grade-count {
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.grade-avg {
  font-size: 11px;
  color: var(--text-muted);
  text-align: right;
  margin-top: 2px;
}
.grade-avg strong { color: var(--text-secondary); }
</style>
