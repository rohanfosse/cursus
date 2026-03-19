import { ref, reactive, computed } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from './app'
import type { Message } from '@/types'

const GROUP_THRESHOLD_MS = 5 * 60 * 1000
const PAGE_SIZE          = 50

export const useMessagesStore = defineStore('messages', () => {
  const appStore = useAppStore()

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
    _typingTimers[name] = setTimeout(() => stopTyping(name), 3000)
  }

  function stopTyping(name: string) {
    clearTimeout(_typingTimers[name])
    delete _typingTimers[name]
    typingUsers.value = typingUsers.value.filter((n) => n !== name)
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
    if (activeChannelId)   return `lastRead:ch:${activeChannelId}`
    if (activeDmStudentId) return `lastRead:dm:${activeDmStudentId}`
    return null
  }

  // ── Fetch initial ──────────────────────────────────────────────────────────
  async function fetchMessages() {
    loading.value    = true
    hasMore.value    = false
    firstUnreadId.value = null

    try {
      const { activeChannelId, activeDmStudentId } = appStore

      const lrKey      = _lrKey()
      const lastReadId = lrKey ? parseInt(localStorage.getItem(lrKey) ?? '0', 10) : 0

      let fetched: Message[] = []

      if (searchTerm.value && activeChannelId) {
        const res = await window.api.searchMessages(activeChannelId, searchTerm.value)
        fetched       = res?.ok ? res.data : []
        hasMore.value = false
      } else if (activeChannelId) {
        const res    = await window.api.getChannelMessagesPage(activeChannelId)
        const page   = res?.ok ? (res.data as Message[]) : []
        fetched      = page.slice().reverse()
        hasMore.value = page.length === PAGE_SIZE
      } else if (activeDmStudentId) {
        const res    = await window.api.getDmMessagesPage(activeDmStudentId)
        const page   = res?.ok ? (res.data as Message[]) : []
        fetched      = page.slice().reverse()
        hasMore.value = page.length === PAGE_SIZE
      }

      messages.value = fetched

      if (!searchTerm.value && lastReadId > 0) {
        const first = fetched.find((m) => m.id > lastReadId)
        firstUnreadId.value = first?.id ?? null
      }

      if (lrKey && fetched.length) {
        localStorage.setItem(lrKey, String(fetched[fetched.length - 1].id))
      }
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
        const res = await window.api.getChannelMessagesPage(activeChannelId, oldestId)
        page = res?.ok ? (res.data as Message[]) : []
      } else if (activeDmStudentId) {
        const res = await window.api.getDmMessagesPage(activeDmStudentId, oldestId)
        page = res?.ok ? (res.data as Message[]) : []
      }

      const older   = page.slice().reverse()
      hasMore.value = page.length === PAGE_SIZE
      messages.value = [...older, ...messages.value]
    } finally {
      loadingMore.value = false
    }
  }

  // ── Epinglage ──────────────────────────────────────────────────────────────
  async function fetchPinned(channelId: number) {
    const res = await window.api.getPinnedMessages(channelId)
    pinned.value = res?.ok ? res.data : []
  }

  // ── Envoi ──────────────────────────────────────────────────────────────────
  async function sendMessage(content: string) {
    if (!appStore.currentUser || !content.trim()) return
    const quote = quotedMessage.value
    await window.api.sendMessage({
      channelId:   appStore.activeChannelId   ?? undefined,
      dmStudentId: appStore.activeDmStudentId ?? undefined,
      authorName:  appStore.currentUser.name,
      authorType:  appStore.currentUser.type,
      channelName: appStore.activeChannelName || undefined,
      promoId:     appStore.activePromoId     ?? undefined,
      content:     content.trim(),
      replyToId:      quote?.id       ?? undefined,
      replyToAuthor:  quote?.author_name ?? undefined,
      replyToPreview: quote ? quote.content.slice(0, 120) : undefined,
    })
    clearQuote()
    await fetchMessages()
  }

  // ── Épinglage ──────────────────────────────────────────────────────────────
  async function togglePin(messageId: number, pinned_: boolean) {
    if (!appStore.activeChannelId) return
    await window.api.togglePinMessage({ messageId, pinned: pinned_ })
    await fetchPinned(appStore.activeChannelId)
    await fetchMessages()
  }

  // ── Réactions ──────────────────────────────────────────────────────────────
  function initReactions(msgId: number, dbJson: string | null) {
    if (reactions[msgId]) return
    const base: Record<string, number> = { check: 0, thumb: 0, fire: 0, heart: 0, think: 0, eyes: 0 }
    if (dbJson) { try { Object.assign(base, JSON.parse(dbJson)) } catch { /* invalid JSON */ } }
    reactions[msgId] = base
    if (!userVotes[msgId]) userVotes[msgId] = new Set()
  }

  function toggleReaction(msgId: number, type: string) {
    const r    = reactions[msgId]
    const mine = userVotes[msgId]
    if (!r || !mine) return
    if (mine.has(type)) { mine.delete(type); r[type] = Math.max(0, (r[type] ?? 1) - 1) }
    else                { mine.add(type);    r[type] = (r[type] ?? 0) + 1 }
    window.api.updateReactions(msgId, JSON.stringify(r))
  }

  async function deleteMessage(id: number) {
    await window.api.deleteMessage(id)
    messages.value = messages.value.filter((m) => m.id !== id)
    delete reactions[id]
    delete userVotes[id]
  }

  async function editMessage(id: number, content: string) {
    const res = await window.api.editMessage(id, content)
    if (!res?.ok) return
    const msg = messages.value.find((m) => m.id === id)
    if (msg) { msg.content = content; msg.edited = 1 }
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
    messages, pinned, loading, loadingMore, hasMore,
    searchTerm, firstUnreadId, highlightMessageId,
    reactions, userVotes,
    quotedMessage, setQuote, clearQuote,
    typingText, setTyping, stopTyping, initTypingListener,
    isGrouped, fetchMessages, loadOlderMessages, fetchPinned,
    sendMessage, togglePin,
    initReactions, toggleReaction, clearSearch,
    deleteMessage, editMessage,
  }
})
