<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, defineAsyncComponent } from 'vue'
import { Users, Puzzle, BarChart3, AlertTriangle, HeartPulse, ExternalLink, type LucideIcon } from 'lucide-vue-next'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import MobileMenuButton from '@/components/layout/MobileMenuButton.vue'
import { getAuthToken } from '@/utils/auth'
import { useApi } from '@/composables/useApi'

const AdminUsers   = defineAsyncComponent(() => import('@/components/admin/AdminUsers.vue'))
const AdminModules = defineAsyncComponent(() => import('@/components/admin/AdminModules.vue'))
const AdminStats   = defineAsyncComponent(() => import('@/components/admin/AdminStats.vue'))
const AdminErrors  = defineAsyncComponent(() => import('@/components/admin/AdminErrors.vue'))
const AdminHealth  = defineAsyncComponent(() => import('@/components/admin/AdminHealth.vue'))

type Tab = 'health' | 'errors' | 'stats' | 'users' | 'modules'

const activeTab = ref<Tab>('health')

// Compteur errors 24h pour le badge sur l'onglet — sert d'alerte glanceable
// au top de l'admin. Critique = boot + uncaught (apparait en rouge).
const { api } = useApi()
const errorsCount24h = ref(0)
const errorsCriticalCount24h = ref(0)

interface StatsRow { source: string; level: string; count: number }

async function loadErrorBadge(): Promise<void> {
  const res = await api(() => window.api.adminGetErrorReportsStats())
  if (!Array.isArray(res)) return
  const rows = res as StatsRow[]
  errorsCount24h.value = rows.reduce((s, r) => s + r.count, 0)
  errorsCriticalCount24h.value = rows
    .filter(r => r.source === 'boot' || r.source === 'uncaught')
    .reduce((s, r) => s + r.count, 0)
}

let badgeTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  loadErrorBadge()
  badgeTimer = setInterval(() => loadErrorBadge(), 60_000)
})
onUnmounted(() => { if (badgeTimer) clearInterval(badgeTimer) })

interface TabDef { id: Tab; label: string; icon: LucideIcon }
const tabs = computed<TabDef[]>(() => [
  { id: 'health',  label: 'Santé',        icon: HeartPulse },
  { id: 'errors',  label: 'Erreurs',      icon: AlertTriangle },
  { id: 'stats',   label: 'Statistiques', icon: BarChart3 },
  { id: 'users',   label: 'Utilisateurs', icon: Users },
  { id: 'modules', label: 'Modules',      icon: Puzzle },
])

function openExternalOps() {
  const token = getAuthToken()
  const url = token
    ? `https://admin.cursus.school/?token=${encodeURIComponent(token)}`
    : 'https://admin.cursus.school/'
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="admin-view">
    <UiPageHeader title="Administration" subtitle="Utilisateurs, modules et statistiques de la plateforme">
      <template #leading>
        <MobileMenuButton />
      </template>
      <template #actions>
        <button
          class="adm-external"
          title="Ouvrir la console externe (deploy, maintenance, audit...)"
          @click="openExternalOps"
        >
          <ExternalLink :size="14" />
          <span>Console ops</span>
        </button>
      </template>
    </UiPageHeader>

    <div class="adm-layout">
      <nav
        class="adm-side"
        role="tablist"
        aria-orientation="vertical"
        aria-label="Sections admin"
      >
        <p class="adm-side-label" id="adm-side-label">Sections</p>
        <button
          v-for="t in tabs"
          :key="t.id"
          class="adm-tab"
          :class="[
            { 'adm-tab--active': activeTab === t.id },
            { 'adm-tab--alert': t.id === 'errors' && errorsCriticalCount24h > 0 },
          ]"
          :aria-selected="activeTab === t.id"
          :tabindex="activeTab === t.id ? 0 : -1"
          role="tab"
          @click="activeTab = t.id"
        >
          <component :is="t.icon" :size="16" class="adm-tab-icon" aria-hidden="true" />
          <span class="adm-tab-label">{{ t.label }}</span>
          <!-- Badge sur l'onglet Erreurs : rouge pulsant si critiques, gris sinon -->
          <span
            v-if="t.id === 'errors' && errorsCount24h > 0"
            class="adm-tab-badge"
            :class="{ 'adm-tab-badge--alert': errorsCriticalCount24h > 0 }"
            :aria-label="`${errorsCount24h} erreur(s) sur 24h${errorsCriticalCount24h ? `, dont ${errorsCriticalCount24h} critique(s)` : ''}`"
          >{{ errorsCount24h > 99 ? '99+' : errorsCount24h }}</span>
        </button>
      </nav>

      <div class="adm-body" role="tabpanel">
        <AdminHealth  v-if="activeTab === 'health'" />
        <AdminErrors  v-else-if="activeTab === 'errors'" />
        <AdminStats   v-else-if="activeTab === 'stats'" />
        <AdminUsers   v-else-if="activeTab === 'users'" />
        <AdminModules v-else-if="activeTab === 'modules'" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-main);
  overflow: hidden;
}

