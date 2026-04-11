<script setup lang="ts">
  // Pill / Badge unifie. Remplace .dv-stat-pill, .devoir-type-badge, .badge-new
  // (cf. design-system/cursus/MASTER.md §7).
  //
  // Tones semantiques + 2 tailles. Optionnellement icone leading.

  type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'muted'
  type Size = 'xs' | 'sm' | 'md'
  type Shape = 'rounded' | 'pill'

  withDefaults(defineProps<{
    tone?: Tone
    size?: Size
    shape?: Shape
  }>(), {
    tone: 'neutral',
    size: 'sm',
    shape: 'pill',
  })
</script>

<template>
  <span
    class="ui-pill"
    :class="[`ui-pill--${tone}`, `ui-pill--${size}`, `ui-pill--${shape}`]"
  >
    <span v-if="$slots.leading" class="ui-pill__leading">
      <slot name="leading" />
    </span>
    <slot />
  </span>
</template>

<style scoped>
.ui-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid transparent;
  line-height: 1;
}
.ui-pill__leading { display: inline-flex; }

/* Tailles */
.ui-pill--xs { font-size: 10px; padding: 2px 6px; letter-spacing: .04em; text-transform: uppercase; font-weight: 800; }
.ui-pill--sm { font-size: 11px; padding: 4px 10px; }
.ui-pill--md { font-size: 13px; padding: var(--space-sm) var(--space-md); }

/* Forme */
.ui-pill--rounded { border-radius: var(--radius-sm); }
.ui-pill--pill    { border-radius: 999px; }

/* Tones (alignes sur les tokens semantiques) */
.ui-pill--neutral {
  background: var(--bg-elevated);
  border-color: var(--border);
  color: var(--text-primary);
}
.ui-pill--accent {
  background: rgba(var(--accent-rgb), .14);
  border-color: rgba(var(--accent-rgb), .25);
  color: var(--accent);
}
.ui-pill--success {
  background: rgba(46,204,113,.12);
  border-color: rgba(46,204,113,.25);
  color: var(--color-success);
}
.ui-pill--warning {
  background: rgba(232,137,26,.12);
  border-color: rgba(232,137,26,.25);
  color: var(--color-warning);
}
.ui-pill--danger {
  background: rgba(231,76,60,.12);
  border-color: rgba(231,76,60,.25);
  color: var(--color-danger);
}
.ui-pill--info {
  background: rgba(59,130,246,.12);
  border-color: rgba(59,130,246,.25);
  color: var(--color-info);
}
.ui-pill--muted {
  background: var(--bg-hover);
  color: var(--text-muted);
}
</style>
