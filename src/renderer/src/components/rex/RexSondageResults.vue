/** RexSondageResults — Barres horizontales triees par frequence pour sondage libre.
 *  Polish Pulse : % affiche, couleurs podium pour top 3, anim d'entree des lignes. */
<script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{
    results: { text: string; count: number }[]
    total: number
  }>()

  const sorted = computed(() =>
    [...props.results].sort((a, b) => b.count - a.count),
  )

  const maxCount = computed(() =>
    sorted.value.length ? sorted.value[0].count : 1,
  )

  const PODIUM_COLORS = [
    'linear-gradient(90deg, #f59e0b, #fbbf24)', // or
    'linear-gradient(90deg, #94a3b8, #cbd5e1)', // argent
    'linear-gradient(90deg, #a16207, #c2884d)', // bronze
  ]
  const DEFAULT_COLOR = 'linear-gradient(90deg, #0d9488, #2dd4bf)'

  function barColor(rank: number): string {
    return PODIUM_COLORS[rank] ?? DEFAULT_COLOR
  }

  function pct(count: number): number {
    return props.total > 0 ? Math.round(count / props.total * 100) : 0
  }
</script>

<template>
  <div class="rex-sondage">
    <TransitionGroup name="rex-sondage-row" tag="div" class="rex-sondage-list">
      <div
        v-for="(item, i) in sorted"
        :key="item.text"
        class="rex-sondage-row"
        :class="{ 'rex-sondage-top': i < 3 }"
      >
        <span class="rex-sondage-rank" :class="{ 'rank-top': i < 3 }">{{ i + 1 }}</span>
        <span class="rex-sondage-label">{{ item.text }}</span>
        <div class="rex-sondage-bar-wrap">
          <div
            class="rex-sondage-bar"
            :style="{
              width: maxCount ? (item.count / maxCount * 100) + '%' : '0%',
              background: barColor(i),
            }"
          />
        </div>
        <div class="rex-sondage-meta">
          <span class="rex-sondage-count">{{ item.count }}</span>
          <span class="rex-sondage-pct">{{ pct(item.count) }}%</span>
        </div>
      </div>
    </TransitionGroup>
    <p v-if="!sorted.length" class="rex-sondage-empty">Aucune reponse pour le moment</p>
  </div>
</template>

<style scoped>
.rex-sondage {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.rex-sondage-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rex-sondage-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  transition: background .2s;
}
.rex-sondage-row:hover {
  background: rgba(255,255,255,.03);
}
.rex-sondage-rank {
  flex: 0 0 24px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.rex-sondage-rank.rank-top {
  color: #f59e0b;
}
.rex-sondage-label {
  flex: 0 0 140px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rex-sondage-bar-wrap {
  flex: 1;
  height: 24px;
  background: rgba(13, 148, 136, 0.06);
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}
.rex-sondage-bar {
  height: 100%;
  border-radius: 6px;
  transition: width 0.7s cubic-bezier(.16,1,.3,1);
  position: relative;
  overflow: hidden;
}
.rex-sondage-bar::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.12), transparent);
  transform: translateX(-100%);
  animation: rex-bar-shine 2.5s ease-in-out infinite;
}
@keyframes rex-bar-shine {
  to { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .rex-sondage-bar::after { animation: none; display: none; }
}

.rex-sondage-meta {
  flex: 0 0 72px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  font-variant-numeric: tabular-nums;
}
.rex-sondage-count {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-primary);
}
.rex-sondage-top .rex-sondage-count {
  color: #fbbf24;
}
.rex-sondage-pct {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
}
.rex-sondage-empty {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 20px 0;
}

/* TransitionGroup */
.rex-sondage-row-enter-from { opacity: 0; transform: translateX(-10px); }
.rex-sondage-row-enter-active { transition: all .3s var(--ease-out); }
.rex-sondage-row-move { transition: transform .4s var(--ease-out); }
</style>
