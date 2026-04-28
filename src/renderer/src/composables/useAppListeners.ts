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
import { useToast }         from '@/composables/useToast'

export function useAppListeners() {
  const router   = useRouter()
  const appStore = useAppStore()
  const modals   = useModalsStore()
  const { showToast } = useToast()

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
  let unsubPollUpdate: (() => void) | null = null
  let unsubPresence: (() => void) | null = null
  let unsubAuthExpired: (() => void) | null = null

  // ── IPC listeners (previously inline in App.vue onMounted) ───────────────
  let unsubLiveInvite: (() => void) | null = null
  let unsubUpdaterAvailable: (() => void) | null = null
  let unsubUpdaterDownloaded: (() => void) | null = null
  let unsubGradeNew: (() => void) | null = null
  let unsubSignature: (() => void) | null = null
  let unsubDocument:  (() => void) | null = null
  let unsubAssignment:(() => void) | null = null
  let unsubRuntimeError: (() => void) | null = null
  let liveInviteTimer: ReturnType<typeof setTimeout> | null = null
  let tokenRefreshTimer: ReturnType<typeof setInterval> | null = null
  let lastTokenRefreshAt = 0
  const MIN_REFRESH_INTERVAL_MS = 10 * 60_000 // pas plus d'un refresh par 10 min

  let initialized = false

  /** Refresh JWT + persistance localStorage. Partage entre timer 6h et reprise de visibilite. */
  async function refreshJwtIfNeeded(force = false): Promise<void> {
    if (!force && Date.now() - lastTokenRefreshAt < MIN_REFRESH_INTERVAL_MS) return
    if (!appStore.currentUser) return
    // Mode demo : le JWT prefixe `demo-` n'est jamais accepte par /api/auth/refresh
    // (qui n'est pas reroute vers /api/demo/*). Un appel provoquerait un 401 ->
    // dispatch `cursus:auth-expired` -> logout du visiteur en plein milieu de la
    // demo. Le token demo a deja une TTL de 24h, plus que suffisant pour explorer.
    if (appStore.currentUser.demo) return
    try {
      const res = await window.api.refreshToken?.()
      if (res?.token) {
        window.api.setToken(res.token)
        appStore.updateSessionToken(res.token)
        lastTokenRefreshAt = Date.now()
      }
    } catch { /* silencieux — prochaine tentative au 6h tick ou a la reprise */ }
  }

  /** Au retour de veille / onglet masque, le token peut etre proche de l'expiration
   *  alors que le timer setInterval n'a pas tire (throttling OS pendant le sommeil). */
  function onVisibilityChange() {
    if (document.visibilityState === 'visible') refreshJwtIfNeeded()
  }

  function initListeners() {
    // Guard double-init : en HMR ou login/logout cycle mal nettoye, un
    // 2e init creerait des listeners en double (toasts duplicates + leak).
    if (initialized) return
    initialized = true

    // Refresh proactif du JWT toutes les 6h (expire dans 7j).
    // Le token rafraichi est persiste en localStorage pour survivre au redemarrage.
    tokenRefreshTimer = setInterval(() => { void refreshJwtIfNeeded(true) }, 6 * 60 * 60_000)
    document.addEventListener('visibilitychange', onVisibilityChange)
    document.addEventListener('keydown', onGlobalShortcut)

    unsubUnread = appStore.initUnreadListener()
    unsubOnline = appStore.initOnlineListener()
    unsubSocket = appStore.initSocketListener()
    unsubPresence = appStore.initPresenceListener()
    unsubAuthExpired = appStore.initAuthExpiredListener()

    // Erreurs runtime du main process (apres startup) → toast non-bloquant.
    // Log cote main suffit comme source de verite ; ici on informe l'utilisateur.
    unsubRuntimeError = window.api?.onRuntimeError?.((data) => {
      showToast('Une erreur inattendue est survenue.', 'error', data.message)
    }) ?? null

    const messagesStore = useMessagesStore()
    unsubTyping = messagesStore.initTypingListener()
    unsubPollUpdate = messagesStore.initPollListener()

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
    unsubUpdaterDownloaded = window.api.onUpdaterDownloaded((payload) => {
      updateVersion.value = typeof payload === 'string' ? payload : payload.version
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

    // Signature updates (etudiants) — capture l unsub sinon les callbacks
    // s accumulent a chaque re-init (logout/login, refresh token).
    unsubSignature = window.api.onSignatureUpdate?.((data) => {
      if (appStore.isStaff) return
      appStore.addNotification({
        category: 'signature',
        title: data.status === 'signed' ? 'Document signe' : 'Signature refusee',
        preview: data.signer_name ? `Par ${data.signer_name}` : '',
        channelName: 'Signature',
      })
    }) ?? null

    // Nouveaux documents (etudiants)
    unsubDocument = window.api.onDocumentNew?.((data: { name: string; category?: string }) => {
      if (appStore.isStaff) return
      appStore.addNotification({
        category: 'document',
        title: 'Nouveau document',
        preview: data.name,
        channelName: data.category || 'Document',
      })
    }) ?? null

    // Nouveaux devoirs (etudiants)
    unsubAssignment = window.api.onAssignmentNew?.((data: { title: string; category?: string; deadline?: string }) => {
      if (appStore.isStaff) return
      appStore.addNotification({
        category: 'assignment',
        title: 'Nouveau devoir',
        preview: data.title,
        channelName: data.category || 'Devoir',
      })
    }) ?? null

  }

  function cleanupListeners() {
    document.removeEventListener('keydown', onGlobalShortcut)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    unsubUnread?.()
    unsubOnline?.()
    unsubSocket?.()
    unsubTyping?.()
    unsubPollUpdate?.()
    unsubPresence?.()
    unsubAuthExpired?.()
    unsubLiveInvite?.()
    unsubUpdaterAvailable?.()
    unsubUpdaterDownloaded?.()
    unsubGradeNew?.()
    unsubSignature?.()
    unsubDocument?.()
    unsubAssignment?.()
    unsubRuntimeError?.()
    // Null-out pour que initListeners() puisse etre re-appele proprement
    // apres un logout/login cycle.
    unsubUnread = unsubOnline = unsubSocket = unsubTyping = unsubPollUpdate = null
    unsubPresence = unsubAuthExpired = unsubLiveInvite = null
    unsubUpdaterAvailable = unsubUpdaterDownloaded = unsubGradeNew = null
    unsubSignature = unsubDocument = unsubAssignment = unsubRuntimeError = null
    if (liveInviteTimer) { clearTimeout(liveInviteTimer); liveInviteTimer = null }
    if (tokenRefreshTimer) { clearInterval(tokenRefreshTimer); tokenRefreshTimer = null }
    initialized = false
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
