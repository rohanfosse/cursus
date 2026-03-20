import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@/types'
import { useToast } from '@/composables/useToast'

const SESSION_KEY = 'cc_session'

export const useAppStore = defineStore('app', () => {
  const { showToast } = useToast()

  // ── État ──────────────────────────────────────────────────────────────────
  const isOnline          = ref<boolean>(navigator.onLine)
  const socketConnected   = ref<boolean>(false)
  const currentUser       = ref<User | null>(null)
  const teacherUser       = ref<User | null>(null)   // sauvegarde pendant simulation
  const activeChannelId   = ref<number | null>(null)
  const activeDmStudentId = ref<number | null>(null)
  const activeDmPeerId    = ref<number | null>(null)    // l'autre personne dans le DM (pour conversations bidirectionnelles)
  const activePromoId     = ref<number | null>(null)
  const activeChannelType = ref<'chat' | 'annonce'>('chat')
  const activeChannelName = ref<string>('')
  const activeProject            = ref<string | null>(null)   // filtre projet Devoirs
  const pendingChannelCategory   = ref<string | null>(null)   // pré-remplissage CreateChannelModal
  const rightPanel        = ref<'travaux' | 'profil' | null>(null)
  const currentTravailId  = ref<number | null>(null)
  const duplicateDevoirData = ref<{ title: string; type: string; category: string | null; description: string | null; channelId: number | null } | null>(null)
  const pendingDevoirType = ref<string | null>(null)
  const pendingNoteDepotId = ref<number | null>(null)
  const rubricDepotId     = ref<number | null>(null)   // null = édition rubric, number = scoring dépôt
  const unread            = ref<Record<number, number>>({})
  const mentionChannels   = ref<Record<number, number>>({})
  const unreadDms         = ref<Record<string, number>>({}) // clé = nom de l'expéditeur
  const taChannelIds      = ref<number[]>([])               // canaux assignés à l'intervenant
  const onlineUsers       = ref<{ id: number; name: string; role: string }[]>([]) // présence en ligne

  // ── Historique de notifications ────────────────────────────────────────────
  interface NotifEntry {
    id:          string
    channelId:   number | null
    channelName: string
    dmStudentId: number | null
    promoId:     number | null
    authorName:  string
    isMention:   boolean
    timestamp:   number
    read:        boolean
  }
  const notificationHistory = ref<NotifEntry[]>([])

  // ── Callback pour rafraîchir les DMs en temps réel ──────────────────────
  const _dmRefreshCallbacks: (() => void)[] = []
  function onDmRefresh(cb: () => void)  { _dmRefreshCallbacks.push(cb) }
  function offDmRefresh(cb: () => void) {
    const idx = _dmRefreshCallbacks.indexOf(cb)
    if (idx >= 0) _dmRefreshCallbacks.splice(idx, 1)
  }

  // ── Calculs ───────────────────────────────────────────────────────────────
  const isStudent    = computed(() => currentUser.value?.type === 'student')
  const isTeacher    = computed(() => currentUser.value?.type === 'teacher')
  const isStaff      = computed(() => currentUser.value?.type === 'teacher' || currentUser.value?.type === 'ta')
  const isSimulating = computed(() => teacherUser.value !== null)
  const isReadonly   = computed(
    () => activeChannelType.value === 'annonce' && isStudent.value,
  )

  // ── Session ───────────────────────────────────────────────────────────────
  const NAV_STATE_KEY = 'cc_nav_state'

  function _saveNavState() {
    try {
      localStorage.setItem(NAV_STATE_KEY, JSON.stringify({
        channelId: activeChannelId.value,
        promoId: activePromoId.value,
        channelName: activeChannelName.value,
        dmStudentId: activeDmStudentId.value,
      }))
    } catch {}
  }

  function restoreSession(): boolean {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        currentUser.value = parsed
        // Reconnecter le socket avec le token JWT stocké
        if (parsed?.token) window.api.setToken(parsed.token)
        if (currentUser.value?.type === 'ta') loadTaChannels()
        // Restaurer le canal actif
        try {
          const nav = JSON.parse(localStorage.getItem(NAV_STATE_KEY) || '{}')
          if (nav.channelId) { activeChannelId.value = nav.channelId; activeChannelName.value = nav.channelName ?? '' }
          if (nav.promoId) activePromoId.value = nav.promoId
          if (nav.dmStudentId) activeDmStudentId.value = nav.dmStudentId
        } catch {}
        return true
      }
    } catch {
      // Session corrompue — nettoyer et avertir
      localStorage.removeItem(SESSION_KEY)
      const { showToast } = useToast()
      showToast('Session expirée ou corrompue. Veuillez vous reconnecter.', 'error')
    }
    return false
  }

  async function loadTaChannels(): Promise<void> {
    if (currentUser.value?.type !== 'ta') { taChannelIds.value = []; return }
    const res = await window.api.getTeacherChannels(currentUser.value.id)
    taChannelIds.value = res?.ok ? res.data : []
  }

  function login(user: User): void {
    currentUser.value = user
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user))
    } catch {
      const { showToast } = useToast()
      showToast('Impossible de sauvegarder la session localement.', 'error')
    }
    if (user.type === 'ta') loadTaChannels()
  }

  function logout(): void {
    currentUser.value = null
    activeChannelId.value   = null
    activeDmStudentId.value = null
    try { localStorage.removeItem(SESSION_KEY) } catch {}
  }

  // ── Écouter l'expiration de session (émis par apiFetch sur 401) ──────────
  const sessionExpiredMessage = ref('')
  function initAuthExpiredListener(): () => void {
    const handler = () => {
      sessionExpiredMessage.value = 'Votre session a expiré. Veuillez vous reconnecter.'
      logout()
    }
    window.addEventListener('cursus:auth-expired', handler)
    return () => window.removeEventListener('cursus:auth-expired', handler)
  }

  function clearMustChangePassword(): void {
    if (!currentUser.value) return
    currentUser.value = { ...currentUser.value, must_change_password: 0 }
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser.value)) } catch {}
  }

  // Impersonnification (prof → étudiant) : pas de sauvegarde en session
  function impersonate(user: User): void {
    currentUser.value = user
  }

  // Simulation vue étudiant (prof voit l'app comme un étudiant donné)
  function startSimulation(student: User): void {
    teacherUser.value   = currentUser.value
    currentUser.value   = student
    activeChannelId.value   = null
    activeDmStudentId.value = null
    activeChannelName.value = ''
    activePromoId.value = student.promo_id
  }

  function stopSimulation(): void {
    if (!teacherUser.value) return
    currentUser.value   = teacherUser.value
    teacherUser.value   = null
    activeChannelId.value   = null
    activeDmStudentId.value = null
    activeChannelName.value = ''
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  const activeChannelDescription = ref<string>('')

  function openChannel(id: number, promoId: number, name: string, type: 'chat' | 'annonce' = 'chat', description?: string) {
    activeChannelId.value   = id
    activeDmStudentId.value = null
    activeDmPeerId.value    = null
    activePromoId.value     = promoId
    activeChannelType.value = type
    activeChannelName.value = name
    activeChannelDescription.value = description || ''
    markRead(id)
    _saveNavState()
  }

  function openDm(studentId: number, promoId: number, name: string) {
    const myId = currentUser.value?.id ?? 0
    const isStudentOpeningTeacherDm = myId > 0 && studentId < 0

    if (isStudentOpeningTeacherDm) {
      // Étudiant ouvre DM avec un prof → lire la boîte de l'étudiant avec peer = prof
      activeDmStudentId.value = myId
      activeDmPeerId.value    = studentId
    } else {
      // Prof ouvre DM avec étudiant, ou étudiant ouvre DM avec étudiant → boîte du destinataire
      activeDmStudentId.value = studentId
      activeDmPeerId.value    = myId
    }

    activeChannelId.value   = null
    activePromoId.value     = promoId
    activeChannelType.value = 'chat'
    activeChannelName.value = name
    markDmRead(name)
    _saveNavState()
  }

  function markDmRead(senderName: string) {
    const next = { ...unreadDms.value }
    delete next[senderName]
    unreadDms.value = next
    notificationHistory.value = notificationHistory.value.map((n) =>
      n.dmStudentId !== null && n.authorName === senderName ? { ...n, read: true } : n,
    )
  }

  // ── Non-lus ───────────────────────────────────────────────────────────────
  function markRead(channelId: number) {
    const next = { ...unread.value }
    delete next[channelId]
    unread.value = next
    // Effacer aussi les pings de mention pour ce canal
    const nextM = { ...mentionChannels.value }
    delete nextM[channelId]
    mentionChannels.value = nextM
    // Marquer les notifs de ce canal comme lues
    notificationHistory.value = notificationHistory.value.map((n) =>
      n.channelId === channelId ? { ...n, read: true } : n,
    )
  }

  function markAllRead() {
    unread.value = {}
    mentionChannels.value = {}
    unreadDms.value = {}
    notificationHistory.value = notificationHistory.value.map((n) => ({ ...n, read: true }))
  }

  // ── Statut socket temps-réel ──────────────────────────────────────────────
  function initSocketListener(): () => void {
    return window.api.onSocketStateChange((connected: boolean) => {
      socketConnected.value = connected
    })
  }

  // ── Présence en ligne ────────────────────────────────────────────────────
  function initPresenceListener(): () => void {
    if (window.api.onPresenceUpdate) {
      return window.api.onPresenceUpdate((data) => { onlineUsers.value = data })
    }
    return () => {}
  }
  function isUserOnline(name: string): boolean {
    return onlineUsers.value.some(u => u.name === name)
  }

  // ── Statut réseau ─────────────────────────────────────────────────────────
  function initOnlineListener(): () => void {
    const onOnline  = () => { isOnline.value = true  }
    const onOffline = () => { isOnline.value = false }
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }

  // ── Helpers notification ──────────────────────────────────────────────────
  const MUTED_DM_KEY = 'cc_muted_dms'
  function _prefNotifDesktop(): boolean {
    try { return JSON.parse(localStorage.getItem('cc_prefs') || '{}').notifDesktop !== false }
    catch { return true }
  }
  function _prefNotifSound(): boolean {
    try { return JSON.parse(localStorage.getItem('cc_prefs') || '{}').notifSound !== false }
    catch { return true }
  }
  function _getMutedDms(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(MUTED_DM_KEY) || '[]') as string[]) }
    catch { return new Set() }
  }
  function muteDm(name: string) {
    const s = _getMutedDms(); s.add(name)
    localStorage.setItem(MUTED_DM_KEY, JSON.stringify([...s]))
  }
  function unmuteDm(name: string) {
    const s = _getMutedDms(); s.delete(name)
    localStorage.setItem(MUTED_DM_KEY, JSON.stringify([...s]))
  }
  function isDmMuted(name: string): boolean { return _getMutedDms().has(name) }

  let _audioCtx: AudioContext | null = null
  let _audioIdleTimer: ReturnType<typeof setTimeout> | null = null
  // Débloquer AudioContext au premier clic utilisateur (requis par les navigateurs)
  let _audioUnlocked = false
  if (typeof document !== 'undefined') {
    const unlockAudio = () => {
      if (_audioUnlocked) return
      _audioUnlocked = true
      if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {})
      document.removeEventListener('click', unlockAudio)
      document.removeEventListener('keydown', unlockAudio)
    }
    document.addEventListener('click', unlockAudio, { once: false })
    document.addEventListener('keydown', unlockAudio, { once: false })
  }
  function _playNotifSound(freq = 800, dur = 0.25) {
    if (!_prefNotifSound()) return
    try {
      if (!_audioCtx) _audioCtx = new AudioContext()
      if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {})
      const osc = _audioCtx.createOscillator()
      const gain = _audioCtx.createGain()
      osc.connect(gain).connect(_audioCtx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.value = 0.12
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + dur)
      osc.stop(_audioCtx.currentTime + dur)
      // Fermer l'AudioContext après 30s d'inactivité
      if (_audioIdleTimer) clearTimeout(_audioIdleTimer)
      _audioIdleTimer = setTimeout(() => {
        _audioCtx?.close().catch(() => {})
        _audioCtx = null
        _audioIdleTimer = null
      }, 30_000)
    } catch {}
  }

  function _fireNotification(title: string, body: string, isDm: boolean, senderName: string, preview: string) {
    // Son
    if (isDm) {
      _playNotifSound(900, 0.3) // DM : son plus aigu
    } else {
      _playNotifSound(700, 0.2) // Mention canal : son plus grave
    }

    // Toast in-app si fenêtre au premier plan
    if (!document.hidden) {
      window.dispatchEvent(new CustomEvent('cursus:notif-toast', {
        detail: { title, body: `${senderName}: ${preview}` },
      }))
      return
    }

    // Notification OS si fenêtre en arrière-plan
    if (_prefNotifDesktop() && Notification.permission === 'granted') {
      new Notification(title, { body, silent: false })
    }
  }

  // Listener temps-réel — appelé une seule fois au démarrage (App.vue onMounted)
  function initUnreadListener(): () => void {
    return window.api.onNewMessage(({ channelId, dmStudentId, authorName, channelName, promoId, preview, mentionEveryone, mentionNames }) => {
      // Ne pas compter ses propres messages
      if (authorName && authorName === currentUser.value?.name) return

      // ── Message direct ────────────────────────────────────────────────────
      if (!channelId && dmStudentId) {
        const senderName = authorName ?? ''

        // Déterminer si on est dans cette conversation
        const inThisConversation =
          activeDmStudentId.value === dmStudentId ||
          activeDmPeerId.value === dmStudentId

        if (inThisConversation) {
          _dmRefreshCallbacks.forEach(cb => cb())
        } else {
          // Badge unread
          unreadDms.value = { ...unreadDms.value, [senderName]: (unreadDms.value[senderName] ?? 0) + 1 }
          const dmEntry: NotifEntry = {
            id:          `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            channelId:   null,
            channelName: senderName,
            dmStudentId,
            promoId:     promoId ?? null,
            authorName:  senderName,
            isMention:   true,
            timestamp:   Date.now(),
            read:        false,
          }
          notificationHistory.value = [dmEntry, ...notificationHistory.value].slice(0, 50)

          // Notification (sauf si DM muté)
          if (!isDmMuted(senderName)) {
            _fireNotification(
              `\u2709\uFE0F Message de ${senderName}`,
              preview ?? '',
              true, senderName, preview ?? '',
            )
          }
        }
        return
      }

      if (!channelId) return

      // ── Message de canal ──────────────────────────────────────────────────
      if (channelId === activeChannelId.value) {
        _dmRefreshCallbacks.forEach(cb => cb())
      } else {
        unread.value = { ...unread.value, [channelId]: (unread.value[channelId] ?? 0) + 1 }
      }

      // Badge mention @
      let isMention = false
      if (currentUser.value) {
        const myName = currentUser.value.name.toLowerCase()
        isMention =
          mentionEveryone ||
          mentionNames.some((n) => {
            const lowerN = n.toLowerCase()
            return myName.split(/\s+/).some((part) => part.startsWith(lowerN))
          })
        if (isMention) {
          mentionChannels.value = {
            ...mentionChannels.value,
            [channelId]: (mentionChannels.value[channelId] ?? 0) + 1,
          }
        }
      }

      // Historique + notification (si pas dans le canal)
      if (channelId !== activeChannelId.value) {
        const entry: NotifEntry = {
          id:          `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          channelId,
          channelName: channelName ?? 'Inconnu',
          dmStudentId: null,
          promoId:     promoId ?? null,
          authorName:  authorName ?? '',
          isMention,
          timestamp:   Date.now(),
          read:        false,
        }
        notificationHistory.value = [entry, ...notificationHistory.value].slice(0, 50)

        // Notification uniquement pour les mentions (pas les messages normaux de canal)
        if (isMention) {
          _fireNotification(
            `\uD83D\uDCE3 Mention dans #${channelName ?? 'canal'}`,
            preview ? `${authorName ?? ''}: ${preview}` : authorName ?? '',
            false, authorName ?? '', preview ?? '',
          )
        }
      }
    })
  }

  // ── API helper ────────────────────────────────────────────────────────────
  async function api<T>(
    call: () => Promise<{ ok: boolean; data: T; error?: string }>,
    errorMsg?: string,
  ): Promise<T | null> {
    try {
      const res = await call()
      if (!res.ok) { showToast(res.error ?? errorMsg ?? 'Erreur serveur'); return null }
      return res.data
    } catch (e) {
      showToast(errorMsg ?? 'Erreur réseau')
      console.error(e)
      return null
    }
  }

  return {
    // état
    isOnline, socketConnected, currentUser, activeChannelId, activeDmStudentId, activeDmPeerId, activePromoId,
    activeChannelType, activeChannelName, activeChannelDescription, activeProject, pendingChannelCategory, rightPanel, currentTravailId, duplicateDevoirData, pendingDevoirType,
    pendingNoteDepotId, rubricDepotId, unread, mentionChannels, unreadDms, notificationHistory, taChannelIds,
    // calculs
    isStudent, isTeacher, isStaff, isSimulating, isReadonly,
    // actions
    restoreSession, login, logout, impersonate, clearMustChangePassword,
    startSimulation, stopSimulation,
    openChannel, openDm, markRead, markDmRead, markAllRead, loadTaChannels,
    muteDm, unmuteDm, isDmMuted,
    onlineUsers, isUserOnline, sessionExpiredMessage,
    initUnreadListener, initOnlineListener, initSocketListener, initPresenceListener, initAuthExpiredListener,
    onDmRefresh, offDmRefresh,
    api,
  }
})
