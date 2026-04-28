<script setup lang="ts">
/**
 * DemoBanner - bandeau sticky affiche quand `currentUser.demo === true`.
 *
 * Hauteur 32px. Texte "Mode demonstration", CTA "Creer un compte" qui
 * pointe vers la page d'inscription en cassant la session demo.
 *
 * Voulu : pas de compteur d'actions, pas de timer (cf. brief Q3 - "le plus
 * simple pour un etudiant qui veut tester sans perdre de temps").
 */
import { Beaker, X } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useDemoMode } from '@/composables/useDemoMode'

const appStore = useAppStore()
const { isDemo } = useDemoMode()

function leaveDemo() {
  // Termine la session cote serveur (best-effort) puis purge le cote client.
  try {
    void window.api.demoEnd?.()
  } catch { /* ignore */ }
  appStore.logout()
  // Recharge sur la page de login pour avoir un etat propre.
  window.location.href = '/'
}

function createAccount() {
  // Logout puis redirige vers la page de login (qui propose creer un compte).
  appStore.logout()
  window.location.href = 'https://app.cursus.school/'
}
</script>

<template>
  <div v-if="isDemo" class="demo-banner" role="status" aria-live="polite">
    <Beaker :size="14" class="demo-banner-icon" aria-hidden="true" />
    <span class="demo-banner-text">
      <strong>Mode demonstration</strong>
      <span class="demo-banner-sep">&middot;</span>
      Donnees fictives, reset apres 24h
    </span>
    <button
      type="button"
      class="demo-banner-cta"
      @click="createAccount"
    >
      Creer un compte
    </button>
    <button
      type="button"
      class="demo-banner-close"
      :title="'Quitter la demo'"
      :aria-label="'Quitter la demo'"
      @click="leaveDemo"
    >
      <X :size="14" />
    </button>
  </div>
</template>

<style scoped>
.demo-banner {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  height: 32px;
  padding: 0 var(--space-md);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 18%, var(--bg-elevated)) 0%,
    color-mix(in srgb, var(--accent) 12%, var(--bg-elevated)) 100%
  );
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
  z-index: 90;
}

.demo-banner-icon { color: var(--accent); flex-shrink: 0; }

.demo-banner-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
}
.demo-banner-text strong {
  color: var(--text-primary);
  font-weight: 700;
}

.demo-banner-sep { margin: 0 6px; color: var(--text-muted); }

.demo-banner-cta {
  flex-shrink: 0;
  padding: 4px 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: filter var(--motion-fast) var(--ease-out);
}
.demo-banner-cta:hover { filter: brightness(1.08); }
.demo-banner-cta:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.demo-banner-close {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out), color var(--motion-fast) var(--ease-out);
}
.demo-banner-close:hover {
  background: rgba(0, 0, 0, .08);
  color: var(--text-primary);
}
.demo-banner-close:focus-visible { outline: none; box-shadow: var(--focus-ring); }

@media (max-width: 640px) {
  .demo-banner-sep { display: none; }
  .demo-banner-text { font-size: 11px; }
}
</style>
