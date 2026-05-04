<!-- WordCloud.vue - Nuage de mots CSS avec tailles proportionnelles et couleurs -->
<script setup lang="ts">
  import { computed } from 'vue'
  import type { LiveResults } from '@/types'

  const props = defineProps<{ results: LiveResults }>()

  const COLORS = ['#4a90d9', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
  const MIN_SIZE = 14
  const MAX_SIZE = 56

  const maxCount = computed(() =>
    Math.max(1, ...(props.results.data ?? []).map(d => d.count)),
  )

  // v2.277 : rotation deterministe basee sur le hash du texte (etait
  // Math.random() qui re-randomisait a chaque rendu et faisait sauter les
  // mots). Plage reduite -4°/+4° (etait -10/+10) pour respect dyslexie.
  // Cf. WCAG 2.1 SC 1.4.10 — texte rotated > 30deg = barrier.
  function stableRotation(text: string): number {
    let hash = 0
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0
    return ((hash % 81) - 40) / 10  // -4.0 a +4.0 deg
  }

  const words = computed(() =>
    (props.results.data ?? []).map((d, i) => {
      const text = d.word ?? d.text ?? d.option ?? '-'
      return {
        text,
        count: d.count,
        size: MIN_SIZE + ((d.count / maxCount.value) * (MAX_SIZE - MIN_SIZE)),
        color: COLORS[i % COLORS.length],
        rotation: stableRotation(text),
      }
    }),
  )
</script>

<template>
  <div class="wordcloud">
    <div class="wordcloud-total">{{ results.totalResponses ?? 0 }} réponse{{ (results.totalResponses ?? 0) > 1 ? 's' : '' }}</div>
    <div class="wordcloud-container">
      <TransitionGroup name="word-fade">
        <span
          v-for="w in words"
          :key="w.text"
          class="wordcloud-word"
          :style="{
            fontSize: `${w.size}px`,
            color: w.color,
            transform: `rotate(${w.rotation}deg)`,
          }"
        >
          {{ w.text }}
        </span>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.wordcloud {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
}
.wordcloud-total {
  font-size: 15px;
  color: var(--text-muted);
  font-weight: 600;
}
.wordcloud-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 12px 18px;
  padding: 24px;
  min-height: 200px;
  max-width: 800px;
  width: 100%;
}
.wordcloud-word {
  font-weight: 700;
  line-height: 1.2;
  display: inline-block;
  transition: all .4s cubic-bezier(.34,1.56,.64,1);
  cursor: default;
  user-select: none;
}
.wordcloud-word:hover {
  transform: scale(1.1) !important;
  filter: brightness(1.3);
}
/* Transition for new words */
.word-fade-enter-active {
  transition: all .5s cubic-bezier(.34,1.56,.64,1);
}
.word-fade-leave-active {
  transition: all var(--motion-slow) var(--ease-out);
}
.word-fade-enter-from {
  opacity: 0;
  transform: scale(0.5);
}
.word-fade-leave-to {
  opacity: 0;
  transform: scale(0.3);
}
@media (prefers-reduced-motion: reduce) {
  .wordcloud-word {
    transform: none !important;
    transition: none;
  }
  .word-fade-enter-active,
  .word-fade-leave-active { transition: opacity 0.2s ease; }
}
</style>
