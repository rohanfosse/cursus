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

    <nav class="adm-tabs" aria-label="Sections admin">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="adm-tab"
        :class="[
          { 'adm-tab--active': activeTab === t.id },
          { 'adm-tab--alert': t.id === 'errors' && errorsCriticalCount24h > 0 },
        ]"
        :aria-selected="activeTab === t.id"
        role="tab"
        @click="activeTab = t.id"
      >
        <component :is="t.icon" :size="15" />
        <span>{{ t.label }}</span>
        <!-- Badge sur l'onglet Erreurs : rouge pulsant si critiques, gris sinon -->
        <span
          v-if="t.id === 'errors' && errorsCount24h > 0"
          class="adm-tab-badge"
          :class="{ 'adm-tab-badge--alert': errorsCriticalCount24h > 0 }"
          :aria-label="`${errorsCount24h} erreur(s) sur 24h${errorsCriticalCount24h ? `, dont ${errorsCriticalCount24h} critique(s)` : ''}`"
        >{{ errorsCount24h > 99 ? '99+' : errorsCount24h }}</span>
      </button>
    </nav>

    <div class="adm-body">
      <AdminHealth  v-if="activeTab === 'health'" />
      <AdminErrors  v-else-if="activeTab === 'errors'" />
      <AdminStats   v-else-if="activeTab === 'stats'" />
      <AdminUsers   v-else-if="activeTab === 'users'" />
      <AdminModules v-else-if="activeTab === 'modules'" />
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

.adm-tabs {
  display: flex;
  gap: 4px;
  padding: 8px var(--space-xl);
  border-bottom: 1px solid var(--border);
  background: var(--bg-main);
  flex-shrink: 0;
  overflow-x: auto;
}

.adm-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  padding: 7px 14px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out);
}
.adm-tab:hover {
  background: var(--bg-active);
  color: var(--text-primary);
}
.adm-tab--active {
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.3);
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
  margin-left: 2px;
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
  overflow: auto;
  padding: var(--space-xl);
}
</style>
