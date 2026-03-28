import { ref, reactive, computed } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from './app'
import { useApi } from '@/composables/useApi'
import type { Message } from '@/types'
import {
  STORAGE_KEYS, GROUP_THRESHOLD_MS, MESSAGE_PAGE_SIZE,
  MAX_MESSAGE_LENGTH, TYPING_TIMEOUT_MS,
} from '@/constants'
import { cacheData, loadCached } from '@/composables/useOfflineCache'

export const useMessagesStore = defineStore('messages', () => {
  const appStore = useAppStore()
  const { api } = useApi()

  const messages           = ref<Message[]>([])
  const pinned             = ref<Message[]>([])
  const loading            = ref(false)
  const loadingMore        = ref(false)
  const hasMore            = ref(false)
  const searchTerm         = ref('')
  const firstUnreadId      = ref<number | null>(null)
  const highlightMessageId = ref<number | null>(null)

  // ── Citation (reply-to) ───────────────────────────────────────────────────
  const quotedMessage = ref<Message | null>(null)

  function setQuote(msg: Message | null) { quotedMessage.value = msg }
  function clearQuote()                   { quotedMessage.value = null }

  // ── Indicateurs de frappe ─────────────────────────────────────────────────
  // Map nom → timeout handle (auto-suppression après 3 s)
  const _typingTimers = reactive<Record<string, ReturnType<typeof setTimeout>>>({})
  const typingUsers   = ref<string[]>([])

  const typingText = computed(() => {
    const names = typingUsers.value
    if (!names.length) return ''
    if (names.length === 1) return `${names[0]} est en train d'écrire…`
    if (names.length === 2) return `${names[0]} et ${names[1]} écrivent…`
    return 'Plusieurs personnes écrivent…'
  })

  function setTyping(name: string) {
    if (!typingUsers.value.includes(name)) typingUsers.value = [...typingUsers.value, name]
    clearTimeout(_typingTimers[name])
    _typingTimers[name] = setTimeout(() => stopTyping(name), TYPING_TIMEOUT_MS)
  }

  function stopTyping(name: string) {
    clearTimeout(_typingTimers[name])
    delete _typingTimers[name]
    typingUsers.value = typingUsers.value.filter((n) => n !== name)
  }

  function clearAllTyping() {
    for (const name of Object.keys(_typingTimers)) {
      clearTimeout(_typingTimers[name])
      delete _typingTimers[name]
    }
    typingUsers.value = []
  }

  // ── Réactions en mémoire ──────────────────────────────────────────────────
  const reactions = reactive<Record<number, Record<string, number>>>({})
  const userVotes = reactive<Record<number, Set<string>>>({})

  // ── Groupement de messages ────────────────────────────────────────────────
  function isGrouped(msg: Message, prev: Message | null): boolean {
    if (!prev || searchTerm.value) return false
    if (msg.author_name !== prev.author_name) return false
    return new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_THRESHOLD_MS
  }

  // ── Clé localStorage pour le marqueur de lecture ──────────────────────────
  function _lrKey(): string | null {
    const { activeChannelId, activeDmStudentId } = appStore
    if (activeChannelId)   return STORAGE_KEYS.lastReadChannel(activeChannelId)
    if (activeDmStudentId) return STORAGE_KEYS.lastReadDm(activeDmStudentId)
    return null
  }

  function markLatestAsRead(messageId: number) {
    const lrKey = _lrKey()
    if (lrKey) localStorage.setItem(lrKey, String(messageId))
  }

  function upsertMessage(message: Message) {
    const existingIndex = messages.value.findIndex((item) => item.id === message.id)
    if (existingIndex >= 0) {
      messages.value = messages.value.map((item) => item.id === message.id ? message : item)
    } else {
      messages.value = [...messages.value, message]
    }
    initReactions(message.id, message.reactions)
    firstUnreadId.value = null
    markLatestAsRead(message.id)
    // Invalider le cache pour cette conversation
    const ck = _cacheKey()
    if (ck) _messageCache.set(ck, { messages: messages.value, hasMore: hasMore.value, timestamp: Date.now() })
  }

  function setPinnedState(messageId: number, isPinned: boolean) {
    messages.value = messages.value.map((message) =>
      message.id === messageId
        ? { ...message, is_pinned: isPinned ? 1 : 0 }
        : message,
    )
  }

  function syncPinnedCache(messageId: number, isPinned: boolean) {
    const message = messages.value.find((item) => item.id === messageId)
    if (!message) return

    const nextPinned = isPinned
      ? [message, ...pinned.value.filter((item) => item.id !== messageId)]
      : pinned.value.filter((item) => item.id !== messageId)

    pinned.value = nextPinned
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
  }

  // ── Cache conversations (évite le refetch au switch) ─────────────────────
  const _messageCache = new Map<string, { messages: Message[]; hasMore: boolean; timestamp: number }>()
  const CACHE_TTL = 60_000 // 1 minute

  function _cacheKey(): string | null {
    const { activeChannelId, activeDmStudentId, activeDmPeerId } = appStore
    if (activeDmStudentId) return `dm:${activeDmStudentId}:${activeDmPeerId}`
    if (activeChannelId) return `ch:${activeChannelId}`
    return null
  }

  function invalidateCache(key?: string) {
    if (key) _messageCache.delete(key)
    else _messageCache.clear()
  }

  // ── Fetch initial ──────────────────────────────────────────────────────────
  async function fetchMessages() {
    hasMore.value       = false
    firstUnreadId.value = null

    // Essayer le cache (sauf recherche)
    if (!searchTerm.value) {
      const ck = _cacheKey()
      const cached = ck ? _messageCache.get(ck) : null
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        messages.value = cached.messages
        hasMore.value  = cached.hasMore
        loading.value  = false
        return
      }
    }

    loading.value = true

    try {
      const { activeChannelId, activeDmStudentId } = appStore

      const lrKey      = _lrKey()
      const lastReadId = lrKey ? parseInt(localStorage.getItem(lrKey) ?? '0', 10) : 0

      let fetched: Message[] = []

      if (searchTerm.value && activeChannelId) {
        fetched       = await api<Message[]>(() => window.api.searchMessages(activeChannelId, searchTerm.value), 'search') ?? []
        hasMore.value = false
      } else if (searchTerm.value && activeDmStudentId) {
        const peer = appStore.activeDmPeerId ?? undefined
        fetched       = await api<Message[]>(() => window.api.searchDmMessages(activeDmStudentId, searchTerm.value, peer), 'search') ?? []
        hasMore.value = false
      } else if (activeChannelId) {
        const page    = await api<Message[]>(() => window.api.getChannelMessagesPage(activeChannelId)) ?? []
        fetched       = page.slice().reverse()
        hasMore.value = page.length === MESSAGE_PAGE_SIZE
      } else if (activeDmStudentId) {
        const peer   = appStore.activeDmPeerId ?? undefined
        const page   = await api<Message[]>(() => window.api.getDmMessagesPage(activeDmStudentId, undefined, peer)) ?? []
        fetched      = page.slice().reverse()
        hasMore.value = page.length === MESSAGE_PAGE_SIZE
      }

      messages.value = fetched

      // Mettre en cache memoire + disque (hors recherche)
      if (!searchTerm.value) {
        const ck = _cacheKey()
        if (ck) {
          _messageCache.set(ck, { messages: fetched, hasMore: hasMore.value, timestamp: Date.now() })
          if (fetched.length) cacheData(`messages-${ck}`, fetched)
        }
      }

      // Fallback offline : si aucun message et hors-ligne, charger depuis le cache disque
      if (!fetched.length && !appStore.isOnline && !searchTerm.value) {
        const ck = _cacheKey()
        if (ck) {
          const cached = await loadCached<Message[]>(`messages-${ck}`)
          if (cached?.length) {
            messages.value = cached
            return
          }
        }
      }

      if (!searchTerm.value && lastReadId > 0) {
        const first = fetched.find((m) => m.id > lastReadId)
        firstUnreadId.value = first?.id ?? null
      }

      if (lrKey && fetched.length) markLatestAsRead(fetched[fetched.length - 1].id)
    } finally {
      loading.value = false
    }
  }

  // ── Infinite scroll vers le haut ──────────────────────────────────────────
  async function loadOlderMessages(): Promise<void> {
    if (loadingMore.value || !hasMore.value) return
    const oldestId = messages.value[0]?.id
    if (!oldestId) return

    loadingMore.value = true
    try {
      const { activeChannelId, activeDmStudentId } = appStore
      let page: Message[] = []

      if (activeChannelId) {
        page = await api<Message[]>(() => window.api.getChannelMessagesPage(activeChannelId, oldestId)) ?? []
      } else if (activeDmStudentId) {
        const peer = appStore.activeDmPeerId ?? undefined
        page = await api<Message[]>(() => window.api.getDmMessagesPage(activeDmStudentId, oldestId, peer)) ?? []
      }

      const older   = page.slice().reverse()
      hasMore.value = page.length === MESSAGE_PAGE_SIZE
      messages.value = [...older, ...messages.value]
    } finally {
      loadingMore.value = false
    }
  }

  // ── Epinglage ──────────────────────────────────────────────────────────────
  async function fetchPinned(channelId: number) {
    pinned.value = await api<Message[]>(() => window.api.getPinnedMessages(channelId)) ?? []
  }

  // ── Envoi ──────────────────────────────────────────────────────────────────
  const sendError = ref(false)

  async function sendMessage(content: string): Promise<boolean> {
    if (!appStore.currentUser || !content.trim()) return false
    if (content.length > MAX_MESSAGE_LENGTH) {
      sendError.value = true
      return false
    }
    const quote = quotedMessage.value
    const result = await api<Message>(
      () => window.api.sendMessage({
        channelId:   appStore.activeChannelId   ?? undefined,
        dmStudentId: appStore.activeDmStudentId ?? undefined,
        dmPeerId:    appStore.activeDmPeerId    ?? undefined,
        authorName:  appStore.currentUser!.name,
        authorType:  appStore.currentUser!.type,
        channelName: appStore.activeChannelName || undefined,
        promoId:     appStore.activePromoId     ?? undefined,
        content:     content.trim(),
        replyToId:      quote?.id       ?? undefined,
        replyToAuthor:  quote?.author_name ?? undefined,
        replyToPreview: quote ? quote.content.slice(0, 120) : undefined,
      }),
      'send',
    )
    if (result === null) {
      sendError.value = true
      return false
    }
    sendError.value = false
    clearQuote()
    if (searchTerm.value) {
      await fetchMessages()
    } else {
      upsertMessage(result)
    }
    return true
  }

  // ── Épinglage ──────────────────────────────────────────────────────────────
  async function togglePin(messageId: number, pinned_: boolean) {
    if (!appStore.activeChannelId) return
    const updated = await api<number>(() => window.api.togglePinMessage({ messageId, pinned: pinned_ }), 'pin')
    if (updated === null) return
    setPinnedState(messageId, pinned_)
    syncPinnedCache(messageId, pinned_)
  }

  // ── Réactions ──────────────────────────────────────────────────────────────
  // Réactions enrichies : { type: { count, users[] } }
  type ReactionData = Record<string, { count: number; users: string[] }>
  const reactionsData = reactive<Record<number, ReactionData>>({})

  function initReactions(msgId: number, dbJson: string | null) {
    if (reactions[msgId]) return
    const base: Record<string, number> = { check: 0, thumb: 0, fire: 0, heart: 0, think: 0, eyes: 0 }
    const enriched: ReactionData = {}
    if (dbJson) {
      try {
        const parsed = JSON.parse(dbJson)
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'object' && v !== null && 'count' in v) {
            // Nouveau format { count, users }
            const obj = v as { count: number; users: string[] }
            base[k] = obj.count
            enriched[k] = obj
          } else {
            // Ancien format (juste un nombre)
            base[k] = v as number
            enriched[k] = { count: v as number, users: [] }
          }
        }
      } catch { /* invalid JSON */ }
    }
    reactions[msgId] = base
    reactionsData[msgId] = enriched
    if (!userVotes[msgId]) userVotes[msgId] = new Set()
  }

  function getReactionUsers(msgId: number, type: string): string[] {
    return reactionsData[msgId]?.[type]?.users ?? []
  }

  function toggleReaction(msgId: number, type: string) {
    const r    = reactions[msgId]
    const mine = userVotes[msgId]
    if (!r || !mine) return
    const userName = appStore.currentUser?.name ?? ''
    if (!reactionsData[msgId]) reactionsData[msgId] = {}
    if (!reactionsData[msgId][type]) reactionsData[msgId][type] = { count: 0, users: [] }

    if (mine.has(type)) {
      mine.delete(type)
      r[type] = Math.max(0, (r[type] ?? 1) - 1)
      reactionsData[msgId][type].count = r[type]
      reactionsData[msgId][type].users = reactionsData[msgId][type].users.filter(n => n !== userName)
    } else {
      mine.add(type)
      r[type] = (r[type] ?? 0) + 1
      reactionsData[msgId][type].count = r[type]
      if (!reactionsData[msgId][type].users.includes(userName)) {
        reactionsData[msgId][type].users.push(userName)
      }
    }

    // Sauvegarder en format enrichi
    const toSave: Record<string, { count: number; users: string[] }> = {}
    for (const [k, v] of Object.entries(r)) {
      if (v > 0) toSave[k] = reactionsData[msgId][k] ?? { count: v, users: [] }
    }
    api(() => window.api.updateReactions(msgId, JSON.stringify(toSave)), 'reaction')
      .then(res => { if (res === null) toggleReaction(msgId, type) /* rollback */ })
  }

  async function deleteMessage(id: number) {
    const result = await api(() => window.api.deleteMessage(id), 'delete')
    if (result === null) return
    messages.value = messages.value.filter((m) => m.id !== id)
    delete reactions[id]
    delete userVotes[id]
  }

  async function editMessage(id: number, newContent: string) {
    const result = await api(() => window.api.editMessage(id, newContent), 'edit')
    if (result === null) return
    const msg = messages.value.find((m) => m.id === id)
    if (msg) { msg.content = newContent; msg.edited = 1 }
  }

  function clearSearch() {
    searchTerm.value = ''
  }

  // ── Typing indicator listener ─────────────────────────────────────────────
  function initTypingListener(): () => void {
    if (!window.api.onTyping) return () => {}
    return window.api.onTyping(({ userName }) => {
      if (userName) setTyping(userName)
    })
  }

  return {
    messages, pinned, loading, loadingMore, hasMore, sendError, MAX_MESSAGE_LENGTH,
    searchTerm, firstUnreadId, highlightMessageId,
    reactions, userVotes,
    quotedMessage, setQuote, clearQuote,
    typingText, setTyping, stopTyping, clearAllTyping, initTypingListener,
    isGrouped, fetchMessages, loadOlderMessages, fetchPinned, upsertMessage,
    sendMessage, togglePin,
    initReactions, toggleReaction, getReactionUsers, clearSearch,
    deleteMessage, editMessage,
  }
})
