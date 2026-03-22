/**
 * CountdownArc.vue — SVG arc showing elapsed time toward a deadline.
 * Color: green <50%, orange 50-75%, red >75%.
 * Label inside: "2j" or "14h" in monospace.
 */
<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  deadline: string
  startDate?: string | null
  size?: number
}

const props = withDefaults(defineProps<Props>(), { size: 20, startDate: null })

const TWO_WEEKS = 14 * 24 * 3600 * 1000

const deadlineMs = computed(() => new Date(props.deadline).getTime())

const startMs = computed(() =>
  props.startDate ? new Date(props.startDate).getTime() : deadlineMs.value - TWO_WEEKS,
)

const totalSpan = computed(() => Math.max(deadlineMs.value - startMs.value, 1))
const elapsed = computed(() => Date.now() - startMs.value)
const pct = computed(() => Math.min(100, Math.max(0, (elapsed.value / totalSpan.value) * 100)))

const color = computed(() => {
  if (pct.value > 75) return '#ef4444'
  if (pct.value >= 50) return '#f59e0b'
  return '#4ade80'
})

const label = computed(() => {
  const remaining = deadlineMs.value - Date.now()
  if (remaining <= 0) return '0j'
  const hours = remaining / (3600 * 1000)
  if (hours < 24) return `${Math.ceil(hours)}h`
  return `${Math.ceil(hours / 24)}j`
})

const radius = computed(() => (props.size - 3) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const dashOffset = computed(() =>
  circumference.value - (pct.value / 100) * circumference.value,
)
</script>

<template>
  <span class="countdown-arc" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      class="countdown-arc-svg"
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
        :style="{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }"
      />
      <text
        :x="size / 2"
        :y="size / 2"
        text-anchor="middle"
        dominant-baseline="central"
        class="countdown-arc-label"
        :fill="color"
        :font-size="size * 0.32"
      >{{ label }}</text>
    </svg>
  </span>
</template>

<style scoped>
.countdown-arc {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.countdown-arc-svg {
  flex-shrink: 0;
}
.countdown-arc-label {
  font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace;
  font-weight: 700;
}
</style>
