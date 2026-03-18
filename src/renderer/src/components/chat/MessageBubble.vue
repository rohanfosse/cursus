<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { Pin, PinOff, MoreHorizontal, Copy, Trash2, Check, Pencil, SmilePlus, Bookmark } from 'lucide-vue-next'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import Avatar from '@/components/ui/Avatar.vue'
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

// ── State
const showMenu    = ref(false)
const showPicker  = ref(false)
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
const isMine   = computed(() => props.msg.author_name === appStore.currentUser?.name)
const canEdit   = computed(() => isMine.value)
const canDelete = computed(() => appStore.isTeacher || isMine.value)

// ── Réactions — types disponibles
const REACT_TYPES = [
  { type: 'check', emoji: '✅' },
  { type: 'thumb', emoji: '👍' },
  { type: 'fire',  emoji: '🔥' },
  { type: 'heart', emoji: '❤️' },
  { type: 'think', emoji: '🤔' },
  { type: 'eyes',  emoji: '👀' },
]
// Raccourcis rapides visibles dans la pill (les 4 premiers)
const QUICK_REACTS = REACT_TYPES.slice(0, 4)

function quickReact(type: string) {
  messagesStore.toggleReaction(props.msg.id, type)
}

function pickReact(type: string) {
  messagesStore.toggleReaction(props.msg.id, type)
  showPicker.value = false
}

const reactionsToShow = computed(() => {
  const r    = messagesStore.reactions[props.msg.id] ?? {}
  const mine = messagesStore.userVotes[props.msg.id] ?? new Set()
  return REACT_TYPES.filter((t) => (r[t.type] ?? 0) > 0).map((t) => ({
    ...t,
    count:  r[t.type] as number,
    isMine: mine.has(t.type),
  }))
})

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
  showMenu.value    = false
  editing.value     = true
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

function cancelEdit() { editing.value = false; editContent.value = '' }

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

function closeAll() { showMenu.value = false; showPicker.value = false }
</script>

<template>
  <div
    class="msg-row"
    :class="{ grouped, pinned: isPinned, editing }"
    :data-msg-id="msg.id"
    @click.self="closeAll"
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

      <!-- Texte — mode lecture -->
      <template v-if="!editing">
        <!-- eslint-disable vue/no-v-html -->
        <p class="msg-text" v-html="content" @click="onMsgClick" />
        <!-- eslint-enable vue/no-v-html -->
      </template>

      <!-- Texte — mode édition inline -->
      <div v-else class="msg-edit-box">
        <textarea
          ref="editEl"
          v-model="editContent"
          class="msg-edit-input"
          rows="2"
          @keydown="onEditKeydown"
        />
        <div class="msg-edit-footer">
          <span class="msg-edit-hint">Entrée · valider &nbsp;·&nbsp; Échap · annuler</span>
          <button class="btn-icon msg-edit-save" title="Valider" @click="commitEdit">
            <Check :size="13" />
          </button>
        </div>
      </div>

      <!-- Réactions affichées sous le texte -->
      <div v-if="reactionsToShow.length && !editing" class="msg-reactions-row">
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
      </div>
    </div>

    <!-- ═══════════════════════════════════════════
         PILL D'ACTIONS (style Slack) — au survol
    ════════════════════════════════════════════ -->
    <div v-if="!editing" class="msg-action-pill">

      <!-- Raccourcis réactions rapides -->
      <button
        v-for="r in QUICK_REACTS"
        :key="r.type"
        class="pill-btn pill-emoji-btn"
        :title="r.emoji"
        @click.stop="quickReact(r.type)"
      >{{ r.emoji }}</button>

      <!-- Picker complet -->
      <div class="pill-picker-wrap" @mouseleave="showPicker = false">
        <button
          class="pill-btn"
          title="Ajouter une réaction"
          @click.stop="showPicker = !showPicker"
        >
          <SmilePlus :size="15" />
        </button>
        <div v-if="showPicker" class="full-picker">
          <button
            v-for="r in REACT_TYPES"
            :key="r.type"
            class="full-picker-btn"
            :title="r.emoji"
            @click.stop="pickReact(r.type)"
          >{{ r.emoji }}</button>
        </div>
      </div>

      <!-- Séparateur -->
      <span class="pill-sep" />

      <!-- Épingler -->
      <button
        v-if="appStore.isTeacher"
        class="pill-btn"
        :title="isPinned ? 'Désépingler' : 'Épingler'"
        @click.stop="togglePin"
      >
        <PinOff v-if="isPinned" :size="15" />
        <Pin v-else :size="15" />
      </button>

      <!-- Bookmark (placeholder) -->
      <button class="pill-btn" title="Sauvegarder" disabled>
        <Bookmark :size="15" />
      </button>

      <!-- Menu ··· -->
      <div class="pill-menu-wrap" @mouseleave="showMenu = false">
        <button
          class="pill-btn"
          title="Plus d'options"
          @click.stop="showMenu = !showMenu"
        >
          <MoreHorizontal :size="15" />
        </button>

        <div v-if="showMenu" class="msg-menu" role="menu">
          <button class="msg-menu-item" role="menuitem" @click="copyMessage">
            <Copy :size="12" /> Copier le texte
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
/* ════════════════════════════════════════════
   PILL D'ACTIONS — style Slack
════════════════════════════════════════════ */
.msg-action-pill {
  /* Positionnée en absolu en haut à droite de la row */
  position: absolute;
  top: -14px;
  right: 16px;

  /* Invisible par défaut */
  display: flex;
  align-items: center;
  gap: 1px;
  opacity: 0;
  pointer-events: none;
  transition: opacity .12s ease, transform .12s ease;
  transform: translateY(4px);

  /* Apparence pill */
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,.3), 0 0 0 1px rgba(255,255,255,.04) inset;
  padding: 2px 4px;
  z-index: 30;
}

