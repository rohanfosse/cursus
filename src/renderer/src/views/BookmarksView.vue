<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bookmark, BookmarkX, Hash, User, Clock, Quote } from 'lucide-vue-next'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Avatar from '@/components/ui/Avatar.vue'
import MobileMenuButton from '@/components/layout/MobileMenuButton.vue'
import { useBookmarksStore, type BookmarkItem } from '@/stores/bookmarks'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { renderMessageContent } from '@/utils/html'
import { relativeTime } from '@/utils/date'
import { avatarColor } from '@/utils/format'

const store = useBookmarksStore()
const appStore = useAppStore()
const router = useRouter()
const { showToast } = useToast()

type Filter = 'all' | 'channels' | 'dms'
const filter = ref<Filter>('all')

const bookmarks = computed<BookmarkItem[]>(() => store.items)
const channelCount = computed(() => bookmarks.value.filter(b => !!b.channel_id).length)
const dmCount = computed(() => bookmarks.value.filter(b => !b.channel_id).length)

const filtered = computed<BookmarkItem[]>(() => {
  if (filter.value === 'channels') return bookmarks.value.filter(b => !!b.channel_id)
  if (filter.value === 'dms') return bookmarks.value.filter(b => !b.channel_id)
  return bookmarks.value
})

// Memoization : `renderMessageContent` fait du parsing HTML + sanitize.
// Invoqué dans le template, il serait rappelé à chaque re-render. On le
// matérialise en Map par id de signet, recalculée seulement quand la liste
// filtrée ou l'utilisateur courant change.
const previewById = computed<Map<number, string>>(() => {
  const uname = appStore.currentUser?.name ?? ''
  const m = new Map<number, string>()
  for (const b of filtered.value) {
    m.set(b.id, renderMessageContent(b.content ?? '', '', uname))
  }
  return m
})

onMounted(() => {
  store.loadItems()
})

function contextLabel(b: BookmarkItem): string {
  if (b.channel_name) return b.channel_name
  if (b.dm_peer_name) return b.dm_peer_name
  return 'Message privé'
}

async function removeBookmark(b: BookmarkItem) {
  const ok = await store.remove(b.id)
  if (ok) showToast('Signet retiré.', 'info')
}

function goToMessage(b: BookmarkItem) {
  if (b.dm_student_id) {
    appStore.openDm(b.dm_student_id, appStore.activePromoId ?? 0, b.author_name)
    router.push('/messages')
    return
  }
  if (b.channel_id) {
    appStore.openChannel(b.channel_id, appStore.activePromoId ?? 0, b.channel_name ?? '')
    router.push('/messages')
  }
}
</script>

<template>
  <div class="bookmarks-view">
    <UiPageHeader title="Signets" :subtitle="`${store.count} message${store.count > 1 ? 's' : ''} sauvegardé${store.count > 1 ? 's' : ''}`" section="chat" wrap>
      <template #leading>
        <MobileMenuButton />
        <span class="bm-head-icon" aria-hidden="true">
          <Bookmark :size="18" />
        </span>
      </template>

      <div v-if="bookmarks.length" class="bm-filters" role="tablist" aria-label="Filtrer par contexte">
        <button
          role="tab"
          :aria-selected="filter === 'all'"
          class="bm-chip"
          :class="{ 'bm-chip--active': filter === 'all' }"
          @click="filter = 'all'"
        >
          Tous <span class="bm-chip-count">{{ bookmarks.length }}</span>
        </button>
        <button
          role="tab"
          :aria-selected="filter === 'channels'"
          class="bm-chip"
          :class="{ 'bm-chip--active': filter === 'channels' }"
          @click="filter = 'channels'"
        >
          <Hash :size="12" /> Canaux <span class="bm-chip-count">{{ channelCount }}</span>
        </button>
        <button
          role="tab"
          :aria-selected="filter === 'dms'"
          class="bm-chip"
          :class="{ 'bm-chip--active': filter === 'dms' }"
          @click="filter = 'dms'"
        >
          <User :size="12" /> Messages <span class="bm-chip-count">{{ dmCount }}</span>
        </button>
      </div>
    </UiPageHeader>

    <div v-if="!bookmarks.length" class="bm-empty">
      <EmptyState
        :icon="Bookmark"
        title="Aucun signet pour l'instant"
        subtitle="Dans un message, clique sur l'icône signet pour le retrouver ici et y revenir plus tard."
        size="lg"
        tone="accent"
      />
    </div>

    <div v-else-if="!filtered.length" class="bm-empty">
      <EmptyState
        :icon="Bookmark"
        title="Aucun signet dans cette catégorie"
        subtitle="Change de filtre pour voir tes autres signets."
        size="md"
        tone="muted"
      />
    </div>

    <ul v-else class="bm-list">
      <li
        v-for="b in filtered"
        :key="b.bookmark_id"
        class="bm-item"
        :class="b.channel_id ? 'bm-item--channel' : 'bm-item--dm'"
      >
        <span class="bm-stripe" aria-hidden="true" />

        <div
          class="bm-main"
          role="button"
          tabindex="0"
          :aria-label="`Ouvrir le message de ${b.author_name}`"
          @click="goToMessage(b)"
          @keydown.enter="goToMessage(b)"
          @keydown.space.prevent="goToMessage(b)"
        >
          <header class="bm-head">
            <Avatar
              :initials="b.author_initials"
              :photo-data="b.author_photo"
              :color="avatarColor(b.author_name)"
              :size="32"
            />
            <div class="bm-head-text">
              <div class="bm-head-row">
                <span class="bm-author">{{ b.author_name }}</span>
                <span class="bm-ctx">
                  <Hash v-if="b.channel_id" :size="11" />
                  <User v-else :size="11" />
                  {{ contextLabel(b) }}
                </span>
              </div>
              <div class="bm-head-sub">
                <Clock :size="10" />
                <span>posté {{ relativeTime(b.created_at) }}</span>
              </div>
            </div>
          </header>

          <blockquote class="bm-quote">
            <Quote class="bm-quote-icon" :size="14" aria-hidden="true" />
            <div class="bm-content" v-html="previewById.get(b.id)" />
          </blockquote>

          <footer class="bm-foot">
            <Bookmark :size="11" />
            <span>sauvegardé {{ relativeTime(b.bookmarked_at) }}</span>
          </footer>
        </div>

        <button
          class="bm-remove"
          title="Retirer le signet"
          aria-label="Retirer le signet"
          @click="removeBookmark(b)"
        >
          <BookmarkX :size="16" />
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.bookmarks-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-canvas, var(--bg-main));
}

