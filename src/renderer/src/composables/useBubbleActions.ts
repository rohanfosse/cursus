/**
 * Actions sur un message : edit, delete, pin, reply, open DM, copy, click handling.
 * Used by ChatBubble.vue
 */
import { ref, computed, nextTick } from 'vue'
import { useRouter }        from 'vue-router'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import { useToast }         from '@/composables/useToast'
import { useOpenExternal }  from '@/composables/useOpenExternal'
import type { Message, Channel } from '@/types'

/**
 * Actions sur un message : edit, delete, pin, reply, open DM, copy, click handling.
 */
export function useBubbleActions(msg: () => Message) {
  const router        = useRouter()
  const appStore      = useAppStore()
  const messagesStore = useMessagesStore()
  const { openExternal } = useOpenExternal()
  const { showToast }    = useToast()

  // ── Computed helpers
  const isOwnMessage = computed(() => msg().author_name === appStore.currentUser?.name)
  const isMine       = computed(() => msg().author_name === appStore.currentUser?.name)
  const isPinned     = computed(() => !!msg().is_pinned)
  const isEdited     = computed(() => !!msg().edited)
  const canEdit      = computed(() => isMine.value)
  const canDelete    = computed(() => appStore.isTeacher || isMine.value)
  const hasQuote     = computed(() => !!msg().reply_to_author)

  // ── DM avec l'auteur
  async function openDmWithAuthor() {
    if (isOwnMessage.value) return
    try {
      const res = await window.api.findUserByName(msg().author_name)
      if (res?.ok && res.data) {
        appStore.openDm(res.data.id, res.data.promo_id ?? appStore.activePromoId ?? 0, res.data.name)
        if (router.currentRoute.value.name !== 'messages') router.push('/messages')
      } else {
        showToast('Utilisateur introuvable.', 'error')
      }
    } catch {
      showToast('Impossible d\'ouvrir la conversation.', 'error')
    }
  }

  // ── Reply
  function onReply() {
    messagesStore.setQuote(msg())
  }

  // ── Pin
  function togglePin() {
    messagesStore.togglePin(msg().id, !isPinned.value)
  }

  // ── Copy
  async function copyMessage() {
    try { await navigator.clipboard.writeText(msg().content) } catch { /* noop */ }
  }

  // ── Edit
  const editing     = ref(false)
  const editContent = ref('')
  const editEl      = ref<HTMLTextAreaElement | null>(null)

  async function startEdit() {
    editing.value     = true
    editContent.value = msg().content
    await nextTick()
    editEl.value?.focus()
    editEl.value?.select()
  }

  async function commitEdit() {
    const trimmed = editContent.value.trim()
    if (!trimmed || trimmed === msg().content) { cancelEdit(); return }
    await messagesStore.editMessage(msg().id, trimmed)
    editing.value = false
  }

  function cancelEdit() { editing.value = false; editContent.value = '' }

  function onEditKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') cancelEdit()
  }

  // ── Delete
  const confirmingDelete = ref(false)

  function deleteMessage() {
    confirmingDelete.value = true
  }

  async function confirmDelete() {
    confirmingDelete.value = false
    await messagesStore.deleteMessage(msg().id)
  }

  function cancelDelete() { confirmingDelete.value = false }

  // ── Report
  const reportingMsg = ref(false)
  const reportReason = ref('')

  async function reportMessage() {
    if (!reportReason.value.trim()) { showToast('Veuillez indiquer une raison.', 'error'); return }
    reportingMsg.value = false
    try {
      const res = await window.api.reportMessage(msg().id, reportReason.value.trim())
      if (res?.ok) { showToast('Message signalé. Un modérateur examinera votre signalement.', 'info') }
      else { showToast(res?.error ?? 'Erreur lors du signalement', 'error') }
    } catch { showToast('Erreur lors du signalement', 'error') }
    reportReason.value = ''
  }

  // ── Click handler (liens externes + #canal)
  function onMsgClick(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest('a[data-url]') as HTMLAnchorElement | null
    if (a) {
      e.preventDefault()
      const url = a.dataset.url
      if (url) openExternal(url)
      return
    }
    const chanRef = (e.target as HTMLElement).closest('.channel-ref') as HTMLElement | null
    if (chanRef) {
      e.preventDefault()
      const channelName = chanRef.dataset.channel
      if (channelName) {
        const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
        if (promoId) {
          window.api.getChannels(promoId).then((res) => {
            const ch = res?.ok ? res.data.find((c: Channel) => c.name === channelName) : null
            if (ch) appStore.openChannel(ch.id, ch.promo_id, ch.name, ch.type)
          })
        }
      }
    }
  }

  return {
    // computed
    isOwnMessage, isMine, isPinned, isEdited, canEdit, canDelete, hasQuote,
    // DM
    openDmWithAuthor,
    // reply / pin / copy
    onReply, togglePin, copyMessage,
    // edit
    editing, editContent, editEl, startEdit, commitEdit, cancelEdit, onEditKeydown,
    // delete
    confirmingDelete, deleteMessage, confirmDelete, cancelDelete,
    // report
    reportingMsg, reportReason, reportMessage,
    // click
    onMsgClick,
  }
}
