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
  <!-- v2.277 : role="timer" + aria-live pour screen readers (WCAG AA).
       aria-live="polite" pour les > 5s, "assertive" pour la zone urgence.
       L'animation pulse est desactivee via prefers-reduced-motion. -->
  <div
    class="countdown-timer"
    :class="{ pulsing: isPulsing }"
    role="timer"
    :aria-label="`Temps restant : ${remaining} secondes`"
  >
    <svg viewBox="0 0 120 120" class="timer-ring" aria-hidden="true">
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
    <span
      class="timer-number"
      :style="{ color: strokeColor }"
      :aria-live="isPulsing ? 'assertive' : 'polite'"
    >{{ remaining }}</span>
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
/* v2.277 : respect prefers-reduced-motion. Le timer reste informatif via
   couleur + chiffre, sans declenchement vestibulaire. */
@media (prefers-reduced-motion: reduce) {
  .countdown-timer.pulsing { animation: none; }
  .ring-fill { transition: stroke 0.3s ease; }
}

/* Mobile : timer plus compact pour ne pas dominer l'ecran etudiant. */
@media (max-width: 600px) {
  .countdown-timer { width: 84px; height: 84px; }
  .timer-number { font-size: 28px; }
}
</style>
