/**
 * SidebarSearch — Arc Browser-style subtle search bar opening the command palette.
 */
<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { useModalsStore } from '@/stores/modals'

const modals = useModalsStore()
</script>

<template>
  <button class="sb-search" @click="modals.cmdPalette = true">
    <Search :size="13" class="sb-search-icon" />
    <span class="sb-search-placeholder">Rechercher…</span>
    <kbd class="sb-search-kbd">Ctrl+K</kbd>
  </button>
</template>

<style scoped>
.sb-search {
  display: flex;
  align-items: center;
  gap: 7px;
  width: calc(100% - 20px);
  margin: 8px 10px 4px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  border-radius: 7px;
  cursor: pointer;
  font-family: var(--font);
  color: var(--text-muted);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  text-align: left;
}
.sb-search:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.18);
  color: var(--text-secondary);
}
.sb-search-icon {
  flex-shrink: 0;
  opacity: 0.6;
}
.sb-search-placeholder {
  flex: 1;
  font-size: 12.5px;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sb-search-kbd {
  font-size: 9.5px;
  font-family: var(--font);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 5px;
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
