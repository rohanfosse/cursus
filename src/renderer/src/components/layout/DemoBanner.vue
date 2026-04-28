<script setup lang="ts">
/**
 * DemoBanner - bandeau sticky affiche quand `currentUser.demo === true`.
 *
 * Hauteur 32px. Texte "Mode demonstration", CTA "Creer un compte" qui
 * pointe vers la page d'inscription en cassant la session demo.
 *
 * Voulu : pas de compteur d'actions, pas de timer (cf. brief Q3 - "le plus
 * simple pour un etudiant qui veut tester sans perdre de temps").
 *
 * Session reelle (backup/restore) : si l'utilisateur etait connecte avec
 * un vrai compte avant de lancer la demo, sa session est sauvegardee dans
 * `cc_session_backup`. Le bouton "Quitter la demo" la restaure pour qu'il
 * retrouve son app comme avant. La demo est strictement independante.
 */
import { computed } from 'vue'
import { Beaker } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useDemoMode } from '@/composables/useDemoMode'
import { STORAGE_KEYS } from '@/constants'
import type { User } from '@/types'

const appStore = useAppStore()
const { isDemo } = useDemoMode()

const hasBackup = computed(() => {
  try { return !!localStorage.getItem(STORAGE_KEYS.SESSION_BACKUP) }
  catch { return false }
})

function endDemoOnServer() {
  try { void window.api.demoEnd?.() } catch { /* ignore */ }
}

function leaveDemo() {
  endDemoOnServer()

  // Si une session reelle a ete backup avant la demo, on la restaure et
  // on retourne sur l'app normale au lieu de logout completement.
  let backup: User | null = null
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION_BACKUP)
    if (raw) backup = JSON.parse(raw) as User
  } catch { /* corrompu : on ignore et on logout */ }

  if (backup && backup.token) {
    // Restore : on logout d'abord (clear cc_session demo) puis on rejoue
    // login avec la session backup. Reload force le reset de tous les
    // stores qui ont charge des donnees demo.
    try { localStorage.removeItem(STORAGE_KEYS.SESSION_BACKUP) } catch { /* */ }
    appStore.logout()
    appStore.login(backup)
    window.api.setToken?.(backup.token)
    // Reload propre pour repartir de zero avec la vraie session.
    window.location.href = '/'
    return
  }

  // Pas de backup : logout simple (visiteur arrivee directement sur /demo).
  appStore.logout()
  window.location.href = '/'
}

function createAccount() {
  endDemoOnServer()
  // Pas de restore ici : l'utilisateur veut explicitement creer un nouveau
  // compte, donc on clean tout.
  try { localStorage.removeItem(STORAGE_KEYS.SESSION_BACKUP) } catch { /* */ }
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
      <template v-if="hasBackup">Ta vraie session t'attend, sors quand tu veux</template>
      <template v-else>Donnees fictives, reset apres 24h</template>
    </span>
    <button
      v-if="!hasBackup"
      type="button"
      class="demo-banner-cta"
      @click="createAccount"
    >
      Creer un compte
    </button>
    <button
      type="button"
      class="demo-banner-leave"
      :title="hasBackup ? 'Revenir a ma session' : 'Quitter la demo'"
      @click="leaveDemo"
    >
      {{ hasBackup ? 'Revenir a mon app' : 'Quitter' }}
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

.demo-banner-leave {
  flex-shrink: 0;
  padding: 4px 12px;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out), color var(--motion-fast) var(--ease-out), border-color var(--motion-fast) var(--ease-out);
}
.demo-banner-leave:hover {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--text-primary);
  border-color: var(--accent);
}
.demo-banner-leave:focus-visible { outline: none; box-shadow: var(--focus-ring); }

@media (max-width: 640px) {
  .demo-banner-sep { display: none; }
  .demo-banner-text { font-size: 11px; }
}
</style>
