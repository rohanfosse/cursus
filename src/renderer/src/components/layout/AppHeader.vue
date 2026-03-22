/**
 * AppHeader.vue
 * Top bar: logo breadcrumb, centred search trigger, notifications + user pill.
 */
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { GraduationCap, Search, Bell } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useModalsStore } from '@/stores/modals'

const route   = useRoute()
const appStore = useAppStore()
const modals   = useModalsStore()

const routeLabel = computed(() => {
  const labels: Record<string, string> = {
    messages:  'Messages',
    devoirs:   'Devoirs',
    documents: 'Documents',
    live:      'Live',
  }
  return labels[route.name as string] ?? (route.name as string) ?? ''
})

const unreadCount = computed(() => {
  const hist = appStore.notificationHistory ?? []
  return hist.filter((n: { read: boolean }) => !n.read).length
})

const initials = computed(() => {
  const name = appStore.currentUser?.name ?? ''
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
})
</script>

<template>
  <header class="app-header">
    <!-- Left: logo + breadcrumb -->
    <div class="ah-left">
      <GraduationCap :size="18" class="ah-logo-icon" />
      <span class="ah-logo-text">Cursus</span>
      <span v-if="routeLabel" class="ah-sep">/</span>
      <span v-if="routeLabel" class="ah-route">{{ routeLabel }}</span>
    </div>

    <!-- Centre: search bar trigger -->
    <button class="ah-search" @click="modals.cmdPalette = true">
      <Search :size="14" class="ah-search-icon" />
      <span class="ah-search-text">Rechercher…</span>
      <kbd class="ah-kbd">Ctrl K</kbd>
    </button>

    <!-- Right: notification bell + user pill -->
    <div class="ah-right">
      <button class="ah-bell" aria-label="Notifications" @click="modals.cmdPalette = true">
        <Bell :size="16" />
        <span v-if="unreadCount > 0" class="ah-bell-badge">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
      </button>
      <span class="ah-user-pill">{{ initials }}</span>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  min-height: 48px;
  padding: 0 16px;
  background: var(--bg-sidebar);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
  z-index: var(--z-sticky);
  gap: 12px;
}

/* ── Left ── */
.ah-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.ah-logo-icon { color: var(--accent); }
.ah-logo-text { font-size: 15px; font-weight: 800; color: var(--text-primary); }
.ah-sep { color: var(--text-muted); font-size: 14px; }
.ah-route { font-size: 13px; font-weight: 500; color: var(--text-secondary); }

/* ── Search bar trigger ── */
.ah-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 1 360px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-hover);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: border-color var(--t-fast), background var(--t-fast);
}
.ah-search:hover {
  border-color: var(--accent);
  background: var(--bg-active);
}
.ah-search-icon { flex-shrink: 0; opacity: .6; }
.ah-search-text { flex: 1; text-align: left; }
.ah-kbd {
  font-size: 10px;
  font-family: inherit;
  padding: 2px 5px;
  border-radius: 3px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,.04);
  color: var(--text-muted);
}

/* ── Right ── */
.ah-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.ah-bell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
}
.ah-bell:hover { background: var(--bg-hover); color: var(--text-primary); }
.ah-bell-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--color-danger);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.ah-user-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .ah-search-text { display: none; }
  .ah-kbd { display: none; }
  .ah-search { flex: 0 0 40px; justify-content: center; padding: 0; }
}
</style>
