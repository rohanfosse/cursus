<script setup lang="ts">
import {
  Check, Reply, AlertTriangle, Flame, Pin, SmilePlus, Plus,
} from 'lucide-vue-next'
import UiRoleBadge from '@/components/ui/UiRoleBadge.vue'
import { computed, ref, watch } from 'vue'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import Avatar       from '@/components/ui/Avatar.vue'
import ContextMenu  from '@/components/ui/ContextMenu.vue'
import MessageActionPill from '@/components/chat/MessageActionPill.vue'
import MessageLightbox from '@/components/chat/MessageLightbox.vue'
import MessageReportDialog from '@/components/chat/MessageReportDialog.vue'
import ForwardMessageModal from '@/components/chat/ForwardMessageModal.vue'
import EmojiPicker from '@/components/ui/EmojiPicker.vue'
import PollRenderer from '@/components/chat/PollRenderer.vue'
import LinkPreviewCard from '@/components/chat/LinkPreviewCard.vue'
import { parsePoll, contentWithoutPoll } from '@/utils/poll'
import { renderMessageContent } from '@/utils/html'
import { formatTime }      from '@/utils/date'
import { authUrl }         from '@/utils/auth'
import { useBubbleActions }   from '@/composables/useBubbleActions'
import { useToast }            from '@/composables/useToast'
import { useBubbleReactions } from '@/composables/useBubbleReactions'
import { useBubbleBookmarks } from '@/composables/useBubbleBookmarks'
import { useBubbleMenu }      from '@/composables/useBubbleMenu'
import { useLinkPreviews, extractUrls, type LinkPreview } from '@/composables/useLinkPreviews'
import { usePrefs } from '@/composables/usePrefs'
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
  isMine, isPinned, isEdited, canEdit, canDelete, hasQuote,
  openDmWithAuthor, onReply: _onReply, togglePin: _togglePin,
  copyMessage: _copyMessage, startEdit: _startEdit,
  editing, editContent, editEl, commitEdit, cancelEdit, onEditKeydown,
  confirmingDelete, deleteMessage: _deleteMessage, confirmDelete, cancelDelete,
  reportingMsg, reportReason, reportMessage, onMsgClick,
} = useBubbleActions(msgGetter)

const {
  REACT_TYPES, QUICK_REACTS, showPicker, quickReact, pickEmojiReact, reactionsToShow,
} = useBubbleReactions(msgGetter)

const { isBookmarked, toggleBookmark } = useBubbleBookmarks(msgGetter)

const {
  lightboxUrl, showMenu,
  ctxVisible, ctxX, ctxY, onContextMenu, ctxItems, ctxQuickEmojiItems,
  content, color, imagePreviewUrl, closeAll: _closeAll,
  copyPermalink,
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
  // Les 5 favoris de l'utilisateur — cohérent entre hover pill et ctx menu.
  // Passé en fonction pour rester réactif aux changements dans Settings.
  quickReactTypes: () => QUICK_REACTS.value,
  reactWithType: (type: string) => { quickReact(type) },
  bookmark: {
    isBookmarked: () => isBookmarked.value,
    toggle:       () => { toggleBookmark(); showMenu.value = false },
  },
})

// ── Wrappers qui ferment aussi le menu (utilises par la pill d'actions)
function onReply()      { _onReply(); showMenu.value = false }
function togglePin()    { _togglePin(); showMenu.value = false }
function copyMessage()  { _copyMessage(); showMenu.value = false }
function startEdit()    { showMenu.value = false; _startEdit() }
function deleteMessage(){ showMenu.value = false; _deleteMessage() }
function copyMessageLink() { copyPermalink(); showMenu.value = false }
function dmAuthor()        { openDmWithAuthor(); showMenu.value = false }
function reportMessageFromPill() { reportingMsg.value = true; showMenu.value = false }

// ── Transfert de message (modal dediee) ──────────────────────────────────
const showForward = ref(false)
function onForward() { showMenu.value = false; showForward.value = true }

// ── Picker inline a cote des reactions deja posees (style Slack) ─────────
// Quand un message a deja >=1 reaction, un bouton "+ emoji" semi-transparent
// apparait en bout de ligne pour permettre d'en ajouter une autre sans passer
// par la pill d'actions flottante (plus rapide, plus visible).
const showInlineEmojiPicker = ref(false)
const inlineEmojiWrapRef = ref<HTMLElement | null>(null)

