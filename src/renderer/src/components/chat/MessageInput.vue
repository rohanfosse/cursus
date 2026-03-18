<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { Send, Type, Paperclip, Loader2, X as XIcon, Reply } from 'lucide-vue-next'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import FormatToolbar from './FormatToolbar.vue'

const appStore      = useAppStore()
const messagesStore = useMessagesStore()

const inputEl     = ref<HTMLTextAreaElement | null>(null)
const content     = ref('')
const showToolbar = ref(false)
const sending     = ref(false)

// ── Mention autocomplete (@) ──────────────────────────────────────────────
interface MentionUser { name: string }
const allUsers       = ref<MentionUser[]>([])
const mentionActive  = ref(false)
const mentionSearch  = ref('')
const mentionStart   = ref(-1)
const mentionResults = computed(() => {
  if (!mentionActive.value) return []
  const q = mentionSearch.value.toLowerCase()
  return allUsers.value
    .filter((u) => u.name.toLowerCase().includes(q))
    .slice(0, 7)
})

async function loadUsers() {
  if (allUsers.value.length) return

  let students: MentionUser[] = []
  const promoId = appStore.activePromoId

  if (promoId) {
    // Étudiants de la promo active — liste ciblée
    const res = await window.api.getStudents(promoId)
    if (res?.ok) students = res.data.map((s) => ({ name: s.name }))
  } else {
    const res = await window.api.getAllStudents()
    if (res?.ok) students = res.data.map((s) => ({ name: s.name }))
  }

  // Ajouter le professeur/TA courant s'il n'est pas dans la liste
  if (appStore.currentUser && appStore.currentUser.type !== 'student') {
    const myName = appStore.currentUser.name
    if (!students.some((u) => u.name === myName)) {
      students = [{ name: myName }, ...students]
    }
  }

  // @everyone en tête de liste
  allUsers.value = [{ name: 'everyone' }, ...students]
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

function closeMention() { mentionActive.value = false }

// ── Placeholder ───────────────────────────────────────────────────────────
const placeholder = computed(() => {
  if (appStore.isReadonly) return 'Canal d\'annonces — lecture seule'
  if (appStore.activeChannelName) return `Envoyer dans #${appStore.activeChannelName}`
  return 'Votre message…'
})

// ── Auto-resize textarea ──────────────────────────────────────────────────
function autoResize() {
  if (!inputEl.value) return
  inputEl.value.style.height = 'auto'
  inputEl.value.style.height = inputEl.value.scrollHeight + 'px'
}

// ── Détection mention + typing indicator ─────────────────────────────────
function onInput() {
  autoResize()

  if (!inputEl.value) return
  const cursor = inputEl.value.selectionStart ?? 0
  const before = content.value.slice(0, cursor)

  // Détecter @query en fin de texte avant le curseur
  const match = before.match(/@(\w*)$/)
  if (match) {
    mentionSearch.value = match[1]
    mentionStart.value  = cursor - match[0].length
    mentionActive.value = true
    loadUsers()
    // Filtrer sans attendre — allUsers se remplit en parallèle
  } else {
    mentionActive.value = false
  }

  // Indicateur de frappe — setTyping() est appelé côté récepteur (push temps-réel futur)
  // Ne pas l'appeler ici car on ne veut pas s'afficher à soi-même
}

// Fermer la mention au clic ailleurs
function onBlur() {
  setTimeout(closeMention, 150) // délai pour laisser le click s'exécuter
}

// Clavier dans la mention
function onMentionKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { closeMention(); e.preventDefault() }
}

// ── Pièce jointe (Paperclip) ──────────────────────────────────────────────
const attaching = ref(false)

async function attachFile() {
  if (attaching.value) return
  attaching.value = true
  try {
    const res = await window.api.openFileDialog()
    if (!res?.ok || !res.data) return
    const filePath = res.data as string
    // Insère le chemin sous forme de lien markdown
    const insert = content.value
      ? `\n${filePath}`
      : filePath
    content.value += insert
    nextTick(() => { autoResize(); inputEl.value?.focus() })
  } finally {
    attaching.value = false
  }
}

// ── Envoi ──────────────────────────────────────────────────────────────────
async function send() {
  if (!content.value.trim() || sending.value || appStore.isReadonly) return
  mentionActive.value = false
  sending.value = true
  try {
    await messagesStore.sendMessage(content.value)
    content.value = ''
    if (inputEl.value) inputEl.value.style.height = 'auto'
  } finally {
    sending.value = false
    inputEl.value?.focus()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (mentionActive.value && mentionResults.value.length) {
      insertMention(mentionResults.value[0].name)
    } else {
      send()
    }
  }
  if (e.key === 'Escape' && mentionActive.value) {
    closeMention()
    e.preventDefault()
  }
}

