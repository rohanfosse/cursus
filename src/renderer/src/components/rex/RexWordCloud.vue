/** RexWordCloud — Nuage de mots avec tailles proportionnelles et palette teal. */
<script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{
    words: { word: string; count: number }[]
  }>()

  const COLORS = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#0891b2', '#06b6d4']

  const maxCount = computed(() =>
    props.words.reduce((m, w) => Math.max(m, w.count), 1),
  )

  function fontSize(count: number): string {
    const min = 14
    const max = 42
    const ratio = count / maxCount.value
    return (min + ratio * (max - min)) + 'px'
  }

  function color(index: number): string {
    return COLORS[index % COLORS.length]
  }

  function rotation(): string {
    const deg = Math.round((Math.random() * 16) - 8)
    return `rotate(${deg}deg)`
  }
</script>

<template>
  <div class="rex-cloud">
    <TransitionGroup name="rex-cloud-word">
      <span
        v-for="(w, i) in words"
        :key="w.word"
        class="rex-cloud-item"
        :style="{
          fontSize: fontSize(w.count),
          color: color(i),
          transform: rotation(),
        }"
      >
        {{ w.word }}
      </span>
    </TransitionGroup>
    <p v-if="!words.length" class="rex-cloud-empty">En attente des mots...</p>
  </div>
</template>

<style scoped>
.rex-cloud {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px 16px;
  padding: 20px;
  min-height: 100px;
}
.rex-cloud-item {
  font-weight: 700;
  line-height: 1.2;
  transition: all 0.4s ease;
  display: inline-block;
}
.rex-cloud-word-enter-from {
  opacity: 0;
  transform: scale(0.5);
}
.rex-cloud-word-enter-active {
  transition: all 0.4s ease;
}
.rex-cloud-word-leave-active {
  transition: all 0.4s ease;
}
.rex-cloud-word-leave-to {
  opacity: 0;
  transform: scale(0.5);
}
.rex-cloud-empty {
  text-align: center;
  color: var(--text-muted, #888);
  font-size: 13px;
  width: 100%;
}
</style>
