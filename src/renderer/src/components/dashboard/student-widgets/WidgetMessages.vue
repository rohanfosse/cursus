<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { MessageSquare, AtSign, Hash, ChevronRight } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { avatarColor, initials } from '@/utils/format'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const router = useRouter()
const appStore = useAppStore()

interface InboxItem {
  key: string
  kind: 'dm' | 'mention'
  label: string
  preview?: string
  count: number
  channelId?: number | null
  channelName?: string
  dmStudentId?: number | null
  authorName?: string
  promoId?: number | null
}

// Top items : DMs non lus + mentions non lues, max 5 au total.
const inbox = computed<InboxItem[]>(() => {
  const dms: InboxItem[] = Object.entries(appStore.unreadDms)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => ({
      key: `dm-${name}`,
      kind: 'dm' as const,
      label: name,
      count,
    }))

  const mentionMap = new Map<string, InboxItem>()
  for (const n of appStore.notificationHistory) {
    if (!n.isMention || n.read) continue
    const k = n.channelId ? `chan-${n.channelId}` : `dm-${n.authorName}`
    const existing = mentionMap.get(k)
    if (existing) {
      existing.count++
    } else {
      mentionMap.set(k, {
        key: k,
        kind: 'mention',
        label: n.channelId ? `#${n.channelName}` : n.authorName,
        preview: n.preview,
        count: 1,
        channelId: n.channelId,
        channelName: n.channelName,
        dmStudentId: n.dmStudentId,
        authorName: n.authorName,
        promoId: n.promoId,
      })
    }
  }

  const merged = [...dms, ...mentionMap.values()]
  merged.sort((a, b) => b.count - a.count)
  return merged.slice(0, 5)
})

const totalCount = computed(() => inbox.value.reduce((s, i) => s + i.count, 0))

function openItem(item: InboxItem) {
  if (item.kind === 'dm' && item.dmStudentId) {
    appStore.openDm(item.dmStudentId, item.promoId ?? appStore.activePromoId ?? 0, item.label)
  } else if (item.kind === 'dm') {
    // unread DM sans dmStudentId : on ouvre juste la vue messages
  } else if (item.channelId) {
    appStore.openChannel(item.channelId, item.promoId ?? appStore.activePromoId ?? 0, item.channelName ?? item.label)
  }
  router.push('/messages')
}
</script>

<template>
  <UiWidgetCard
    :icon="MessageSquare"
    label="Messages"
    aria-label="Messages non lus"
  >
    <template v-if="totalCount > 0" #header-extra>
      <span class="wm-count">{{ totalCount }}</span>
      <ChevronRight :size="13" class="wm-chevron" />
    </template>

    <EmptyState
      v-if="!inbox.length"
      size="sm"
      tone="muted"
      title="Inbox vide"
    />

    <ul v-else class="wm-list">
      <li v-for="item in inbox" :key="item.key">
        <button type="button" class="wm-item" @click="openItem(item)">
          <template v-if="item.kind === 'dm'">
            <div class="wm-avatar" :style="{ background: avatarColor(item.label) }">
              {{ initials(item.label) }}
            </div>
          </template>
          <component
            v-else
            :is="item.channelId ? Hash : AtSign"
            :size="11"
            class="wm-icon"
          />
          <span class="wm-label">{{ item.label }}</span>
          <span class="wm-badge">{{ item.count }}</span>
        </button>
      </li>
    </ul>
  </UiWidgetCard>
</template>

<style scoped>
.wm-count {
  font-size: var(--text-xs);
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  padding: 1px 6px;
  border-radius: var(--radius);
  font-variant-numeric: tabular-nums;
}
.wm-chevron { color: var(--text-muted); }

.wm-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wm-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  transition: background var(--motion-fast) var(--ease-out);
}
.wm-item:hover { background: var(--bg-hover); }
.wm-item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.wm-avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.wm-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  width: 24px;
  display: flex;
  justify-content: center;
}

.wm-label {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.wm-badge {
  font-size: var(--text-2xs);
  font-weight: 700;
  color: var(--accent);
  background: rgba(var(--accent-rgb), .12);
  padding: 1px 6px;
  border-radius: var(--radius);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
</style>
