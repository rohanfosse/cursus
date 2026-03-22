/**
 * WidgetShortcuts.vue — Raccourcis vers les canaux récents.
 */
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Hash } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { STORAGE_KEYS } from '@/constants'

const router = useRouter()
const appStore = useAppStore()
const recentChannels = ref<{ id: number; name: string }[]>([])

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_CHANNELS)
    if (raw) recentChannels.value = (JSON.parse(raw) as { id: number; name: string }[]).slice(0, 4)
  } catch { /* ignore */ }
})

function goToChannel(ch: { id: number; name: string }) {
  appStore.activeChannelId = ch.id
  appStore.activeChannelName = ch.name
  router.push('/messages')
}
</script>

<template>
  <div v-if="recentChannels.length" class="sa-shortcuts">
    <div class="sa-card-header">
      <Hash :size="14" class="sa-card-icon" />
      <span class="sa-section-label">Conversations récentes</span>
    </div>
    <div class="sa-shortcuts-grid">
      <button
        v-for="ch in recentChannels" :key="ch.id"
        class="sa-shortcut"
        @click="goToChannel(ch)"
      >
        <Hash :size="12" class="sa-shortcut-hash" />
        <span>{{ ch.name }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.sa-shortcuts { margin-top: 2px; }
.sa-card-header { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
.sa-card-icon { color: var(--text-muted); flex-shrink: 0; }
.sa-section-label {
  text-transform: uppercase; letter-spacing: .08em; font-size: 10px;
  font-weight: 700; color: var(--text-muted); flex: 1;
}
.sa-shortcuts-grid { display: flex; gap: 8px; flex-wrap: wrap; }
.sa-shortcut {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 12px; border-radius: 8px;
  background: rgba(255,255,255,.03); border: 1px solid var(--border);
  color: var(--text-secondary); font-size: 12.5px; font-weight: 500;
  cursor: pointer; font-family: var(--font);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.sa-shortcut:hover {
  background: rgba(74,144,217,.08); border-color: rgba(74,144,217,.25);
  color: var(--accent);
}
.sa-shortcut-hash { color: var(--text-muted); }
@media (max-width: 600px) { .sa-shortcuts-grid { flex-direction: column; } }
</style>
