<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Send, Paperclip, Loader2, X as XIcon, Reply, Bold, Italic, Code, SquareCode, Strikethrough, Quote, List, ListOrdered, Smile, Eye, EyeOff, Pen } from 'lucide-vue-next'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import { usePrefs }         from '@/composables/usePrefs'
import { avatarColor, initials } from '@/utils/format'

import { useMsgDraft }        from '@/composables/useMsgDraft'
import { useMsgAutocomplete, COMMAND_CATEGORIES, type SlashCommand } from '@/composables/useMsgAutocomplete'
import {
  BookOpen, FileText, Bell, Megaphone, BarChart2 as BarChart2Icon, Table, Code2, HelpCircle, Calendar, Minus,
} from 'lucide-vue-next'

const CMD_ICONS: Record<string, object> = {
  BookOpen, FileText, Bell, Megaphone, BarChart2: BarChart2Icon, Table, Code2, HelpCircle, Calendar, Minus,
}
import { useMsgAttachment }   from '@/composables/useMsgAttachment'
import { useMsgSend }         from '@/composables/useMsgSend'
import { useMsgFormatting }   from '@/composables/useMsgFormatting'
import { useModules }         from '@/composables/useModules'
import { ROLE_LABELS }        from '@/constants'
import type { RefChannel, RefDevoir, RefDoc } from '@/composables/useMsgAutocomplete'

const appStore      = useAppStore()
const messagesStore = useMessagesStore()
const { getPref }   = usePrefs()
const { isEnabled: moduleEnabled } = useModules()

const inputEl = ref<HTMLTextAreaElement | null>(null)
const content = ref('')
const showEmojiPicker = ref(false)
const requestSignature = ref(false)

// Detecter si le contenu contient un fichier attache (pour afficher le toggle signature)
const hasFileAttachment = computed(() => content.value.includes('📎'))
const isDm = computed(() => !!appStore.activeDmStudentId)
const showSignatureToggle = computed(() => moduleEnabled('signatures') && isDm.value && hasFileAttachment.value && !appStore.isTeacher)

defineExpose({ requestSignature })

// ── Auto-resize textarea ──────────────────────────────────────────────────
function autoResize() {
  if (!inputEl.value) return
  inputEl.value.style.height = 'auto'
  inputEl.value.style.height = inputEl.value.scrollHeight + 'px'
}

// ── Placeholder ───────────────────────────────────────────────────────────
const placeholder = computed(() => {
  if (appStore.activeChannelArchived) return 'Canal archive - lecture seule'
  if (appStore.isReadonly) return 'Canal d\'annonces - lecture seule'
  if (appStore.activeDmStudentId) return `Message à ${appStore.activeChannelName}`
  if (appStore.activeChannelName) return `Message dans #${appStore.activeChannelName}`
  return 'Écrivez un message…'
})

// ── Composables ───────────────────────────────────────────────────────────
const { showPreview, previewHtml, clearDraft, scheduleDraftSave } =
  useMsgDraft(content, inputEl, autoResize)

const {
  mentionActive, mentionResults, mentionIndex, mentionPopupEl,
  insertMention, closeMention,
  activeRef, refResults, refIndex, insertRef,
  wrapperEl, popupStyle,
  detectTriggers, scrollMentionIntoView,
  triggerMention, triggerChannel, triggerDevoir, executeCommand, dismissAll,
} = useMsgAutocomplete(content, inputEl, autoResize)

const { attaching, attachFile, uploadProgress } = useMsgAttachment(content, inputEl, autoResize)

