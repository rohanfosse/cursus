<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, Teleport } from 'vue'
import { Send, Paperclip, Loader2, X as XIcon, Reply, Bold, Italic, Code, SquareCode, Strikethrough, Quote, List, ListOrdered, Smile, Eye, EyeOff } from 'lucide-vue-next'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import { useToast }         from '@/composables/useToast'
import { usePrefs }         from '@/composables/usePrefs'
import { avatarColor, initials } from '@/utils/format'

const appStore      = useAppStore()
const messagesStore = useMessagesStore()
const { showToast } = useToast()
const { getPref }   = usePrefs()

const inputEl = ref<HTMLTextAreaElement | null>(null)
const content = ref('')
const sending = ref(false)
const showPreview = ref(false)
const showEmojiPicker = ref(false)

// ── Preview markdown ──────────────────────────────────────────────────────
import { renderMessageContent } from '@/utils/html'
const previewHtml = computed(() => showPreview.value ? renderMessageContent(content.value) : '')

// ── Brouillons (auto-save localStorage) ──────────────────────────────────────
let _draftTimer: ReturnType<typeof setTimeout> | null = null

const draftKey = computed(() => {
  if (appStore.activeChannelId)   return `draft_ch_${appStore.activeChannelId}`
  if (appStore.activeDmStudentId) return `draft_dm_${appStore.activeDmStudentId}`
  return null
})

function saveDraft() {
  if (!draftKey.value) return
  if (content.value.trim()) localStorage.setItem(draftKey.value, content.value)
  else                      localStorage.removeItem(draftKey.value)
}

function clearDraft() {
  if (_draftTimer) { clearTimeout(_draftTimer); _draftTimer = null }
  if (draftKey.value) localStorage.removeItem(draftKey.value)
}

// ── Autocomplete unifié (@mention, #canal, /devoir, /doc) ─────────────────
type RefType = 'mention' | 'channel' | 'devoir' | 'doc'

interface MentionUser {
  name: string
  type: 'student' | 'teacher' | 'ta' | 'everyone'
}

interface RefChannel { name: string; type: string }
interface RefDevoir { title: string; type: string; deadline: string }
interface RefDoc    { name: string; type: string; category: string | null }

const channelList = ref<RefChannel[]>([])
const devoirList  = ref<RefDevoir[]>([])
const docList     = ref<RefDoc[]>([])
const activeRef   = ref<RefType | null>(null)
const refSearch   = ref('')
const refStart    = ref(-1)
const refIndex    = ref(0)

const refResults = computed(() => {
  if (!activeRef.value || activeRef.value === 'mention') return []
  const q = normalize(refSearch.value)
  if (activeRef.value === 'channel') {
    return channelList.value.filter(c => normalize(c.name).includes(q)).slice(0, 8)
  }
  if (activeRef.value === 'devoir') {
    return devoirList.value.filter(d => normalize(d.title).includes(q)).slice(0, 8)
  }
  if (activeRef.value === 'doc') {
    return docList.value.filter(d => normalize(d.name).includes(q)).slice(0, 8)
  }
  return []
})

watch(refSearch, () => { refIndex.value = 0 })

let _channelsLoadedForPromo: number | null = null
async function loadChannels() {
  const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
  if (!promoId) return
  if (channelList.value.length && _channelsLoadedForPromo === promoId) return
  const res = await window.api.getChannels(promoId)
  channelList.value = res?.ok ? (res.data as RefChannel[]) : []
  _channelsLoadedForPromo = promoId
}

async function loadDevoirs() {
  const channelId = appStore.activeChannelId
  if (!channelId) return
  const res = await window.api.getTravaux(channelId)
  devoirList.value = res?.ok ? (res.data as RefDevoir[]) : []
}

async function loadDocs() {
  const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
  if (!promoId) return
  const res = await window.api.getProjectDocuments(promoId)
  docList.value = res?.ok ? (res.data as RefDoc[]) : []
}

// Précharger les données d'autocomplete au montage et quand la promo change
onMounted(() => {
  loadUsers()
  loadChannels()
})
watch(() => appStore.activePromoId, () => {
  _channelsLoadedForPromo = null
  channelList.value = []
  loadChannels()
})

