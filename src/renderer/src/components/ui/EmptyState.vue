<script setup lang="ts">
  // Etat vide reutilisable : icone + titre + sous-titre + action optionnelle.
  // Trois tailles (sm/md/lg). En md/lg, l'icone est dans un wrapper colore
  // facon "carte d'illustration" (cf. design-system/cursus/MASTER.md §7).
  import type { Component } from 'vue'

  type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'muted'

  withDefaults(defineProps<{
    icon?: Component
    title?: string
    subtitle?: string
    /** sm = inline (sidebar/panel), md = section (defaut), lg = page entiere */
    size?: 'sm' | 'md' | 'lg'
    /** Couleur de fond du wrapper d'icone (variantes semantiques) */
    tone?: Tone
    /** @deprecated utiliser size="sm" */
    compact?: boolean
  }>(), {
    size: 'md',
    tone: 'accent',
    compact: false,
  })
</script>

<template>
  <div
    class="es"
    :class="[
      `es--${compact ? 'sm' : size}`,
      `es--tone-${tone}`,
    ]"
  >
    <div v-if="icon || $slots.icon" class="es-icon-wrap">
      <component :is="icon" v-if="icon" :size="size === 'sm' || compact ? 22 : size === 'lg' ? 36 : 28" />
      <slot v-else name="icon" />
    </div>
    <h3 v-if="title" class="es-title">{{ title }}</h3>
    <p v-if="subtitle" class="es-sub">{{ subtitle }}</p>
    <div v-if="$slots.default" class="es-actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.es {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  text-align: center;
}

.es--sm { padding: var(--space-lg) var(--space-md); gap: var(--space-xs); }
.es--md { padding: var(--space-xl) var(--space-lg); gap: var(--space-sm); }
.es--lg { padding: 80px var(--space-xl); gap: var(--space-md); }

.es-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-sm);
}
.es--sm .es-icon-wrap { width: 40px; height: 40px; }
.es--md .es-icon-wrap { width: 56px; height: 56px; }
.es--lg .es-icon-wrap { width: 72px; height: 72px; }

/* Tones — fond et couleur d'icone (rgba via tokens, theme-reactif) */
.es--tone-accent  .es-icon-wrap { background: rgba(var(--accent-rgb), .12);   color: var(--accent); }
.es--tone-success .es-icon-wrap { background: rgba(46,204,113,.12);            color: var(--color-success); }
.es--tone-warning .es-icon-wrap { background: rgba(232,137,26,.12);            color: var(--color-warning); }
.es--tone-danger  .es-icon-wrap { background: rgba(231,76,60,.12);             color: var(--color-danger); }
.es--tone-muted   .es-icon-wrap { background: var(--bg-hover);                 color: var(--text-muted); }

.es-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.es--sm .es-title { font-size: 13px; }
.es--lg .es-title { font-size: 17px; }

.es-sub {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 340px;
  line-height: 1.5;
  margin: 0;
}
.es--sm .es-sub { font-size: 12px; max-width: 280px; }

.es-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}
</style>
