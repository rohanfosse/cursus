<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Loader2, X as XIcon, Reply, Pen } from 'lucide-vue-next'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import { usePrefs }         from '@/composables/usePrefs'
import { avatarColor, initials } from '@/utils/format'

import { useMsgDraft }        from '@/composables/useMsgDraft'
import { useMsgAutocomplete, COMMAND_CATEGORIES, type SlashCommand } from '@/composables/useMsgAutocomplete'
import type { EmojiShortcode } from '@/utils/emojiShortcodes'
import { useModalsStore }    from '@/stores/modals'
import {
  BookOpen, FileText, Bell, Megaphone, BarChart2 as BarChart2Icon, Table, Code2, HelpCircle, Calendar, Minus,
} from 'lucide-vue-next'

const CMD_ICONS: Record<string, object> = {
  BookOpen, FileText, Bell, Megaphone, BarChart2: BarChart2Icon, Table, Code2, HelpCircle, Calendar, Minus,
}
import { useMsgAttachment }   from '@/composables/useMsgAttachment'
import { useMsgSend }         from '@/composables/useMsgSend'
import { useMsgFormatting }   from '@/composables/useMsgFormatting'
import MessageInputToolbar   from './MessageInputToolbar.vue'
import CreatePollModal       from '@/components/modals/CreatePollModal.vue'
import CreateTableModal      from '@/components/modals/CreateTableModal.vue'
import CreateCodeModal       from '@/components/modals/CreateCodeModal.vue'
import CreateAnnounceModal   from '@/components/modals/CreateAnnounceModal.vue'
import HelpModal             from '@/components/modals/HelpModal.vue'
import ScheduleMessageModal  from '@/components/modals/ScheduleMessageModal.vue'
import ScheduledMessagesModal from '@/components/modals/ScheduledMessagesModal.vue'
import { Clock } from 'lucide-vue-next'
import { useScheduledStore } from '@/stores/scheduled'
import { useModules }         from '@/composables/useModules'
import { ROLE_LABELS }        from '@/constants'
import type { RefChannel, RefDevoir, RefDoc } from '@/composables/useMsgAutocomplete'

const appStore      = useAppStore()
const messagesStore = useMessagesStore()
const modals        = useModalsStore()
const { getPref }   = usePrefs()
const { isEnabled: moduleEnabled } = useModules()

const inputEl = ref<HTMLTextAreaElement | null>(null)
const content = ref('')
const requestSignature = ref(false)
const showScheduleModal = ref(false)
const showScheduledListModal = ref(false)

// Banner rappel : messages programmes pour le canal / DM courant
const scheduledStore = useScheduledStore()
const scheduledHereCount = computed(() => scheduledStore.countForContext({
  channelId: appStore.activeChannelId,
  dmStudentId: appStore.activeDmStudentId,
}))

// Detecter si le contenu contient un fichier attache (pour afficher le toggle signature)
const hasFileAttachment = computed(() => content.value.includes('📎'))
const isDm = computed(() => !!appStore.activeDmStudentId)
const showSignatureToggle = computed(() => moduleEnabled('signatures') && isDm.value && hasFileAttachment.value && !appStore.isTeacher)

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
} = useMsgAutocomplete(content, inputEl, autoResize, {
  onOpenPoll:     () => { modals.createPoll = true },
  onOpenHelp:     () => { modals.help = true },
  onOpenTable:    () => { modals.createTable = true },
  onOpenCode:     () => { modals.createCode = true },
  onOpenAnnounce: () => { modals.createAnnounce = true },
})

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

// ── /sondage submit: remplir le champ + envoyer immediatement ─────────────
async function onPollSubmit(payload: { content: string }) {
  if (appStore.isReadonly) return
  // On met le contenu poll dans le champ puis on declenche le flow send() standard.
  content.value = payload.content
  await nextTick()
  await send()
}

// ── Insertion d'un bloc markdown au curseur (tableau, code, ...) ─────────
// Factorise la logique entre /tableau et /code : isole le bloc avec une
// ligne vide avant/apres pour que le moteur markdown le detecte comme un
// vrai bloc (certains renderers sont stricts la-dessus).
async function insertBlockAtCursor(md: string) {
  const el = inputEl.value
  if (!el) { content.value = content.value + '\n' + md + '\n'; return }
  const pos = el.selectionStart ?? content.value.length
  const before = content.value.slice(0, pos)
  const after  = content.value.slice(pos)
  const needsNewlineBefore = before.length > 0 && !before.endsWith('\n')
  const needsNewlineAfter  = after.length > 0 && !after.startsWith('\n')
  const insertion = (needsNewlineBefore ? '\n' : '')
    + md
    + (needsNewlineAfter ? '\n' : '')
  content.value = before + insertion + after
  await nextTick()
  autoResize()
  const newPos = before.length + insertion.length
  el.focus()
  el.setSelectionRange(newPos, newPos)
}
function onTableSubmit(p:    { markdown: string }) { insertBlockAtCursor(p.markdown) }
function onCodeSubmit(p:     { markdown: string }) { insertBlockAtCursor(p.markdown) }
function onAnnounceSubmit(p: { markdown: string }) { insertBlockAtCursor(p.markdown) }

