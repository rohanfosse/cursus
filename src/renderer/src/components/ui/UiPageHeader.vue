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

  // Section : controle l'accent (border-bottom, optional badge tint).
  // Mappe sur les tokens --color-{chat,devoirs,docs,lumen,live,rex,dashboard}
  // herites de la landing (cf. base.css). Defaut 'none' = couleur accent generique.
  type Section = 'chat' | 'devoirs' | 'docs' | 'lumen' | 'live' | 'rex' | 'dashboard' | 'none'

  withDefaults(defineProps<{
    title?: string
    subtitle?: string
    sticky?: boolean
    wrap?: boolean
    section?: Section
  }>(), {
    sticky: true,
    wrap: false,
    section: 'none',
  })
</script>

<template>
  <header
    class="ui-page-header"
    :class="{ 'ui-page-header--sticky': sticky, 'ui-page-header--wrap': wrap }"
    :data-section="section !== 'none' ? section : undefined"
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
  position: relative;
}

/* Accent par feature (alignement landing) — barre fine en bas teintee.
   v2.284 : passe de 2px plein a 1px + opacity 0.55 — la barre 2px etait
   visuellement trop forte (notamment sur la section Lumen avec le
   --color-lumen jaune/or saturated). Cf. base.css §Couleurs sectorielles.
*/
.ui-page-header[data-section]::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: -1px;
  height: 1px;
  opacity: 0.55;
  pointer-events: none;
}
.ui-page-header[data-section="chat"]::after      { background: var(--color-chat); }
.ui-page-header[data-section="devoirs"]::after   { background: var(--color-devoirs); }
.ui-page-header[data-section="docs"]::after      { background: var(--color-docs); }
.ui-page-header[data-section="lumen"]::after     { background: var(--color-lumen); }
.ui-page-header[data-section="live"]::after      { background: var(--color-live); }
.ui-page-header[data-section="rex"]::after       { background: var(--color-rex); }
.ui-page-header[data-section="dashboard"]::after { background: var(--color-dashboard); }
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
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
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
