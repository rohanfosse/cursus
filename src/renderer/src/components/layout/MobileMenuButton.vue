/**
 * MobileMenuButton - hamburger reutilisable pour les en-tetes de page.
 *
 * Visible uniquement <= 768px (mobile). Cache totalement sur desktop pour
 * eviter les doublons avec le NavRail. Utiliser dans le slot "leading" de
 * UiPageHeader ou directement en debut de header custom.
 */
<script setup lang="ts">
import { Menu } from 'lucide-vue-next'

defineProps<{
  toggleSidebar?: () => void
}>()
</script>

<template>
  <button
    v-if="toggleSidebar"
    class="mobile-menu-btn"
    aria-label="Ouvrir le menu"
    type="button"
    @click="toggleSidebar"
  >
    <Menu :size="22" />
  </button>
</template>

<style scoped>
.mobile-menu-btn {
  display: none;
  background: transparent;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  align-items: center;
  justify-content: center;
  min-width: 40px;
  min-height: 40px;
}
.mobile-menu-btn:active {
  background: var(--bg-hover);
}
.mobile-menu-btn:focus-visible {
  outline: var(--focus-ring);
  outline-offset: 2px;
}
@media (max-width: 768px) {
  .mobile-menu-btn {
    display: inline-flex;
  }
}
</style>
