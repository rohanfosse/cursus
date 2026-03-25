<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Pen, Clock, FileText } from 'lucide-vue-next'
import { useSignature } from '@/composables/useSignature'
import { relativeTime } from '@/utils/date'
import type { SignatureRequest } from '@/types'

const { requests, loading, loadRequests } = useSignature()
const emit = defineEmits<{ openSignature: [request: SignatureRequest] }>()

onMounted(() => loadRequests('pending'))

function initials(name: string) {
  return name?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
}
</script>

<template>
  <div class="wsig-root">
    <div class="wsig-header">
      <Pen :size="14" class="wsig-icon" />
      <span class="wsig-title">Signatures en attente</span>
      <span v-if="requests.length" class="wsig-badge">{{ requests.length }}</span>
    </div>

    <div v-if="loading" class="wsig-empty">Chargement...</div>
    <div v-else-if="!requests.length" class="wsig-empty">Aucune signature en attente</div>

    <div v-else class="wsig-list">
      <div
        v-for="req in requests.slice(0, 5)"
        :key="req.id"
        class="wsig-item"
        @click="$emit('openSignature', req)"
      >
        <div class="wsig-avatar" :style="{ background: '#4a90d9' }">{{ initials(req.student_name || '') }}</div>
        <div class="wsig-info">
          <span class="wsig-name">{{ req.student_name }}</span>
          <span class="wsig-file"><FileText :size="10" /> {{ req.file_name }}</span>
        </div>
        <span class="wsig-date">{{ relativeTime(req.created_at) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wsig-root { display: flex; flex-direction: column; gap: 8px; }
.wsig-header { display: flex; align-items: center; gap: 6px; }
.wsig-icon { color: var(--accent); }
.wsig-title { font-size: 12px; font-weight: 700; color: var(--text-primary); }
.wsig-badge {
  font-size: 10px; font-weight: 700; color: #fff;
  background: var(--color-danger, #dc2626); border-radius: 10px;
  padding: 1px 6px; margin-left: auto;
}
.wsig-empty { font-size: 12px; color: var(--text-muted); padding: 8px 0; }
.wsig-list { display: flex; flex-direction: column; gap: 4px; }
.wsig-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 8px; cursor: pointer;
  transition: background .12s;
}
.wsig-item:hover { background: var(--bg-hover); }
.wsig-avatar {
  width: 24px; height: 24px; border-radius: 50%;
  font-size: 9px; font-weight: 700; color: #fff;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.wsig-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.wsig-name { font-size: 12px; font-weight: 600; color: var(--text-primary); }
.wsig-file {
  font-size: 10.5px; color: var(--text-muted); display: flex; align-items: center; gap: 3px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.wsig-date { font-size: 10px; color: var(--text-muted); flex-shrink: 0; }
</style>
