<script setup lang="ts">
import {
  Check, Reply, AlertTriangle, Flame, Pin,
} from 'lucide-vue-next'
import UiRoleBadge from '@/components/ui/UiRoleBadge.vue'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import Avatar       from '@/components/ui/Avatar.vue'
import ContextMenu  from '@/components/ui/ContextMenu.vue'
import MessageActionPill from '@/components/chat/MessageActionPill.vue'
import MessageLightbox from '@/components/chat/MessageLightbox.vue'
import MessageReportDialog from '@/components/chat/MessageReportDialog.vue'
import { formatTime }      from '@/utils/date'
import { authUrl }         from '@/utils/auth'
import { useBubbleActions }   from '@/composables/useBubbleActions'
import { useBubbleReactions } from '@/composables/useBubbleReactions'
import { useBubbleBookmarks } from '@/composables/useBubbleBookmarks'
import { useBubbleMenu }      from '@/composables/useBubbleMenu'
import type { Message } from '@/types'

interface Props {
  msg:         Message
  grouped?:    boolean
  searchTerm?: string
}

const props = withDefaults(defineProps<Props>(), { grouped: false, searchTerm: '' })

const appStore      = useAppStore()
const messagesStore = useMessagesStore()

// ── Composables
const msgGetter   = () => props.msg
const searchGetter = () => props.searchTerm

const {
  isOwnMessage, isMine, isPinned, isEdited, canEdit, canDelete, hasQuote,
  openDmWithAuthor, onReply: _onReply, togglePin: _togglePin,
  copyMessage: _copyMessage, startEdit: _startEdit,
  editing, editContent, editEl, commitEdit, cancelEdit, onEditKeydown,
  confirmingDelete, deleteMessage: _deleteMessage, confirmDelete, cancelDelete,
  reportingMsg, reportReason, reportMessage, onMsgClick,
} = useBubbleActions(msgGetter)

const {
  QUICK_REACTS, showPicker, quickReact, pickEmojiReact, reactionsToShow,
} = useBubbleReactions(msgGetter)

const { isBookmarked, toggleBookmark } = useBubbleBookmarks(msgGetter)

const {
  lightboxUrl, showMenu,
  ctxVisible, ctxX, ctxY, onContextMenu, ctxItems,
  content, color, imagePreviewUrl, closeAll: _closeAll,
} = useBubbleMenu(msgGetter, searchGetter, {
  isMine:   () => isMine.value,
  isPinned: () => isPinned.value,
  canEdit:  () => canEdit.value,
  canDelete: () => canDelete.value,
  onReply:      () => { _onReply(); showMenu.value = false },
  copyMessage:  () => { _copyMessage(); showMenu.value = false },
  startEdit:    () => { showMenu.value = false; _startEdit() },
  togglePin:    () => { _togglePin(); showMenu.value = false },
  deleteMessage: () => { showMenu.value = false; _deleteMessage() },
  reportingMsg,
})

// ── Wrappers that also close menu (used by inline template menu)
function onReply()      { _onReply(); showMenu.value = false }
function togglePin()    { _togglePin(); showMenu.value = false }
function copyMessage()  { _copyMessage(); showMenu.value = false }
function startEdit()    { showMenu.value = false; _startEdit() }
function deleteMessage(){ showMenu.value = false; _deleteMessage() }

function closeAll() { _closeAll(showPicker, confirmingDelete) }

// ── Click sur le texte du message : lightbox si image, sinon handler normal ──
function onTextClick(e: MouseEvent) {
  const img = (e.target as HTMLElement).closest('img.msg-inline-img') as HTMLImageElement | null
  if (img?.src) { lightboxUrl.value = img.src; return }
  onMsgClick(e)
}
</script>