/** Insere + envoie directement : 1 clic de moins quand le bloc est auto-
 *  suffisant (tableau, bloc de code) et n'a pas besoin de texte autour. */
async function insertBlockAndSend(md: string) {
  if (appStore.isReadonly) return
  await insertBlockAtCursor(md)
  await send()
}
function onTableSubmitSend(p: { markdown: string }) { insertBlockAndSend(p.markdown) }
function onCodeSubmitSend(p:  { markdown: string }) { insertBlockAndSend(p.markdown) }

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
      else if (activeRef.value === 'emoji') insertRef((item as EmojiShortcode).emoji)
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

      <!-- Banner : messages programmes dans ce canal/DM (style Slack) -->
      <Transition name="sched-banner">
        <button
          v-if="scheduledHereCount > 0"
          class="mi-scheduled-banner"
          :aria-label="`${scheduledHereCount} message(s) programme(s) ici`"
          @click="showScheduledListModal = true"
        >
          <Clock :size="13" />
          <span class="mi-scheduled-text">
            Vous avez <strong>{{ scheduledHereCount }}</strong>
            {{ scheduledHereCount > 1 ? 'messages programmés' : 'message programmé' }} ici.
          </span>
          <span class="mi-scheduled-action">Voir les messages programmés</span>
        </button>
      </Transition>

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

        <!-- Popup autocomplete #canal, /devoir, /doc, :emoji -->
        <Teleport to="body">
        <Transition name="mention-pop">
          <div
            v-if="activeRef && refResults.length"
            class="mi-mention-popup"
            :style="popupStyle"
            role="listbox"
            :aria-label="activeRef === 'command' ? 'Commandes' : activeRef === 'channel' ? 'Canaux' : activeRef === 'devoir' ? 'Devoirs' : activeRef === 'emoji' ? 'Emojis' : 'Ressources'"
          >
            <div class="mi-mention-header">
              {{ activeRef === 'command' ? 'Commandes' : activeRef === 'channel' ? 'Canaux' : activeRef === 'devoir' ? 'Devoirs' : activeRef === 'emoji' ? 'Emojis' : 'Ressources' }}
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
                <span v-if="(ch as RefChannel).type === 'annonce'" class="mi-mention-badge mi-mention-badge--annonce">Annonce</span>
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
            <template v-else-if="activeRef === 'emoji'">
              <button
                v-for="(e, i) in refResults"
                :key="(e as EmojiShortcode).shortcode"
                class="mi-mention-item mi-emoji-item"
                :class="{ 'mi-mention-selected': i === refIndex }"
                @mousedown.prevent="insertRef((e as EmojiShortcode).emoji)"
                @mouseenter="refIndex = i"
              >
                <span class="mi-emoji-char">{{ (e as EmojiShortcode).emoji }}</span>
                <span class="mi-mention-name">:{{ (e as EmojiShortcode).shortcode }}:</span>
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

        <!-- Barre d'actions (composant extrait) -->
        <MessageInputToolbar
          :content="content"
          :sending="sending"
          :attaching="attaching"
          :show-preview="showPreview"
          :show-char-count="showCharCount"
          :char-count="charCount"
          :char-count-over="charCountOver"
          :is-offline-or-disconnected="isOfflineOrDisconnected"
          :max-message-length="messagesStore.MAX_MESSAGE_LENGTH"
          :show-signature-toggle="showSignatureToggle"
          :request-signature="requestSignature"
          @fmt-wrap="fmtWrap"
          @fmt-line-prefix="fmtLinePrefix"
          @fmt-insert-block="fmtInsertBlock"
          @trigger-mention="triggerMention"
          @trigger-channel="triggerChannel"
          @trigger-devoir="triggerDevoir"
          @attach-file="attachFile"
          @send="send"
          @schedule="showScheduleModal = true"
          @update:show-preview="showPreview = $event"
          @update:request-signature="requestSignature = $event"
          @insert-emoji="(e) => { content += e; inputEl?.focus() }"
        />

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

    <!-- Modal de composition de sondage (declenche par /sondage) -->
    <CreatePollModal
      v-model="modals.createPoll"
      @submit="onPollSubmit"
    />

    <!-- Modal de composition de tableau (declenche par /tableau) -->
    <CreateTableModal
      v-model="modals.createTable"
      @submit="onTableSubmit"
      @submit-send="onTableSubmitSend"
    />

    <!-- Modal de composition de bloc de code (declenche par /code) -->
    <CreateCodeModal
      v-model="modals.createCode"
      @submit="onCodeSubmit"
      @submit-send="onCodeSubmitSend"
    />

    <!-- Modal de composition d'annonce (declenche par /annonce) -->
    <CreateAnnounceModal
      v-model="modals.createAnnounce"
      @submit="onAnnounceSubmit"
    />

    <!-- Modal d'aide riche (declenche par /aide) -->
    <HelpModal v-model="modals.help" />

    <!-- Modal liste des messages programmes (ouvert via la banner) -->
    <ScheduledMessagesModal v-model="showScheduledListModal" />

    <!-- Modal de programmation d'envoi -->
    <ScheduleMessageModal
      v-model="showScheduleModal"
      :content="content"
      :channel-id="appStore.activeChannelId"
      :dm-student-id="appStore.activeDmStudentId"
      :dm-peer-id="appStore.activeDmPeerId"
      :reply-to-id="messagesStore.quotedMessage?.id ?? null"
      :reply-to-author="messagesStore.quotedMessage?.author_name ?? null"
      :reply-to-preview="messagesStore.quotedMessage?.content?.slice(0, 100) ?? null"
      @scheduled="clearDraft(); content = ''; messagesStore.clearQuote()"
    />
  </div>
