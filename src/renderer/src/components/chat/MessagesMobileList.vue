/**
 * MessagesMobileList - vue plein ecran "liste de conversations" sur mobile.
 *
 * S'affiche sur /messages quand aucun canal/DM n'est actif ET en mobile
 * (<= 768px). Permet a l'utilisateur de choisir un salon ou un correspondant
 * sans avoir a ouvrir le drawer global (pattern Slack/Telegram mobile).
 *
 * Reutilise les composables sidebar (useSidebarData, useSidebarDm,
 * useSidebarNav) pour partager la logique de chargement et de selection
 * avec la sidebar desktop. Pas de duplication de business logic.
 */
<script setup lang="ts">
import { computed, onMounted, ref, type Component } from 'vue'
import { Search, X, MessageSquarePlus, Lock, Hash, Megaphone, ChevronDown } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useSidebarData }     from '@/composables/useSidebarData'
import { useSidebarDm }       from '@/composables/useSidebarDm'
import { useSidebarNav }      from '@/composables/useSidebarNav'
import { useContextMenu }     from '@/composables/useContextMenu'
import { avatarColor, initials } from '@/utils/format'
import type { Channel, Student } from '@/types'

const emit = defineEmits<{ navigate: [] }>()

const appStore = useAppStore()
const { state: ctx } = useContextMenu()

// Composables sidebar partages : meme source de verite que la sidebar desktop.
const { sortedChannelGroups, dmStudents, loading, load, setLoadRecentDmContacts } = useSidebarData()
const { selectChannel } = useSidebarNav(emit)
const {
  loadRecentDmContacts, recentDmContacts, dmContactsToShow, selectDm,
} = useSidebarDm(dmStudents, ctx, emit)

setLoadRecentDmContacts(loadRecentDmContacts)

const filter = ref('')

onMounted(async () => {
  await load()
})

const filteredChannelGroups = computed(() => {
  const q = filter.value.toLowerCase().trim()
  if (!q) return sortedChannelGroups.value
  return sortedChannelGroups.value
    .map(g => ({ ...g, channels: g.channels.filter(c => c.name.toLowerCase().includes(q)) }))
    .filter(g => g.channels.length > 0)
})

const filteredDmContacts = computed(() => {
  const q = filter.value.toLowerCase().trim()
  if (!q) return dmContactsToShow.value
  return dmContactsToShow.value.filter(s => s.name.toLowerCase().includes(q))
})

// Lookups precalcules au render pour eviter O(N) par ligne :
//  - `appStore.isUserOnline(name)` faisait `.some()` sur onlineUsers
//    (O(M)) puis etait appele une fois par ligne (O(N×M)).
//  - `getDmPreview(name)` faisait `.find()` sur recentDmContacts pareil.
// Avec une liste de 30 etudiants en ligne et 50 DMs, c'etait 1500
// comparaisons string par re-render. Maintenant : Sets/Maps construits
// une fois et requetes en O(1).
const onlineUserNames = computed(() => {
  const set = new Set<string>()
  for (const u of (appStore.onlineUsers ?? [])) set.add(u.name)
  return set
})

const dmPreviewByName = computed(() => {
  const map = new Map<string, string>()
  for (const c of recentDmContacts.value) {
    if (c.last_message_preview) map.set(c.name, c.last_message_preview.substring(0, 40))
  }
  return map
})

function channelUnread(id: number): number {
  return appStore.unread[id] ?? 0
}
function channelMention(id: number): number {
  return appStore.mentionChannels[id] ?? 0
}
function dmUnread(name: string): number {
  return appStore.unreadDms[name] ?? 0
}
function avatarStyle(s: Student): { background: string } {
  if (s.id < 0) return { background: 'var(--accent)' }
  return { background: avatarColor(s.name) }
}
function channelIcon(ch: Channel): Component {
  if (ch.type === 'annonce') return Megaphone
  return Hash
}

function onTapChannel(ch: Channel): void {
  selectChannel(ch)
}
function onTapDm(s: Student): void {
  selectDm(s)
}
</script>

