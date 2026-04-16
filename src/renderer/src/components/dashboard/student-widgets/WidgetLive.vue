/**
 * WidgetLive.vue - Widget Live : session active ou bouton rejoindre.
 */
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Zap, ArrowRight, Radio } from 'lucide-vue-next'
import { useLiveStore } from '@/stores/live'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const liveStore = useLiveStore()
const appStore = useAppStore()

const hasLive = computed(() => !!liveStore.currentSession && liveStore.currentSession.status === 'active')

onMounted(() => {
  // Skip if already fetched (avoids double-fetch with StudentLiveTab)
  if (liveStore.currentSession) return
  const pid = appStore.activePromoId
  if (pid) liveStore.fetchActiveForPromo(pid)
})
</script>

<template>
  <!-- Session active : CTA rouge -->
  <div v-if="hasLive" class="sa-live sa-live--active" role="button" tabindex="0" aria-label="Rejoindre la session Live en cours" @click="router.push('/live')" @keydown.enter="router.push('/live')">
    <Zap :size="16" class="sa-live-icon" />
    <span class="sa-live-dot" />
    <span class="sa-live-text">Live en cours : <strong>{{ liveStore.currentSession?.title }}</strong></span>
    <button class="sa-live-btn sa-live-btn--active">Rejoindre <ArrowRight :size="12" /></button>
  </div>

  <!-- Pas de session : etat compact avec bouton code -->
  <div v-else class="sa-live sa-live--idle" role="button" tabindex="0" aria-label="Rejoindre une session Live" @click="router.push('/live')" @keydown.enter="router.push('/live')">
    <Radio :size="14" class="sa-live-icon--idle" />
    <span class="sa-live-text--idle">Pas de session Live en cours</span>
    <button class="sa-live-btn sa-live-btn--idle">Rejoindre <ArrowRight :size="11" /></button>
  </div>
</template>

<style scoped>
.sa-live {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  cursor: pointer;
  transition: background .15s;
  height: 100%;
}

/* Active session */
.sa-live--active {
  background: rgba(231,76,60,.08);
  border: 1px solid rgba(231,76,60,.25);
}
.sa-live--active:hover { background: rgba(231,76,60,.12); }
.sa-live-icon { color: var(--color-danger); }
.sa-live-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--color-danger);
  animation: sa-pulse 1.5s ease-in-out infinite;
}
@keyframes sa-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
.sa-live-text { flex: 1; font-size: 13px; color: var(--text-primary); }
.sa-live-btn--active {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; font-weight: 700; padding: 5px 12px;
  border: none; border-radius: 6px;
  background: var(--color-danger); color: #fff;
  cursor: pointer; font-family: var(--font);
}

/* Idle (no session) */
.sa-live--idle {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
}
.sa-live--idle:hover { background: var(--bg-hover); border-color: var(--accent); }
.sa-live-icon--idle { color: var(--text-muted); opacity: .5; flex-shrink: 0; }
.sa-live-text--idle { flex: 1; font-size: 12px; color: var(--text-muted); }
.sa-live-btn--idle {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; padding: 4px 10px;
  border: 1px solid var(--border); border-radius: 6px;
  background: transparent; color: var(--accent);
  cursor: pointer; font-family: var(--font);
  transition: all .15s; white-space: nowrap;
}
.sa-live-btn--idle:hover { background: rgba(74,144,217,.06); border-color: var(--accent); }
</style>