function insertRef(text: string) {
  const el = inputEl.value
  if (!el) return
  const end  = el.selectionStart
  const pre  = content.value.slice(0, refStart.value)
  const post = content.value.slice(end)
  content.value = pre + text + ' ' + post
  activeRef.value = null
  nextTick(() => {
    el.focus()
    el.selectionStart = el.selectionEnd = refStart.value + text.length + 1
    autoResize()
  })
}

const allUsers        = ref<MentionUser[]>([])
const mentionActive   = ref(false)
const mentionSearch   = ref('')
const mentionStart    = ref(-1)
const mentionIndex    = ref(0)
const mentionPopupEl  = ref<HTMLElement | null>(null)

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const mentionResults = computed(() => {
  if (!mentionActive.value) return []
  const q = normalize(mentionSearch.value)
  return allUsers.value
    .filter((u) => normalize(u.name).includes(q))
    .slice(0, 8)
})

watch(mentionSearch, () => { mentionIndex.value = 0 })
watch(() => appStore.activePromoId, () => { allUsers.value = [] })

async function loadUsers() {
  if (allUsers.value.length) return

  let students: MentionUser[] = []
  const promoId = appStore.activePromoId

  if (promoId) {
    const res = await window.api.getStudents(promoId)
    if (res?.ok) students = res.data.map((s) => ({ name: s.name, type: 'student' as const }))
  } else {
    const res = await window.api.getAllStudents()
    if (res?.ok) students = res.data.map((s) => ({ name: s.name, type: 'student' as const }))
  }

  if (appStore.currentUser && appStore.currentUser.type !== 'student') {
    const myName = appStore.currentUser.name
    const myType = appStore.currentUser.type as 'teacher' | 'ta'
    if (!students.some((u) => u.name === myName)) {
      students = [{ name: myName, type: myType }, ...students]
    }
  }

  allUsers.value = [{ name: 'everyone', type: 'everyone' }, ...students]
}

function insertMention(name: string) {
  if (!inputEl.value) return
  const cursorPos = inputEl.value.selectionStart ?? 0
  const before    = content.value.slice(0, mentionStart.value)
  const after     = content.value.slice(cursorPos)
  content.value   = `${before}@${name} ${after}`
  mentionActive.value = false
  nextTick(() => {
    const pos = mentionStart.value + name.length + 2
    inputEl.value?.setSelectionRange(pos, pos)
    inputEl.value?.focus()
    autoResize()
  })
}

function closeMention() {
  mentionActive.value = false
  mentionIndex.value  = 0
}

// ── Position fixe des popups (échapper overflow:hidden des parents) ─────
const wrapperEl = ref<HTMLElement | null>(null)
const popupStyle = computed(() => {
  if (!wrapperEl.value) return {}
  const rect = wrapperEl.value.getBoundingClientRect()
  return {
    position: 'fixed' as const,
    bottom: `${window.innerHeight - rect.top + 6}px`,
    left:   `${rect.left}px`,
    width:  `${rect.width}px`,
    zIndex: '9999',
  }
})

// ── Placeholder ───────────────────────────────────────────────────────────
const placeholder = computed(() => {
  if (appStore.isReadonly) return 'Canal d\'annonces — lecture seule'
  if (appStore.activeChannelName) return `Message dans #${appStore.activeChannelName}`
  return 'Votre message…'
})

// ── Auto-resize textarea ──────────────────────────────────────────────────
function autoResize() {
  if (!inputEl.value) return
  inputEl.value.style.height = 'auto'
  inputEl.value.style.height = inputEl.value.scrollHeight + 'px'
}

// ── Détection mention ─────────────────────────────────────────────────────
// ── Typing indicator emission ───────────────────────────────────────────
let _lastTypingEmit = 0
function emitTyping() {
  const now = Date.now()
  if (now - _lastTypingEmit < 2000) return  // max 1 event / 2s
  _lastTypingEmit = now
  const channelId = appStore.activeChannelId
  const dmStudentId = appStore.activeDmStudentId
  if (channelId && window.api.emitTyping) {
    window.api.emitTyping(channelId)
  } else if (dmStudentId && window.api.emitDmTyping) {
    window.api.emitDmTyping(dmStudentId)
  }
}

