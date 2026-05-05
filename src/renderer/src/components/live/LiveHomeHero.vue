<script setup lang="ts">
/**
 * LiveHomeHero — hero panel de la page d'accueil Live (cote prof).
 * Extrait de TeacherLiveView.vue (v2.282) pour decoupage en composants.
 *
 * Affiche : icone halo pulse + titre display + tagline + stats pills
 * (brouillons, modeles, archives) + raccourci clavier "?".
 */
import { Zap, PencilLine, Bookmark, FileText, HelpCircle } from 'lucide-vue-next'

interface HomeStats {
  drafts: number
  templates: number
  archived: number
}

defineProps<{
  stats: HomeStats
}>()

defineEmits<{
  (e: 'show-shortcuts'): void
}>()
</script>

<template>
  <section class="live-hero" aria-labelledby="live-hero-title">
    <div class="live-hero-icon" aria-hidden="true">
      <Zap :size="32" />
      <span class="live-hero-pulse" />
    </div>
    <div class="live-hero-content">
      <h1 id="live-hero-title" class="live-hero-title">
        Live
        <span class="live-hero-badge">Beta</span>
      </h1>
      <p class="live-hero-tagline">
        Quiz, sondages, code en direct. Engage tes etudiants en temps reel.
      </p>
      <div class="live-hero-stats" role="list" aria-label="Resume Live">
        <div v-if="stats.drafts > 0" class="lh-stat lh-stat--accent" role="listitem">
          <PencilLine :size="13" aria-hidden="true" />
          <span class="lh-stat-value">{{ stats.drafts }}</span>
          <span class="lh-stat-label">brouillon{{ stats.drafts > 1 ? 's' : '' }}</span>
        </div>
        <div v-if="stats.templates > 0" class="lh-stat" role="listitem">
          <Bookmark :size="13" aria-hidden="true" />
          <span class="lh-stat-value">{{ stats.templates }}</span>
          <span class="lh-stat-label">modele{{ stats.templates > 1 ? 's' : '' }}</span>
        </div>
        <div v-if="stats.archived > 0" class="lh-stat" role="listitem">
          <FileText :size="13" aria-hidden="true" />
          <span class="lh-stat-value">{{ stats.archived }}</span>
          <span class="lh-stat-label">archivee{{ stats.archived > 1 ? 's' : '' }}</span>
        </div>
        <button
          class="lh-stat lh-stat--shortcut"
          type="button"
          title="Raccourcis clavier"
          aria-label="Afficher les raccourcis clavier"
          @click="$emit('show-shortcuts')"
        >
          <HelpCircle :size="13" aria-hidden="true" />
          <span class="lh-stat-label"><kbd>?</kbd> pour les raccourcis</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Hero (accueil Live) — v2.279 / extracted v2.282
   Triple radial gradient (indigo + live-red + dot pattern) signature
   .hero landing. Big icon avec halo pulse, display title -0.03em. */
.live-hero {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-xl);
  padding: 36px 32px;
  border-radius: var(--radius-bento);
  border: 1px solid var(--border);
  background:
    radial-gradient(ellipse 60% 80% at 0% 50%,
      rgba(var(--accent-rgb), 0.10) 0%, transparent 70%),
    radial-gradient(ellipse 50% 70% at 100% 50%,
      color-mix(in srgb, var(--color-live) 14%, transparent) 0%, transparent 70%),
    radial-gradient(circle 1px at center,
      color-mix(in srgb, var(--accent) 25%, transparent) 1px, transparent 1px),
    var(--bg-elevated);
  background-size: 100% 100%, 100% 100%, 22px 22px, 100% 100%;
  overflow: hidden;
  isolation: isolate;
}

.live-hero-icon {
  position: relative;
  width: 76px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 22px;
  background:
    linear-gradient(135deg,
      color-mix(in srgb, var(--color-live) 90%, white) 0%,
      var(--color-live) 100%);
  color: #fff;
  flex-shrink: 0;
  box-shadow:
    0 12px 32px color-mix(in srgb, var(--color-live) 35%, transparent),
    0 2px 6px color-mix(in srgb, var(--color-live) 25%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.live-hero-pulse {
  position: absolute;
  inset: -6px;
  border-radius: 28px;
  border: 2px solid color-mix(in srgb, var(--color-live) 50%, transparent);
  animation: live-hero-ring 2.4s ease-out infinite;
  pointer-events: none;
}
@keyframes live-hero-ring {
  0%   { transform: scale(0.92); opacity: 0.7; }
  100% { transform: scale(1.18); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .live-hero-pulse { animation: none; opacity: 0.4; }
}

.live-hero-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.live-hero-title {
  font-family: var(--font-display);
  font-size: 36px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.03em;
  line-height: 1.05;
  display: flex;
  align-items: center;
  gap: 10px;
}
.live-hero-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-live);
  background: color-mix(in srgb, var(--color-live) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-live) 35%, transparent);
  border-radius: 999px;
}
.live-hero-tagline {
  font-size: 15px;
  color: var(--text-secondary);
  margin: 0;
  letter-spacing: -0.005em;
  max-width: 540px;
}

.live-hero-stats {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}
.lh-stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--bg-main);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1;
}
.lh-stat--accent {
  background: color-mix(in srgb, var(--color-live) 12%, transparent);
  border-color: color-mix(in srgb, var(--color-live) 35%, transparent);
  color: var(--color-live);
  font-weight: 700;
}
.lh-stat-value { font-weight: 700; color: inherit; font-variant-numeric: tabular-nums; }
.lh-stat-label { color: inherit; opacity: .9; }
.lh-stat--shortcut {
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out);
  font-family: inherit;
  margin-left: auto;
}
.lh-stat--shortcut:hover {
  background: var(--bg-active);
  border-color: color-mix(in srgb, var(--color-live) 40%, var(--border));
  color: var(--text-primary);
}
.lh-stat--shortcut kbd {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px;
  font-weight: 700;
  background: var(--bg-active);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 0 4px;
  margin: 0 2px;
}

@media (max-width: 720px) {
  .live-hero {
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    padding: 24px 20px;
    gap: 16px;
  }
  .live-hero-title { font-size: 28px; }
  .live-hero-tagline { font-size: 14px; }
}
</style>
