<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Bookmark } from 'lucide-vue-next'
import { STORAGE_KEYS } from '@/constants'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

interface BookmarkEntry {
  id: string | number
  content: string
  authorName: string
  channelName: string
  date: string
}

const router = useRouter()
const bookmarks = ref<BookmarkEntry[]>([])

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BOOKMARKS)
    if (raw) bookmarks.value = JSON.parse(raw) as BookmarkEntry[]
  } catch (err) {
    console.warn('[WidgetBookmarks] Erreur lecture localStorage', err)
  }
})

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

function goToMessages() {
  router.push('/messages')
}
</script>

<template>
  <UiWidgetCard
    :icon="Bookmark"
    label="Messages sauvegardés"
    accent-color="var(--color-bookmark)"
  >
    <div v-if="bookmarks.length" class="wb-list">
      <div
        v-for="b in bookmarks.slice(0, 3)"
        :key="b.id"
        class="wb-item"
        role="button"
        tabindex="0"
        @click="goToMessages"
        @keydown.enter="goToMessages"
        @keydown.space.prevent="goToMessages"
      >
        <span class="wb-author">{{ b.authorName }}</span>
        <span class="wb-content">{{ truncate(b.content, 40) }}</span>
        <span class="wb-channel">#{{ b.channelName }}</span>
      </div>
    </div>
    <EmptyState v-else size="sm" tone="muted" title="Aucun message sauvegardé" />
  </UiWidgetCard>
</template>

<style scoped>
.wb-list { display: flex; flex-direction: column; gap: var(--space-xs); }

.wb-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--space-xs) var(--space-xs);
  border-radius: var(--radius-sm);
  transition: background var(--motion-fast) var(--ease-out);
}

.wb-item:hover { background: var(--bg-hover); }
.wb-item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.wb-author {
  font-weight: 600;
  color: var(--text-primary);
  flex-shrink: 0;
}

.wb-content {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-muted);
}

.wb-channel {
  font-size: var(--text-xs);
  color: var(--text-muted);
  opacity: .7;
  flex-shrink: 0;
}
</style>
