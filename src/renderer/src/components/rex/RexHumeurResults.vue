<!-- RexHumeurResults.vue - Visualisation des résultats de type humeur (emoji bar chart) -->
<script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{
    emojis: { emoji: string; count: number }[]
    total: number
  }>()

  const maxCount = computed(() =>
    props.emojis.reduce((m, e) => Math.max(m, e.count), 1),
  )

  const MOOD_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444']

  function pct(count: number): number {
    return props.total > 0 ? Math.round(count / props.total * 100) : 0
  }
</script>

<template>
  <div class="rex-humeur">
    <div class="rex-humeur-total">{{ total }} reponse{{ total > 1 ? 's' : '' }}</div>
    <div class="rex-humeur-bars">
      <div
        v-for="(e, i) in emojis"
        :key="e.emoji"
        class="rex-humeur-row"
      >
        <span class="rex-humeur-emoji">{{ e.emoji }}</span>
        <div class="rex-humeur-bar-track">
          <div
            class="rex-humeur-bar-fill"
            :style="{
              width: (e.count / maxCount * 100) + '%',
              background: `linear-gradient(90deg, ${MOOD_COLORS[i % MOOD_COLORS.length]}, color-mix(in srgb, ${MOOD_COLORS[i % MOOD_COLORS.length]} 70%, #fff))`,
            }"
          />
        </div>
        <span class="rex-humeur-count">{{ e.count }}</span>
        <span class="rex-humeur-pct">{{ pct(e.count) }}%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rex-humeur {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}
.rex-humeur-total {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 600;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: .5px;
}
.rex-humeur-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rex-humeur-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background .15s;
}
.rex-humeur-row:hover { background: rgba(255,255,255,.03); }
.rex-humeur-emoji {
  font-size: 32px;
  flex-shrink: 0;
  width: 44px;
  text-align: center;
  filter: grayscale(0);
  transition: transform .2s;
}
.rex-humeur-row:hover .rex-humeur-emoji {
  transform: scale(1.12);
}
.rex-humeur-bar-track {
  flex: 1;
  height: 30px;
  background: rgba(255,255,255,.04);
  border-radius: 10px;
  overflow: hidden;
}
.rex-humeur-bar-fill {
  height: 100%;
  border-radius: 10px;
  transition: width .7s cubic-bezier(.16,1,.3,1);
  min-width: 2px;
  position: relative;
  overflow: hidden;
}
.rex-humeur-bar-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.15), transparent);
  transform: translateX(-100%);
  animation: humeur-shine 2.8s ease-in-out infinite;
}
@keyframes humeur-shine { to { transform: translateX(100%); } }
@media (prefers-reduced-motion: reduce) { .rex-humeur-bar-fill::after { animation: none; } }

.rex-humeur-count {
  font-size: 17px;
  font-weight: 800;
  color: var(--text-primary);
  min-width: 30px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.rex-humeur-pct {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  min-width: 38px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
