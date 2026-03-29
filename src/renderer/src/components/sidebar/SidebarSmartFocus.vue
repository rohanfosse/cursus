/**
 * SidebarSmartFocus - "À LA UNE" section showing urgent/unread channels.
 * Hidden when empty. Flame icon in header.
 */
<script setup lang="ts">
import { Flame } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useRouter, useRoute } from 'vue-router'
import type { Channel } from '@/types'
import { channelMemberCount } from '@/composables/useSidebarNav'

interface FocusItem {
  channel: Channel
  reason: string
  urgency: 'high' | 'medium' | 'low'
}

defineProps<{ items: FocusItem[] }>()

const appStore = useAppStore()
const router   = useRouter()
const route    = useRoute()

function select(ch: Channel) {
  appStore.openChannel(ch.id, ch.promo_id, ch.name, ch.type, ch.description ?? '', false, !!ch.is_private, channelMemberCount(ch))
  if (route.name !== 'messages') router.push('/messages')
}
</script>

<template>
  <div v-if="items.length" class="sb-smart-focus">
    <div class="sb-section-title">
      <Flame :size="11" class="sb-section-icon" />
      <span>À LA UNE</span>
    </div>
    <button
      v-for="item in items"
      :key="item.channel.id"
      class="sb-focus-item"
      :class="`sb-focus-${item.urgency}`"
      @click="select(item.channel)"
    >
      <span class="sb-focus-name">{{ item.channel.name }}</span>
      <span class="sb-focus-reason">{{ item.reason }}</span>
    </button>
  </div>
</template>

<style scoped>
.sb-smart-focus {
  padding: 0 10px;
  margin-bottom: 4px;
}

.sb-section-title {
  display: flex;
  align-items: center;
  gap: 5px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  padding: 8px 0 4px;
}

.sb-section-icon {
  opacity: 0.7;
}

.sb-focus-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 5px 8px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.03);
  border: none;
  cursor: pointer;
  font-family: var(--font);
  color: var(--text-primary);
  font-size: 12.5px;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: 2px;
}
.sb-focus-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.sb-focus-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sb-focus-reason {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-muted);
  margin-left: 6px;
}

.sb-focus-high .sb-focus-reason {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}
.sb-focus-medium .sb-focus-reason {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}
.sb-focus-low .sb-focus-reason {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-muted);
}
</style>
