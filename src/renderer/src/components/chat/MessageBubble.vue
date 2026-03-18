<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { Pin, PinOff, MoreHorizontal, Copy, Trash2, Check, Pencil } from 'lucide-vue-next'
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
  msg:         Message
  grouped?:    boolean
  searchTerm?: string
}

const props = withDefaults(defineProps<Props>(), { grouped: false, searchTerm: '' })

const appStore      = useAppStore()
const messagesStore = useMessagesStore()
const { openExternal } = useOpenExternal()

// ── Menu ···
const showMenu  = ref(false)

// ── Édition inline
const editing     = ref(false)
const editContent = ref('')
const editEl      = ref<HTMLTextAreaElement | null>(null)

// ── Computed
const content  = computed(() =>
  renderMessageContent(props.msg.content, props.searchTerm, appStore.currentUser?.name ?? ''),
)
const color    = computed(() => avatarColor(props.msg.author_name))
const isPinned = computed(() => !!props.msg.is_pinned)
const isEdited = computed(() => !!props.msg.edited)
const isMine   = computed(() =>
  props.msg.author_name === appStore.currentUser?.name,
)
const canEdit   = computed(() => isMine.value)
const canDelete = computed(() => appStore.isTeacher || isMine.value)

// ── Actions menu
function togglePin() {
  messagesStore.togglePin(props.msg.id, !isPinned.value)
  showMenu.value = false
}

async function copyMessage() {
  try { await navigator.clipboard.writeText(props.msg.content) } catch { /* noop */ }
  showMenu.value = false
}

async function startEdit() {
  showMenu.value  = false
  editing.value   = true
  editContent.value = props.msg.content
  await nextTick()
  editEl.value?.focus()
  editEl.value?.select()
}

async function commitEdit() {
  const trimmed = editContent.value.trim()
  if (!trimmed || trimmed === props.msg.content) { cancelEdit(); return }
  await messagesStore.editMessage(props.msg.id, trimmed)
  editing.value = false
}

function cancelEdit() {
  editing.value = false
  editContent.value = ''
}

function onEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() }
  if (e.key === 'Escape') cancelEdit()
}

async function deleteMessage() {
  if (!confirm('Supprimer ce message définitivement ?')) { showMenu.value = false; return }
  showMenu.value = false
  await messagesStore.deleteMessage(props.msg.id)
}

function onMsgClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest('a[data-url]') as HTMLAnchorElement | null
  if (!a) return
  e.preventDefault()
  const url = a.dataset.url
  if (url) openExternal(url)
}

// ── Réactions — 6 types avec emojis expressifs
const REACT_TYPES = [
  { type: 'check',    emoji: '✅' },
  { type: 'thumb',    emoji: '👍' },
  { type: 'fire',     emoji: '🔥' },
  { type: 'heart',    emoji: '❤️' },
  { type: 'think',    emoji: '🤔' },
  { type: 'eyes',     emoji: '👀' },
]
const EMOJI_MAP: Record<string, string> = Object.fromEntries(REACT_TYPES.map(r => [r.type, r.emoji]))

const reactionsToShow = computed(() => {
  const r    = messagesStore.reactions[props.msg.id] ?? {}
  const mine = messagesStore.userVotes[props.msg.id] ?? new Set()
  return REACT_TYPES.filter((t) => (r[t.type] ?? 0) > 0).map((t) => ({
    ...t,
    count:  r[t.type] as number,
    isMine: mine.has(t.type),
  }))
})
</script>