function toggleInlineEmojiPicker(e?: Event) {
  e?.stopPropagation()
  showInlineEmojiPicker.value = !showInlineEmojiPicker.value
}
function onInlineEmojiPick(emoji: string) {
  // Reutilise le flow existant (toggleReaction via store) pour rester coherent
  // avec le picker de la pill d'actions et le quick-react.
  pickEmojiReact(emoji)
  showInlineEmojiPicker.value = false
}
// Fermeture au clic exterieur : listener pose uniquement quand ouvert.
function handleInlinePickerOutside(e: MouseEvent) {
  if (!inlineEmojiWrapRef.value) return
  if (!inlineEmojiWrapRef.value.contains(e.target as Node)) {
    showInlineEmojiPicker.value = false
  }
}
watch(showInlineEmojiPicker, (open) => {
  if (open) setTimeout(() => document.addEventListener('click', handleInlinePickerOutside), 0)
  else document.removeEventListener('click', handleInlinePickerOutside)
})

// ── Capacites derivees pour la pill d'actions (props explicites)
const canReport = computed(() => !isMine.value)
const canDmAuthor = computed(() => !isMine.value && props.msg.author_id != null)

// Set des types deja reactes par l'utilisateur — permet aux chips quick-react
// de la pill d'afficher un etat "active" (inspire Discord).
const myReactedTypes = computed<ReadonlySet<string>>(
  () => messagesStore.userVotes[props.msg.id] ?? new Set(),
)

function closeAll() { _closeAll(showPicker, confirmingDelete) }

// ── Click sur le texte du message : lightbox si image, sinon handler normal ──
const { showToast } = useToast()

function onTextClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  // Bouton "Copier" dans l'en-tete d'un bloc de code : intercepte avant le
  // flow standard pour copier le texte brut dans le presse-papiers (le
  // rendu est v-html, donc on passe par delegation).
  const copyBtn = target.closest('[data-action="copy-code"]') as HTMLElement | null
  if (copyBtn) {
    e.preventDefault()
    e.stopPropagation()
    const block = copyBtn.closest('.code-block')
    const codeEl = block?.querySelector('code')
    const text = codeEl?.textContent ?? ''
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Code copie.', 'success')
        copyBtn.classList.add('is-copied')
        setTimeout(() => copyBtn.classList.remove('is-copied'), 1500)
      }).catch(() => { showToast('Erreur lors de la copie.', 'error') })
    }
    return
  }
  // Checkbox de checklist GFM : toggle le state [ ] <-> [x] dans le contenu,
  // puis editMessage pour persister. Seul l'auteur peut cocher (respect de
  // la regle serveur : editMessage exige ownership ; pour d'autres users,
  // on affiche un toast discret).
  const taskCheckbox = target.closest('input[type="checkbox"]') as HTMLInputElement | null
  if (taskCheckbox && target.closest('.msg-text')) {
    e.preventDefault()
    e.stopPropagation()
    if (!isMine.value) {
      showToast("Seul l'auteur peut cocher cette liste.", 'info')
      return
    }
    void handleTaskToggle(taskCheckbox)
    return
  }
  const img = target.closest('img.msg-inline-img') as HTMLImageElement | null
  if (img?.src) { lightboxUrl.value = img.src; return }
  onMsgClick(e)
}

/**
 * Toggle la N-ieme tache d'une checklist markdown dans le contenu du message.
 * Les checkboxes sont rendues par marked dans l'ordre d'apparition du texte
 * source ; on compte l'index visuel via son rang dans le DOM .msg-text et
 * on toggle le match correspondant dans le string original.
 */
