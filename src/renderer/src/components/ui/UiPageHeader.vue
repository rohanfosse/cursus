<script setup lang="ts">
  // En-tete de section unifie. Remplace .channel-header / .devoirs-header /
  // .agenda-header / .lumen-topbar / .docs-header (cf. MASTER.md §7-8).
  //
  // Layout :
  //   [#leading] [titre + sous-titre] [#actions / slot par defaut a droite]
  //
  // Variants :
  //   - sticky (defaut true) : box-shadow elevation-2, z-index 10
  //   - wrap (defaut false)  : flex-wrap pour les pages avec filtres (Agenda, Documents)

  withDefaults(defineProps<{
    title?: string
    subtitle?: string
    sticky?: boolean
    wrap?: boolean
  }>(), {
    sticky: true,
    wrap: false,
  })
</script>

<template>
  <header
    class="ui-page-header"
    :class="{ 'ui-page-header--sticky': sticky, 'ui-page-header--wrap': wrap }"
  >
    <div v-if="$slots.leading" class="ui-page-header__leading">
      <slot name="leading" />
    </div>

    <div v-if="title || subtitle || $slots.title" class="ui-page-header__main">
      <slot name="title">
        <h1 v-if="title" class="ui-page-header__title">{{ title }}</h1>
      </slot>
      <p v-if="subtitle" class="ui-page-header__subtitle">{{ subtitle }}</p>
    </div>

    <div v-if="$slots.default || $slots.actions" class="ui-page-header__actions">
      <slot name="actions" />
      <slot />
    </div>
  </header>
</template>

<style scoped>
.ui-page-header {
  min-height: var(--header-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: 0 var(--space-xl);
  background: var(--bg-main);
  border-bottom: 1px solid var(--border);
}
.ui-page-header--sticky {
  box-shadow: var(--elevation-2);
  z-index: 10;
}
.ui-page-header--wrap {
  flex-wrap: wrap;
  padding-top: var(--space-sm);
  padding-bottom: var(--space-sm);
}

.ui-page-header__leading {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.ui-page-header__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.ui-page-header__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-page-header__subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-page-header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
  margin-left: auto;
}
</style>