const {
  sending, everyoneWarning, isOfflineOrDisconnected,
  charCount, showCharCount, charCountOver,
  send, cancelEveryone, emitTyping,
} = useMsgSend(content, inputEl, clearDraft, closeMention, async (sentContent: string) => {
  // Creer une signature request si le toggle est actif
  if (requestSignature.value && appStore.activeDmStudentId) {
    const fileMatch = sentContent.match(/\[📎\s*([^\]]+)\]\(([^)#]+)/)
    if (fileMatch) {
      const fileName = fileMatch[1].trim()
      const fileUrl = fileMatch[2]
      // On a besoin du message_id — on prend le dernier message envoye
      const lastMsg = messagesStore.messages[messagesStore.messages.length - 1]
      if (lastMsg) {
        await window.api.createSignatureRequest({
          message_id: lastMsg.id,
          dm_student_id: appStore.activeDmStudentId,
          file_url: fileUrl,
          file_name: fileName,
        })
      }
    }
    requestSignature.value = false
  }
})

const { fmtWrap, fmtLinePrefix, fmtInsertBlock } =
  useMsgFormatting(content, inputEl, autoResize)

// ── Input handler ─────────────────────────────────────────────────────────
function onInput() {
  autoResize()
  emitTyping()
  detectTriggers()
  scheduleDraftSave()
}

function onBlur() {
  setTimeout(() => { dismissAll() }, 200)
}

// ── Channel change: dismiss autocomplete ──────────────────────────────────
watch(
  () => [appStore.activeChannelId, appStore.activeDmStudentId],
  () => { mentionActive.value = false },
)

// ── Keydown handler ───────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (mentionActive.value && mentionResults.value.length) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mentionIndex.value = (mentionIndex.value + 1) % mentionResults.value.length
      scrollMentionIntoView()
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      mentionIndex.value = (mentionIndex.value - 1 + mentionResults.value.length) % mentionResults.value.length
      scrollMentionIntoView()
      return
    }
    if (e.key === 'Enter') { e.preventDefault(); insertMention(mentionResults.value[mentionIndex.value].name); return }
    if (e.key === 'Escape') { closeMention(); e.preventDefault(); return }
  }

  if (activeRef.value && refResults.value.length) {
    if (e.key === 'ArrowDown') { e.preventDefault(); refIndex.value = (refIndex.value + 1) % refResults.value.length; return }
    if (e.key === 'ArrowUp')   { e.preventDefault(); refIndex.value = (refIndex.value - 1 + refResults.value.length) % refResults.value.length; return }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = refResults.value[refIndex.value]
      if (activeRef.value === 'command') executeCommand(item as SlashCommand)
      else if (activeRef.value === 'channel') insertRef('#' + (item as { name: string }).name)
      else if (activeRef.value === 'devoir') insertRef('\\[' + (item as RefDevoir).title + '](devoir:' + (item as RefDevoir).id + ')')
      else if (activeRef.value === 'doc') insertRef('📄 [' + (item as RefDoc).name + '](doc:' + (item as RefDoc).id + ')')
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); activeRef.value = null; return }
  }

  if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
    if (e.key === 'b') { e.preventDefault(); fmtWrap('**', '**'); return }
    if (e.key === 'i') { e.preventDefault(); fmtWrap('*', '*'); return }
    if (e.key === 'e') { e.preventDefault(); fmtWrap('`', '`'); return }
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
    if (e.key === 'X' || e.key === 'x') { e.preventDefault(); fmtWrap('~~', '~~'); return }
    if (e.key === 'C' || e.key === 'c') { e.preventDefault(); fmtInsertBlock(); return }
    if (e.key === '>' || e.key === '.') { e.preventDefault(); fmtLinePrefix('> '); return }
  }

  const enterSendPref = getPref('enterToSend') ?? true
  const shouldSend = enterSendPref
    ? (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey)
    : (e.key === 'Enter' && (e.ctrlKey || e.metaKey))

  if (shouldSend) { e.preventDefault(); send() }
  if (e.key === 'Escape' && mentionActive.value) { closeMention(); e.preventDefault() }
}
</script>