async function handleTaskToggle(clicked: HTMLInputElement) {
  const msgTextEl = clicked.closest('.msg-text')
  if (!msgTextEl) return
  const allCheckboxes = Array.from(msgTextEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
  const targetIdx = allCheckboxes.indexOf(clicked)
  if (targetIdx < 0) return
  // Toggle le N-ieme "- [ ]" ou "- [x]" dans le contenu source.
  let seen = 0
  const newContent = props.msg.content.replace(
    /^(\s*[-*+]\s+\[)([ xX])(\])/gm,
    (match, pre, state, post) => {
      if (seen === targetIdx) {
        seen++
        return pre + (state.toLowerCase() === 'x' ? ' ' : 'x') + post
      }
      seen++
      return match
    },
  )
  if (newContent === props.msg.content) return
  await messagesStore.editMessage(props.msg.id, newContent)
}

// ── Link preview (unfurl) — resolution async, respect de la pref user
const { getPref } = usePrefs()
const { resolve: resolveLinks } = useLinkPreviews()
const linkPreviews = ref<LinkPreview[]>([])

async function loadLinkPreviews() {
  if (getPref('unfurlEnabled') === false) { linkPreviews.value = []; return }
  const urls = extractUrls(props.msg.content)
  if (!urls.length) { linkPreviews.value = []; return }
  const res = await resolveLinks(urls)
  linkPreviews.value = res
}
loadLinkPreviews()
watch(() => props.msg.content, loadLinkPreviews)

// ── Sondage embarque : detecte le marqueur, rend le bloc, masque la 1re ligne
const pollDefinition = computed(() => parsePoll(props.msg.content))
const renderedContentWithoutPoll = computed(() => {
  if (!pollDefinition.value) return null
  const rest = contentWithoutPoll(props.msg.content)
  if (!rest) return ''
  return renderMessageContent(rest, props.searchTerm, appStore.currentUser?.name ?? '')
})
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
            :class="{ clickable: !isMine }"
            :role="isMine ? undefined : 'button'"
            :tabindex="isMine ? undefined : 0"
            :title="isMine ? '' : 'Cliquer pour envoyer un message direct'"
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
        <!-- Sondage structure (si le message commence par ::poll::) -->
        <template v-if="pollDefinition">
          <PollRenderer :msg="msg" :definition="pollDefinition" />
          <!-- Texte complementaire eventuel apres le sondage (eslint-disable vue/no-v-html) -->
          <!-- eslint-disable vue/no-v-html -->
          <div
            v-if="renderedContentWithoutPoll"
            class="msg-text msg-text--after-poll"
            v-html="renderedContentWithoutPoll"
            @click="onTextClick"
          />
          <!-- eslint-enable vue/no-v-html -->
        </template>

        <!-- Message standard -->
        <template v-else>
          <!-- eslint-disable vue/no-v-html -->
          <div class="msg-text" v-html="content" @click="onTextClick" />
          <!-- eslint-enable vue/no-v-html -->

          <!-- Prévisualisation image inline (bare URL hors markdown, ex. lien collé) -->
          <div v-if="imagePreviewUrl" class="msg-img-preview">
            <img :src="authUrl(imagePreviewUrl)" alt="Aperçu" loading="lazy" @click="lightboxUrl = imagePreviewUrl!" />
          </div>

          <!-- Link previews (unfurl OpenGraph) -->
          <LinkPreviewCard
            v-for="p in linkPreviews"
            :key="p.url"
            :preview="p"
          />
        </template>
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

        <!-- Bouton "+ emoji" quasi-transparent qui apparait quand il y a deja
             au moins une reaction : permet d'en ajouter une autre sans passer
             par la pill d'actions (style Slack/Discord "add reaction"). -->
        <div ref="inlineEmojiWrapRef" class="msg-reaction-add-wrap">
          <button
            class="msg-reaction-add"
            :class="{ 'is-open': showInlineEmojiPicker }"
            type="button"
            aria-label="Ajouter une réaction"
            aria-haspopup="dialog"
            :aria-expanded="showInlineEmojiPicker"
            title="Ajouter une réaction"
            @click="toggleInlineEmojiPicker"
          >
            <SmilePlus :size="14" aria-hidden="true" />
            <Plus :size="9" class="msg-reaction-add-plus" aria-hidden="true" />
          </button>
          <div v-if="showInlineEmojiPicker" class="msg-reaction-add-picker" @click.stop>
            <EmojiPicker @pick="onInlineEmojiPick" />
          </div>
        </div>
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
      :can-report="canReport"
      :can-dm-author="canDmAuthor"
      :my-reacted-types="myReactedTypes"
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
      @copy-link="copyMessageLink"
      @dm-author="dmAuthor"
      @edit="startEdit"
      @delete="deleteMessage"
      @report="reportMessageFromPill"
      @forward="onForward"
    />

    <!-- Modal "Transferer le message" : ouverte depuis le menu actions. -->
    <ForwardMessageModal
      v-model="showForward"
      :message="msg"
    />

    <!-- Menu contextuel (clic droit) -->
    <ContextMenu
      v-if="ctxVisible"
      :x="ctxX"
      :y="ctxY"
      :items="ctxItems"
      :quick-emojis="ctxQuickEmojiItems"
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
/* Texte complementaire eventuel apres un sondage : compact, sous le bloc */
.msg-text--after-poll {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

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

/* ════════════════════════════════════════════
   BLOCS DE CODE — style GitHub/Notion
════════════════════════════════════════════ */
:deep(.code-block) {
  position: relative;
  margin: 10px 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, .32);
  box-shadow: var(--elevation-1);
}

/* Header : langue a gauche + meta + bouton Copier a droite */
:deep(.code-block-head) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px 5px 14px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  min-height: 28px;
}
:deep(.code-lang) {
  display: inline-block;
  padding: 2px 9px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--accent);
  background: rgba(var(--accent-rgb), .15);
  border: 1px solid rgba(var(--accent-rgb), .3);
  border-radius: 12px;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
}
:deep(.code-lines) {
  font-size: 10.5px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
/* Bouton "Copier" : discret, s'active au hover, feedback "Copie!" quand cliqué */
:deep(.code-copy) {
  margin-left: auto;
  padding: 3px 10px;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out);
}
:deep(.code-copy:hover) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-input);
}
:deep(.code-copy.is-copied) {
  background: rgba(var(--color-success-rgb), .15);
  color: var(--color-success);
  border-color: rgba(var(--color-success-rgb), .4);
}
:deep(.code-copy.is-copied::before) {
  content: 'Copié';
}
:deep(.code-copy.is-copied) {
  font-size: 0;
}
:deep(.code-copy.is-copied::before) {
  font-size: 11px;
}

