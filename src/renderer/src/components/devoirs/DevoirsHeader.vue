/**
 * En-tête de la vue Devoirs : breadcrumb projet, hamburger mobile, bouton "Nouveau".
 */
<script setup lang="ts">
import { BookOpen, Plus, Menu } from 'lucide-vue-next'
import { useAppStore }    from '@/stores/app'
import { useModalsStore } from '@/stores/modals'

defineProps<{
  toggleSidebar?: () => void
}>()

const appStore = useAppStore()
const modals   = useModalsStore()
</script>

<template>
  <header class="devoirs-header">
    <div class="devoirs-header-title">
      <button v-if="toggleSidebar" class="mobile-hamburger" aria-label="Ouvrir le menu" @click="toggleSidebar">
        <Menu :size="22" />
      </button>
      <BookOpen :size="18" />
      <span>Devoirs</span>
      <template v-if="appStore.activeProject">
        <span class="header-breadcrumb-sep">&rsaquo;</span>
        <span class="header-project-ctx">{{ appStore.activeProject.replace(/^\S+\s/, '') }}</span>
        <button class="header-project-clear" title="Voir tous les devoirs" @click="appStore.activeProject = null">&times;</button>
      </template>
      <span v-else-if="appStore.activeChannelName" class="header-channel-ctx">
        # {{ appStore.activeChannelName }}
      </span>
    </div>

    <div class="devoirs-header-actions">
      <template v-if="appStore.isTeacher && !appStore.activeProject">
        <button class="btn-primary btn-nouveau" @click="modals.newDevoir = true">
          <Plus :size="14" /> Nouveau
        </button>
      </template>
    </div>

    <template v-if="appStore.isTeacher && appStore.activeProject">
      <button class="btn-primary btn-nouveau" @click="modals.newDevoir = true">
        <Plus :size="14" /> Nouveau
      </button>
    </template>
  </header>
</template>

<style scoped>
.devoirs-header {
  height: var(--header-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  gap: 12px;
  border-bottom: 1px solid var(--border);
}

.devoirs-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.header-channel-ctx {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-muted);
}

.header-breadcrumb-sep {
  font-size: 13px;
  color: var(--text-muted);
  opacity: .5;
}

.header-project-ctx {
  font-size: 13px;
  font-weight: 600;
  color: #9B87F5;
}

.header-project-clear {
  font-size: 10px;
  line-height: 1;
  padding: 2px 5px;
  border: 1px solid rgba(155,135,245,.3);
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-family: var(--font);
  transition: background var(--t-fast), color var(--t-fast);
}
.header-project-clear:hover {
  background: rgba(155,135,245,.15);
  color: #9B87F5;
  border-color: rgba(155,135,245,.6);
}

.devoirs-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-nouveau {
  font-size: 13px;
  padding: 6px 12px;
}
</style>