<template>
  <section class="msg-mobile-list" aria-label="Conversations">
    <header class="msg-mobile-header">
      <h1 class="msg-mobile-title">Messages</h1>
      <div class="msg-mobile-search">
        <Search :size="14" class="msg-mobile-search-icon" />
        <input
          v-model="filter"
          type="text"
          class="msg-mobile-search-input"
          placeholder="Rechercher un salon ou une personne..."
          aria-label="Rechercher"
        />
        <button
          v-if="filter"
          type="button"
          class="msg-mobile-search-clear"
          aria-label="Effacer la recherche"
          @click="filter = ''"
        >
          <X :size="14" />
        </button>
      </div>
    </header>

    <div class="msg-mobile-scroll">
      <!-- Skeleton de chargement initial : 5 lignes pulsantes pour eviter
           le flash empty -> liste qui apparaissait au mount d'un user lent. -->
      <div
        v-if="loading && filteredChannelGroups.length === 0 && filteredDmContacts.length === 0"
        class="msg-mobile-skeleton"
        aria-busy="true"
        aria-label="Chargement des conversations"
      >
        <div v-for="i in 5" :key="i" class="msg-mobile-skeleton-row">
          <div class="msg-mobile-skeleton-avatar" />
          <div class="msg-mobile-skeleton-text">
            <div class="msg-mobile-skeleton-line msg-mobile-skeleton-line--title" />
            <div class="msg-mobile-skeleton-line msg-mobile-skeleton-line--preview" />
          </div>
        </div>
      </div>

      <!-- Salons -->
      <div v-for="group in filteredChannelGroups" :key="group.key" class="msg-mobile-section">
        <div v-if="filteredChannelGroups.length > 1" class="msg-mobile-section-title">
          <ChevronDown :size="11" aria-hidden="true" />
          <span>{{ group.label }}</span>
        </div>
        <button
          v-for="ch in group.channels"
          :key="ch.id"
          type="button"
          class="msg-mobile-row"
          :class="{ 'has-unread': channelUnread(ch.id) > 0, 'has-mention': channelMention(ch.id) > 0 }"
          @click="onTapChannel(ch)"
        >
          <span class="msg-mobile-row-avatar msg-mobile-row-avatar--channel">
            <component :is="channelIcon(ch)" :size="18" aria-hidden="true" />
          </span>
          <span class="msg-mobile-row-body">
            <span class="msg-mobile-row-title">
              <span class="msg-mobile-row-name">{{ ch.name }}</span>
              <Lock v-if="ch.is_private" :size="11" class="msg-mobile-row-lock" aria-label="Canal prive" />
            </span>
            <span v-if="ch.description" class="msg-mobile-row-preview">{{ ch.description }}</span>
          </span>
          <span v-if="channelMention(ch.id) > 0" class="msg-mobile-row-badge msg-mobile-row-badge--mention" aria-label="Mention">@</span>
          <span v-else-if="channelUnread(ch.id) > 0" class="msg-mobile-row-badge">
            {{ channelUnread(ch.id) > 9 ? '9+' : channelUnread(ch.id) }}
          </span>
        </button>
      </div>

      <!-- DMs -->
      <div v-if="filteredDmContacts.length > 0" class="msg-mobile-section">
        <div class="msg-mobile-section-title">
          <ChevronDown :size="11" aria-hidden="true" />
          <span>Messages directs</span>
        </div>
        <button
          v-for="s in filteredDmContacts"
          :key="s.id"
          type="button"
          class="msg-mobile-row"
          :class="{ 'has-unread': dmUnread(s.name) > 0 }"
          @click="onTapDm(s)"
        >
          <span class="msg-mobile-row-avatar" :style="avatarStyle(s)">
            <span v-if="!s.photo_data">{{ initials(s.name) }}</span>
            <img v-else :src="s.photo_data" :alt="s.name" />
            <span v-if="onlineUserNames.has(s.name)" class="msg-mobile-row-online" aria-label="En ligne" />
          </span>
          <span class="msg-mobile-row-body">
            <span class="msg-mobile-row-title">
              <span class="msg-mobile-row-name">{{ s.name }}</span>
            </span>
            <span class="msg-mobile-row-preview">{{ dmPreviewByName.get(s.name) || (s.id < 0 ? 'Enseignant' : 'Etudiant') }}</span>
          </span>
          <span v-if="dmUnread(s.name) > 0" class="msg-mobile-row-badge">
            {{ dmUnread(s.name) > 9 ? '9+' : dmUnread(s.name) }}
          </span>
        </button>
      </div>

      <!-- Aucun resultat -->
      <div
        v-if="filter && filteredChannelGroups.length === 0 && filteredDmContacts.length === 0"
        class="msg-mobile-empty"
      >
        <MessageSquarePlus :size="32" aria-hidden="true" />
        <p>Aucun resultat pour "{{ filter }}"</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.msg-mobile-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.msg-mobile-header {
  flex-shrink: 0;
  padding: 12px 16px 8px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
  padding-top: calc(12px + env(safe-area-inset-top, 0));
}