/* Contenu code : typo mono + scroll horizontal sur long code */
:deep(.code-block pre) {
  margin: 0;
  padding: 12px 16px;
  overflow-x: auto;
  font-size: 12.5px;
  line-height: 1.6;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, Menlo, Consolas, monospace;
  tab-size: 2;
}
/* Scrollbar fine et discrete dans le bloc */
:deep(.code-block pre::-webkit-scrollbar) {
  height: 8px;
}
:deep(.code-block pre::-webkit-scrollbar-track) {
  background: transparent;
}
:deep(.code-block pre::-webkit-scrollbar-thumb) {
  background: rgba(255, 255, 255, .08);
  border-radius: 4px;
}
:deep(.code-block pre::-webkit-scrollbar-thumb:hover) {
  background: rgba(255, 255, 255, .15);
}

/* ════════════════════════════════════════════
   CHECKLISTS GFM (- [ ] / - [x])
════════════════════════════════════════════ */
/* Marked genere :
   <ul><li><input type="checkbox" disabled> Tâche...</li></ul>
   On retire les puces de la liste et on style la checkbox custom.
*/
:deep(.msg-text ul:has(> li > input[type="checkbox"])) {
  list-style: none;
  padding-left: 0;
  margin: 6px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
:deep(.msg-text li:has(> input[type="checkbox"])) {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 3px 6px;
  border-radius: 5px;
  line-height: 1.5;
  transition: background var(--motion-fast) var(--ease-out);
}
:deep(.msg-text li:has(> input[type="checkbox"]):hover) {
  background: rgba(255, 255, 255, .025);
}
:deep(.msg-text input[type="checkbox"]) {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  margin: 3px 0 0;
  flex-shrink: 0;
  background: var(--bg-input);
  border: 1.5px solid var(--border-input);
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  transition:
    background var(--motion-fast) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out),
    transform .1s cubic-bezier(.34, 1.56, .64, 1);
}
:deep(.msg-text input[type="checkbox"]:hover) {
  border-color: var(--color-success);
  transform: scale(1.1);
}
:deep(.msg-text input[type="checkbox"]:checked) {
  background: var(--color-success);
  border-color: var(--color-success);
}
:deep(.msg-text input[type="checkbox"]:checked::after) {
  content: '';
  position: absolute;
  top: 1px;
  left: 4px;
  width: 4px;
  height: 8px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
/* Texte de tache cochee : raye + dim */
:deep(.msg-text li:has(> input[type="checkbox"]:checked)) {
  color: var(--text-muted);
  text-decoration: line-through;
  text-decoration-color: rgba(var(--color-success-rgb), .5);
}

/* ════════════════════════════════════════════
   TABLEAUX MARKDOWN - style Notion / Linear
════════════════════════════════════════════ */
/* Wrapper scroll horizontal sur petit ecran sans deformer la bubble */
:deep(.msg-text table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  margin: 10px 0;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-elevated);
  box-shadow: var(--elevation-1);
  font-variant-numeric: tabular-nums;
  /* tab-size pour code imbrique eventuel */
  tab-size: 2;
}
:deep(.msg-text table thead) {
  background: var(--bg-active);
}
:deep(.msg-text table th),
:deep(.msg-text table td) {
  padding: 8px 14px;
  font-size: 13px;
  line-height: 1.5;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
}
:deep(.msg-text table th:last-child),
:deep(.msg-text table td:last-child) {
  border-right: none;
}
:deep(.msg-text table th) {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-secondary);
  white-space: nowrap;
}
/* Zebra striping pour lisibilite sur tables denses */
:deep(.msg-text table tbody tr:nth-child(even)) {
  background: rgba(255, 255, 255, .015);
}
:deep(.msg-text table tbody tr:hover) {
  background: rgba(var(--accent-rgb), .05);
}
:deep(.msg-text table tbody tr:last-child td) {
  border-bottom: none;
}
/* Code inline dans une cellule : plus discret pour ne pas etouffer */
:deep(.msg-text table code) {
  font-size: .85em;
  padding: 1px 5px;
  color: var(--accent);
  background: rgba(var(--accent-rgb), .1);
  border: 1px solid rgba(var(--accent-rgb), .2);
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
/* ══════════════════════════════════════════════════════════════
   PILL D'ACTIONS — style Slack-like : aere, sobre, sans transform
   ══════════════════════════════════════════════════════════════ */
.msg-action-pill {
  position: absolute;
  top: -18px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity   var(--motion-fast) var(--ease-out),
              transform var(--motion-fast) var(--ease-out);
  transform: translateY(2px);
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--elevation-2);
  padding: 4px;
  z-index: 30;
  isolation: isolate;
}

