/**
 * useAppListeners - regroupe TOUS les listeners globaux de l'application.
 * Extrait de App.vue pour reduire la complexite du composant racine.
 */
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import { useTravauxStore }  from '@/stores/travaux'
import { useDocumentsStore } from '@/stores/documents'
import { useModalsStore }   from '@/stores/modals'

export function useAppListeners() {
  const router   = useRouter()
  const appStore = useAppStore()
  const modals   = useModalsStore()

  // ── State expose au template App.vue ─────────────────────────────────────
  const liveInvite = ref<{ sessionId: number; title: string; joinCode: string; teacherName: string } | null>(null)
  const updateState = ref<'idle' | 'downloading' | 'ready'>('idle')
  const updateVersion = ref('')

  // ── Raccourcis clavier globaux ────────────────────────────────────────────
  function onGlobalShortcut(e: KeyboardEvent) {
    if (e.ctrlKey && !e.shiftKey && !e.altKey) {
      if (e.key === '1') { e.preventDefault(); router.push('/dashboard') }
      if (e.key === '2') { e.preventDefault(); router.push('/messages') }
      if (e.key === '3') { e.preventDefault(); router.push('/devoirs') }
      if (e.key === '4') { e.preventDefault(); router.push('/documents') }
      if (e.key === 'n') { e.preventDefault(); modals.cmdPalette = true }
    }
  }

  // ── Core listeners ───────────────────────────────────────────────────────
  let unsubUnread:   (() => void) | null = null
  let unsubOnline:   (() => void) | null = null
  let unsubSocket:   (() => void) | null = null
  let unsubTyping:   (() => void) | null = null
  let unsubPresence: (() => void) | null = null
  let unsubAuthExpired: (() => void) | null = null

  // ── IPC listeners (previously inline in App.vue onMounted) ───────────────
  let unsubLiveInvite: (() => void) | null = null
  let unsubUpdaterAvailable: (() => void) | null = null
  let unsubUpdaterDownloaded: (() => void) | null = null
  let unsubGradeNew: (() => void) | null = null
  let liveInviteTimer: ReturnType<typeof setTimeout> | null = null
  let tokenRefreshTimer: ReturnType<typeof setInterval> | null = null

  function initListeners() {
    // Refresh proactif du JWT toutes les 6h (expire dans 7j)
    tokenRefreshTimer = setInterval(async () => {
      try {
        const res = await window.api.refreshToken?.()
        if (res?.token) window.api.setToken(res.token)
      } catch { /* silencieux — le prochain appel re-tentera */ }
    }, 6 * 60 * 60_000)
    document.addEventListener('keydown', onGlobalShortcut)

    unsubUnread = appStore.initUnreadListener()
    unsubOnline = appStore.initOnlineListener()
    unsubSocket = appStore.initSocketListener()
    unsubPresence = appStore.initPresenceListener()
    unsubAuthExpired = appStore.initAuthExpiredListener()

    const messagesStore = useMessagesStore()
    unsubTyping = messagesStore.initTypingListener()

    // Sync au retour en ligne
    watch(() => appStore.isOnline, (online, wasOnline) => {
      if (online && !wasOnline) {
        messagesStore.fetchMessages()
        messagesStore.flushDmQueue()
        const travauxStore = useTravauxStore()
        travauxStore.fetchStudentDevoirs()
        const docsStore = useDocumentsStore()
        const pid = appStore.activePromoId ?? appStore.currentUser?.promo_id
        if (pid) docsStore.fetchDocuments(pid)
      }
    })

    // Live invite (etudiants)
    unsubLiveInvite = window.api.onLiveInvite((data) => {
      if (appStore.isStaff) return
      liveInvite.value = data
      if (liveInviteTimer) clearTimeout(liveInviteTimer)
      liveInviteTimer = setTimeout(() => { liveInvite.value = null }, 30_000)
    })

    // Auto-updater
    unsubUpdaterAvailable = window.api.onUpdaterAvailable((version: string) => {
      updateVersion.value = version
      updateState.value = 'downloading'
    })
    unsubUpdaterDownloaded = window.api.onUpdaterDownloaded((version: string) => {
      updateVersion.value = version
      updateState.value = 'ready'
    })

    // Grade notifications (etudiants)
    unsubGradeNew = window.api.onGradeNew((data) => {
      if (appStore.isStaff) return
      const label = data.note
        ? `Nouvelle note : ${data.note} sur ${data.devoirTitle}`
        : `Nouveau feedback sur ${data.devoirTitle}`
      appStore.addNotification({
        category: 'grade',
        title: data.note ? 'Nouvelle note' : 'Nouveau feedback',
        preview: label,
        channelName: data.devoirTitle,
        authorName: data.note ? `Note : ${data.note}` : 'Feedback',
      })
      window.api?.setBadge?.()
    })

    // Signature updates (etudiants)
    window.api.onSignatureUpdate?.((data) => {
      if (appStore.isStaff) return
      appStore.addNotification({
        category: 'signature',
        title: data.status === 'signed' ? 'Document signe' : 'Signature refusee',
        preview: data.signer_name ? `Par ${data.signer_name}` : '',
        channelName: 'Signature',
      })
    })

    // Nouveaux documents (etudiants)
    window.api.onDocumentNew?.((data: { name: string; category?: string }) => {
      if (appStore.isStaff) return
      appStore.addNotification({
        category: 'document',
        title: 'Nouveau document',
        preview: data.name,
        channelName: data.category || 'Document',
      })
    })

    // Nouveaux devoirs (etudiants)
    window.api.onAssignmentNew?.((data: { title: string; category?: string; deadline?: string }) => {
      if (appStore.isStaff) return
      appStore.addNotification({
        category: 'assignment',
        title: 'Nouveau devoir',
        preview: data.title,
        channelName: data.category || 'Devoir',
      })
    })

  }

  function cleanupListeners() {
    document.removeEventListener('keydown', onGlobalShortcut)
    unsubUnread?.()
    unsubOnline?.()
    unsubSocket?.()
    unsubTyping?.()
    unsubPresence?.()
    unsubAuthExpired?.()
    unsubLiveInvite?.()
    unsubUpdaterAvailable?.()
    unsubUpdaterDownloaded?.()
    unsubGradeNew?.()
    if (liveInviteTimer) clearTimeout(liveInviteTimer)
    if (tokenRefreshTimer) clearInterval(tokenRefreshTimer)
  }

  function dismissLiveInvite() {
    liveInvite.value = null
    if (liveInviteTimer) clearTimeout(liveInviteTimer)
  }

  return {
    initListeners,
    cleanupListeners,
    liveInvite,
    updateState,
    updateVersion,
    dismissLiveInvite,
  }
}
