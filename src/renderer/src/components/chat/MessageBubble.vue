<script setup lang="ts">
import { ref, computed } from 'vue'
import { Pin, PinOff, MoreHorizontal, Copy, Trash2, MessageSquare } from 'lucide-vue-next'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import Avatar from '@/components/ui/Avatar.vue'
import ReactionPicker from './ReactionPicker.vue'
import { avatarColor }          from '@/utils/format'
import { formatTime }           from '@/utils/date'
import { renderMessageContent } from '@/utils/html'
import { useOpenExternal }      from '@/composables/useOpenExternal'
import type { Message } from '@/types'

interface Props {
  msg:        Message
  grouped?:   boolean
  searchTerm?: string
}

const props = withDefaults(defineProps<Props>(), { grouped: false, searchTerm: '' })

const appStore      = useAppStore()
const messagesStore = useMessagesStore()
const { openExternal } = useOpenExternal()

const showMenu = ref(false)

const content  = computed(() =>
  renderMessageContent(props.msg.content, props.searchTerm, appStore.currentUser?.name ?? ''),
)
const color    = computed(() => avatarColor(props.msg.author_name))
const isPinned = computed(() => !!props.msg.is_pinned)
const replyCount = computed(() => (props.msg as any).reply_count ?? 0)

function togglePin() {
  messagesStore.togglePin(props.msg.id, !isPinned.value)
  showMenu.value = false
}

async function copyMessage() {
  try { await navigator.clipboard.writeText(props.msg.content) } catch { /* noop */ }
  showMenu.value = false
}

function onMsgClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest('a[data-url]') as HTMLAnchorElement | null
  if (!a) return
  e.preventDefault()
  const url = a.dataset.url
  if (url) openExternal(url)
}

// Emoji par type de réaction
const EMOJI_MAP: Record<string, string> = {
  check:    '✅',
  thumb:    '👍',
  bulb:     '💡',
  question: '❓',
  eye:      '👀',
}

const REACT_TYPES = [
  { type: 'check',    icon: 'check'       },
  { type: 'thumb',    icon: 'thumbs-up'   },
  { type: 'bulb',     icon: 'lightbulb'   },
  { type: 'question', icon: 'help-circle' },
  { type: 'eye',      icon: 'eye'         },
]

const reactionsToShow = computed(() => {
  const r    = messagesStore.reactions[props.msg.id] ?? {}
  const mine = messagesStore.userVotes[props.msg.id] ?? new Set()
  return REACT_TYPES.filter((t) => (r[t.type] ?? 0) > 0).map((t) => ({
    ...t,
    emoji:  EMOJI_MAP[t.type] ?? '',
    count:  r[t.type],
    isMine: mine.has(t.type),
  }))
})
</script>

<template>
  <div
    class="msg-row"
    :class="{ grouped, pinned: isPinned }"
    :data-msg-id="msg.id"
    @click.self="showMenu = false"
  >
    <!-- Avatar -->
    <template v-if="!grouped">
      <Avatar
        :initials="msg.author_initials || msg.author_name.slice(0, 2).toUpperCase()"
        :color="color"
        :photo-data="msg.author_photo"
      />
    </template>
    <div v-else class="msg-avatar-placeholder" />

    <!-- Corps -->
    <div class="msg-body">
      <template v-if="!grouped">
        <span class="msg-author">{{ msg.author_name }}</span>
        <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
        <span v-if="isPinned" class="pin-badge" title="Message épinglé">📌</span>
      </template>

      <!-- eslint-disable vue/no-v-html -->
      <p class="msg-text" v-html="content" @click="onMsgClick" />
      <!-- eslint-enable vue/no-v-html -->

      <!-- Réactions -->
      <div v-if="reactionsToShow.length" class="msg-reactions">
        <button
          v-for="r in reactionsToShow"
          :key="r.type"
          class="msg-reaction-pill"
          :class="{ mine: r.isMine }"
          :aria-label="`Réaction ${r.type}`"
          @click="messagesStore.toggleReaction(msg.id, r.type)"
        >
          <span class="reaction-emoji">{{ r.emoji }}</span>
          <span class="reaction-count">{{ r.count }}</span>
        </button>
      </div>

      <!-- Indicateur de réponses (future feature) -->
      <button v-if="replyCount > 0" class="msg-thread-btn">
        <MessageSquare :size="12" />
        <span>{{ replyCount }} réponse{{ replyCount > 1 ? 's' : '' }}</span>
      </button>
    </div>

    <!-- Actions au survol -->
    <div class="msg-actions">
      <ReactionPicker :msg-id="msg.id" />

      <button
        v-if="appStore.isTeacher"
        class="btn-icon msg-action-btn"
        :title="isPinned ? 'Désépingler' : 'Épingler'"
        :aria-label="isPinned ? 'Désépingler le message' : 'Épingler le message'"
        @click="togglePin"
      >
        <PinOff v-if="isPinned" :size="14" />
        <Pin v-else :size="14" />
      </button>

      <!-- Menu ··· -->
      <div class="msg-menu-wrap" @mouseleave="showMenu = false">
        <button
          class="btn-icon msg-action-btn"
          title="Plus d'options"
          aria-label="Plus d'options"
          @click.stop="showMenu = !showMenu"
        >
          <MoreHorizontal :size="14" />
        </button>
        <div v-if="showMenu" class="msg-menu" role="menu">
          <button class="msg-menu-item" role="menuitem" @click="copyMessage">
            <Copy :size="12" /> Copier le texte
          </button>
          <button v-if="appStore.isTeacher" class="msg-menu-item" role="menuitem" @click="togglePin">
            <Pin :size="12" /> {{ isPinned ? 'Désépingler' : 'Épingler' }}
          </button>
          <button v-if="appStore.isTeacher" class="msg-menu-item msg-menu-danger" role="menuitem" @click="showMenu = false">
            <Trash2 :size="12" /> Supprimer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Réactions ── */
.msg-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.msg-reaction-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 40px;
  min-height: 26px;
  padding: 3px 8px;
  border-radius: 13px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,.04);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast), transform var(--t-fast);
  line-height: 1;
}
.msg-reaction-pill:hover {
  background: rgba(255,255,255,.09);
  border-color: rgba(255,255,255,.15);
  transform: translateY(-1px);
}
.msg-reaction-pill.mine {
  background: rgba(74,144,217,.18);
  border-color: rgba(74,144,217,.45);
  color: var(--accent-light);
  font-weight: 600;
}
.reaction-emoji { font-size: 13px; line-height: 1; }
.reaction-count { font-size: 11.5px; font-weight: 600; }

/* ── Bouton thread ── */
.msg-thread-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  padding: 2px 6px;
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 4px;
  transition: background var(--t-fast);
}
.msg-thread-btn:hover { background: var(--accent-subtle); }

/* ── Menu ··· ── */
.msg-menu-wrap {
  position: relative;
}
.msg-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 50;
  min-width: 160px;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,.45);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.msg-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font);
  font-size: 12.5px;
  border-radius: 5px;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background var(--t-fast), color var(--t-fast);
}
.msg-menu-item:hover {
  background: rgba(255,255,255,.07);
  color: var(--text-primary);
}
.msg-menu-danger       { color: var(--color-danger); }
.msg-menu-danger:hover { background: rgba(231,76,60,.12); color: #ff8070; }
</style>