/* Pill visible au survol OU au focus (a11y clavier). */
.msg-row:hover .msg-action-pill,
.msg-row:focus-within .msg-action-pill {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

/* Boutons icone : 32x32 pour respirer (Slack-like, vs 28x28 Discord-like).
   Pas de scale au hover : Slack reste sobre, juste un changement de fond. */
.pill-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: 7px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: background var(--motion-fast) var(--ease-out),
              color      var(--motion-fast) var(--ease-out);
  padding: 0;
}
.pill-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.pill-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
  color: var(--text-primary);
}
.pill-btn:disabled { opacity: .35; cursor: default; }

/* Chips emoji favoris : meme format carre que les icones pour uniformite,
   avec etat "reacted" accent distinctif (scan rapide de ses reactions). */
.pill-emoji-btn {
  width: 32px;
  height: 32px;
  font-size: 17px;
  border-radius: 7px;
}
.pill-emoji-btn:hover:not(:disabled) {
  background: var(--bg-hover);
}
.pill-emoji-btn--reacted {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
}
.pill-emoji-btn--reacted:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 28%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 60%, transparent);
}

/* Separateur vertical : conserve pour compat, mais plus utilise par defaut
   depuis la refonte Slack (le flux d'icones est volontairement continu). */
.pill-sep {
  display: block;
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 2px;
  flex-shrink: 0;
  opacity: .7;
}

/* Picker complet */
.pill-picker-wrap { position: relative; }
.full-picker-pos {
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  z-index: 40;
}

/* ════════════════════════════════════════════
   MENU ··· (popover) — design Discord/Slack-like
═══════════════════════════════════════════════ */
.pill-menu-wrap { position: relative; }

