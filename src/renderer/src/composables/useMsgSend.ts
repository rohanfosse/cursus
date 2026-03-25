/**
 * Composition et envoi de message, alerte @everyone, indicateur de saisie.
 * Used by MessageInput.vue
 */
import { ref, computed, type Ref } from 'vue'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import { useToast }         from '@/composables/useToast'

/**
 * Message composition, send, @everyone warning, typing indicator.
 */
export function useMsgSend(
  content: Ref<string>,
  inputEl: Ref<HTMLTextAreaElement | null>,
  clearDraft: () => void,
  closeMention: () => void,
  onAfterSend?: (sentContent: string) => void,
) {
  const appStore      = useAppStore()
  const messagesStore = useMessagesStore()
  const { showToast } = useToast()

  const sending = ref(false)
  const everyoneWarning = ref(false)

  const isOfflineOrDisconnected = computed(() => !appStore.isOnline || !appStore.socketConnected)
  const charCount     = computed(() => content.value.length)
  const showCharCount = computed(() => charCount.value > messagesStore.MAX_MESSAGE_LENGTH * 0.8)
  const charCountOver = computed(() => charCount.value > messagesStore.MAX_MESSAGE_LENGTH)

  async function send() {
    if (!content.value.trim() || sending.value || appStore.isReadonly) return
    if (isOfflineOrDisconnected.value) {
      showToast('Hors-ligne - message non envoyé.', 'error')
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

    closeMention()
    sending.value = true
    try {
      const msgContent = content.value
      const ok = await messagesStore.sendMessage(msgContent)
      if (ok) {
        clearDraft()
        content.value = ''
        if (inputEl.value) inputEl.value.style.height = 'auto'
        onAfterSend?.(msgContent)
      } else {
        showToast('Message non envoyé - réessayez.', 'error')
      }
    } finally {
      sending.value = false
      inputEl.value?.focus()
    }
  }

  function cancelEveryone() {
    everyoneWarning.value = false
    content.value = content.value.replace(/@everyone\b/gi, '').trim()
  }

  // ── Typing indicator ───────────────────────────────────────────────────────
  let _lastTypingEmit = 0
  function emitTyping() {
    const now = Date.now()
    if (now - _lastTypingEmit < 2000) return
    _lastTypingEmit = now
    const channelId   = appStore.activeChannelId
    const dmStudentId = appStore.activeDmStudentId
    if (channelId && window.api.emitTyping) {
      window.api.emitTyping(channelId)
    } else if (dmStudentId && window.api.emitDmTyping) {
      window.api.emitDmTyping(dmStudentId, appStore.activeDmPeerId ?? undefined)
    }
  }

  return {
    sending,
    everyoneWarning,
    isOfflineOrDisconnected,
    charCount,
    showCharCount,
    charCountOver,
    send,
    cancelEveryone,
    emitTyping,
  }
}
