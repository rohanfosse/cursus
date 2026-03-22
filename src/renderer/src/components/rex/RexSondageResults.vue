/** RexSondageResults — Barres horizontales triees par frequence pour sondage libre. */
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
</script>

<template>
  <div class="rex-sondage">
    <div v-for="(item, i) in sorted" :key="i" class="rex-sondage-row">
      <span class="rex-sondage-label">{{ item.text }}</span>
      <div class="rex-sondage-bar-wrap">
        <div
          class="rex-sondage-bar"
          :style="{ width: maxCount ? (item.count / maxCount * 100) + '%' : '0%' }"
        />
      </div>
      <span class="rex-sondage-count">{{ item.count }}</span>
    </div>
    <p v-if="!sorted.length" class="rex-sondage-empty">Aucune reponse pour le moment</p>
  </div>
</template>

<style scoped>
.rex-sondage {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rex-sondage-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rex-sondage-label {
  flex: 0 0 140px;
  font-size: 13px;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rex-sondage-bar-wrap {
  flex: 1;
  height: 24px;
  background: rgba(13, 148, 136, 0.08);
  border-radius: 6px;
  overflow: hidden;
}
.rex-sondage-bar {
  height: 100%;
  background: linear-gradient(90deg, #0d9488, #2dd4bf);
  border-radius: 6px;
  transition: width 0.6s ease;
}
.rex-sondage-count {
  flex: 0 0 32px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: #14b8a6;
}
.rex-sondage-empty {
  text-align: center;
  color: var(--text-muted, #888);
  font-size: 13px;
  padding: 20px 0;
}
</style>
