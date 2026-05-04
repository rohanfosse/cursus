/** CountdownTimer.vue - Compte a rebours circulaire SVG style Kahoot */
<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

  const props = defineProps<{
    totalSeconds: number
    startedAt: string
  }>()

  const emit = defineEmits<{
    expired: []
  }>()

  const remaining = ref(props.totalSeconds)
  let timer: ReturnType<typeof setInterval> | null = null

  const fraction = computed(() => Math.max(0, remaining.value / props.totalSeconds))

  const strokeColor = computed(() => {
    const f = fraction.value
    if (f > 0.6) return '#22c55e'
    if (f > 0.35) return '#eab308'
    if (f > 0.15) return '#f97316'
    return '#ef4444'
  })

  const isPulsing = computed(() => remaining.value <= 5 && remaining.value > 0)

  // SVG circle parameters
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const dashOffset = computed(() => circumference * (1 - fraction.value))

  function tick() {
    if (!props.startedAt) return
    const startMs = new Date(props.startedAt.endsWith('Z') ? props.startedAt : props.startedAt + 'Z').getTime()
    const elapsed = (Date.now() - startMs) / 1000
    remaining.value = Math.max(0, Math.ceil(props.totalSeconds - elapsed))
    if (remaining.value <= 0) {
      if (timer) { clearInterval(timer); timer = null }
      emit('expired')
    }
  }

  function start() {
    if (timer) clearInterval(timer)
    tick()
    timer = setInterval(tick, 250)
  }

  watch(() => props.startedAt, () => { if (props.startedAt) start() })

  onMounted(() => { if (props.startedAt) start() })
  onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="countdown-timer" :class="{ pulsing: isPulsing }">
    <svg viewBox="0 0 120 120" class="timer-ring">
      <circle
        class="ring-bg"
        cx="60" cy="60" :r="radius"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        stroke-width="8"
      />
      <circle
        class="ring-fill"
        cx="60" cy="60" :r="radius"
        fill="none"
        :stroke="strokeColor"
        stroke-width="8"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        transform="rotate(-90 60 60)"
      />
    </svg>
    <span class="timer-number" :style="{ color: strokeColor }">{{ remaining }}</span>
  </div>
</template>

<style scoped>
.countdown-timer {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.timer-ring {
  width: 100%;
  height: 100%;
}
.ring-fill {
  transition: stroke-dashoffset 0.3s linear, stroke var(--motion-slow) var(--ease-out);
}
.timer-number {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 900;
  font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace);
  font-variant-numeric: tabular-nums;
}
.countdown-timer.pulsing {
  animation: pulse-timer 0.5s ease-in-out infinite;
}
@keyframes pulse-timer {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
</style>
