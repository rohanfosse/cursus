/**
 * Actions sur un message : edit, delete, pin, reply, open DM, copy, click handling.
 * Used by ChatBubble.vue
 */
import { ref, computed, nextTick } from 'vue'
import { useRouter }        from 'vue-router'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import { useModalsStore }   from '@/stores/modals'
import { useDocumentsStore } from '@/stores/documents'
import { useTravauxStore }  from '@/stores/travaux'
import { useLumenStore }    from '@/stores/lumen'
import { useToast }         from '@/composables/useToast'
import { authUrl }          from '@/utils/auth'
import { useOpenExternal }  from '@/composables/useOpenExternal'
import type { Message, Channel } from '@/types'

/**
 * Actions sur un message : edit, delete, pin, reply, open DM, copy, click handling.
 */
export function useBubbleActions(msg: () => Message) {
  const router        = useRouter()
  const appStore      = useAppStore()
  const messagesStore = useMessagesStore()
  const modals        = useModalsStore()
  const documentsStore = useDocumentsStore()
  const travauxStore  = useTravauxStore()
  const lumenStore    = useLumenStore()
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

  // ── Click handler (fichiers, liens externes + #canal)
  function onMsgClick(e: MouseEvent) {
    // File card → preview si type supporté, sinon download
    const fileCard = (e.target as HTMLElement).closest('.msg-file-card') as HTMLElement | null
    if (fileCard) {
      e.preventDefault()
      const url = fileCard.dataset.url || ''
      const fileName = fileCard.dataset.fileName || ''
      const ext = fileName.split('.').pop()?.toLowerCase() || ''
      const previewable = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'docx', 'xlsx', 'txt']
      if (previewable.includes(ext)) {
        documentsStore.openPreview({ id: 0, channel_id: null, promo_id: null, name: fileName, type: 'file', content: url, category: null, description: null, created_at: '' })
        modals.documentPreview = true
      } else {
        openExternal(authUrl(url))
      }
      return
    }
    const a = (e.target as HTMLElement).closest('a[data-url]') as HTMLAnchorElement | null
    if (a) {
      e.preventDefault()
      const url = a.dataset.url
      if (url) openExternal(authUrl(url))
      return
    }
    const devoirRef = (e.target as HTMLElement).closest('.devoir-ref[data-devoir-id]') as HTMLElement | null
    if (devoirRef) {
      e.preventDefault()
      const devoirId = Number(devoirRef.dataset.devoirId)
      if (devoirId) {
        travauxStore.openTravail(devoirId).then(() => { modals.gestionDevoir = true })
      }
      return
    }
    // Lumen ref → ouvrir le cours dans le reader Lumen
    const lumenRef = (e.target as HTMLElement).closest('.lumen-ref[data-lumen-id]') as HTMLElement | null
    if (lumenRef) {
      e.preventDefault()
      const courseId = Number(lumenRef.dataset.lumenId)
      if (courseId) {
        lumenStore.fetchCourse(courseId).then((course) => {
          if (course) {
            router.push({ name: 'lumen', query: { course: String(courseId) } })
          } else {
            showToast('Cours introuvable.', 'error')
          }
        }).catch(() => { showToast('Impossible de charger le cours.', 'error') })
      }
      return
    }
    // Document ref → ouvrir le document (aperçu ou lien externe)
    const docRef = (e.target as HTMLElement).closest('.doc-ref[data-doc-id]') as HTMLElement | null
    if (docRef) {
      e.preventDefault()
      const docId = Number(docRef.dataset.docId)
      if (docId) {
        const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
        if (promoId) {
          window.api.getProjectDocuments(promoId).then((res) => {
            const doc = res?.ok ? res.data.find((d) => d.id === docId) : null
            if (doc) {
              if (doc.type === 'link') {
                openExternal(doc.content)
              } else {
                documentsStore.openPreview(doc)
                modals.documentPreview = true
              }
            } else {
              showToast('Document introuvable.', 'error')
            }
          }).catch(() => { showToast('Impossible de charger le document.', 'error') })
        }
      }
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
          }).catch(() => { /* canal introuvable — ignoré */ })
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
