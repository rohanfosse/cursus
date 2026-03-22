/**
 * WidgetLive.vue — Bannière de session live en cours.
 */
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Radio, ArrowRight } from 'lucide-vue-next'
import { useLiveStore } from '@/stores/live'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const liveStore = useLiveStore()
const appStore = useAppStore()

const hasLive = computed(() => !!liveStore.currentSession && liveStore.currentSession.status === 'active')

onMounted(() => {
  const pid = appStore.activePromoId
  if (pid) liveStore.fetchActiveForPromo(pid)
})
</script>

<template>
  <div v-if="hasLive" class="sa-live" @click="router.push('/live')">
    <Radio :size="16" class="sa-live-icon" />
    <span class="sa-live-dot" />
    <span class="sa-live-text">Session live en cours : <strong>{{ liveStore.currentSession?.title }}</strong></span>
    <button class="sa-live-btn">Rejoindre <ArrowRight :size="12" /></button>
  </div>
</template>

<style scoped>
.sa-live {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 10px;
  background: rgba(231,76,60,.08);
  border: 1px solid rgba(231,76,60,.25);
  cursor: pointer;
  transition: background .15s cubic-bezier(0.4, 0, 0.2, 1);
}
.sa-live:hover { background: rgba(231,76,60,.12); }
.sa-live-icon { color: var(--color-danger); }
.sa-live-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--color-danger);
  animation: sa-pulse 1.5s ease-in-out infinite;
}
@keyframes sa-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
.sa-live-text { flex: 1; font-size: 13px; color: var(--text-primary); }
.sa-live-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; font-weight: 700; padding: 5px 12px;
  border: none; border-radius: 6px;
  background: var(--color-danger); color: #fff;
  cursor: pointer; font-family: var(--font);
}
</style>