<template>
  <div id="message-input-area" class="message-input-area" :class="{ readonly: appStore.isReadonly }">
    <template v-if="!appStore.isReadonly">

      <!-- Indicateur de frappe -->
      <div class="mi-typing" aria-live="polite">
        <span v-if="messagesStore.typingText" class="mi-typing-text">
          {{ messagesStore.typingText }}
        </span>
      </div>

      <!-- Prévisualisation de la citation -->
      <Transition name="quote-slide">
        <div v-if="messagesStore.quotedMessage" class="mi-quote-preview">
          <Reply :size="13" class="mi-quote-icon" />
          <div class="mi-quote-body">
            <span class="mi-quote-author">{{ messagesStore.quotedMessage.author_name }}</span>
            <span class="mi-quote-text">{{ messagesStore.quotedMessage.content.slice(0, 100) }}</span>
          </div>
          <button class="btn-icon mi-quote-close" aria-label="Annuler la citation" @click="messagesStore.clearQuote()">
            <XIcon :size="13" />
          </button>
        </div>
      </Transition>

      <!-- Avertissement @everyone -->
      <Transition name="mention-pop">
        <div v-if="everyoneWarning" class="mi-everyone-warn">
          <span>Ce message mentionne <strong>@everyone</strong> et notifiera tous les membres du canal.</span>
          <div class="mi-everyone-actions">
            <button class="mi-everyone-btn mi-everyone-cancel" @click="cancelEveryone">Retirer</button>
            <button class="mi-everyone-btn mi-everyone-confirm" @click="send">Envoyer quand même</button>
          </div>
        </div>
      </Transition>

      <!-- Carte principale de saisie -->
      <div id="message-input-wrapper" ref="wrapperEl" class="message-input-wrapper">

        <!-- Popup autocomplete mentions (teleporté pour échapper overflow:hidden) -->
        <Teleport to="body">
        <Transition name="mention-pop">
          <div
            v-if="mentionActive && mentionResults.length"
            ref="mentionPopupEl"
            class="mi-mention-popup"
            :style="popupStyle"
            role="listbox"
            aria-label="Mentions"
          >
            <div class="mi-mention-header">Membres</div>
            <button
              v-for="(user, i) in mentionResults"
              :key="user.name"
              class="mi-mention-item"
              :class="{
                'mi-mention-everyone': user.name === 'everyone',
                'mi-mention-selected': i === mentionIndex,
              }"
              role="option"
              :aria-selected="i === mentionIndex"
              @mousedown.prevent="insertMention(user.name)"
              @mouseenter="mentionIndex = i"
            >
              <div
                class="mi-mention-avatar"
                :class="{ 'mi-mention-avatar-everyone': user.name === 'everyone' }"
                :style="user.name !== 'everyone' ? { background: avatarColor(user.name) } : {}"
              >
                {{ user.name === 'everyone' ? '✦' : initials(user.name) }}
              </div>
              <span class="mi-mention-name">{{ user.name }}</span>
              <span v-if="user.name === 'everyone'" class="mi-mention-hint">Notifie tout le monde</span>
              <span v-else-if="user.type === 'admin'" class="mi-mention-badge mi-badge-teacher">{{ ROLE_LABELS.admin }}</span>
              <span v-else-if="user.type === 'teacher'" class="mi-mention-badge mi-badge-teacher">{{ ROLE_LABELS.teacher }}</span>
              <span v-else-if="user.type === 'ta'" class="mi-mention-badge mi-badge-ta">{{ ROLE_LABELS.ta }}</span>
            </button>
          </div>
        </Transition>
        </Teleport>

        <!-- Popup autocomplete #canal, /devoir, /doc -->
        <Teleport to="body">
        <Transition name="mention-pop">
          <div
            v-if="activeRef && refResults.length"
            class="mi-mention-popup"
            :style="popupStyle"
            role="listbox"
            :aria-label="activeRef === 'command' ? 'Commandes' : activeRef === 'channel' ? 'Canaux' : activeRef === 'devoir' ? 'Devoirs' : 'Documents'"
          >
            <div class="mi-mention-header">
              {{ activeRef === 'command' ? 'Commandes' : activeRef === 'channel' ? 'Canaux' : activeRef === 'devoir' ? 'Devoirs' : 'Documents' }}
            </div>
            <!-- Commandes slash -->
            <template v-if="activeRef === 'command'">
              <template v-for="cat in ['ref', 'format', 'util']" :key="cat">
                <div
                  v-if="(refResults as SlashCommand[]).filter(c => c.category === cat).length"
                  class="mi-cmd-cat"
                >{{ COMMAND_CATEGORIES[cat] }}</div>
                <button
                  v-for="(cmd, i) in refResults"
                  :key="(cmd as SlashCommand).name + cat"
                  v-show="(cmd as SlashCommand).category === cat"
                  class="mi-mention-item mi-cmd-item"
                  :class="{ 'mi-mention-selected': i === refIndex }"
                  @mousedown.prevent="executeCommand(cmd as SlashCommand)"
                  @mouseenter="refIndex = i"
                >
                  <span class="mi-cmd-icon" :style="{ background: (cmd as SlashCommand).color + '18', color: (cmd as SlashCommand).color }">
                    <component :is="CMD_ICONS[(cmd as SlashCommand).icon]" :size="14" />
                  </span>
                  <div class="mi-cmd-body">
                    <span class="mi-cmd-name">/{{ (cmd as SlashCommand).name }}</span>
                    <span class="mi-cmd-desc">{{ (cmd as SlashCommand).description }}</span>
                  </div>
                  <span class="mi-cmd-shortcut">↵</span>
                </button>
              </template>
            </template>
            <template v-else-if="activeRef === 'channel'">
              <button
                v-for="(ch, i) in refResults"
                :key="(ch as RefChannel).name"
                class="mi-mention-item"
                :class="{ 'mi-mention-selected': i === refIndex }"
                @mousedown.prevent="insertRef('#' + (ch as RefChannel).name)"
                @mouseenter="refIndex = i"
              >
                <span class="mi-ref-icon">#</span>
                <span class="mi-mention-name">{{ (ch as RefChannel).name }}</span>
                <span v-if="(ch as RefChannel).type === 'annonce'" class="mi-mention-badge" style="background:rgba(243,156,18,.2);color:#e67e22">Annonce</span>
              </button>
            </template>
            <template v-else-if="activeRef === 'devoir'">
              <button
                v-for="(d, i) in refResults"
                :key="(d as RefDevoir).title"
                class="mi-mention-item"
                :class="{ 'mi-mention-selected': i === refIndex }"
                @mousedown.prevent="insertRef('\\[' + (d as RefDevoir).title + '](devoir:' + (d as RefDevoir).id + ')')"
                @mouseenter="refIndex = i"
              >
                <span class="mi-ref-icon">\</span>
                <span class="mi-mention-name">{{ (d as RefDevoir).title }}</span>
              </button>
            </template>
            <template v-else-if="activeRef === 'doc'">
              <button
                v-for="(d, i) in refResults"
                :key="(d as RefDoc).name"
                class="mi-mention-item"
                :class="{ 'mi-mention-selected': i === refIndex }"
                @mousedown.prevent="insertRef('📄 [' + (d as RefDoc).name + '](doc:' + (d as RefDoc).id + ')')"
                @mouseenter="refIndex = i"
              >
                <span class="mi-ref-icon">📄</span>
                <span class="mi-mention-name">{{ (d as RefDoc).name }}</span>
                <span v-if="(d as RefDoc).category" class="mi-mention-hint">{{ (d as RefDoc).category }}</span>
              </button>
            </template>
          </div>
        </Transition>
        </Teleport>

        <!-- Zone textarea / preview -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-if="showPreview && content.trim()" class="mi-preview msg-text" v-html="previewHtml" />
        <textarea
          v-else
          id="message-input"
          ref="inputEl"
          v-model="content"
          class="message-input"
          :placeholder="placeholder"
          aria-label="Écrire un message"
          rows="1"
          @input="onInput"
          @keydown="onKeydown"
          @blur="onBlur"
        />

        <!-- Barre de progression upload -->
        <div v-if="uploadProgress !== null" class="msg-upload-bar">
          <div class="msg-upload-fill" :style="{ width: uploadProgress + '%' }" />
        </div>

        <!-- Barre d'actions bas -->
        <div class="mi-actions-row">
          <!-- Boutons de formatage -->
          <div class="mi-fmt-group" role="toolbar" aria-label="Mise en forme">
            <button class="mi-fmt-btn" title="Gras (Ctrl+B)" aria-label="Gras" @mousedown.prevent="fmtWrap('**', '**')">
              <Bold :size="13" />
            </button>
            <button class="mi-fmt-btn" title="Italique (Ctrl+I)" aria-label="Italique" @mousedown.prevent="fmtWrap('*', '*')">
              <Italic :size="13" />
            </button>
            <button class="mi-fmt-btn" title="Code inline" aria-label="Code inline" @mousedown.prevent="fmtWrap('`', '`')">
              <Code :size="13" />
            </button>
            <button class="mi-fmt-btn" title="Bloc de code (Ctrl+Shift+C)" aria-label="Bloc de code" @mousedown.prevent="fmtInsertBlock">
              <SquareCode :size="13" />
            </button>
            <button class="mi-fmt-btn" title="Barré (Ctrl+Shift+X)" aria-label="Barré" @mousedown.prevent="fmtWrap('~~', '~~')">
              <Strikethrough :size="13" />
            </button>

            <div class="mi-fmt-divider" />

            <button class="mi-fmt-btn" title="Citation (Ctrl+Shift+.)" aria-label="Citation" @mousedown.prevent="fmtLinePrefix('> ')">
              <Quote :size="13" />
            </button>
            <button class="mi-fmt-btn" title="Liste à puces" aria-label="Liste à puces" @mousedown.prevent="fmtLinePrefix('- ')">
              <List :size="13" />
            </button>
            <button class="mi-fmt-btn" title="Liste numérotée" aria-label="Liste numérotée" @mousedown.prevent="fmtLinePrefix('1. ')">
              <ListOrdered :size="13" />
            </button>

            <div class="mi-fmt-divider" />

            <!-- Mention rapide -->
            <button
              class="mi-fmt-btn mi-fmt-mention"
              title="Mentionner quelqu'un"
              aria-label="Mentionner"
              @mousedown.prevent="triggerMention"
            >@</button>
            <button
              class="mi-fmt-btn mi-fmt-mention"
              title="Référencer un canal"
              aria-label="Canal"
              @mousedown.prevent="triggerChannel"
            >#</button>
            <button
              class="mi-fmt-btn mi-fmt-mention"
              title="Référencer un devoir"
              aria-label="Devoir"
              @mousedown.prevent="triggerDevoir"
            >\</button>
          </div>

          <!-- Actions droite -->
          <div class="mi-actions-right">
            <!-- Emoji picker inline -->
            <div class="mi-emoji-wrapper">
              <button
                class="mi-icon-btn"
                title="Insérer un emoji"
                aria-label="Emoji"
                @click="showEmojiPicker = !showEmojiPicker"
              >
                <Smile :size="14" />
              </button>
              <div v-if="showEmojiPicker" class="mi-emoji-panel">
                <button
                  v-for="e in ['😊','😂','🤣','😍','🤔','😮','😢','👍','👏','🔥','❤️','✅','🎉','💯','🙏','👋','⭐','💡','🎯','⚡']"
                  :key="e"
                  class="mi-emoji-btn"
                  @mousedown.prevent="content += e; showEmojiPicker = false; inputEl?.focus()"
                >{{ e }}</button>
              </div>
            </div>

            <!-- Aperçu markdown -->
            <button
              class="mi-icon-btn"
              :class="{ active: showPreview }"
              :title="showPreview ? 'Modifier' : 'Aperçu du message'"
              aria-label="Aperçu"
              @click="showPreview = !showPreview"
            >
              <EyeOff v-if="showPreview" :size="14" />
              <Eye v-else :size="14" />
            </button>

            <button
              class="mi-icon-btn"
              :class="{ attaching }"
              title="Joindre un fichier"
              aria-label="Joindre un fichier"
              :disabled="attaching"
              @click="attachFile"
            >
              <Loader2 v-if="attaching" :size="14" class="mi-spinner" />
              <Paperclip v-else :size="14" />
            </button>

            <span v-if="showCharCount" class="mi-char-count" :class="{ over: charCountOver }">
              {{ charCount }}/{{ messagesStore.MAX_MESSAGE_LENGTH }}
            </span>
            <button
              id="btn-send"
              class="mi-send-btn"
              :disabled="!content.trim() || sending || isOfflineOrDisconnected || charCountOver"
              :title="isOfflineOrDisconnected ? 'Vous êtes hors ligne' : charCountOver ? 'Message trop long' : 'Envoyer (Entrée)'"
              aria-label="Envoyer le message (Entrée)"
              @click="send"
            >
              <Loader2 v-if="sending" :size="14" class="mi-spinner" />
              <Send v-else :size="14" />
              <span class="mi-send-label">Envoyer</span>
            </button>
          </div>
        </div>

      </div>

      <div class="mi-hint-row">
        <p class="mi-hint">
          <template v-if="getPref('enterToSend') ?? true">
            <kbd>Entrée</kbd> envoyer · <kbd>Shift+Entrée</kbd> saut de ligne
          </template>
          <template v-else>
            <kbd>Ctrl+Entrée</kbd> envoyer · <kbd>Entrée</kbd> saut de ligne
          </template>
        </p>
        <button v-if="showSignatureToggle" class="mi-sig-link" :class="{ active: requestSignature }" @click="requestSignature = !requestSignature">
          <Pen :size="10" />
          {{ requestSignature ? 'Signature demandee ✓' : 'Demander une signature' }}
        </button>
      </div>

    </template>

    <p v-else class="readonly-notice">Canal d'annonces - seuls les responsables peuvent publier ici.</p>
  </div>
