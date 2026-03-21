<script setup lang="ts">
import {
  Pin, PinOff, MoreHorizontal, Copy, Trash2, Check, Pencil,
  SmilePlus, Bookmark, BookmarkCheck, Reply, AlertTriangle, Flame, Download, X,
} from 'lucide-vue-next'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import Avatar       from '@/components/ui/Avatar.vue'
import EmojiPicker  from '@/components/ui/EmojiPicker.vue'
import ContextMenu  from '@/components/ui/ContextMenu.vue'
import { formatTime }      from '@/utils/date'
import { useOpenExternal } from '@/composables/useOpenExternal'
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
const { openExternal } = useOpenExternal()

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
          :icon="isMine && appStore.currentUser?.type === 'teacher' && !msg.author_photo ? Flame : null"
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
            :class="{ clickable: !isOwnMessage, 'msg-author-teacher': msg.author_type === 'teacher' }"
            :role="isOwnMessage ? undefined : 'button'"
            :tabindex="isOwnMessage ? undefined : 0"
            :title="isOwnMessage ? '' : 'Cliquer pour envoyer un message direct'"
            @click="openDmWithAuthor"
            @keydown.enter="openDmWithAuthor"
          >{{ msg.author_name }}</span>
          <!-- badge rôle retiré pour plus de sobriété -->
          <span class="msg-time" :title="new Date(msg.created_at).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })">{{ formatTime(msg.created_at) }}</span>
          <span v-if="isEdited" class="msg-edited-tag">(modifié)</span>
          <span v-if="isPinned" class="pin-badge" title="Message épinglé">📌</span>
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
        <p class="msg-text" v-html="content" @click="onMsgClick" />
        <!-- eslint-enable vue/no-v-html -->

        <!-- Prévisualisation image inline -->
        <div v-if="imagePreviewUrl" class="msg-img-preview">
          <img :src="imagePreviewUrl" alt="Aperçu" loading="lazy" @click="lightboxUrl = imagePreviewUrl!" />
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
    <div v-if="!editing" class="msg-action-pill">

      <!-- Répondre -->
      <button class="pill-btn" title="Répondre" aria-label="Répondre au message" @click.stop="onReply">
        <Reply :size="15" />
      </button>

      <!-- Raccourcis réactions rapides -->
      <button
        v-for="r in QUICK_REACTS"
        :key="r.type"
        class="pill-btn pill-emoji-btn"
        :title="r.emoji"
        :aria-label="`Réagir avec ${r.emoji}`"
        @click.stop="quickReact(r.type)"
      >{{ r.emoji }}</button>

      <!-- Picker complet -->
      <div class="pill-picker-wrap">
        <button
          class="pill-btn"
          title="Ajouter une réaction"
          aria-label="Ouvrir le sélecteur de réactions"
          @click.stop="showPicker = !showPicker"
        >
          <SmilePlus :size="15" />
        </button>
        <div v-if="showPicker" class="full-picker-pos" @click.stop>
          <EmojiPicker @pick="pickEmojiReact" />
        </div>
      </div>

      <!-- Séparateur -->
      <span class="pill-sep" />

      <!-- Épingler -->
      <button
        v-if="appStore.isTeacher"
        class="pill-btn"
        :title="isPinned ? 'Désépingler' : 'Épingler'"
        :aria-label="isPinned ? 'Désépingler le message' : 'Épingler le message'"
        @click.stop="togglePin"
      >
        <PinOff v-if="isPinned" :size="15" />
        <Pin v-else :size="15" />
      </button>

      <!-- Bookmark -->
      <button
        class="pill-btn"
        :class="{ 'pill-bookmarked': isBookmarked }"
        :title="isBookmarked ? 'Retirer des favoris' : 'Sauvegarder dans les favoris'"
        :aria-label="isBookmarked ? 'Retirer des favoris' : 'Sauvegarder dans les favoris'"
        @click.stop="toggleBookmark"
      >
        <BookmarkCheck v-if="isBookmarked" :size="15" />
        <Bookmark v-else :size="15" />
      </button>

      <!-- Menu ··· -->
      <div class="pill-menu-wrap" @mouseleave="showMenu = false">
        <button
          class="pill-btn"
          title="Plus d'options"
          aria-label="Plus d'options"
          @click.stop="showMenu = !showMenu"
        >
          <MoreHorizontal :size="15" />
        </button>

        <div v-if="showMenu" class="msg-menu" role="menu">
          <button class="msg-menu-item" role="menuitem" @click="onReply">
            <Reply :size="12" /> Répondre
          </button>
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

    <!-- Menu contextuel (clic droit) -->
    <ContextMenu
      v-if="ctxVisible"
      :x="ctxX"
      :y="ctxY"
      :items="ctxItems"
      @close="ctxVisible = false"
    />

  </div>

  <!-- Lightbox image plein écran -->
  <Teleport to="body">
    <Transition name="lightbox-fade">
      <div v-if="lightboxUrl" class="lightbox-overlay" @click.self="lightboxUrl = null">
        <div class="lightbox-toolbar">
          <a :href="lightboxUrl" download class="lightbox-btn" title="Télécharger" @click.stop>
            <Download :size="18" />
          </a>
          <button class="lightbox-btn" title="Ouvrir dans le navigateur" @click.stop="openExternal(lightboxUrl!)">
            <Flame :size="18" />
          </button>
          <button class="lightbox-btn" title="Fermer" @click="lightboxUrl = null">
            <X :size="18" />
          </button>
        </div>
        <img :src="lightboxUrl" class="lightbox-img" alt="Image agrandie" />
      </div>
    </Transition>

    <!-- Dialog de signalement -->
    <Transition name="lightbox-fade">
      <div v-if="reportingMsg" class="lightbox-overlay report-overlay" @click.self="reportingMsg = false">
        <div class="report-dialog">
          <h3 class="report-title"><AlertTriangle :size="16" /> Signaler ce message</h3>
          <p class="report-preview">"{{ msg.content.slice(0, 100) }}{{ msg.content.length > 100 ? '…' : '' }}"</p>
          <p class="report-hint">Indiquez la raison du signalement :</p>
          <div class="report-quick-reasons">
            <button v-for="r in ['Harcèlement', 'Spam', 'Contenu inapproprié', 'Hors-sujet']" :key="r"
              class="report-reason-btn" :class="{ active: reportReason === r }" @click="reportReason = r"
            >{{ r }}</button>
          </div>
          <textarea v-model="reportReason" class="report-textarea" rows="2" placeholder="Ou décrivez la raison…" />
          <div class="report-actions">
            <button class="btn-ghost" @click="reportingMsg = false">Annuler</button>
            <button class="btn-primary" :disabled="!reportReason.trim()" @click="reportMessage">Envoyer</button>
          </div>
        </div>
      </div>
    </Transition>
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
  border: 2px solid var(--bg-primary, #1a1a2e);
}
.presence-online  { background: #22c55e; }

/* Fond subtil au survol - effet Discord */
.msg-row:hover {
  background: rgba(255, 255, 255, 0.025);
  border-radius: 4px;
}
.msg-row.editing { background: rgba(74, 144, 217, .04); border-radius: 6px; }
.msg-row.pinned  { background: rgba(243, 156, 18, .04); }

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

/* Nom de l'auteur - plus impactant */
.msg-author {
  font-weight: 700;
  font-size: 13.5px;
  color: var(--text-primary);
  letter-spacing: .01em;
}
/* Nom du prof - couleur accent distincte */
.msg-author-teacher { color: var(--accent); }
/* Légère teinte accent sur hover de la row */
.msg-row:hover .msg-author { color: var(--accent-light, #7db8f0); }
.msg-author.clickable { cursor: pointer; }
.msg-author.clickable:hover { text-decoration: underline; color: var(--accent); }

/* Badge rôle Prof */
.msg-role-badge {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--accent);
  background: var(--accent-subtle, rgba(74,144,217,.14));
  padding: 1px 6px;
  border-radius: 4px;
  line-height: 1.4;
}

/* Heure - plus discrète */
.msg-time {
  font-size: 10.5px;
  color: var(--text-muted);
  font-weight: 400;
}
.msg-edited-tag { font-size: 10px; color: var(--text-muted); font-style: italic; }

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
  background: rgba(74, 144, 217, .06);
  border-radius: 0 4px 4px 0;
  max-width: 100%;
  overflow: hidden;
  cursor: default;
}
.msg-quote-icon   { color: var(--accent); flex-shrink: 0; }
.msg-quote-author {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--accent-light, #7db8f0);
  white-space: nowrap;
  flex-shrink: 0;
}
.msg-quote-preview {
  font-size: 11.5px;
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
  background: rgba(74, 144, 217, .06);
  border-radius: 0 6px 6px 0;
  color: var(--text-secondary);
  font-style: italic;
}

/* Code inline */
:deep(.msg-text code) {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: .85em;
  background: rgba(255, 255, 255, .07);
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: 4px;
  padding: 1px 5px;
  color: #e8a87c;
}

/* Blocs de code highlight.js */
:deep(.code-block) {
  position: relative;
  margin: 8px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .08);
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
  background: rgba(255, 255, 255, .04);
  border-bottom: 1px solid rgba(255, 255, 255, .06);
}
:deep(.code-block pre) {
  margin: 0;
  padding: 10px 14px;
  overflow-x: auto;
  font-size: 12.5px;
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
  transition: opacity .12s ease, transform .12s ease;
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
  background: rgba(255,255,255,.09);
  color: var(--text-primary);
  transform: scale(1.1);
}
.pill-btn:disabled { opacity: .35; cursor: default; }