<template>
  <div
    class="msg-row"
    :class="{ grouped, pinned: isPinned, editing }"
    :data-msg-id="msg.id"
    @click.self="closeAll"
    @contextmenu.prevent="onContextMenu"
  >
    <!-- Avatar + pastille présence -->
    <template v-if="!grouped">
      <div class="msg-avatar-wrap">
        <Avatar
          :initials="msg.author_initials || msg.author_name.slice(0, 2).toUpperCase()"
          :color="color"
          :photo-data="msg.author_photo"
          :icon="isMine && (appStore.currentUser?.type === 'admin' || appStore.currentUser?.type === 'teacher') && !msg.author_photo ? Flame : null"
        />
        <span v-if="appStore.isUserOnline(msg.author_name)" class="presence-dot presence-online"></span>
      </div>
    </template>
    <div v-else class="msg-avatar-placeholder" />

    <!-- Corps -->
    <div class="msg-body">

      <!-- En-tête auteur + heure -->
      <template v-if="!grouped">
        <div class="msg-meta">
          <span
            class="msg-author"
            :class="{ clickable: !isOwnMessage }"
            :role="isOwnMessage ? undefined : 'button'"
            :tabindex="isOwnMessage ? undefined : 0"
            :title="isOwnMessage ? '' : 'Cliquer pour envoyer un message direct'"
            @click="openDmWithAuthor"
            @keydown.enter="openDmWithAuthor"
          >{{ msg.author_name }}</span>
          <UiRoleBadge v-if="msg.author_type === 'teacher'" role="teacher" size="xs" />
          <span class="msg-time" :title="new Date(msg.created_at).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })">{{ formatTime(msg.created_at) }}</span>
          <span v-if="isEdited" class="msg-edited-tag">(modifié)</span>
          <span v-if="isPinned" class="msg-pin-badge" title="Message épinglé" aria-label="Message épinglé">
            <Pin :size="10" aria-hidden="true" />
          </span>
        </div>
      </template>

      <!-- Citation (reply-to) -->
      <div v-if="hasQuote" class="msg-quote" role="button" tabindex="0" @click="closeAll" @keydown.enter="closeAll">
        <Reply :size="11" class="msg-quote-icon" />
        <span class="msg-quote-author">{{ msg.reply_to_author }}</span>
        <span class="msg-quote-preview">{{ msg.reply_to_preview }}</span>
      </div>

      <!-- Texte - mode lecture -->
      <template v-if="!editing">
        <!-- eslint-disable vue/no-v-html -->
        <div class="msg-text" v-html="content" @click="onTextClick" />
        <!-- eslint-enable vue/no-v-html -->

        <!-- Prévisualisation image inline (bare URL hors markdown, ex. lien collé) -->
        <div v-if="imagePreviewUrl" class="msg-img-preview">
          <img :src="authUrl(imagePreviewUrl)" alt="Aperçu" loading="lazy" @click="lightboxUrl = imagePreviewUrl!" />
        </div>
      </template>

      <!-- Texte - mode édition inline -->
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
          <button class="btn-icon msg-edit-save" title="Valider" aria-label="Valider la modification" @click="commitEdit">
            <Check :size="13" />
          </button>
        </div>
      </div>

      <!-- Confirmation de suppression inline -->
      <Transition name="del-confirm-fade">
        <div v-if="confirmingDelete" class="msg-delete-confirm">
          <AlertTriangle :size="13" class="del-icon" />
          <span class="del-label">Supprimer ce message définitivement ?</span>
          <button class="del-btn del-btn-danger" @click="confirmDelete">Supprimer</button>
          <button class="del-btn del-btn-cancel" @click="cancelDelete">Annuler</button>
        </div>
      </Transition>

      <!-- Réactions affichées sous le texte -->
      <div v-if="reactionsToShow.length && !editing" class="msg-reactions-row">
        <button
          v-for="r in reactionsToShow"
          :key="r.type"
          class="msg-reaction-pill"
          :class="{ mine: r.isMine }"
          :aria-label="`Réagir ${r.emoji}`"
          :title="messagesStore.getReactionUsers(msg.id, r.type).join(', ') || undefined"
          @click="messagesStore.toggleReaction(msg.id, r.type)"
        >
          <span class="reaction-emoji">{{ r.emoji }}</span>
          <span class="reaction-count">{{ r.count }}</span>
        </button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════
         PILL D'ACTIONS (style Slack) - au survol
    ════════════════════════════════════════════ -->
    <MessageActionPill
      v-if="!editing"
      :quick-reacts="QUICK_REACTS"
      :is-pinned="isPinned"
      :is-bookmarked="isBookmarked"
      :can-edit="canEdit"
      :can-delete="canDelete"
      :show-picker="showPicker"
      :show-menu="showMenu"
      @update:show-picker="showPicker = $event"
      @update:show-menu="showMenu = $event"
      @reply="onReply"
      @quick-react="quickReact"
      @pick-emoji="pickEmojiReact"
      @toggle-pin="togglePin"
      @toggle-bookmark="toggleBookmark"
      @copy="copyMessage"
      @edit="startEdit"
      @delete="deleteMessage"
    />

    <!-- Menu contextuel (clic droit) -->
    <ContextMenu
      v-if="ctxVisible"
      :x="ctxX"
      :y="ctxY"
      :items="ctxItems"
      @close="ctxVisible = false"
    />

  </div>

  <!-- Lightbox image + dialog signalement -->
  <Teleport to="body">
    <MessageLightbox :url="lightboxUrl" @close="lightboxUrl = null" />
    <MessageReportDialog
      :open="reportingMsg"
      :message-preview="msg.content.slice(0, 100) + (msg.content.length > 100 ? '...' : '')"
      :reason="reportReason"
      @update:open="reportingMsg = $event"
      @update:reason="reportReason = $event"
      @submit="reportMessage"
    />
  </Teleport>
