/**
 * MessageWall : mur de messages interactif style Wooclap.
 * Posts anonymes ou identifies, likes, moderation prof (masquer/epingler),
 * tri par date ou popularite. Reutilise live_board_cards en backend.
 */
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import {
  MessagesSquare, ThumbsUp, Send, EyeOff, Eye, Trash2,
  ArrowDownWideNarrow, Clock, Copy, Flag,
} from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app'
import { useContextMenu } from '@/composables/useContextMenu'
import type { BoardCard } from '@/types'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'

const props = defineProps<{
  activityId: number
  isTeacher: boolean
}>()

const { showToast } = useToast()
const appStore = useAppStore()
const cards = ref<BoardCard[]>([])
const newMessage = ref('')
const loading = ref(false)
const sortMode = ref<'recent' | 'popular'>('recent')
let unsubscribe: (() => void) | null = null

const visibleCards = computed(() => {
  const filtered = props.isTeacher
    ? cards.value
    : cards.value.filter(c => !(c as any).hidden)
  return [...filtered].sort((a, b) => {
    if (sortMode.value === 'popular') return b.votes - a.votes
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
})

const totalMessages = computed(() => cards.value.filter(c => !(c as any).hidden).length)
const totalLikes = computed(() => cards.value.reduce((s, c) => s + c.votes, 0))

async function fetchCards() {
  loading.value = true
  try {
    const res = await window.api.getLiveV2BoardCards(props.activityId)
    if (res?.ok && res.data) cards.value = res.data
  } finally {
    loading.value = false
  }
}

async function sendMessage() {
  const content = newMessage.value.trim()
  if (!content) return
  try {
    const res = await window.api.addLiveV2BoardCard(props.activityId, {
      columnName: 'messages', content, color: '#ffffff',
    })
    if (res?.ok) {
      newMessage.value = ''
    } else {
      showToast(res?.error || 'Erreur', 'error')
    }
  } catch {
    showToast('Erreur lors de l\'envoi', 'error')
  }
}

async function likeCard(card: BoardCard) {
  const currentlyVoted = card.voted_by_me ?? false
  if (!currentlyVoted && card.author_id === (appStore.currentUser?.id ?? -1)) return
  try {
    const res = await window.api.voteLiveV2BoardCard(card.id, !currentlyVoted)
    if (res?.ok) {
      cards.value = cards.value.map(c =>
        c.id === card.id
          ? { ...c, voted_by_me: !currentlyVoted, votes: Math.max(0, c.votes + (currentlyVoted ? -1 : 1)) }
          : c,
      )
    }
  } catch {
    showToast('Erreur', 'error')
  }
}

async function toggleHide(card: BoardCard) {
  const hidden = !(card as any).hidden
  try {
    const res = await window.api.hideLiveV2BoardCard(card.id, hidden)
    if (res?.ok) {
      cards.value = cards.value.map(c =>
        c.id === card.id ? { ...c, hidden } : c,
      )
    }
  } catch {
    showToast('Erreur', 'error')
  }
}

async function deleteCard(card: BoardCard) {
  try {
    await window.api.deleteLiveV2BoardCard(card.id)
  } catch {
    showToast('Erreur', 'error')
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

onMounted(() => {
  fetchCards()
  unsubscribe = window.api.onLiveBoardUpdate((data) => {
    if (data.activityId !== props.activityId) return
    if (data.action === 'add' && data.card) {
      const card = data.card as BoardCard
      if (!cards.value.find(c => c.id === card.id)) cards.value.push(card)
    } else if (data.action === 'delete' && data.cardId) {
      cards.value = cards.value.filter(c => c.id !== data.cardId)
    } else if (data.action === 'vote' && data.cardId && data.votes !== undefined) {
      cards.value = cards.value.map(c =>
        c.id === data.cardId ? { ...c, votes: data.votes! } : c,
      )
    } else if (data.action === 'hide' && data.cardId) {
      cards.value = cards.value.map(c =>
        c.id === data.cardId ? { ...c, hidden: data.hidden } : c,
      )
    }
  })
})

onBeforeUnmount(() => { unsubscribe?.() })

const { ctx, open: openCtx, close: closeCtx } = useContextMenu<BoardCard>()
const ctxItems = computed<ContextMenuItem[]>(() => {
  const c = ctx.value?.target
  if (!c) return []
  const isHidden = Boolean((c as BoardCard & { hidden?: boolean }).hidden)
  const items: ContextMenuItem[] = [
    { label: 'Copier le texte', icon: Copy, action: async () => {
      await navigator.clipboard.writeText(c.content)
      showToast('Message copié.', 'success')
    } },
    { label: c.voted_by_me ? 'Retirer mon like' : 'Aimer', icon: ThumbsUp, action: () => likeCard(c) },
  ]
  if (props.isTeacher) {
    items.push({
      label: isHidden ? 'Afficher' : 'Masquer',
      icon: isHidden ? Eye : EyeOff,
      separator: true,
      action: () => toggleHide(c),
    })
    items.push({ label: 'Supprimer', icon: Trash2, danger: true, action: () => deleteCard(c) })
  } else if (c.author_id !== (appStore.currentUser?.id ?? -1)) {
    items.push({ label: 'Signaler', icon: Flag, separator: true, action: () => {
      showToast('Signalement transmis.', 'success')
    } })
  }
  return items
})
</script>

<template>
  <div class="mw-wrap">
    <!-- Header -->
    <div class="mw-header">
      <MessagesSquare :size="14" class="mw-icon" />
      <span class="mw-title">Mur de messages</span>
      <span class="mw-stat">{{ totalMessages }} message{{ totalMessages > 1 ? 's' : '' }}</span>
      <span v-if="totalLikes > 0" class="mw-stat mw-stat--accent">{{ totalLikes }} like{{ totalLikes > 1 ? 's' : '' }}</span>
      <div class="mw-sort">
        <button
          :class="['mw-sort-btn', { active: sortMode === 'recent' }]"
          @click="sortMode = 'recent'"
        >
          <Clock :size="12" /> Recents
        </button>
        <button
          :class="['mw-sort-btn', { active: sortMode === 'popular' }]"
          @click="sortMode = 'popular'"
        >
          <ArrowDownWideNarrow :size="12" /> Populaires
        </button>
      </div>
    </div>

    <!-- Input -->
    <div class="mw-input-row">
      <textarea
        v-model="newMessage"
        class="mw-input"
        placeholder="Ecrire un message..."
        rows="2"
        @keydown="onKeydown"
      />
      <button
        class="mw-send-btn"
        :disabled="!newMessage.trim()"
        @click="sendMessage"
      >
        <Send :size="16" />
      </button>
    </div>

    <!-- Messages grid -->
    <div class="mw-grid">
      <div
        v-for="card in visibleCards"
        :key="card.id"
        :class="['mw-card', { 'mw-card--hidden': (card as any).hidden }]"
        @contextmenu="openCtx($event, card)"
      >
        <div class="mw-card-content">{{ card.content }}</div>
        <div class="mw-card-footer">
          <span class="mw-card-author">{{ card.author_name }}</span>
          <div class="mw-card-actions">
            <button
              :class="['mw-like-btn', { active: card.voted_by_me }]"
              @click="likeCard(card)"
            >
              <ThumbsUp :size="12" />
              <span v-if="card.votes > 0">{{ card.votes }}</span>
            </button>
            <template v-if="isTeacher">
              <button class="mw-mod-btn" @click="toggleHide(card)">
                <EyeOff v-if="!(card as any).hidden" :size="12" />
                <Eye v-else :size="12" />
              </button>
              <button class="mw-mod-btn mw-mod-btn--danger" @click="deleteCard(card)">
                <Trash2 :size="12" />
              </button>
            </template>
          </div>
        </div>
      </div>
      <div v-if="visibleCards.length === 0 && !loading" class="mw-empty">
        Aucun message pour le moment
      </div>
    </div>

    <ContextMenu
      v-if="ctx"
      :x="ctx.x"
      :y="ctx.y"
      :items="ctxItems"
      @close="closeCtx"
    />
  </div>
</template>

<style scoped>
.mw-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mw-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.mw-icon { color: #a855f7; flex-shrink: 0 }
.mw-title { font-weight: 600; font-size: 14px; color: var(--text-primary) }
.mw-stat {
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 99px;
}
.mw-stat--accent { background: #f3e8ff; color: #7c3aed }
.mw-sort {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.mw-sort-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 3px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all .15s;
}
.mw-sort-btn.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}
.mw-input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.mw-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  resize: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: inherit;
}
.mw-input:focus {
  outline: none;
  border-color: #a855f7;
  box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.15);
}
.mw-send-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: #a855f7;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity .15s;
}
.mw-send-btn:disabled { opacity: 0.4; cursor: not-allowed }
.mw-send-btn:not(:disabled):hover { opacity: 0.85 }
.mw-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}
.mw-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: box-shadow .15s, opacity .15s;
  animation: mw-fade-in .25s ease-out;
}
.mw-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.mw-card--hidden {
  opacity: 0.45;
  border-style: dashed;
}
.mw-card-content {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}
.mw-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.mw-card-author {
  font-size: 11px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mw-card-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.mw-like-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all .15s;
}
.mw-like-btn:hover { border-color: #a855f7; color: #a855f7 }
.mw-like-btn.active {
  background: #f3e8ff;
  border-color: #a855f7;
  color: #7c3aed;
}
.mw-mod-btn {
  display: flex;
  align-items: center;
  padding: 2px 5px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all .15s;
}
.mw-mod-btn:hover { border-color: var(--text-tertiary); color: var(--text-primary) }
.mw-mod-btn--danger:hover { border-color: #ef4444; color: #ef4444 }
.mw-empty {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
  padding: 24px 0;
}
@keyframes mw-fade-in {
  from { opacity: 0; transform: translateY(6px) }
  to   { opacity: 1; transform: translateY(0) }
}
</style>