</template>

<style scoped>
/* ── Indicateur de frappe ── */
.mi-typing {
  min-height: 18px;
  padding: 0 4px 2px 4px;
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}
.mi-typing-text::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  margin-right: 5px;
  vertical-align: middle;
  animation: mi-pulse 1.4s ease-in-out infinite;
}

/* ── Prévisualisation citation ── */
.mi-quote-preview {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 12px;
  margin: 0 0 4px;
  background: rgba(74, 144, 217, .07);
  border-left: 3px solid var(--accent);
  border-radius: 0 6px 6px 0;
}
.mi-quote-icon { color: var(--accent); flex-shrink: 0; margin-top: 2px; }
.mi-quote-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.mi-quote-author {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-light, #7db8f0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mi-quote-text {
  font-size: 11.5px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mi-quote-close {
  flex-shrink: 0;
  padding: 3px;
  opacity: .6;
  transition: opacity var(--t-fast);
}
.mi-quote-close:hover { opacity: 1; }

/* Transition quote */
.quote-slide-enter-active,
.quote-slide-leave-active { transition: all .15s ease; }
.quote-slide-enter-from,
.quote-slide-leave-to     { opacity: 0; transform: translateY(-4px); max-height: 0; }

/* ── Popup autocomplete mention ── */
/* ── Avertissement @everyone ── */
.mi-everyone-warn {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 8px 14px; margin-bottom: 6px;
  background: rgba(243,156,18,.1); border: 1px solid rgba(243,156,18,.25);
  border-radius: var(--radius-sm); font-size: 12.5px; color: var(--color-warning);
}
.mi-everyone-actions { display: flex; gap: 6px; flex-shrink: 0; }
.mi-everyone-btn {
  padding: 4px 12px; border: none; border-radius: 6px; font-size: 12px;
  font-weight: 600; cursor: pointer; font-family: var(--font);
}
.mi-everyone-cancel { background: var(--bg-active); color: var(--text-secondary); }
.mi-everyone-cancel:hover { background: var(--bg-active); }
.mi-everyone-confirm { background: var(--color-warning); color: #fff; }
.mi-everyone-confirm:hover { filter: brightness(1.1); }

.message-input-wrapper { position: relative; }

.mi-mention-popup {
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 -8px 28px rgba(0, 0, 0, .45);
  overflow: hidden;
  max-height: 300px;
  overflow-y: auto;
}

.mi-mention-header {
  padding: 6px 14px 5px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  user-select: none;
}

.mi-mention-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: var(--font);
  font-size: 13.5px;
  color: var(--text-secondary);
  text-align: left;
  transition: background .08s;
}
.mi-mention-item:hover,
.mi-mention-item.mi-mention-selected {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.mi-mention-avatar {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -.3px;
  user-select: none;
}
.mi-mention-avatar-everyone {
  background: linear-gradient(135deg, #e74c3c, #c0392b) !important;
  font-size: 12px;
}
.mi-mention-name {
  flex: 1;
  font-weight: 500;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mi-mention-everyone .mi-mention-name {
  color: var(--color-danger, #e74c3c);
  font-weight: 700;
}
.mi-mention-hint {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--text-muted);
  font-style: italic;
  white-space: nowrap;
  flex-shrink: 0;
}
.mi-mention-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .4px;
  padding: 1px 6px;
  border-radius: 10px;
  flex-shrink: 0;
  white-space: nowrap;
}
.mi-badge-teacher { background: rgba(123, 104, 238, .2); color: var(--color-cctl); }
.mi-badge-ta      { background: rgba(39, 174, 96, .2); color: var(--color-success); }

/* Transition popup mention */
.mention-pop-enter-active { transition: opacity .1s ease, transform .1s ease; }
.mention-pop-leave-active { transition: opacity .08s ease, transform .08s ease; }
.mention-pop-enter-from,
.mention-pop-leave-to     { opacity: 0; transform: translateY(4px); }

/* ── Barre d'actions bas ── */
.mi-actions-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px 4px 10px;
  border-top: 1px solid var(--border);
  margin-top: 2px;
}

/* Groupe de boutons de formatage */
.mi-fmt-group {
  display: flex;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
}

.mi-fmt-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: 5px;
  cursor: pointer;
  color: var(--text-muted);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 700;
  transition: background .1s, color .1s;
  flex-shrink: 0;
}
.mi-fmt-btn:hover {
  background: var(--bg-active);
  color: var(--text-secondary);
}

.mi-fmt-mention {
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -.5px;
}

.mi-fmt-divider {
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 3px;
  flex-shrink: 0;
}

/* ── Preview markdown ── */
.mi-preview {
  padding: 10px 14px;
  min-height: 42px;
  max-height: 200px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  background: rgba(74,144,217,.04);
  border-top: 1px dashed rgba(74,144,217,.2);
}

/* ── Emoji picker ── */
.mi-emoji-wrapper {
  position: relative;
}
.mi-emoji-panel {
  position: absolute;
  bottom: 32px;
  right: 0;
  background: var(--bg-modal);
  border: 1px solid var(--border-input);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,.5);
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 2px;
  z-index: 500;
  width: 210px;
}
.mi-emoji-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  transition: background .1s, transform .1s;
}
.mi-emoji-btn:hover {
  background: var(--bg-hover);
  transform: scale(1.15);
}

