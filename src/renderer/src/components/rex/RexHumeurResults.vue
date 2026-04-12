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
              background: MOOD_COLORS[i % MOOD_COLORS.length],
            }"
          />
        </div>
        <span class="rex-humeur-count">{{ e.count }}</span>
        <span class="rex-humeur-pct">{{ total > 0 ? Math.round(e.count / total * 100) : 0 }}%</span>
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
}
.rex-humeur-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rex-humeur-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rex-humeur-emoji {
  font-size: 28px;
  flex-shrink: 0;
  width: 40px;
  text-align: center;
}
.rex-humeur-bar-track {
  flex: 1;
  height: 28px;
  background: rgba(255,255,255,.04);
  border-radius: 8px;
  overflow: hidden;
}
.rex-humeur-bar-fill {
  height: 100%;
  border-radius: 8px;
  transition: width .6s cubic-bezier(.25,.8,.25,1);
  min-width: 2px;
}
.rex-humeur-count {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
  min-width: 28px;
  text-align: right;
}
.rex-humeur-pct {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  min-width: 36px;
  text-align: right;
}
</style>