// Réinitialiser le resize quand le canal change
watch(
  () => [appStore.activeChannelId, appStore.activeDmStudentId],
  () => {
    content.value = ''
    mentionActive.value = false
    if (inputEl.value) inputEl.value.style.height = 'auto'
  },
)
</script>

<template>
  <div id="message-input-area" class="message-input-area" :class="{ readonly: appStore.isReadonly }">
    <template v-if="!appStore.isReadonly">

      <!-- Zone indicateur de frappe -->
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

      <!-- Barre de formatage -->
      <FormatToolbar v-if="showToolbar" :input-el="inputEl" />

      <!-- Zone de saisie principale -->
      <div id="message-input-wrapper" class="message-input-wrapper">

        <button
          id="btn-toggle-format"
          class="btn-icon"
          :class="{ active: showToolbar }"
          title="Mise en forme"
          aria-label="Afficher la barre de mise en forme"
          @click="showToolbar = !showToolbar"
        >
          <Type :size="16" />
        </button>

        <!-- Autocomplete mentions -->
        <div v-if="mentionActive && mentionResults.length" class="mi-mention-popup">
          <button
            v-for="user in mentionResults"
            :key="user.name"
            class="mi-mention-item"
            :class="{ 'mi-mention-everyone': user.name === 'everyone' }"
            @mousedown.prevent="insertMention(user.name)"
          >
            <span class="mi-mention-at">@</span>
            <span class="mi-mention-name">{{ user.name }}</span>
            <span v-if="user.name === 'everyone'" class="mi-mention-hint">Notifie tout le monde</span>
          </button>
        </div>

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
          @keydown.esc="closeMention"
        />

        <!-- Paperclip actif -->
        <button
          class="btn-icon mi-attach-btn"
          :class="{ attaching }"
          title="Joindre un fichier"
          aria-label="Joindre un fichier"
          :disabled="attaching"
          @click="attachFile"
        >
          <Loader2 v-if="attaching" :size="16" class="mi-spinner" />
          <Paperclip v-else :size="16" />
        </button>

        <button
          id="btn-send"
          class="btn-primary mi-send-btn"
          :disabled="!content.trim() || sending"
          aria-label="Envoyer le message"
          @click="send"
        >
          <Loader2 v-if="sending" :size="16" class="mi-spinner" />
          <Send v-else :size="16" />
        </button>

      </div>
    </template>

    <p v-else class="readonly-notice">Ce canal est en lecture seule.</p>
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
  margin: 0 0 2px;
  background: rgba(74, 144, 217, .07);
  border-left: 3px solid var(--accent);
  border-radius: 0 4px 4px 0;
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

/* Transition entrée/sortie quote */
.quote-slide-enter-active,
.quote-slide-leave-active { transition: all .15s ease; }
.quote-slide-enter-from,
.quote-slide-leave-to     { opacity: 0; transform: translateY(-4px); max-height: 0; }

/* ── Autocomplete mention ── */
.mi-mention-popup {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 50;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 -6px 24px rgba(0,0,0,.4);
  overflow: hidden;
  max-height: 260px;
  overflow-y: auto;
}
.mi-mention-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: var(--font);
  font-size: 13px;
  color: var(--text-secondary);
  text-align: left;
  transition: background .1s, color .1s;
}
.mi-mention-item:hover {
  background: rgba(255,255,255,.07);
  color: var(--text-primary);
}
.mi-mention-at {
  font-weight: 700;
  color: var(--accent);
  font-size: 13px;
  flex-shrink: 0;
}
.mi-mention-name { font-weight: 500; flex-shrink: 0; }
.mi-mention-hint {
  margin-left: auto;
  font-size: 10.5px;
  color: var(--text-muted);
  font-style: italic;
  white-space: nowrap;
}

/* @everyone — style légèrement distinct */
.mi-mention-everyone .mi-mention-at { color: var(--color-danger, #e74c3c); }
.mi-mention-everyone .mi-mention-name {
  color: var(--color-danger, #e74c3c);
  font-weight: 700;
}

/* ── Bouton paperclip actif ── */
.mi-attach-btn {
  transition: color .15s, opacity .15s;
}
.mi-attach-btn:not(:disabled):hover { color: var(--accent); }
.mi-attach-btn:disabled:not(.attaching) { opacity: .4; cursor: not-allowed; }

/* ── Bouton envoi ── */
.mi-send-btn {
  transition: opacity .15s, transform .15s, background .15s;
}
.mi-send-btn:not(:disabled):hover { transform: scale(1.06); }

/* ── Spinner ── */
@keyframes mi-spin { to { transform: rotate(360deg); } }
.mi-spinner { animation: mi-spin .65s linear infinite; }

@keyframes mi-pulse {
  0%, 100% { opacity: .4; transform: scale(.85); }
  50%       { opacity: 1;  transform: scale(1.1); }
}
</style>