</template>

<style scoped>
/* ── Banner messages programmes ── */
.mi-scheduled-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  margin: 0 0 4px;
  background: rgba(var(--accent-rgb), .10);
  border: 1px solid rgba(var(--accent-rgb), .25);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background .15s, border-color .15s;
}
.mi-scheduled-banner:hover {
  background: rgba(var(--accent-rgb), .16);
  border-color: var(--accent);
}
.mi-scheduled-text {
  flex: 1;
  min-width: 0;
  color: var(--text-primary);
}
.mi-scheduled-text strong { color: var(--accent); font-weight: 700; }
.mi-scheduled-action {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  flex-shrink: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.sched-banner-enter-active,
.sched-banner-leave-active { transition: opacity .2s var(--ease-out), transform .2s var(--ease-out); }
.sched-banner-enter-from,
.sched-banner-leave-to { opacity: 0; transform: translateY(4px); }

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
  background: rgba(var(--accent-rgb), .07);
  border-left: 3px solid var(--accent);
  border-radius: 0 6px 6px 0;
}
.mi-quote-icon { color: var(--accent); flex-shrink: 0; margin-top: 2px; }
.mi-quote-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.mi-quote-author {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-light);
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
.quote-slide-leave-active { transition: all var(--motion-fast) var(--ease-out); }
.quote-slide-enter-from,
.quote-slide-leave-to     { opacity: 0; transform: translateY(-4px); max-height: 0; }

/* ── Popup autocomplete mention ── */
/* ── Avertissement @everyone ── */
.mi-everyone-warn {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 8px 14px; margin-bottom: 6px;
  background: color-mix(in srgb, var(--color-warning) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-warning) 25%, transparent);
  border-radius: var(--radius-sm); font-size: 12.5px; color: var(--color-warning);
}
.mi-mention-badge--annonce {
  background: color-mix(in srgb, var(--color-warning) 20%, transparent);
  color: var(--color-warning);
}
.mi-everyone-actions { display: flex; gap: 6px; flex-shrink: 0; }
.mi-everyone-btn {
  padding: 4px 12px; border: none; border-radius: 6px; font-size: 12px;
  font-weight: 600; cursor: pointer; font-family: var(--font);
}
.mi-everyone-cancel { background: var(--bg-active); color: var(--text-secondary); }
.mi-everyone-cancel:hover { background: var(--bg-active); }
.mi-everyone-confirm { background: var(--color-warning); color: white; }
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
  color: white;
  letter-spacing: -.3px;
  user-select: none;
}
.mi-mention-avatar-everyone {
  background: linear-gradient(135deg, var(--color-danger), color-mix(in srgb, var(--color-danger) 75%, black)) !important;
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
  color: var(--color-danger);
  font-weight: 700;
}
.mi-emoji-item .mi-mention-name {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 12px;
  color: var(--text-muted);
}
.mi-emoji-char {
  font-size: 20px;
  line-height: 1;
  width: 26px;
  text-align: center;
  flex-shrink: 0;
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
.mi-badge-teacher { background: color-mix(in srgb, var(--color-cctl) 20%, transparent); color: var(--color-cctl); }
.mi-badge-ta      { background: color-mix(in srgb, var(--color-success) 20%, transparent); color: var(--color-success); }

/* Transition popup mention */
.mention-pop-enter-active { transition: opacity .1s ease, transform .1s ease; }
.mention-pop-leave-active { transition: opacity .08s ease, transform .08s ease; }
.mention-pop-enter-from,
.mention-pop-leave-to     { opacity: 0; transform: translateY(4px); }

/* ── Preview markdown ── */
.mi-preview {
  padding: 10px 14px;
  min-height: 42px;
  max-height: 200px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  background: rgba(var(--accent-rgb),.04);
  border-top: 1px dashed rgba(var(--accent-rgb),.2);
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
.mi-sig-link.active { color: var(--color-success); font-weight: 600; }
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
.mi-mention-selected .mi-cmd-name { color: var(--text-primary); }
.mi-mention-selected .mi-cmd-desc { color: var(--text-secondary); }
.mi-mention-selected .mi-cmd-icon { background: var(--bg-active) !important; color: var(--text-primary) !important; }
.mi-mention-selected .mi-cmd-shortcut { background: var(--bg-active); color: var(--text-secondary); opacity: 1; }
</style>