.msg-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 60;
  min-width: 240px;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow:
    var(--elevation-3),
    0 0 0 1px rgba(255, 255, 255, .02) inset;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  animation: msg-menu-in .14s var(--ease-out);
  transform-origin: top right;
}
@keyframes msg-menu-in {
  from { opacity: 0; transform: translateY(-4px) scale(.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.msg-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  width: 100%;
  text-align: left;
  line-height: 1.2;
  transition:
    background var(--motion-fast) var(--ease-out),
    color      var(--motion-fast) var(--ease-out);
}
/* Icone uniforme 14px, couleur attenuee — prend vie au hover */
.msg-menu-item > svg {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  transition: color var(--motion-fast) var(--ease-out);
}
.msg-menu-item:hover,
.msg-menu-item:focus-visible {
  background: var(--bg-hover);
  color: var(--text-primary);
  outline: none;
}
.msg-menu-item:hover > svg,
.msg-menu-item:focus-visible > svg {
  color: var(--text-primary);
}

/* Etat "coche" (ex. bookmark actif) */
.msg-menu-item--active {
  color: var(--accent);
}
.msg-menu-item--active > svg { color: var(--accent); }
.msg-menu-item--active:hover,
.msg-menu-item--active:focus-visible {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
}
.msg-menu-item--active:hover > svg { color: var(--accent); }

/* Action dangereuse (Supprimer) : isolee visuellement */
.msg-menu-danger { color: var(--color-danger); }
.msg-menu-danger > svg { color: var(--color-danger); }
.msg-menu-danger:hover,
.msg-menu-danger:focus-visible {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger);
}
.msg-menu-danger:hover > svg,
.msg-menu-danger:focus-visible > svg { color: var(--color-danger); }

/* Separateur inline */
.msg-menu-sep {
  height: 1px;
  background: var(--border);
  margin: 4px 6px;
  opacity: .7;
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

/* ── Bouton "+ emoji" inline (ajout rapide, style Slack) ─────────────────
   Apparait a la suite des reactions deja posees. Quasi-invisible au repos
   (bordure pointillee, fond transparent) pour ne pas voler l'attention ;
   se revele au hover. */
.msg-reaction-add-wrap { position: relative; display: inline-flex; }
.msg-reaction-add {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 32px;
  padding: 2px 9px 2px 8px;
  border-radius: 16px;
  background: transparent;
  border: 1px dashed var(--border);
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
  opacity: .55;
  transition:
    background var(--motion-fast) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out),
    color var(--motion-fast) var(--ease-out),
    opacity var(--motion-fast) var(--ease-out),
    transform .15s cubic-bezier(.34, 1.56, .64, 1);
}
.msg-row:hover .msg-reaction-add { opacity: 1; }
.msg-reaction-add:hover,
.msg-reaction-add:focus-visible,
.msg-reaction-add.is-open {
  opacity: 1;
  background: var(--bg-elevated);
  border-style: solid;
  border-color: rgba(var(--accent-rgb), .45);
  color: var(--accent);
  outline: none;
  transform: translateY(-1px) scale(1.04);
  box-shadow: 0 2px 6px rgba(0, 0, 0, .18);
}
.msg-reaction-add-plus {
  /* Petit "+" dans une pastille, comme dans Slack */
  background: var(--bg-hover);
  border-radius: 50%;
  padding: 1px;
  color: var(--text-muted);
  transition: background var(--motion-fast) var(--ease-out), color var(--motion-fast) var(--ease-out);
}
.msg-reaction-add:hover .msg-reaction-add-plus,
.msg-reaction-add:focus-visible .msg-reaction-add-plus,
.msg-reaction-add.is-open .msg-reaction-add-plus {
  background: var(--accent);
  color: #fff;
}

/* Picker positionne au-dessus du bouton — evite le chevauchement du texte
   du message suivant (empeche aussi le picker d'etre coupe en bas d'ecran). */
.msg-reaction-add-picker {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 40;
}

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
.pill-bookmarked:hover {
  background: color-mix(in srgb, var(--color-warning) 12%, transparent) !important;
}

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
  .msg-reaction-add:hover,
  .msg-reaction-add:focus-visible,
  .msg-reaction-add.is-open { transform: none !important; }
}

/* Les styles du lightbox et de la modale de signalement ont ete deplaces
   dans MessageLightbox.vue et MessageReportDialog.vue respectivement (v2.229.0). */
</style>