</template>

<style scoped>
/* ════════════════════════════════════════════
   LIGNE DE MESSAGE - hover + états
════════════════════════════════════════════ */

/* Pastille de présence sur l'avatar */
.msg-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.msg-avatar-wrap .presence-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--bg-main);
}
.presence-online  { background: var(--color-success); }

/* Fond subtil au survol - style Discord/Slack */
.msg-row {
  position: relative;
  transition: background-color .12s ease;
}
.msg-row:hover {
  background: rgba(255, 255, 255, 0.025);
  border-radius: 4px;
}
.msg-row.editing { background: rgba(var(--accent-rgb), .04); border-radius: 6px; }

/* Message épinglé : bandeau latéral gold au lieu de fond pâle (plus clean) */
.msg-row.pinned {
  background: color-mix(in srgb, var(--color-warning) 5%, transparent);
  box-shadow: inset 2px 0 0 var(--color-warning);
  padding-left: 4px;
}

/* ════════════════════════════════════════════
   TYPOGRAPHIE & MÉTA
════════════════════════════════════════════ */
.msg-meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 1px;
}

/* Nom de l'auteur */
.msg-author {
  font-weight: 700;
  font-size: 13px;
  color: var(--text-primary);
  letter-spacing: .005em;
}
.msg-author.clickable { cursor: pointer; }
.msg-author.clickable:hover { color: var(--accent); text-decoration: underline; }

/* Pin badge (remplace l'emoji 📌) */
.msg-pin-badge {
  display: inline-flex;
  align-items: center;
  color: var(--color-warning);
  opacity: .85;
}

/* Heure - plus discrète */
.msg-time {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}
.msg-edited-tag { font-size: 11px; color: var(--text-muted); font-style: italic; }

/* ════════════════════════════════════════════
   CITATION (reply-to)
════════════════════════════════════════════ */
.msg-quote {
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 3px 8px;
  margin-bottom: 4px;
  border-left: 3px solid var(--accent);
  background: rgba(var(--accent-rgb), .06);
  border-radius: 0 4px 4px 0;
  max-width: 100%;
  overflow: hidden;
  cursor: default;
}
.msg-quote-icon   { color: var(--accent); flex-shrink: 0; }
.msg-quote-author {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-light);
  white-space: nowrap;
  flex-shrink: 0;
}
.msg-quote-preview {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

/* ════════════════════════════════════════════
   CONTENU ENRICHI - blockquote, code, pre
════════════════════════════════════════════ */
/* Blockquotes markdown */
:deep(.msg-text blockquote) {
  margin: 6px 0;
  padding: 6px 12px;
  border-left: 3px solid var(--accent);
  background: rgba(var(--accent-rgb), .06);
  border-radius: 0 6px 6px 0;
  color: var(--text-secondary);
  font-style: italic;
}

/* Code inline */
:deep(.msg-text code) {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: .85em;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 5px;
  color: var(--color-warning);
}

/* Blocs de code highlight.js */
:deep(.code-block) {
  position: relative;
  margin: 8px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, .3);
}
:deep(.code-lang) {
  display: block;
  padding: 4px 12px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--text-muted);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}
