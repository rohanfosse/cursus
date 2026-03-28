/**
 * useAppListeners - regroupe les listeners globaux de l'application.
 * Extrait de App.vue pour reduire la complexite du composant racine.
 */
import { onMounted, onUnmounted, watch } from 'vue'
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

  // ── Listeners lifecycle ───────────────────────────────────────────────────
  let unsubUnread:   (() => void) | null = null
  let unsubOnline:   (() => void) | null = null
  let unsubSocket:   (() => void) | null = null
  let unsubTyping:   (() => void) | null = null
  let unsubPresence: (() => void) | null = null
  let unsubAuthExpired: (() => void) | null = null

  function initListeners() {
    document.addEventListener('keydown', onGlobalShortcut)

    unsubUnread = appStore.initUnreadListener()
    unsubOnline = appStore.initOnlineListener()
    unsubSocket = appStore.initSocketListener()
    unsubPresence = appStore.initPresenceListener()
    unsubAuthExpired = appStore.initAuthExpiredListener()

    const messagesStore = useMessagesStore()
    unsubTyping = messagesStore.initTypingListener()

    // Sync auto au retour en ligne (silencieuse)
    watch(() => appStore.isOnline, (online, wasOnline) => {
      if (online && !wasOnline) {
        console.log('[Sync] Retour en ligne, re-fetch des donnees...')
        messagesStore.fetchMessages()
        const travauxStore = useTravauxStore()
        travauxStore.fetchStudentDevoirs()
        const docsStore = useDocumentsStore()
        const pid = appStore.activePromoId ?? appStore.currentUser?.promo_id
        if (pid) docsStore.fetchDocuments(pid)
      }
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
  }

  return { initListeners, cleanupListeners }
}