.pill-emoji-btn { width: 32px; font-size: 16px; }
.pill-emoji-btn:hover:not(:disabled) { transform: scale(1.25); background: rgba(255,255,255,.07); }

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
  gap: 4px;
  min-width: 46px;
  height: 26px;
  padding: 0 8px;
  border-radius: 13px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, .04);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  /* transition douce sur plusieurs propriétés */
  transition:
    background .12s ease,
    border-color .12s ease,
    transform .15s cubic-bezier(.34, 1.56, .64, 1),
    box-shadow .12s ease;
  line-height: 1;
  box-shadow: 0 1px 3px rgba(0,0,0,.2);
}

/* Survol rebondissant */
.msg-reaction-pill:hover {
  background: rgba(255, 255, 255, .1);
  transform: translateY(-2px) scale(1.06);
  box-shadow: 0 4px 12px rgba(0,0,0,.25);
}

/* Réaction de l'utilisateur courant - visuel accentué */
.msg-reaction-pill.mine {
  background: rgba(74, 144, 217, .2);
  border-color: rgba(74, 144, 217, .65);
  color: var(--accent-light, #7db8f0);
  font-weight: 700;
  box-shadow: 0 0 0 1px rgba(74, 144, 217, .3), 0 2px 8px rgba(74, 144, 217, .15);
}
.msg-reaction-pill.mine:hover {
  background: rgba(74, 144, 217, .3);
  border-color: rgba(74, 144, 217, .8);
  box-shadow: 0 0 0 1px rgba(74, 144, 217, .5), 0 4px 14px rgba(74, 144, 217, .2);
}

.reaction-emoji { font-size: 14px; line-height: 1; }
.reaction-count { font-size: 11.5px; font-weight: 600; }

/* ════════════════════════════════════════════
   ÉDITION INLINE
════════════════════════════════════════════ */
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
  background: rgba(231,76,60,.09);
  border: 1px solid rgba(231,76,60,.22);
  border-radius: 7px;
  max-width: fit-content;
}