.msg-mobile-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 10px;
  letter-spacing: -.4px;
}

.msg-mobile-search {
  position: relative;
  display: flex;
  align-items: center;
}
.msg-mobile-search-icon {
  position: absolute;
  left: 12px;
  color: var(--text-muted);
  pointer-events: none;
}
.msg-mobile-search-input {
  flex: 1;
  height: 40px;
  padding: 0 36px 0 36px;
  background: var(--bg-input, var(--bg-elevated));
  border: 1px solid var(--border-input, var(--border));
  border-radius: var(--radius);
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  outline: none;
}
.msg-mobile-search-input:focus {
  border-color: var(--accent);
}
.msg-mobile-search-clear {
  position: absolute;
  right: 6px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 32px;
}
.msg-mobile-search-clear:active { background: var(--bg-hover); }

.msg-mobile-scroll {
  flex: 1;
  overflow-y: auto;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0));
  -webkit-overflow-scrolling: touch;
}

.msg-mobile-section {
  margin-top: 12px;
}

.msg-mobile-section-title {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 16px 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: var(--text-muted);
}

.msg-mobile-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  min-height: 64px;
  transition: background var(--t-fast);
}
.msg-mobile-row:active {
  background: var(--bg-hover);
}

.msg-mobile-row-avatar {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full, 999px);
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
}
.msg-mobile-row-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.msg-mobile-row-avatar--channel {
  background: var(--bg-active, var(--bg-elevated));
  color: var(--accent);
}

.msg-mobile-row-online {
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: 12px;
  height: 12px;
  background: var(--color-success, #10b981);
  border: 2px solid var(--bg-primary);
  border-radius: var(--radius-full, 999px);
}

.msg-mobile-row-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.msg-mobile-row-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.msg-mobile-row-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.has-unread .msg-mobile-row-name {
  font-weight: 700;
}
.msg-mobile-row-lock {
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: .65;
}
.msg-mobile-row-preview {
  font-size: 12.5px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.msg-mobile-row-badge {
  flex-shrink: 0;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  border-radius: var(--radius-full, 999px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.msg-mobile-row-badge--mention {
  background: var(--color-danger);
}
.has-mention .msg-mobile-row-name {
  color: var(--color-danger);
}

.msg-mobile-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 16px;
  color: var(--text-muted);
  text-align: center;
}
.msg-mobile-empty p {
  font-size: 13px;
  margin: 0;
}

.msg-mobile-skeleton {
  padding-top: 12px;
}
.msg-mobile-skeleton-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.msg-mobile-skeleton-avatar {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full, 999px);
  background: var(--bg-active, var(--bg-elevated));
  animation: msg-skeleton-pulse 1.6s ease-in-out infinite;
  flex-shrink: 0;
}
.msg-mobile-skeleton-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.msg-mobile-skeleton-line {
  height: 11px;
  border-radius: 4px;
  background: var(--bg-active, var(--bg-elevated));
  animation: msg-skeleton-pulse 1.6s ease-in-out infinite;
}
.msg-mobile-skeleton-line--title   { width: 55%; }
.msg-mobile-skeleton-line--preview { width: 80%; opacity: .55; }
@keyframes msg-skeleton-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: .55; }
}
@media (prefers-reduced-motion: reduce) {
  .msg-mobile-skeleton-avatar,
  .msg-mobile-skeleton-line {
    animation: none !important;
  }
}
</style>