:deep(.code-block pre) {
  margin: 0;
  padding: 10px 14px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.6;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

/* ════════════════════════════════════════════
   PRÉVISUALISATION IMAGE
════════════════════════════════════════════ */
.msg-img-preview {
  margin-top: 6px;
  max-width: 340px;
}
.msg-img-preview img {
  max-width: 100%;
  max-height: 220px;
  border-radius: 8px;
  border: 1px solid var(--border);
  cursor: pointer;
  display: block;
  object-fit: cover;
  transition: opacity .15s;
}
.msg-img-preview img:hover { opacity: .88; }

/* ════════════════════════════════════════════
   PILL D'ACTIONS - style Slack
════════════════════════════════════════════ */
.msg-action-pill {
  position: absolute;
  top: -14px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 1px;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--motion-fast) var(--ease-out), transform var(--motion-fast) var(--ease-out);
  transform: translateY(4px);
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,.3), 0 0 0 1px rgba(255,255,255,.04) inset;
  padding: 2px 4px;
  z-index: 30;
}

.msg-row:hover .msg-action-pill {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.pill-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 32px;
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
  background: var(--bg-active);
  color: var(--text-primary);
  transform: scale(1.1);
}
.pill-btn:disabled { opacity: .35; cursor: default; }

.pill-emoji-btn { width: 32px; font-size: 16px; }
.pill-emoji-btn:hover:not(:disabled) { transform: scale(1.25); background: var(--bg-hover); }

.pill-sep {
  display: block;
  width: 1px;
  height: 18px;
  background: var(--border);
  margin: 0 3px;
  flex-shrink: 0;
}

/* Picker complet */
.pill-picker-wrap { position: relative; }
.full-picker-pos {
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  z-index: 40;
}

/* Menu ··· */
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
  font-size: 13px;
  border-radius: 5px;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background .1s, color .1s;
}
.msg-menu-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.msg-menu-danger       { color: var(--color-danger); }
.msg-menu-danger:hover {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger);
}

/* ════════════════════════════════════════════
   RÉACTIONS - design "juicy"
════════════════════════════════════════════ */
.msg-reactions-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 5px;
}

.msg-reaction-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 48px;
  min-height: 32px;
  padding: 2px 10px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  /* transition douce sur plusieurs propriétés */
  transition:
    background var(--motion-fast) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out),
    transform .15s cubic-bezier(.34, 1.56, .64, 1),
    box-shadow var(--motion-fast) var(--ease-out);
  line-height: 1;
  box-shadow: 0 1px 3px rgba(0,0,0,.2);
}

/* Survol rebondissant */
.msg-reaction-pill:hover {
  background: var(--bg-elevated);
  transform: translateY(-2px) scale(1.06);
  box-shadow: 0 4px 12px rgba(0,0,0,.25);
}

/* Réaction de l'utilisateur courant - visuel accentué (opacités scale cohérent 12/28/45) */
.msg-reaction-pill.mine {
  background: rgba(var(--accent-rgb), .18);
  border-color: rgba(var(--accent-rgb), .45);
  color: var(--accent-light);
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(var(--accent-rgb), .12);
}
.msg-reaction-pill.mine:hover {
  background: rgba(var(--accent-rgb), .28);
  border-color: rgba(var(--accent-rgb), .65);
  box-shadow: 0 4px 14px rgba(var(--accent-rgb), .18);
}

.reaction-emoji { font-size: 16px; line-height: 1; }
.reaction-count { font-size: 12.5px; font-weight: 700; }

/* ════════════════════════════════════════════
   ÉDITION INLINE
════════════════════════════════════════════ */
.msg-edit-box { margin-top: 2px; }
.msg-edit-input {
  width: 100%;
  background: var(--bg-hover);
  border: 1.5px solid var(--accent);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 13.5px;
  font-family: var(--font);
  padding: 7px 10px;
  resize: none;
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb),.15);
  line-height: 1.5;
}
.msg-edit-input:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }
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

/* ════════════════════════════════════════════
   CONFIRMATION SUPPRESSION INLINE
════════════════════════════════════════════ */
.msg-delete-confirm {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  padding: 7px 12px;
  background: color-mix(in srgb, var(--color-danger) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-danger) 22%, transparent);
  border-radius: 7px;
  max-width: fit-content;
}

.del-icon { color: var(--color-danger); flex-shrink: 0; }

.del-label {
  font-size: 13px;
  color: var(--color-danger);
  font-weight: 600;
  white-space: nowrap;
}

.del-btn {
  font-size: 12px;
  font-family: var(--font);
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  transition: opacity .12s;
  white-space: nowrap;
}
.del-btn:hover { opacity: .85; }

.del-btn-danger {
  background: var(--color-danger);
  color: #fff;
}

.del-btn-cancel {
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border-input);
}
.del-btn-cancel:hover { color: var(--text-primary); background: var(--bg-active); }