/* Header — icône chip + filtres */
.bm-head-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius);
  background: rgba(var(--accent-rgb), .12);
  color: var(--accent);
  flex-shrink: 0;
}

.bm-filters {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  flex-wrap: wrap;
}

.bm-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 999px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out);
}
.bm-chip:hover {
  background: var(--bg-hover);
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  color: var(--text-primary);
}
.bm-chip--active {
  background: rgba(var(--accent-rgb), .12);
  border-color: color-mix(in srgb, var(--accent) 60%, transparent);
  color: var(--accent);
}
.bm-chip-count {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 700;
  padding: 0 5px;
  border-radius: 999px;
  background: color-mix(in srgb, currentColor 14%, transparent);
  min-width: 16px;
  text-align: center;
}

/* Empty */
.bm-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* List */
.bm-list {
  flex: 1;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  max-width: 960px;
  width: 100%;
  box-sizing: border-box;
  margin-inline: auto;
}

/* Card */
.bm-item {
  --bm-accent: var(--accent);
  --bm-accent-rgb: var(--accent-rgb);
  position: relative;
  display: flex;
  gap: var(--space-md);
  align-items: stretch;
  padding: var(--space-md) var(--space-md) var(--space-md) calc(var(--space-md) + 6px);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  overflow: hidden;
  transition: transform var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out),
              box-shadow var(--motion-fast) var(--ease-out),
              background var(--motion-fast) var(--ease-out);
}
.bm-item--dm {
  --bm-accent: #8b5cf6;
  --bm-accent-rgb: 139, 92, 246;
}

.bm-item:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--bm-accent) 50%, var(--border));
  box-shadow: 0 6px 18px rgba(0, 0, 0, .08),
              0 2px 6px rgba(var(--bm-accent-rgb), .12);
}
.bm-item:hover .bm-stripe { width: 5px; }

/* Stripe gauche */
.bm-stripe {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg,
    var(--bm-accent),
    color-mix(in srgb, var(--bm-accent) 40%, transparent));
  transition: width var(--motion-fast) var(--ease-out);
}

.bm-main {
  flex: 1;
  min-width: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  border-radius: var(--radius-sm);
}
.bm-main:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* Header : avatar + auteur + contexte + timestamp */
.bm-head {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}
.bm-head-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.bm-head-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
  min-width: 0;
}
.bm-author {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bm-ctx {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(var(--bm-accent-rgb), .12);
  color: var(--bm-accent);
  font-size: 11px;
  font-weight: 600;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bm-head-sub {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
}

/* Quote content */
.bm-quote {
  position: relative;
  margin: 0;
  padding: var(--space-sm) var(--space-md) var(--space-sm) calc(var(--space-md) + 8px);
  background: color-mix(in srgb, var(--bm-accent) 4%, var(--bg-elevated, var(--bg-hover)));
  border-radius: var(--radius);
  border-left: 3px solid color-mix(in srgb, var(--bm-accent) 35%, transparent);
}
.bm-quote-icon {
  position: absolute;
  top: 8px;
  left: 10px;
  color: color-mix(in srgb, var(--bm-accent) 55%, transparent);
  opacity: .9;
}
.bm-content {
  padding-left: 18px;
  font-size: var(--text-sm);
  color: var(--text-primary);
  line-height: 1.5;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bm-content :deep(p) { margin: 0; }
.bm-content :deep(p + p) { margin-top: 4px; }
.bm-content :deep(code) {
  background: color-mix(in srgb, var(--bm-accent) 12%, var(--bg-hover));
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  font-size: 90%;
}

/* Footer meta */
.bm-foot {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

/* Remove */
.bm-remove {
  flex-shrink: 0;
  align-self: flex-start;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  transition: background var(--motion-fast),
              color var(--motion-fast),
              border-color var(--motion-fast);
}
.bm-remove:hover {
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 25%, transparent);
}
.bm-remove:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

@media (prefers-reduced-motion: reduce) {
  .bm-item, .bm-stripe, .bm-chip, .bm-remove { transition: none !important; }
  .bm-item:hover { transform: none; }
}

@media (max-width: 720px) {
  .bm-list { padding: var(--space-md); }
  .bm-item { padding: var(--space-sm) var(--space-sm) var(--space-sm) calc(var(--space-sm) + 6px); }
  .bm-ctx { max-width: 140px; }
}
</style>