.del-icon { color: var(--color-danger); flex-shrink: 0; }

.del-label {
  font-size: 12.5px;
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
  background: rgba(255,255,255,.07);
  color: var(--text-secondary);
  border: 1px solid var(--border-input);
}
.del-btn-cancel:hover { color: var(--text-primary); background: rgba(255,255,255,.11); }

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
  background: rgba(255,255,255,.12); border: none;
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
  background: var(--bg-primary, #1a1a2e); border-radius: 12px; padding: 24px;
  max-width: 420px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,.5);
}
.report-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 15px; font-weight: 600; color: #f87171; margin-bottom: 10px;
}
.report-preview {
  font-size: 12px; color: var(--text-muted); font-style: italic;
  padding: 8px; background: rgba(255,255,255,.04); border-radius: 6px; margin-bottom: 12px;
  word-break: break-word;
}
.report-hint { font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; }
.report-quick-reasons { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.report-reason-btn {
  padding: 4px 10px; border-radius: 14px; font-size: 11px;
  background: rgba(255,255,255,.06); color: var(--text-secondary);
  border: 1px solid rgba(255,255,255,.1); cursor: pointer; transition: all .15s;
}
.report-reason-btn.active, .report-reason-btn:hover {
  background: rgba(248,113,113,.15); color: #f87171; border-color: rgba(248,113,113,.3);
}
.report-textarea {
  width: 100%; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
  border-radius: 6px; padding: 8px; color: var(--text-primary); font-size: 12px;
  resize: vertical; margin-bottom: 12px;
}
.report-actions { display: flex; justify-content: flex-end; gap: 8px; }
.report-actions .btn-primary {
  background: #f87171; color: #fff; padding: 6px 16px; border-radius: 6px; font-size: 12px;
  border: none; cursor: pointer;
}
.report-actions .btn-primary:disabled { opacity: .4; cursor: not-allowed; }
.report-actions .btn-ghost {
  padding: 6px 12px; font-size: 12px; color: var(--text-muted); cursor: pointer;
  background: none; border: none;
}
</style>
