<script setup lang="ts">
import { onMounted } from 'vue'
import { Pen, FileText } from 'lucide-vue-next'
import { useSignature } from '@/composables/useSignature'
import { useModalsStore } from '@/stores/modals'
import { relativeTime } from '@/utils/date'
import { initials, avatarColor } from '@/utils/format'
import type { SignatureRequest } from '@/types'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const { requests, loading, loadRequests } = useSignature()
const modals = useModalsStore()

onMounted(() => loadRequests('pending'))

function openSignature(req: SignatureRequest) {
  modals.signatureRequest = req
}
</script>

<template>
  <UiWidgetCard
    :icon="Pen"
    label="Signatures en attente"
    tone="accent"
    aria-label="Signatures en attente"
  >
    <template v-if="requests.length" #header-extra>
      <span class="wsig-badge">{{ requests.length }}</span>
    </template>

    <div v-if="loading" class="wsig-loading">Chargement...</div>
    <EmptyState v-else-if="!requests.length" size="sm" tone="muted" title="Aucune signature en attente" />

    <div v-else class="wsig-list">
      <button
        v-for="req in requests.slice(0, 5)"
        :key="req.id"
        type="button"
        class="wsig-item"
        @click="openSignature(req)"
      >
        <div class="wsig-avatar" :style="{ background: avatarColor(req.student_name || '') }">
          {{ initials(req.student_name || '') }}
        </div>
        <div class="wsig-info">
          <span class="wsig-name">{{ req.student_name }}</span>
          <span class="wsig-file"><FileText :size="10" /> {{ req.file_name }}</span>
        </div>
        <span class="wsig-date">{{ relativeTime(req.created_at) }}</span>
      </button>
    </div>
  </UiWidgetCard>
</template>

<style scoped>
.wsig-badge {
  font-size: var(--text-2xs);
  font-weight: 700;
  color: #fff;
  background: var(--color-danger);
  border-radius: var(--radius);
  padding: 1px 6px;
}

.wsig-loading {
  font-size: var(--text-sm);
  color: var(--text-muted);
  padding: var(--space-sm) 0;
  text-align: center;
}

.wsig-list { display: flex; flex-direction: column; gap: var(--space-xs); }

.wsig-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px var(--space-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  font-family: inherit;
  transition: background var(--motion-fast) var(--ease-out);
}
.wsig-item:hover { background: var(--bg-hover); }
.wsig-item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.wsig-avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wsig-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.wsig-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.wsig-file {
  font-size: 10.5px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wsig-date {
  font-size: var(--text-2xs);
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