function onInput() {
  autoResize()
  emitTyping()

  if (!inputEl.value) return
  const cursor = inputEl.value.selectionStart ?? 0
  const before = content.value.slice(0, cursor)

  // ── Détection des différents triggers ──────────────────────────────────
  const matchMention = before.match(/@([^\s@]*)$/)
  const matchChannel = before.match(/#([^\s#]*)$/)
  const matchDevoir  = before.match(/\/devoir\s?(.*)$/i)
  const matchDoc     = before.match(/\/doc\s?(.*)$/i)

  if (matchMention) {
    mentionSearch.value = matchMention[1]
    mentionStart.value  = cursor - matchMention[0].length
    mentionActive.value = true
    activeRef.value = null
    loadUsers()
  } else if (matchChannel) {
    activeRef.value = 'channel'
    refSearch.value = matchChannel[1]
    refStart.value  = cursor - matchChannel[0].length
    mentionActive.value = false
    loadChannels()
  } else if (matchDevoir) {
    activeRef.value = 'devoir'
    refSearch.value = matchDevoir[1]
    refStart.value  = cursor - matchDevoir[0].length
    mentionActive.value = false
    loadDevoirs()
  } else if (matchDoc) {
    activeRef.value = 'doc'
    refSearch.value = matchDoc[1]
    refStart.value  = cursor - matchDoc[0].length
    mentionActive.value = false
    loadDocs()
  } else {
    mentionActive.value = false
    activeRef.value = null
  }

  if (_draftTimer) clearTimeout(_draftTimer)
  _draftTimer = setTimeout(saveDraft, 500)
}

function onBlur() {
  setTimeout(() => {
    closeMention()
    activeRef.value = null
  }, 200)
}

// ── Formatage inline ──────────────────────────────────────────────────────
function fmtWrap(pre: string, post: string) {
  const el = inputEl.value
  if (!el) return
  const start = el.selectionStart
  const end   = el.selectionEnd
  const sel   = el.value.slice(start, end) || 'texte'
  el.value = el.value.slice(0, start) + pre + sel + post + el.value.slice(end)
  content.value = el.value
  el.focus()
  el.selectionStart = start + pre.length
  el.selectionEnd   = start + pre.length + sel.length
  autoResize()
}

/** Insère un préfixe en début de la ligne courante (ou de chaque ligne sélectionnée) */
function fmtLinePrefix(prefix: string) {
  const el = inputEl.value
  if (!el) return
  const start = el.selectionStart
  const end   = el.selectionEnd
  const lines = el.value.slice(start, end || start)

  if (start === end) {
    // Pas de sélection : trouver le début de la ligne courante
    const lineStart = el.value.lastIndexOf('\n', start - 1) + 1
    el.value = el.value.slice(0, lineStart) + prefix + el.value.slice(lineStart)
    content.value = el.value
    el.focus()
    el.selectionStart = el.selectionEnd = start + prefix.length
  } else {
    // Sélection : préfixer chaque ligne
    const prefixed = lines.split('\n').map(l => prefix + l).join('\n')
    el.value = el.value.slice(0, start) + prefixed + el.value.slice(end)
    content.value = el.value
    el.focus()
    el.selectionStart = start
    el.selectionEnd = start + prefixed.length
  }
  autoResize()
}

function fmtInsertBlock() {
  const el = inputEl.value
  if (!el) return
  const start = el.selectionStart
  const end   = el.selectionEnd
  const sel   = el.value.slice(start, end) || 'code'
  const block = '```\n' + sel + '\n```'
  el.value = el.value.slice(0, start) + block + el.value.slice(end)
  content.value = el.value
  el.focus()
  el.selectionStart = start + 4
  el.selectionEnd   = start + 4 + sel.length
  autoResize()
}

// ── Bouton mention @ ──────────────────────────────────────────────────────
function triggerMention() {
  const el = inputEl.value
  if (!el) return
  const pos    = el.selectionStart ?? content.value.length
  const before = content.value.slice(0, pos)
  const after  = content.value.slice(pos)
  content.value = before + '@' + after
  nextTick(() => {
    const newPos = pos + 1
    el.setSelectionRange(newPos, newPos)
    el.focus()
    mentionSearch.value = ''
    mentionStart.value  = newPos - 1
    mentionActive.value = true
    loadUsers()
    autoResize()
  })
}

// ── Bouton canal # ────────────────────────────────────────────────────────
function triggerChannel() {
  const el = inputEl.value
  if (!el) return
  const pos    = el.selectionStart ?? content.value.length
  const before = content.value.slice(0, pos)
  const after  = content.value.slice(pos)
  content.value = before + '#' + after
  nextTick(() => {
    const newPos = pos + 1
    el.setSelectionRange(newPos, newPos)
    el.focus()
    refSearch.value = ''
    refStart.value  = newPos - 1
    activeRef.value = 'channel'
    loadChannels()
    autoResize()
  })
}

// ── Pièce jointe ──────────────────────────────────────────────────────────
const attaching = ref(false)

async function attachFile() {
  if (attaching.value) return
  attaching.value = true
  try {
    const res = await window.api.openFileDialog()
    if (!res?.ok || !res.data) return
    const uploadRes = await window.api.uploadFile(res.data as string)
    if (!uploadRes?.ok) {
      showToast('Erreur lors du chargement du fichier.', 'error')
      return
    }
    const url = uploadRes.data as string
    // Formater en markdown : images → ![](url), fichiers → [nom](url)
    const fileName = (res.data as string).split(/[\\/]/).pop() || 'fichier'
    const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(fileName)
    const md = isImage ? `![${fileName}](${url})` : `[📎 ${fileName}](${url})`
    content.value += content.value ? `\n${md}` : md
    nextTick(() => { autoResize(); inputEl.value?.focus() })
  } finally {
    attaching.value = false
  }
}

// ── Envoi ──────────────────────────────────────────────────────────────────
const everyoneWarning = ref(false)

const isOfflineOrDisconnected = computed(() => !appStore.isOnline || !appStore.socketConnected)
const charCount = computed(() => content.value.length)
const showCharCount = computed(() => charCount.value > messagesStore.MAX_MESSAGE_LENGTH * 0.8)
const charCountOver = computed(() => charCount.value > messagesStore.MAX_MESSAGE_LENGTH)

async function send() {
  if (!content.value.trim() || sending.value || appStore.isReadonly) return
  if (isOfflineOrDisconnected.value) {
    showToast('Hors-ligne — message non envoyé.', 'error')
    return
  }
  if (charCountOver.value) {
    showToast(`Message trop long (${charCount.value}/${messagesStore.MAX_MESSAGE_LENGTH})`, 'error')
    return
  }

  // Confirmation @everyone
  if (/@everyone\b/i.test(content.value) && !everyoneWarning.value) {
    everyoneWarning.value = true
    return
  }
  everyoneWarning.value = false

  mentionActive.value = false
  sending.value = true
  try {
    const ok = await messagesStore.sendMessage(content.value)
    if (ok) {
      clearDraft()
      content.value = ''
      if (inputEl.value) inputEl.value.style.height = 'auto'
    } else {
      showToast('Message non envoyé — réessayez.', 'error')
    }
  } finally {
    sending.value = false
    inputEl.value?.focus()
  }
}

function cancelEveryone() {
  everyoneWarning.value = false
  // Retirer @everyone du message
  content.value = content.value.replace(/@everyone\b/gi, '').trim()
}

function scrollMentionIntoView() {
  nextTick(() => {
    const popup = mentionPopupEl.value
    if (!popup) return
    const active = popup.querySelector('.mi-mention-selected') as HTMLElement
    active?.scrollIntoView({ block: 'nearest' })
  })
}

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
    if (e.key === 'Enter') {
      e.preventDefault()
      insertMention(mentionResults.value[mentionIndex.value].name)
      return
    }
    if (e.key === 'Escape') {
      closeMention()
      e.preventDefault()
      return
    }
  }

  // ── Navigation ref popup (#canal, /devoir, /doc) ──────────────────────────
  if (activeRef.value && refResults.value.length) {
    if (e.key === 'ArrowDown') { e.preventDefault(); refIndex.value = (refIndex.value + 1) % refResults.value.length; return }
    if (e.key === 'ArrowUp')   { e.preventDefault(); refIndex.value = (refIndex.value - 1 + refResults.value.length) % refResults.value.length; return }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = refResults.value[refIndex.value]
      if (activeRef.value === 'channel') insertRef('#' + (item as { name: string }).name)
      else if (activeRef.value === 'devoir') insertRef('📋 [' + (item as { title: string }).title + ']')
      else if (activeRef.value === 'doc') insertRef('📄 [' + (item as { name: string }).name + ']')
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); activeRef.value = null; return }
  }

  // ── Raccourcis de formatage ───────────────────────────────────────────────
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

  // Entrée pour envoyer : Enter seul (pref activée) ou Ctrl+Enter (pref désactivée)
  const enterSendPref = getPref('enterToSend') ?? true
  const shouldSend = enterSendPref
    ? (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey)
    : (e.key === 'Enter' && (e.ctrlKey || e.metaKey))

  if (shouldSend) {
    e.preventDefault()
    send()
  }
  if (e.key === 'Escape' && mentionActive.value) {
    closeMention()
    e.preventDefault()
  }
}

