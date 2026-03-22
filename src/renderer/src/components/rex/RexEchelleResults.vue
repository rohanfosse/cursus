/** RexEchelleResults — Affichage moyenne + distribution en barres pour echelle. */
<script setup lang="ts">
  import { computed } from 'vue'
  import { Star } from 'lucide-vue-next'

  const props = defineProps<{
    average: number
    maxRating: number
    distribution: { rating: number; count: number }[]
    total: number
  }>()

  const maxCount = computed(() =>
    props.distribution.reduce((m, d) => Math.max(m, d.count), 1),
  )

  const sortedDist = computed(() =>
    [...props.distribution].sort((a, b) => a.rating - b.rating),
  )

  const filledStars = computed(() => Math.round(props.average))
</script>

<template>
  <div class="rex-echelle">
    <!-- Moyenne -->
    <div class="rex-echelle-avg">
      <span class="rex-echelle-avg-num">{{ average.toFixed(1) }}</span>
      <span class="rex-echelle-avg-sep"> / {{ maxRating }}</span>
      <div v-if="maxRating <= 5" class="rex-echelle-stars">
        <Star
          v-for="s in maxRating"
          :key="s"
          :size="22"
          :class="s <= filledStars ? 'star-filled' : 'star-empty'"
        />
      </div>
    </div>
    <span class="rex-echelle-total">{{ total }} reponse{{ total > 1 ? 's' : '' }}</span>

    <!-- Distribution -->
    <div class="rex-echelle-dist">
      <div v-for="d in sortedDist" :key="d.rating" class="rex-echelle-row">
        <span class="rex-echelle-rating">{{ d.rating }}</span>
        <div class="rex-echelle-bar-wrap">
          <div
            class="rex-echelle-bar"
            :style="{ width: maxCount ? (d.count / maxCount * 100) + '%' : '0%' }"
          />
        </div>
        <span class="rex-echelle-count">{{ d.count }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rex-echelle {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.rex-echelle-avg {
  display: flex;
  align-items: center;
  gap: 4px;
}
.rex-echelle-avg-num {
  font-size: 36px;
  font-weight: 800;
  color: #0d9488;
  line-height: 1;
}
.rex-echelle-avg-sep {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-muted, #888);
}
.rex-echelle-stars {
  display: flex;
  gap: 2px;
  margin-left: 10px;
}
.star-filled {
  color: #0d9488;
  fill: #0d9488;
}
.star-empty {
  color: rgba(13, 148, 136, 0.25);
}
.rex-echelle-total {
  font-size: 13px;
  color: var(--text-muted, #888);
}
.rex-echelle-dist {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rex-echelle-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rex-echelle-rating {
  flex: 0 0 24px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #aaa);
}
.rex-echelle-bar-wrap {
  flex: 1;
  height: 20px;
  background: rgba(13, 148, 136, 0.08);
  border-radius: 5px;
  overflow: hidden;
}
.rex-echelle-bar {
  height: 100%;
  background: linear-gradient(90deg, #0d9488, #2dd4bf);
  border-radius: 5px;
  transition: width 0.6s ease;
}
.rex-echelle-count {
  flex: 0 0 28px;
  text-align: right;
  font-size: 12px;
  font-weight: 600;
  color: #14b8a6;
}
</style>