.adm-external {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: var(--radius-lg);
  padding: 6px 12px;
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out);
}
.adm-external:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

/* Layout 2 colonnes : sidebar gauche fixe, contenu droite scrollable.
   Sous 768px (mobile), bascule en colonne avec une barre horizontale
   scrollable au sommet (comme avant v2.340). */
.adm-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.adm-side {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 220px;
  flex-shrink: 0;
  padding: var(--space-md) var(--space-sm);
  border-right: 1px solid var(--border);
  background: var(--bg-sidebar, var(--bg-main));
  overflow-y: auto;
}
.adm-side-label {
  margin: 0 0 var(--space-sm) var(--space-sm);
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--text-muted);
  user-select: none;
}

.adm-tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  font-size: 13.5px;
  font-weight: 500;
  text-align: left;
  padding: 9px 12px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background var(--t-fast) var(--ease-out),
    color var(--t-fast) var(--ease-out),
    border-color var(--t-fast) var(--ease-out);
}
.adm-tab:hover {
  background: var(--bg-active);
  color: var(--text-primary);
}
.adm-tab:focus-visible {
  outline: var(--focus-ring);
  outline-offset: 2px;
}
.adm-tab-icon {
  flex-shrink: 0;
}
.adm-tab-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.adm-tab--active {
  background: rgba(var(--accent-rgb), 0.14);
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.28);
}
/* Indicateur vertical sur l'onglet actif : barre 3px le long du bord
   gauche, signe le pattern "section selectionnee" des sidebars admin. */
.adm-tab--active::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--accent);
}

/* Onglet Erreurs en mode alerte (boot/uncaught presents en 24h) : bordure
   rouge persistante pour attirer l'oeil meme sans cliquer dessus. */
.adm-tab--alert {
  border-color: rgba(var(--color-danger-rgb, 220, 38, 38), .5);
  color: var(--color-danger);
}
.adm-tab--alert:hover {
  background: rgba(var(--color-danger-rgb, 220, 38, 38), .08);
  color: var(--color-danger);
}
.adm-tab--alert.adm-tab--active::before {
  background: var(--color-danger);
}

.adm-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  font-size: 10.5px;
  font-weight: 700;
  background: var(--bg-active);
  color: var(--text-secondary);
  border-radius: var(--radius-full, 999px);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.adm-tab-badge--alert {
  background: var(--color-danger);
  color: white;
  animation: badge-pulse 2.4s ease-in-out infinite;
}
@keyframes badge-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--color-danger-rgb, 220, 38, 38), .5); }
  50%      { box-shadow: 0 0 0 6px rgba(var(--color-danger-rgb, 220, 38, 38), 0); }
}
@media (prefers-reduced-motion: reduce) {
  .adm-tab-badge--alert { animation: none; }
}

.adm-body {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: var(--space-xl);
}

/* Mobile : sidebar repliee en barre horizontale scrollable au sommet.
   Reproduit le comportement d'avant la mise en sidebar tout en gardant
   la meme structure DOM (moins de risque a11y, tablist reste valide). */
@media (max-width: 768px) {
  .adm-layout {
    flex-direction: column;
  }
  .adm-side {
    flex-direction: row;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 8px var(--space-md);
    border-right: none;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    overflow-y: hidden;
    background: var(--bg-main);
  }
  .adm-side-label {
    display: none;
  }
  .adm-tab {
    width: auto;
    flex-shrink: 0;
    padding: 7px 12px;
    font-size: 13px;
  }
  .adm-tab--active::before {
    display: none;
  }
}
</style>
