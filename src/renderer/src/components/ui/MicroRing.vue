/**
 * MicroRing — SVG progress ring with value/total label in monospace.
 * Color: green >=75%, accent >=40%, orange >=25%, red <25%.
 */
<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  value: number
  total: number
  size?: number
}

const props = withDefaults(defineProps<Props>(), { size: 20 })

const pct = computed(() => (props.total > 0 ? (props.value / props.total) * 100 : 0))

const color = computed(() => {
  if (pct.value >= 75) return '#4ade80'
  if (pct.value >= 40) return 'var(--accent, #6366f1)'
  if (pct.value >= 25) return '#f59e0b'
  return '#ef4444'
})

const radius = computed(() => (props.size - 3) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const dashOffset = computed(() =>
  circumference.value - (pct.value / 100) * circumference.value,
)
</script>

<template>
  <span class="micro-ring" :style="{ gap: '4px' }">
    <svg
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      class="micro-ring-svg"
    >
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        :stroke-width="2"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="color"
        :stroke-width="2"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        :style="{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', filter: `drop-shadow(0 0 3px ${color})` }"
      />
    </svg>
    <span class="micro-ring-label">{{ value }}/{{ total }}</span>
  </span>
</template>

<style scoped>
.micro-ring {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}
.micro-ring-svg {
  flex-shrink: 0;
}
.micro-ring-label {
  font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace;
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
}
</style>
