/**
 * Menu contextuel des cartes devoirs (prof) : ouvrir, publier/dépublier, dupliquer, supprimer.
 */
<script setup lang="ts">
import { ExternalLink, Eye, EyeOff, Copy, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  ctxMenu: { x: number; y: number; devoir: { is_published?: boolean | number } | null }
  ctxOpen: () => void
  ctxPublishToggle: () => void
  ctxDuplicate: () => void
  ctxDelete: () => void
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="ctxMenu.devoir"
      class="ctx-menu"
      :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      @click.stop
    >
      <button class="ctx-item" @click="ctxOpen">
        <ExternalLink :size="14" /> Ouvrir
      </button>
      <button class="ctx-item" @click="ctxPublishToggle">
        <component :is="ctxMenu.devoir.is_published ? EyeOff : Eye" :size="14" />
        {{ ctxMenu.devoir.is_published ? 'Dépublier' : 'Publier' }}
      </button>
      <button class="ctx-item" @click="ctxDuplicate">
        <Copy :size="14" /> Dupliquer
      </button>
      <div class="ctx-divider" />
      <button class="ctx-item ctx-item--danger" @click="ctxDelete">
        <Trash2 :size="14" /> Supprimer
      </button>
    </div>
  </Teleport>
</template>

<style>
.ctx-menu {
  position: fixed;
  z-index: 10000;
  min-width: 170px;
  background: var(--bg-primary, #1e1e2e);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,.35);
  padding: 4px 0;
  animation: ctxFade .12s ease;
}
@keyframes ctxFade {
  from { opacity: 0; transform: scale(.96); }
  to   { opacity: 1; transform: scale(1); }
}
.ctx-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 7px 14px;
  background: none; border: none; color: var(--text-primary, #cdd6f4);
  font-size: 13px; cursor: pointer; text-align: left;
}
.ctx-item:hover { background: var(--bg-hover, rgba(255,255,255,.07)); }
.ctx-item--danger { color: var(--color-error, #f38ba8); }
.ctx-item--danger:hover { background: rgba(243,139,168,.12); }
.ctx-divider { height: 1px; margin: 4px 8px; background: var(--border-color, #333); }
</style>
