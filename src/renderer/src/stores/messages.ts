import { ref, reactive } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from './app'
import type { Message } from '@/types'

const GROUP_THRESHOLD_MS = 5 * 60 * 1000
const PAGE_SIZE          = 50

export const useMessagesStore = defineStore('messages', () => {
  const appStore = useAppStore()

  const messages      = ref<Message[]>([])
  const pinned        = ref<Message[]>([])
  const loading       = ref(false)
  const loadingMore   = ref(false)   // chargement des messages plus anciens
  const hasMore       = ref(false)   // des messages plus anciens existent-ils ?
  const searchTerm    = ref('')
  const firstUnreadId = ref<number | null>(null)

  // Réactions en mémoire — non persistées (client-side uniquement)
  const reactions = reactive<Record<number, Record<string, number>>>({})
  const userVotes = reactive<Record<number, Set<string>>>({})

  // ── Groupement de messages ────────────────────────────────────────────────
  // Deux messages consécutifs du même auteur dans la même minute → grouped
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

  // ── Fetch initial (page la plus récente) ──────────────────────────────────
  /**
   * Charge les PAGE_SIZE messages les plus récents du canal/DM actif.
   * Utilise le curseur localStorage pour marquer le premier message non lu.
   *
   * Pourquoi DESC + reverse() ?
   *   SQLite retourne les 50 derniers en ORDER BY id DESC (le plus efficace
   *   avec un index sur id). On les renverse côté JS pour affichage ASC.
   *   Cela évite une sous-requête ou un tri supplémentaire en DB.
   */
  async function fetchMessages() {
    loading.value    = true
    hasMore.value    = false
    firstUnreadId.value = null

    try {
      const { activeChannelId, activeDmStudentId } = appStore

      // Lire le marqueur avant le fetch pour détecter les nouveaux messages
      const lrKey      = _lrKey()
      const lastReadId = lrKey ? parseInt(localStorage.getItem(lrKey) ?? '0', 10) : 0

      let fetched: Message[] = []

      if (searchTerm.value && activeChannelId) {
        // Mode recherche : pas de pagination, pas de marqueur non-lu
        const res = await window.api.searchMessages(activeChannelId, searchTerm.value)
        fetched       = res?.ok ? res.data : []
        hasMore.value = false
      } else if (activeChannelId) {
        const res    = await window.api.getChannelMessagesPage(activeChannelId)
        const page   = res?.ok ? (res.data as Message[]) : []
        fetched      = page.slice().reverse()          // ASC pour affichage
        hasMore.value = page.length === PAGE_SIZE
      } else if (activeDmStudentId) {
        const res    = await window.api.getDmMessagesPage(activeDmStudentId)
        const page   = res?.ok ? (res.data as Message[]) : []
        fetched      = page.slice().reverse()
        hasMore.value = page.length === PAGE_SIZE
      }

      messages.value = fetched

      // Calculer le premier message non lu (hors mode recherche)
      if (!searchTerm.value && lastReadId > 0) {
        const first = fetched.find((m) => m.id > lastReadId)
        firstUnreadId.value = first?.id ?? null
      }

      // Sauvegarder le dernier message comme "lu"
      if (lrKey && fetched.length) {
        localStorage.setItem(lrKey, String(fetched[fetched.length - 1].id))
      }
    } finally {
      loading.value = false
    }
  }

  // ── Chargement de messages plus anciens (infinite scroll vers le haut) ────
  /**
   * Charge la page précédente (avant le plus ancien message chargé).
   * Le composant doit préserver la position de scroll AVANT d'appeler cette
   * fonction, puis la restaurer après awaiting + nextTick.
   *
   * Stratégie scroll-anchor :
   *   prevHeight = el.scrollHeight
   *   await loadOlderMessages()
   *   await nextTick()
   *   el.scrollTop = savedTop + (el.scrollHeight - prevHeight)
   */
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

      const older   = page.slice().reverse()          // ASC
      hasMore.value = page.length === PAGE_SIZE

      // Prepend sans déclencher de re-render complet — spread crée un nouveau ref
      messages.value = [...older, ...messages.value]
    } finally {
      loadingMore.value = false
    }
  }

  // ── Epinglage ─────────────────────────────────────────────────────────────
  async function fetchPinned(channelId: number) {
    const res = await window.api.getPinnedMessages(channelId)
    pinned.value = res?.ok ? res.data : []
  }

  // ── Envoi ─────────────────────────────────────────────────────────────────
  async function sendMessage(content: string) {
    if (!appStore.currentUser || !content.trim()) return
    await window.api.sendMessage({
      channelId:   appStore.activeChannelId   ?? undefined,
      dmStudentId: appStore.activeDmStudentId ?? undefined,
      authorName:  appStore.currentUser.name,
      authorType:  appStore.currentUser.type,
      content:     content.trim(),
    })
    // Le push msg:new déclenche un rechargement via le listener dans App.vue
    await fetchMessages()
  }

  // ── Épinglage ─────────────────────────────────────────────────────────────
  async function togglePin(messageId: number, pinned_: boolean) {
    if (!appStore.activeChannelId) return
    await window.api.togglePinMessage({ messageId, pinned: pinned_ })
    await fetchPinned(appStore.activeChannelId)
    await fetchMessages()
  }

  // ── Réactions ─────────────────────────────────────────────────────────────
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
    // Persister en DB (fire-and-forget)
    window.api.updateReactions(msgId, JSON.stringify(r))
  }

  async function deleteMessage(id: number) {
    await window.api.deleteMessage(id)
    messages.value = messages.value.filter((m) => m.id !== id)
    // Nettoyer le cache de réactions
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

  return {
    messages, pinned, loading, loadingMore, hasMore,
    searchTerm, firstUnreadId,
    reactions, userVotes,
    isGrouped, fetchMessages, loadOlderMessages, fetchPinned,
    sendMessage, togglePin,
    initReactions, toggleReaction, clearSearch,
    deleteMessage, editMessage,
  }
})
