<script setup lang="ts">
import { ref, computed } from 'vue'
import { Send, Type, Paperclip, Loader2 } from 'lucide-vue-next'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import FormatToolbar from './FormatToolbar.vue'

const appStore      = useAppStore()
const messagesStore = useMessagesStore()

const inputEl     = ref<HTMLTextAreaElement | null>(null)
const content     = ref('')
const showToolbar = ref(false)
const sending     = ref(false)

const placeholder = computed(() => {
  if (appStore.isReadonly) return 'Canal d\'annonces — lecture seule'
  if (appStore.activeChannelName) return `Envoyer dans #${appStore.activeChannelName}`
  return 'Votre message…'
})

// Placeholder: will be populated when typing-presence is implemented
const typingText = computed(() => '')

function autoResize() {
  if (!inputEl.value) return
  inputEl.value.style.height = 'auto'
  inputEl.value.style.height = inputEl.value.scrollHeight + 'px'
}

async function send() {
  if (!content.value.trim() || sending.value || appStore.isReadonly) return
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
    send()
  }
}
</script>

<template>
  <div id="message-input-area" class="message-input-area" :class="{ readonly: appStore.isReadonly }">
    <template v-if="!appStore.isReadonly">

      <!-- Zone indicateur de frappe -->
      <div class="mi-typing" aria-live="polite">
        <span v-if="typingText" class="mi-typing-text">{{ typingText }}</span>
      </div>

      <!-- Barre de formatage -->
      <FormatToolbar v-if="showToolbar" :input-el="inputEl" />

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

        <textarea
          id="message-input"
          ref="inputEl"
          v-model="content"
          class="message-input"
          :placeholder="placeholder"
          rows="1"
          @input="autoResize"
          @keydown="onKeydown"
        />

        <button
          class="btn-icon mi-attach-btn"
          title="Joindre un fichier"
          aria-label="Joindre un fichier"
          tabindex="-1"
          disabled
        >
          <Paperclip :size="16" />
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
/* Indicateur de frappe */
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

/* Bouton paperclip */
.mi-attach-btn {
  opacity: .45;
  cursor: not-allowed;
}

/* Bouton envoi */
.mi-send-btn {
  transition: opacity .15s, transform .15s, background .15s;
}
.mi-send-btn:not(:disabled):hover {
  transform: scale(1.06);
}

/* Spinner */
@keyframes mi-spin { to { transform: rotate(360deg); } }
.mi-spinner { animation: mi-spin .65s linear infinite; }

@keyframes mi-pulse {
  0%, 100% { opacity: .4; transform: scale(.85); }
  50%       { opacity: 1;  transform: scale(1.1); }
}
</style>
