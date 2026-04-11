<script setup lang="ts">
  // Carte unifiee. Remplace .dv-proj-card / .sa-card / .travail-card /
  // .doc-card / .dv-next-card / .identity-card et leurs variantes
  // (cf. design-system/cursus/MASTER.md §7-8).
  //
  // Variants :
  //   - interactive (defaut false) : hover translateY + elevation, role=button
  //   - elevated   (defaut 1)      : niveau d'elevation au repos (0..3)
  //   - tone       (defaut none)   : barre laterale colore (accent/warning/...)
  //   - padding    (defaut 'md')   : sm/md/lg

  type Tone = 'none' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

  const props = withDefaults(defineProps<{
    interactive?: boolean
    elevated?: 0 | 1 | 2 | 3
    tone?: Tone
    padding?: 'sm' | 'md' | 'lg'
    as?: 'div' | 'article' | 'section' | 'button'
  }>(), {
    interactive: false,
    elevated: 1,
    tone: 'none',
    padding: 'md',
    as: 'div',
  })

  const emit = defineEmits<{ (e: 'click', ev: MouseEvent): void }>()

  function onClick(ev: MouseEvent) {
    if (props.interactive) emit('click', ev)
  }
</script>

<template>
  <component
    :is="as"
    class="ui-card"
    :class="[
      `ui-card--pad-${padding}`,
      `ui-card--elev-${elevated}`,
      tone !== 'none' ? `ui-card--tone-${tone}` : null,
      { 'ui-card--interactive': interactive },
    ]"
    :tabindex="interactive ? 0 : undefined"
    :role="interactive && as !== 'button' ? 'button' : undefined"
    @click="onClick"
    @keydown.enter="interactive && $emit('click', $event as unknown as MouseEvent)"
    @keydown.space.prevent="interactive && $emit('click', $event as unknown as MouseEvent)"
  >
    <slot />
  </component>
</template>

<style scoped>
.ui-card {
  position: relative;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  text-align: left;
  width: 100%;
  transition:
    transform var(--motion-base) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out),
    box-shadow var(--motion-base) var(--ease-out),
    background var(--motion-fast) var(--ease-out);
}

/* Padding scale */
.ui-card--pad-sm { padding: var(--space-md); }
.ui-card--pad-md { padding: var(--space-lg); }
.ui-card--pad-lg { padding: var(--space-xl); }

/* Elevation au repos */
.ui-card--elev-0 { box-shadow: var(--elevation-0); }
.ui-card--elev-1 { box-shadow: var(--elevation-1); }
.ui-card--elev-2 { box-shadow: var(--elevation-2); }
.ui-card--elev-3 { box-shadow: var(--elevation-3); }

/* Tone : barre laterale 3px (style "categorise") */
.ui-card--tone-accent  { border-left: 3px solid var(--accent); }
.ui-card--tone-success { border-left: 3px solid var(--color-success); }
.ui-card--tone-warning { border-left: 3px solid var(--color-warning); }
.ui-card--tone-danger  { border-left: 3px solid var(--color-danger); }
.ui-card--tone-info    { border-left: 3px solid var(--color-info); }

/* Interactive : hover state + focus ring */
.ui-card--interactive {
  cursor: pointer;
  user-select: none;
}
.ui-card--interactive:hover {
  border-color: var(--accent);
  background: rgba(var(--accent-rgb), .04);
  transform: translateY(-2px);
  box-shadow: var(--elevation-2);
}
.ui-card--interactive:active {
  transform: translateY(0);
}
.ui-card--interactive:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring), var(--elevation-2);
}
</style>