.del-confirm-fade-enter-active { transition: opacity .14s ease, transform .14s ease; }
.del-confirm-fade-leave-active { transition: opacity .10s ease, transform .10s ease; }
.del-confirm-fade-enter-from, .del-confirm-fade-leave-to { opacity: 0; transform: translateY(-4px); }

/* ════════════════════════════════════════════
   BOOKMARK ACTIF
════════════════════════════════════════════ */
.pill-bookmarked {
  color: var(--color-warning) !important;
}
.pill-bookmarked:hover { background: rgba(232,137,26,.12) !important; }

/* ══════════════ Motion polish ══════════════ */

/* Entrée : un nouveau message apparait en slide-up doux. On cible les rows
   qui arrivent via Vue reactivity (clé data-msg-id nouvelle) — effet natif
   grâce à `@starting-style` non supporté partout, on fallback via CSS keyframe
   déclenché par animation-name (stable cross-browser). */
@keyframes msg-enter {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.msg-row {
  animation: msg-enter .18s cubic-bezier(0.4, 0, 0.2, 1);
}
/* Les messages groupés (même auteur) ont une animation plus discrète */
.msg-row.grouped {
  animation-duration: .14s;
}

/* Reduced motion : on respecte la préférence utilisateur. */
@media (prefers-reduced-motion: reduce) {
  .msg-row,
  .msg-row.grouped { animation: none !important; }
  .msg-action-pill { transition: none !important; }
  .msg-reaction-pill:hover { transform: none !important; }
  .pill-btn:hover:not(:disabled) { transform: none !important; }
  .pill-emoji-btn:hover:not(:disabled) { transform: none !important; }
}

/* ── Lightbox ── */
.lightbox-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,.85); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  cursor: zoom-out;
}
.lightbox-img {
  max-width: 90vw; max-height: 85vh; object-fit: contain;
  border-radius: 8px; box-shadow: 0 8px 40px rgba(0,0,0,.5);
  cursor: default;
}
.lightbox-toolbar {
  position: absolute; top: 16px; right: 16px;
  display: flex; gap: 8px; z-index: 1;
}
.lightbox-btn {
  width: 36px; height: 36px; border-radius: 8px;
  background: var(--bg-active); border: none;
  color: #fff; cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  transition: background .15s; text-decoration: none;
}
.lightbox-btn:hover { background: rgba(255,255,255,.25); }
.lightbox-fade-enter-active { transition: opacity .2s; }
.lightbox-fade-leave-active { transition: opacity .15s; }
.lightbox-fade-enter-from, .lightbox-fade-leave-to { opacity: 0; }

/* Report dialog */
.report-overlay { align-items: center; justify-content: center; }
.report-dialog {
  background: var(--bg-modal); border-radius: 12px; padding: 24px;
  max-width: 420px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,.5);
}
.report-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 15px; font-weight: 600; color: var(--color-danger); margin-bottom: 10px;
}
.report-preview {
  font-size: 12px; color: var(--text-muted); font-style: italic;
  padding: 8px; background: var(--bg-elevated); border-radius: 6px; margin-bottom: 12px;
  word-break: break-word;
}
.report-hint { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
.report-quick-reasons { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.report-reason-btn {
  padding: 4px 10px; border-radius: 14px; font-size: 11px;
  background: var(--bg-hover); color: var(--text-secondary);
  border: 1px solid var(--border); cursor: pointer;
  transition: background-color .15s, color .15s, border-color .15s;
}
.report-reason-btn.active, .report-reason-btn:hover {
  background: color-mix(in srgb, var(--color-danger) 15%, transparent);
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 30%, transparent);
}
.report-textarea {
  width: 100%; background: var(--bg-hover); border: 1px solid var(--border);
  border-radius: 6px; padding: 8px; color: var(--text-primary); font-size: 12px;
  resize: vertical; margin-bottom: 12px;
}
.report-actions { display: flex; justify-content: flex-end; gap: 8px; }
.report-actions .btn-primary {
  background: var(--color-danger); color: white; padding: 6px 16px; border-radius: 6px; font-size: 12px;
  border: none; cursor: pointer;
}
.report-actions .btn-primary:disabled { opacity: .4; cursor: not-allowed; }
.report-actions .btn-ghost {
  padding: 6px 12px; font-size: 12px; color: var(--text-muted); cursor: pointer;
  background: none; border: none;
}
</style>
