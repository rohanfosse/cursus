<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { Send, Paperclip, Loader2, X as XIcon, Reply, Bold, Italic, Code, SquareCode } from 'lucide-vue-next'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import { useToast }         from '@/composables/useToast'
import { avatarColor, initials } from '@/utils/format'

const appStore      = useAppStore()
const messagesStore = useMessagesStore()
const { showToast } = useToast()

const inputEl = ref<HTMLTextAreaElement | null>(null)
const content = ref('')
const sending = ref(false)

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

// ── Mention autocomplete (@) ──────────────────────────────────────────────
interface MentionUser {
  name: string
  type: 'student' | 'teacher' | 'ta' | 'everyone'
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
function onInput() {
  autoResize()

  if (!inputEl.value) return
  const cursor = inputEl.value.selectionStart ?? 0
  const before = content.value.slice(0, cursor)

  const match = before.match(/@([^\s@]*)$/)
  if (match) {
    mentionSearch.value = match[1]
    mentionStart.value  = cursor - match[0].length
    mentionActive.value = true
    loadUsers()
  } else {
    mentionActive.value = false
  }

  if (_draftTimer) clearTimeout(_draftTimer)
  _draftTimer = setTimeout(saveDraft, 500)
}

function onBlur() {
  setTimeout(closeMention, 150)
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
    content.value += content.value ? `\n${url}` : url
    nextTick(() => { autoResize(); inputEl.value?.focus() })
  } finally {
    attaching.value = false
  }
}

// ── Envoi ──────────────────────────────────────────────────────────────────
async function send() {
  if (!content.value.trim() || sending.value || appStore.isReadonly) return
  if (!appStore.isOnline) {
    showToast('Hors-ligne — message non envoyé.', 'error')
    return
  }
  mentionActive.value = false
  sending.value = true
  try {
    await messagesStore.sendMessage(content.value)
    clearDraft()
    content.value = ''
    if (inputEl.value) inputEl.value.style.height = 'auto'
  } finally {
    sending.value = false
    inputEl.value?.focus()
  }
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

  if (e.key === 'Enter' && !e.shiftKey) {
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

      <!-- Carte principale de saisie -->
      <div id="message-input-wrapper" class="message-input-wrapper">

        <!-- Popup autocomplete mentions -->
        <Transition name="mention-pop">
          <div
            v-if="mentionActive && mentionResults.length"
            ref="mentionPopupEl"
            class="mi-mention-popup"
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

        <!-- Zone textarea -->
        <textarea
          id="message-input"
          ref="inputEl"
          v-model="content"
          class="message-input"
          :placeholder="placeholder"
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
            <button class="mi-fmt-btn" title="Bloc de code" aria-label="Bloc de code" @mousedown.prevent="fmtInsertBlock">
              <SquareCode :size="13" />
            </button>

            <div class="mi-fmt-divider" />

            <!-- Mention rapide -->
            <button
              class="mi-fmt-btn mi-fmt-mention"
              title="Mentionner quelqu'un"
              aria-label="Mentionner"
              @mousedown.prevent="triggerMention"
            >@</button>
          </div>

          <!-- Actions droite -->
          <div class="mi-actions-right">
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

            <button
              id="btn-send"
              class="mi-send-btn"
              :disabled="!content.trim() || sending"
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
        <kbd>Entrée</kbd> pour envoyer · <kbd>Shift+Entrée</kbd> pour un saut de ligne
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
.message-input-wrapper { position: relative; }

.mi-mention-popup {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 50;
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
  font-size: 10px;
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
  font-size: 9.5px;
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
  font-size: 9.5px;
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
