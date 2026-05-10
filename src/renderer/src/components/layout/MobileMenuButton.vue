/**
 * MobileMenuButton - hamburger reutilisable pour les en-tetes de page.
 *
 * Visible uniquement <= 768px. Lit `toggleSidebar` directement depuis
 * `useUiStore`, donc aucune prop a passer depuis les vues parentes.
 *
 * Si on a besoin d'un comportement custom (ex. fermer un panneau avant
 * d'ouvrir le drawer), passer la prop `onTap` qui prend le pas sur
 * l'action par defaut.
 */
<script setup lang="ts">
import { Menu } from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'

const props = defineProps<{
  onTap?: () => void
}>()

const ui = useUiStore()

function handleTap(): void {
  if (props.onTap) props.onTap()
  else ui.toggleSidebar()
}
</script>

<template>
  <button
    class="mobile-menu-btn"
    aria-label="Ouvrir le menu"
    type="button"
    @click="handleTap"
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