/* Affichage au survol de la row */
.msg-row:hover .msg-action-pill {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

/* Bouton générique de la pill */
.pill-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: 5px;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  transition: background .1s, color .1s, transform .1s;
  padding: 0;
}
.pill-btn:hover:not(:disabled) {
  background: rgba(255,255,255,.09);
  color: var(--text-primary);
  transform: scale(1.1);
}
.pill-btn:disabled { opacity: .35; cursor: default; }

/* Emoji rapide — légèrement plus large */
.pill-emoji-btn { width: 32px; font-size: 16px; }
.pill-emoji-btn:hover:not(:disabled) { transform: scale(1.25); background: rgba(255,255,255,.07); }

/* Séparateur vertical */
.pill-sep {
  display: block;
  width: 1px;
  height: 18px;
  background: var(--border);
  margin: 0 3px;
  flex-shrink: 0;
}

/* ── Picker complet ── */
.pill-picker-wrap { position: relative; }
.full-picker {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 3px;
  padding: 6px 8px;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0,0,0,.4);
  z-index: 40;
  white-space: nowrap;
}
.full-picker-btn {
  font-size: 18px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: background .1s, transform .1s;
}
.full-picker-btn:hover { background: rgba(255,255,255,.1); transform: scale(1.2); }

/* ── Menu ··· ── */
.pill-menu-wrap { position: relative; }
.msg-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 60;
  min-width: 168px;
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
  gap: 9px;
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
  transition: background .1s, color .1s;
}
.msg-menu-item:hover { background: rgba(255,255,255,.07); color: var(--text-primary); }
.msg-menu-danger       { color: var(--color-danger); }
.msg-menu-danger:hover { background: rgba(231,76,60,.12); color: #ff8070; }

/* ════════════════════════════════════════════
   RÉACTIONS affichées sous le texte
════════════════════════════════════════════ */
.msg-reactions-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}
.msg-reaction-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 44px;
  height: 26px;
  padding: 0 8px;
  border-radius: 13px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,.04);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background .1s, border-color .1s, transform .1s;
  line-height: 1;
}
.msg-reaction-pill:hover { background: rgba(255,255,255,.09); transform: translateY(-1px); }
.msg-reaction-pill.mine {
  background: rgba(74,144,217,.18);
  border-color: rgba(74,144,217,.5);
  color: var(--accent-light);
  font-weight: 700;
}
.reaction-emoji { font-size: 14px; line-height: 1; }
.reaction-count { font-size: 11.5px; font-weight: 600; }

/* ════════════════════════════════════════════
   MÉTADONNÉES & ÉDITION
════════════════════════════════════════════ */
.msg-meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}
.msg-edited-tag { font-size: 10px; color: var(--text-muted); font-style: italic; }

.msg-edit-box { margin-top: 2px; }
.msg-edit-input {
  width: 100%;
  background: rgba(255,255,255,.05);
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
}
.msg-edit-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 4px;
}
.msg-edit-hint { font-size: 10.5px; color: var(--text-muted); }
.msg-edit-save { color: var(--color-success); }
.msg-edit-save:hover { background: rgba(39,174,96,.12); }

.msg-row.editing { background: rgba(74,144,217,.04); border-radius: 6px; }
</style>