// Restaurer le brouillon quand le canal change
watch(
  () => [appStore.activeChannelId, appStore.activeDmStudentId],
  () => {
    mentionActive.value = false
    if (_draftTimer) { clearTimeout(_draftTimer); _draftTimer = null }
    const key = draftKey.value
    content.value = key ? (localStorage.getItem(key) ?? '') : ''
    nextTick(() => {
      autoResize()
      inputEl.value?.focus()
    })
  },
)
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
              <span v-else-if="user.type === 'teacher'" class="mi-mention-badge mi-badge-teacher">Resp. Péda.</span>
              <span v-else-if="user.type === 'ta'" class="mi-mention-badge mi-badge-ta">Intervenant</span>
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
            :aria-label="activeRef === 'channel' ? 'Canaux' : activeRef === 'devoir' ? 'Devoirs' : 'Documents'"
          >
            <div class="mi-mention-header">
              {{ activeRef === 'channel' ? 'Canaux' : activeRef === 'devoir' ? 'Devoirs' : 'Documents' }}
            </div>
            <template v-if="activeRef === 'channel'">
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
                @mousedown.prevent="insertRef('📋 [' + (d as RefDevoir).title + ']')"
                @mouseenter="refIndex = i"
              >
                <span class="mi-ref-icon">📋</span>
                <span class="mi-mention-name">{{ (d as RefDevoir).title }}</span>
              </button>
            </template>
            <template v-else-if="activeRef === 'doc'">
              <button
                v-for="(d, i) in refResults"
                :key="(d as RefDoc).name"
                class="mi-mention-item"
                :class="{ 'mi-mention-selected': i === refIndex }"
                @mousedown.prevent="insertRef('📄 [' + (d as RefDoc).name + ']')"
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

      <p class="mi-hint">
        <template v-if="getPref('enterToSend') ?? true">
          <kbd>Entrée</kbd> envoyer · <kbd>Shift+Entrée</kbd> saut de ligne
        </template>
        <template v-else>
          <kbd>Ctrl+Entrée</kbd> envoyer · <kbd>Entrée</kbd> saut de ligne
        </template>
      </p>

    </template>

    <p v-else class="readonly-notice">Canal d'annonces — seuls les enseignants peuvent publier ici.</p>
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
.mi-everyone-cancel { background: rgba(255,255,255,.08); color: var(--text-secondary); }
.mi-everyone-cancel:hover { background: rgba(255,255,255,.12); }
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
  background: rgba(255, 255, 255, .07);
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
.mi-badge-teacher { background: rgba(123, 104, 238, .2); color: #9b87f5; }
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
  background: rgba(255, 255, 255, .08);
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
  background: rgba(255, 255, 255, .08);
  color: var(--text-secondary);
}
.mi-icon-btn:disabled { opacity: .4; cursor: not-allowed; }

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
.mi-hint {
  margin: 4px 2px 0;
  font-size: 10.5px;
  color: var(--text-muted);
  opacity: .7;
  user-select: none;
}
.mi-hint kbd {
  font-family: var(--font);
  font-size: 10.5px;
  background: rgba(255, 255, 255, .07);
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
</style>