/* Actions droite */
.mi-actions-right {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  flex-shrink: 0;
}

.mi-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-muted);
  transition: background .1s, color .1s;
}
.mi-icon-btn:hover:not(:disabled) {
  background: var(--bg-active);
  color: var(--text-secondary);
}
.mi-icon-btn:disabled { opacity: .4; cursor: not-allowed; }
.mi-icon-btn.active { color: var(--accent); background: rgba(59,130,246,.1); }

/* Bouton Envoyer */
.mi-char-count {
  font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums;
  padding: 0 4px;
}
.mi-char-count.over { color: #f87171; font-weight: 600; }
.mi-send-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 13px 5px 10px;
  border: none;
  border-radius: 7px;
  background: var(--accent, #4a90d9);
  color: #fff;
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity .15s, background .15s, transform .12s;
  white-space: nowrap;
}
.mi-send-btn:not(:disabled):hover {
  background: var(--accent-hover, #5a9fe6);
  transform: scale(1.02);
}
.mi-send-btn:disabled {
  opacity: .38;
  cursor: not-allowed;
  transform: none;
}
.mi-send-label {
  line-height: 1;
}

/* ── Hint clavier ── */
.mi-hint-row { display: flex; align-items: center; justify-content: space-between; margin: 4px 2px 0; }
.mi-hint {
  font-size: 10.5px;
  color: var(--text-muted);
  opacity: .7;
  user-select: none;
  margin: 0;
}
.mi-sig-link {
  display: flex; align-items: center; gap: 4px;
  font-size: 10.5px; font-weight: 500; color: var(--text-muted);
  background: none; border: none; cursor: pointer;
  font-family: inherit; padding: 2px 6px; border-radius: 4px;
  transition: color .12s, background .12s;
}
.mi-sig-link:hover { color: var(--text-secondary); background: var(--bg-hover); }
.mi-sig-link.active { color: var(--color-success, #059669); font-weight: 600; }
.mi-hint kbd {
  font-family: var(--font);
  font-size: 10.5px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 4px;
}

/* ── Spinner ── */
@keyframes mi-spin { to { transform: rotate(360deg); } }
.mi-spinner { animation: mi-spin .65s linear infinite; flex-shrink: 0; }

@keyframes mi-pulse {
  0%, 100% { opacity: .4; transform: scale(.85); }
  50%       { opacity: 1;  transform: scale(1.1); }
}

/* ── Commandes slash ── */
.mi-cmd-cat {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .5px; color: var(--text-muted);
  padding: 8px 12px 4px; opacity: .7;
}
.mi-cmd-item {
  display: flex !important; flex-direction: row !important;
  align-items: center !important; gap: 10px !important;
  padding: 7px 12px !important;
}
.mi-cmd-icon {
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: transform .15s;
}
.mi-cmd-item:hover .mi-cmd-icon { transform: scale(1.1); }
.mi-cmd-body { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.mi-cmd-name {
  font-size: 13px; font-weight: 600; color: var(--text-primary);
  font-family: 'Fira Code', 'Consolas', monospace;
}
.mi-cmd-desc {
  font-size: 11px; color: var(--text-muted); line-height: 1.2;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mi-cmd-shortcut {
  font-size: 10px; color: var(--text-muted); opacity: .4;
  background: var(--bg-hover); padding: 2px 6px;
  border-radius: 4px; flex-shrink: 0;
}
.mi-mention-selected .mi-cmd-name { color: #fff; }
.mi-mention-selected .mi-cmd-desc { color: rgba(255,255,255,.6); }
.mi-mention-selected .mi-cmd-icon { background: var(--bg-active) !important; color: #fff !important; }
.mi-mention-selected .mi-cmd-shortcut { background: var(--bg-active); color: rgba(255,255,255,.7); opacity: 1; }
</style>