<template>
  <div
    class="msg-row"
    :class="{ grouped, pinned: isPinned, editing }"
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

      <!-- En-tête auteur + heure -->
      <template v-if="!grouped">
        <div class="msg-meta">
          <span class="msg-author">{{ msg.author_name }}</span>
          <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
          <span v-if="isEdited" class="msg-edited-tag">(modifié)</span>
          <span v-if="isPinned" class="pin-badge" title="Message épinglé">📌</span>
        </div>
      </template>

      <!-- Contenu — mode lecture -->
      <template v-if="!editing">
        <!-- eslint-disable vue/no-v-html -->
        <p class="msg-text" v-html="content" @click="onMsgClick" />
        <!-- eslint-enable vue/no-v-html -->
      </template>

      <!-- Contenu — mode édition inline -->
      <div v-else class="msg-edit-box">
        <textarea
          ref="editEl"
          v-model="editContent"
          class="msg-edit-input"
          rows="1"
          @keydown="onEditKeydown"
        />
        <div class="msg-edit-actions">
          <span class="msg-edit-hint">Entrée pour valider · Échap pour annuler</span>
          <button class="btn-icon msg-edit-save" title="Valider" @click="commitEdit">
            <Check :size="13" />
          </button>
        </div>
      </div>

      <!-- Réactions affichées + bouton picker (style Slack : inline sous le texte) -->
      <div v-if="!editing" class="msg-reactions-row">
        <button
          v-for="r in reactionsToShow"
          :key="r.type"
          class="msg-reaction-pill"
          :class="{ mine: r.isMine }"
          :aria-label="`Réagir ${r.emoji}`"
          @click="messagesStore.toggleReaction(msg.id, r.type)"
        >
          <span class="reaction-emoji">{{ r.emoji }}</span>
          <span class="reaction-count">{{ r.count }}</span>
        </button>

        <!-- Bouton + toujours visible si réactions existantes, sinon au survol -->
        <ReactionPicker
          :msg-id="msg.id"
          :class="{ 'reaction-picker-visible': reactionsToShow.length > 0 }"
          class="inline-picker"
        />
      </div>
    </div>

    <!-- Actions flottantes au survol (droite) -->
    <div class="msg-actions">

      <!-- Épingler (prof seulement) -->
      <button
        v-if="appStore.isTeacher && !editing"
        class="btn-icon msg-action-btn"
        :title="isPinned ? 'Désépingler' : 'Épingler'"
        @click="togglePin"
      >
        <PinOff v-if="isPinned" :size="14" />
        <Pin v-else :size="14" />
      </button>

      <!-- Menu ··· -->
      <div v-if="!editing" class="msg-menu-wrap" @mouseleave="showMenu = false">
        <button
          class="btn-icon msg-action-btn"
          title="Plus d'options"
          @click.stop="showMenu = !showMenu"
        >
          <MoreHorizontal :size="14" />
        </button>

        <div v-if="showMenu" class="msg-menu" role="menu">
          <button class="msg-menu-item" role="menuitem" @click="copyMessage">
            <Copy :size="12" /> Copier
          </button>
          <button v-if="canEdit" class="msg-menu-item" role="menuitem" @click="startEdit">
            <Pencil :size="12" /> Modifier
          </button>
          <button v-if="appStore.isTeacher" class="msg-menu-item" role="menuitem" @click="togglePin">
            <Pin :size="12" /> {{ isPinned ? 'Désépingler' : 'Épingler' }}
          </button>
          <button v-if="canDelete" class="msg-menu-item msg-menu-danger" role="menuitem" @click="deleteMessage">
            <Trash2 :size="12" /> Supprimer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Métadonnées auteur ── */
.msg-meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}
.msg-edited-tag {
  font-size: 10px;
  color: var(--text-muted);
  font-style: italic;
}

/* ── Édition inline ── */
.msg-edit-box {
  margin-top: 2px;
}
.msg-edit-input {
  width: 100%;
  background: var(--bg-input, rgba(255,255,255,.06));
  border: 1.5px solid var(--accent);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13.5px;
  font-family: var(--font);
  padding: 7px 10px;
  resize: none;
  outline: none;
  box-shadow: 0 0 0 3px rgba(74,144,217,.15);
  line-height: 1.5;
  min-height: 40px;
}
.msg-edit-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 4px;
}
.msg-edit-hint {
  font-size: 10.5px;
  color: var(--text-muted);
}
.msg-edit-save {
  color: var(--color-success);
}
.msg-edit-save:hover { background: rgba(39,174,96,.12); }

/* ── Zone réactions — inline sous le texte (style Slack) ── */
.msg-reactions-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  min-height: 0;
}

/* Le picker inline est caché par défaut, visible au survol de la row ou si réactions présentes */
.inline-picker {
  opacity: 0;
  transition: opacity var(--t-fast);
}
.msg-row:hover .inline-picker,
.inline-picker.reaction-picker-visible {
  opacity: 1;
}

.msg-reaction-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 42px;
  min-height: 26px;
  padding: 3px 9px;
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
  border-color: rgba(255,255,255,.18);
  transform: translateY(-1px);
}
.msg-reaction-pill.mine {
  background: rgba(74,144,217,.18);
  border-color: rgba(74,144,217,.5);
  color: var(--accent-light);
  font-weight: 700;
}
.reaction-emoji { font-size: 14px; line-height: 1; }
.reaction-count { font-size: 11.5px; font-weight: 600; }

/* ── Menu ··· ── */
.msg-menu-wrap { position: relative; }
.msg-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 60;
  min-width: 160px;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04) inset;
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

/* État édition en cours */
.msg-row.editing { background: rgba(74,144,217,.04); }
</style>
