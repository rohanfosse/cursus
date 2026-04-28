import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { User } from '@/types'
import { useToast } from '@/composables/useToast'
import { useApi } from '@/composables/useApi'
import {
  STORAGE_KEYS,
  NOTIFICATION_HISTORY_LIMIT,
} from '@/constants'
import { hasRole } from '@/utils/permissions'

export const useAppStore = defineStore('app', () => {
  const { showToast } = useToast()
  const { api } = useApi()

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
  const activeChannelArchived    = ref<boolean>(false)
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
  const onlineUsers       = ref<Array<{ id: number; name: string; role: string; status?: { emoji: string | null; text: string | null; expiresAt: string | null } | null }>>([]) // présence en ligne + statuts

  // Bandeau "session expirée". Source unique, affichee par App.vue.
  // Reset implicite a chaque login/restoreSession (un nouveau token = nouvelle
  // session, on ne veut surtout pas garder l'ancien message colle en haut).
  // Reset explicite via dismissSessionExpired() pour le bouton "fermer".
  const sessionExpiredMessage = ref('')
  function dismissSessionExpired(): void { sessionExpiredMessage.value = '' }

  // ── Historique de notifications ────────────────────────────────────────────
  interface NotifEntry {
    id:          string
    category:    'message' | 'mention' | 'dm' | 'grade' | 'deadline' | 'signature' | 'document' | 'assignment' | 'spark' | 'pulse'
    channelId:   number | null
    channelName: string
    dmStudentId: number | null
    promoId:     number | null
    authorName:  string
    title:       string
    preview:     string
    actionUrl:   string | null
    isMention:   boolean
    timestamp:   number
    read:        boolean
  }

  const NOTIF_STORAGE_KEY = 'cc_notifications'
  const NOTIF_MAX = 100
  const NOTIF_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

  function _loadNotifications(): NotifEntry[] {
    try {
      const saved = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || '[]') as unknown
      // Garde defensive : si localStorage est corrompu (objet au lieu d'array),
      // on reset plutot que crasher avec "filter is not a function" plus tard
      // dans WidgetMessages / autres consumers qui font .filter() ou for...of.
      if (!Array.isArray(saved)) return []
      return (saved as NotifEntry[]).filter(n => n && typeof n.timestamp === 'number'
        && Date.now() - n.timestamp < NOTIF_MAX_AGE_MS)
    } catch { return [] }
  }
  function _persistNotifications() {
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notificationHistory.value.slice(0, NOTIF_MAX)))
  }

  const notificationHistory = ref<NotifEntry[]>(_loadNotifications())

  /** Ajouter une notification au centre unifie */
  function addNotification(opts: {
    category: NotifEntry['category']
    title: string
    preview?: string
    authorName?: string
    channelId?: number | null
    channelName?: string
    dmStudentId?: number | null
    promoId?: number | null
    actionUrl?: string | null
    silent?: boolean
  }) {
    const entry: NotifEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category: opts.category,
      channelId: opts.channelId ?? null,
      channelName: opts.channelName ?? '',
      dmStudentId: opts.dmStudentId ?? null,
      promoId: opts.promoId ?? null,
      authorName: opts.authorName ?? '',
      title: opts.title,
      preview: opts.preview ?? '',
      actionUrl: opts.actionUrl ?? null,
      isMention: ['mention', 'dm', 'grade', 'deadline', 'signature'].includes(opts.category),
      timestamp: Date.now(),
      read: false,
    }
    notificationHistory.value = [entry, ...notificationHistory.value].slice(0, NOTIF_MAX)
    _persistNotifications()
    if (!opts.silent) {
      const isDm = opts.category === 'dm'
      const notifType = isDm ? 'dm' as const
        : opts.category === 'mention' ? 'mention' as const
        : opts.category === 'grade' || opts.category === 'deadline' ? 'devoir' as const
        : opts.category === 'assignment' ? 'annonce' as const
        : 'message' as const
      _fireNotification(opts.title, opts.preview ?? '', isDm, opts.authorName ?? '', opts.preview ?? '', notifType)
    }
  }

  // ── Callback pour rafraîchir les DMs en temps réel ──────────────────────
  type DmRefreshCb = (message?: unknown) => void
  const _dmRefreshCallbacks: DmRefreshCb[] = []
  function onDmRefresh(cb: DmRefreshCb)  { _dmRefreshCallbacks.push(cb) }
  function offDmRefresh(cb: DmRefreshCb) {
    const idx = _dmRefreshCallbacks.indexOf(cb)
    if (idx >= 0) _dmRefreshCallbacks.splice(idx, 1)
  }

  // ── Calculs ───────────────────────────────────────────────────────────────
  const isStudent    = computed(() => currentUser.value?.type === 'student')
  const isAdmin      = computed(() => currentUser.value?.type === 'admin')
  const isTeacher    = computed(() => hasRole(currentUser.value?.type, 'teacher'))
  const isStaff      = computed(() => hasRole(currentUser.value?.type, 'ta'))
  const userRole     = computed(() => (currentUser.value?.type ?? 'student') as import('@/utils/permissions').Role)
  const isSimulating = computed(() => teacherUser.value !== null)
  const isReadonly   = computed(
    () => activeChannelArchived.value || (activeChannelType.value === 'annonce' && isStudent.value),
  )

  // ── Session ───────────────────────────────────────────────────────────────
  function _saveNavState() {
    try {
      localStorage.setItem(STORAGE_KEYS.NAV_STATE, JSON.stringify({
        channelId: activeChannelId.value,
        promoId: activePromoId.value,
        channelName: activeChannelName.value,
        dmStudentId: activeDmStudentId.value,
      }))
    } catch (e) {
      console.warn('[app] _saveNavState: impossible d\'écrire dans localStorage', e)
    }
  }

  /** Restaure canal/DM/promo actifs depuis localStorage si l'etat en memoire est vide. */
  function _restoreNavState(): void {
    if (activeChannelId.value || activeDmStudentId.value) return
    try {
      const nav = JSON.parse(localStorage.getItem(STORAGE_KEYS.NAV_STATE) || '{}')
      if (nav.channelId) { activeChannelId.value = nav.channelId; activeChannelName.value = nav.channelName ?? '' }
      if (nav.promoId) activePromoId.value = nav.promoId
      if (nav.dmStudentId) activeDmStudentId.value = nav.dmStudentId
    } catch (e) {
      console.warn('[app] _restoreNavState: état de navigation corrompu, réinitialisation', e)
    }
  }

  function restoreSession(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SESSION)
      if (raw) {
        const parsed = JSON.parse(raw)
        currentUser.value = parsed
        // Reconnecter le socket avec le token JWT stocké
        if (parsed?.token) window.api.setToken(parsed.token)
        if (currentUser.value?.type === 'ta') loadTaChannels()
        _restoreNavState()
        // Nouvelle session valide -> on efface l'eventuel bandeau "expire"
        // herite d'un cycle precedent (sinon il reste colle alors que l'app
        // marche).
        sessionExpiredMessage.value = ''
        return true
      }
    } catch {
      // Session corrompue - nettoyer et avertir
      localStorage.removeItem(STORAGE_KEYS.SESSION)
      const { showToast } = useToast()
      showToast('Session expirée ou corrompue. Veuillez vous reconnecter.', 'error')
    }
    return false
  }

  async function loadTaChannels(): Promise<void> {
    if (currentUser.value?.type !== 'ta') { taChannelIds.value = []; return }
    taChannelIds.value = await api<number[]>(() => window.api.getTeacherChannels(currentUser.value!.id)) ?? []
  }

  function login(user: User): void {
    currentUser.value = user
    try {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user))
    } catch {
      const { showToast } = useToast()
      showToast('Impossible de sauvegarder la session localement.', 'error')
    }
    if (user.type === 'ta') loadTaChannels()
    // Si l'utilisateur revient apres une expiration de session, restaurer
    // le canal qu'il consultait (no-op si deja dans un canal/DM).
    _restoreNavState()
    // Nouvelle session = on dismiss le bandeau "expire" si encore affiche
    // (cas typique : 401 -> bandeau -> reconnexion sans reload, le bandeau
    // resterait colle sinon).
    sessionExpiredMessage.value = ''
  }

  function logout(): void {
    currentUser.value = null
    activeChannelId.value   = null
    activeDmStudentId.value = null
    try { localStorage.removeItem(STORAGE_KEYS.SESSION) } catch (e) { console.warn('[app] logout: impossible de supprimer la session localStorage', e) }
    // Purge le JWT + socket cote preload pour eviter que le prochain utilisateur
    // herite des messages temps-reel de l'ancienne session sur la meme machine.
    try { window.api?.clearAuth?.() } catch { /* preload absent en mode web */ }
  }

  /** Persiste un nouveau JWT dans localStorage apres refresh proactif. */
  function updateSessionToken(newToken: string): void {
    if (!currentUser.value) return
    currentUser.value = { ...currentUser.value, token: newToken }
    try { localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(currentUser.value)) } catch (e) {
      console.warn('[app] updateSessionToken: impossible de persister le nouveau token', e)
    }
  }

  // ── Écouter l'expiration de session (émis par apiFetch sur 401) ──────────
  // Deux sources :
  //  - Web (src/web/api-shim.ts)     : dispatch d'un CustomEvent sur window
  //  - Electron (src/preload/*.ts)   : channel `authExpired` expose via IPC
  // (`sessionExpiredMessage` est declare en haut du store pour que login() et
  // restoreSession() puissent le reset.)
  function initAuthExpiredListener(): () => void {
    // Idempotent : un dogpile de 401 (10 requetes en vol quand le token expire)
    // ne doit declencher qu'un seul logout + un seul banner.
    const handler = () => {
      if (sessionExpiredMessage.value) return
      sessionExpiredMessage.value = 'Votre session a expiré. Veuillez vous reconnecter.'
      logout()
    }
    window.addEventListener('cursus:auth-expired', handler)
    const unsubIpc = window.api?.onAuthExpired?.(handler) ?? (() => {})
    return () => {
      window.removeEventListener('cursus:auth-expired', handler)
      unsubIpc()
    }
  }

  function clearMustChangePassword(): void {
    if (!currentUser.value) return
    currentUser.value = { ...currentUser.value, must_change_password: 0 }
    try { localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(currentUser.value)) } catch (e) { console.warn('[app] clearMustChangePassword: impossible de persister la session localStorage', e) }
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
    activeChannelIsPrivate.value = false
    activeChannelMemberCount.value = null
    activeChannelArchived.value = false
    activePromoId.value = student.promo_id
  }

  function stopSimulation(): void {
    if (!teacherUser.value) return
    currentUser.value   = teacherUser.value
    teacherUser.value   = null
    activeChannelId.value   = null
    activeDmStudentId.value = null
    activeChannelName.value = ''
    activeChannelIsPrivate.value = false
    activeChannelMemberCount.value = null
    activeChannelArchived.value = false
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  const activeChannelDescription = ref<string>('')
  const activeChannelIsPrivate   = ref<boolean>(false)
  const activeChannelMemberCount = ref<number | null>(null)

  function openChannel(id: number, promoId: number, name: string, type: 'chat' | 'annonce' = 'chat', description?: string, archived = false, isPrivate = false, memberCount: number | null = null) {
    activeChannelId.value   = id
    activeDmStudentId.value = null
    activeDmPeerId.value    = null
    activePromoId.value     = promoId
    activeChannelType.value = type
    activeChannelName.value = name
    activeChannelDescription.value = description || ''
    activeChannelArchived.value = archived
    activeChannelIsPrivate.value = isPrivate
    activeChannelMemberCount.value = memberCount
    markRead(id)
    _saveNavState()
  }

  function openDm(studentId: number, promoId: number, name: string) {
    const myId = currentUser.value?.id ?? 0
    const isStudentOpeningTeacherDm = myId > 0 && studentId < 0
    const isStudentToStudent        = myId > 0 && studentId > 0

    if (isStudentOpeningTeacherDm) {
      activeDmStudentId.value = myId
      activeDmPeerId.value    = studentId
    } else if (isStudentToStudent) {
      // Convention min/max pour les DMs etudiant-etudiant
      activeDmStudentId.value = Math.min(myId, studentId)
      activeDmPeerId.value    = Math.max(myId, studentId)
    } else {
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
      return window.api.onPresenceUpdate(async (data) => {
        onlineUsers.value = data
        // Synchroniser le store statuses avec les entrees re cues (statuts
        // actifs embarques dans presence:update).
        try {
          const { useStatusesStore } = await import('@/stores/statuses')
          const statuses = useStatusesStore()
          statuses.applyBulk(data.map(u => ({ userId: u.id, status: u.status ?? null })))
        } catch { /* non bloquant */ }
      })
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
  function _loadNotifPrefs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.PREFS) || '{}') }
    catch { return {} }
  }
  function _prefNotifDesktop(): boolean { return _loadNotifPrefs().notifDesktop !== false }
  function _prefNotifSound(): boolean { return _loadNotifPrefs().notifSound !== false }

  /** Verifie si un type de notification est autorise (granulaire + DND). */
  function _isNotifAllowed(type: 'mention' | 'dm' | 'message' | 'devoir' | 'annonce'): boolean {
    const p = _loadNotifPrefs()
    // Mode DND actif ?
    if (p.dndEnabled) {
      const now = new Date()
      const current = now.getHours() * 60 + now.getMinutes()
      const [sh, sm] = (p.dndStart || '22:00').split(':').map(Number)
      const [eh, em] = (p.dndEnd || '08:00').split(':').map(Number)
      const start = sh * 60 + sm, end = eh * 60 + em
      const inDnd = start > end ? (current >= start || current < end) : (current >= start && current < end)
      if (inDnd) return false
    }
    // Prefs granulaires
    if (type === 'mention' && p.notifMentions === false) return false
    if (type === 'dm' && p.notifDms === false) return false
    if (type === 'devoir' && p.notifDevoirs === false) return false
    if (type === 'annonce' && p.notifAnnonces === false) return false
    return true
  }
  function _getMutedDms(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.MUTED_DMS) || '[]') as string[]) }
    catch { return new Set() }
  }
  function muteDm(name: string) {
    const s = _getMutedDms(); s.add(name)
    localStorage.setItem(STORAGE_KEYS.MUTED_DMS, JSON.stringify([...s]))
  }
  function unmuteDm(name: string) {
    const s = _getMutedDms(); s.delete(name)
    localStorage.setItem(STORAGE_KEYS.MUTED_DMS, JSON.stringify([...s]))
  }
  function isDmMuted(name: string): boolean { return _getMutedDms().has(name) }

  // ── Sons de notification — pool 2 instances (message + DM) pour eviter
  //    d allouer un HTMLAudioElement par notif (200/jour → leak 10-30 MB/j).
  const _notifSoundUrl    = new URL('@/assets/sounds/notif.wav', import.meta.url).href
  const _notifDmSoundUrl  = new URL('@/assets/sounds/notif-dm.wav', import.meta.url).href
  let _notifAudio:   HTMLAudioElement | null = null
  let _notifDmAudio: HTMLAudioElement | null = null

  function _getNotifAudio(isDm: boolean): HTMLAudioElement {
    if (isDm) {
      if (!_notifDmAudio) {
        _notifDmAudio = new Audio(_notifDmSoundUrl)
        _notifDmAudio.volume = 0.3
        _notifDmAudio.preload = 'auto'
      }
      return _notifDmAudio
    }
    if (!_notifAudio) {
      _notifAudio = new Audio(_notifSoundUrl)
      _notifAudio.volume = 0.3
      _notifAudio.preload = 'auto'
    }
    return _notifAudio
  }

  function _playNotifSound(isDm = false) {
    if (!_prefNotifSound()) return
    try {
      const audio = _getNotifAudio(isDm)
      audio.currentTime = 0
      audio.play().catch(() => {})
    } catch {}
  }

  function _fireNotification(title: string, body: string, isDm: boolean, senderName: string, preview: string, notifType: 'mention' | 'dm' | 'message' | 'devoir' | 'annonce' = 'message') {
    // Verifier les prefs granulaires + DND
    if (!_isNotifAllowed(notifType)) return

    // Son
    if (isDm) {
      _playNotifSound(true)
    } else {
      _playNotifSound(false)
    }

    // Toast in-app si fenetre au premier plan
    if (!document.hidden) {
      window.dispatchEvent(new CustomEvent('cursus:notif-toast', {
        detail: { title, body: `${senderName}: ${preview}` },
      }))
      return
    }

    // Notification OS si fenetre en arriere-plan
    if (_prefNotifDesktop() && Notification.permission === 'granted') {
      new Notification(title, { body, silent: false })
    }
  }

  // Listener temps-réel - appelé une seule fois au démarrage (App.vue onMounted)
  function initUnreadListener(): () => void {
    return window.api.onNewMessage(({ channelId, dmStudentId, authorName, channelName, promoId, preview, mentionEveryone, mentionNames, message }) => {
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
          _dmRefreshCallbacks.forEach(cb => cb(message))
        } else {
          // Badge unread
          unreadDms.value = { ...unreadDms.value, [senderName]: (unreadDms.value[senderName] ?? 0) + 1 }
          addNotification({
            category: 'dm',
            title: `\u2709\uFE0F Message de ${senderName}`,
            preview: preview ?? '',
            authorName: senderName,
            dmStudentId,
            promoId: promoId ?? null,
            channelName: senderName,
            silent: isDmMuted(senderName),
          })
        }
        return
      }

      if (!channelId) return

      // ── Isolation promo : un étudiant ignore les messages d'une autre promo ──
      if (currentUser.value?.type === 'student' && promoId && currentUser.value.promo_id && promoId !== currentUser.value.promo_id) return

      // ── Message de canal ──────────────────────────────────────────────────
      if (channelId === activeChannelId.value) {
        _dmRefreshCallbacks.forEach(cb => cb(message))
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
        addNotification({
          category: isMention ? 'mention' : 'message',
          title: isMention ? `\uD83D\uDCE3 Mention dans #${channelName ?? 'canal'}` : `Message dans #${channelName ?? 'canal'}`,
          preview: preview ? `${authorName ?? ''}: ${preview}` : '',
          authorName: authorName ?? '',
          channelId,
          channelName: channelName ?? 'Inconnu',
          promoId: promoId ?? null,
          silent: !isMention, // Pas de son/notif pour les messages normaux
        })
      }
    })
  }

  return {
    // état
    isOnline, socketConnected, currentUser, activeChannelId, activeDmStudentId, activeDmPeerId, activePromoId,
    activeChannelType, activeChannelName, activeChannelDescription, activeChannelArchived, activeChannelIsPrivate, activeChannelMemberCount, activeProject, pendingChannelCategory, rightPanel, currentTravailId, duplicateDevoirData, pendingDevoirType,
    pendingNoteDepotId, rubricDepotId, unread, mentionChannels, unreadDms, notificationHistory, taChannelIds,
    // calculs
    isStudent, isTeacher, isAdmin, isStaff, userRole, isSimulating, isReadonly,
    // actions
    restoreSession, login, logout, updateSessionToken, impersonate, clearMustChangePassword,
    startSimulation, stopSimulation,
    openChannel, openDm, markRead, markDmRead, markAllRead, loadTaChannels,
    addNotification, muteDm, unmuteDm, isDmMuted,
    onlineUsers, isUserOnline, sessionExpiredMessage, dismissSessionExpired,
    initUnreadListener, initOnlineListener, initSocketListener, initPresenceListener, initAuthExpiredListener,
    onDmRefresh, offDmRefresh,
  }
})
