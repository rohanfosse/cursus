<script setup lang="ts">
/**
 * LiveCategoryGrid — grille des 4 cartes de categories Live
 * (Spark / Pulse / Code / Board) sur la home prof.
 * Extrait de TeacherLiveView.vue (v2.282).
 *
 * Click sur une carte -> emit('select', key). Le parent gere la nav vers
 * la sub-page detail OU l'ouverture directe.
 */
import { Sparkles, ArrowRight } from 'lucide-vue-next'
import { ACTIVITY_CATEGORIES } from '@/utils/liveActivity'
import type { ActivityCategory } from '@/utils/liveActivity'

defineEmits<{
  (e: 'select', key: ActivityCategory): void
}>()
</script>

<template>
  <section class="live-section" aria-labelledby="live-create-title">
    <header class="live-section-head">
      <h2 id="live-create-title" class="live-section-title">
        <Sparkles :size="18" aria-hidden="true" />
        Creer une nouvelle session
      </h2>
      <p class="live-section-sub">Choisis un type d'activite pour commencer.</p>
    </header>
    <div class="live-cat-grid">
      <button
        v-for="(cat, key) in ACTIVITY_CATEGORIES"
        :key="key"
        class="live-cat-card"
        :style="{ '--cat-color': cat.color }"
        @click="$emit('select', key as ActivityCategory)"
      >
        <div class="live-cat-glow" aria-hidden="true" />
        <div class="live-cat-icon">
          <component :is="cat.icon" :size="28" />
        </div>
        <div class="live-cat-info">
          <span class="live-cat-label">{{ cat.label }}</span>
          <span class="live-cat-desc">{{ cat.description }}</span>
        </div>
        <div class="live-cat-types">
          <span v-for="t in cat.types.slice(0, 3)" :key="t" class="live-cat-type">{{ t.replace(/_/g, ' ') }}</span>
          <span v-if="cat.types.length > 3" class="live-cat-type live-cat-more">+{{ cat.types.length - 3 }}</span>
        </div>
        <span class="live-cat-cta">
          <span>Creer</span>
          <ArrowRight :size="14" />
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
/* ── Section générique (extrait v2.282) ──────────────────────────────── */
.live-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.live-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 16px;
}
.live-section-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.03em;
  line-height: 1.15;
}
.live-section-title :deep(svg),
.live-section-title svg {
  color: var(--color-live);
  flex-shrink: 0;
}
.live-section-sub {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0;
  letter-spacing: -0.005em;
}

/* ── Category grid (v2.279 / extracted v2.282) : gradient tiles ──────── */
.live-cat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  width: 100%;
}
.live-cat-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 28px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-bento);
  cursor: pointer;
  text-align: left;
  transition:
    transform 0.32s var(--ease-spring),
    border-color 0.2s,
    box-shadow 0.32s var(--ease-spring);
  overflow: hidden;
  font-family: inherit;
  isolation: isolate;
}
/* Glow en haut a droite (signature visuelle bento landing) */
.live-cat-glow {
  position: absolute;
  top: -40%;
  right: -20%;
  width: 60%;
  height: 100%;
  background: radial-gradient(
    circle at center,
    color-mix(in srgb, var(--cat-color) 35%, transparent) 0%,
    transparent 65%
  );
  opacity: 0.6;
  z-index: -1;
  transition: opacity 0.4s var(--ease-out), transform 0.4s var(--ease-out);
  pointer-events: none;
}
/* Barre coloree en haut, signature module */
.live-cat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg,
    var(--cat-color),
    color-mix(in srgb, var(--cat-color) 50%, transparent));
  border-radius: var(--radius-bento) var(--radius-bento) 0 0;
}
.live-cat-card:hover {
  border-color: color-mix(in srgb, var(--cat-color) 55%, var(--border));
  box-shadow:
    0 18px 40px color-mix(in srgb, var(--cat-color) 18%, transparent),
    0 4px 12px color-mix(in srgb, var(--cat-color) 12%, transparent);
  transform: translateY(-4px);
}
.live-cat-card:hover .live-cat-glow {
  opacity: 1;
  transform: scale(1.15);
}
.live-cat-card:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--cat-color) 30%, transparent),
    0 18px 40px color-mix(in srgb, var(--cat-color) 18%, transparent);
}
.live-cat-card:disabled { opacity: .5; cursor: wait; }

.live-cat-icon {
  position: relative;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--cat-color) 90%, white) 0%,
    var(--cat-color) 100%);
  color: #fff;
  flex-shrink: 0;
  box-shadow:
    0 8px 20px color-mix(in srgb, var(--cat-color) 35%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: transform 0.32s var(--ease-spring),
              box-shadow 0.32s var(--ease-out);
}
.live-cat-card:hover .live-cat-icon {
  transform: scale(1.06) rotate(-3deg);
  box-shadow:
    0 12px 28px color-mix(in srgb, var(--cat-color) 45%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.live-cat-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.live-cat-label {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  line-height: 1.15;
}
.live-cat-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.45;
}
.live-cat-types {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 2px;
}
.live-cat-type {
  font-size: 10.5px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cat-color) 10%, transparent);
  color: color-mix(in srgb, var(--cat-color) 80%, var(--text-secondary));
  text-transform: capitalize;
  border: 1px solid color-mix(in srgb, var(--cat-color) 20%, transparent);
}
.live-cat-more {
  color: var(--text-muted);
  background: var(--bg-hover);
  border-color: var(--border);
}

/* CTA "Creer →" en bas a droite, slide-in au hover */
.live-cat-cta {
  position: absolute;
  right: 22px;
  bottom: 22px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--cat-color);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  opacity: 0;
  transform: translateX(8px);
  transition: opacity 0.22s var(--ease-out),
              transform 0.22s var(--ease-out);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--cat-color) 30%, transparent);
}
.live-cat-card:hover .live-cat-cta {
  opacity: 1;
  transform: translateX(0);
}
@media (prefers-reduced-motion: reduce) {
  .live-cat-card,
  .live-cat-card:hover,
  .live-cat-icon,
  .live-cat-glow,
  .live-cat-cta {
    transition: none;
    transform: none;
  }
  .live-cat-cta { opacity: 1; transform: none; }
}

@media (max-width: 600px) {
  .live-cat-grid { grid-template-columns: 1fr; }
  .live-cat-card { padding: 20px; }
}
</style>
