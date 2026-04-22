<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue'
import { Users, Puzzle, BarChart3, Menu, ExternalLink, type LucideIcon } from 'lucide-vue-next'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import { getAuthToken } from '@/utils/auth'

const AdminUsers   = defineAsyncComponent(() => import('@/components/admin/AdminUsers.vue'))
const AdminModules = defineAsyncComponent(() => import('@/components/admin/AdminModules.vue'))
const AdminStats   = defineAsyncComponent(() => import('@/components/admin/AdminStats.vue'))

defineProps<{ toggleSidebar?: () => void }>()

type Tab = 'users' | 'modules' | 'stats'

const activeTab = ref<Tab>('stats')

const tabs: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: 'stats',   label: 'Statistiques', icon: BarChart3 },
  { id: 'users',   label: 'Utilisateurs', icon: Users },
  { id: 'modules', label: 'Modules',      icon: Puzzle },
]

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
        <button
          v-if="toggleSidebar"
          class="adm-menu-btn"
          aria-label="Ouvrir le menu"
          @click="toggleSidebar"
        ><Menu :size="18" /></button>
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
        :class="{ 'adm-tab--active': activeTab === t.id }"
        :aria-selected="activeTab === t.id"
        role="tab"
        @click="activeTab = t.id"
      >
        <component :is="t.icon" :size="15" />
        <span>{{ t.label }}</span>
      </button>
    </nav>

    <div class="adm-body">
      <AdminStats   v-if="activeTab === 'stats'" />
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

.adm-menu-btn {
  display: none;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  color: var(--text-primary);
  cursor: pointer;
}
@media (max-width: 900px) {
  .adm-menu-btn { display: inline-flex; align-items: center; }
}

.adm-external {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 14px;
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
  border-radius: 10px;
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

.adm-body {
  flex: 1;
  overflow: auto;
  padding: var(--space-xl);
}
</style>
