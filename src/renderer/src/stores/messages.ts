import { ref, reactive } from 'vue'
import { defineStore } from 'pinia'
import { useAppStore } from './app'
import type { Message } from '@/types'

const GROUP_THRESHOLD_MS = 5 * 60 * 1000

export const useMessagesStore = defineStore('messages', () => {
  const appStore = useAppStore()

  const messages       = ref<Message[]>([])
  const pinned         = ref<Message[]>([])
  const loading        = ref(false)
  const searchTerm     = ref('')

  // Réactions en mémoire — non persistées (client-side uniquement)
  const reactions  = reactive<Record<number, Record<string, number>>>({})
  const userVotes  = reactive<Record<number, Set<string>>>({})

  // ── Groupement de messages ────────────────────────────────────────────────
  // Deux messages consécutifs du même auteur dans la même minute → grouped
  function isGrouped(msg: Message, prev: Message | null): boolean {
    if (!prev || searchTerm.value) return false
    if (msg.author_name !== prev.author_name) return false
    return new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_THRESHOLD_MS
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────
  async function fetchMessages() {
    loading.value = true
    try {
      const { activeChannelId, activeDmStudentId } = appStore
      let res: { ok: boolean; data: Message[] } | null = null

      if (searchTerm.value && activeChannelId) {
        res = await window.api.searchMessages(activeChannelId, searchTerm.value)
      } else if (activeChannelId) {
        res = await window.api.getChannelMessages(activeChannelId)
      } else if (activeDmStudentId) {
        res = await window.api.getDmMessages(activeDmStudentId)
      }

      messages.value = res?.ok ? res.data : []
    } finally {
      loading.value = false
    }
  }

  async function fetchPinned(channelId: number) {
    const res = await window.api.getPinnedMessages(channelId)
    pinned.value = res?.ok ? res.data : []
  }

  // ── Envoi ─────────────────────────────────────────────────────────────────
  async function sendMessage(content: string) {
    if (!appStore.currentUser || !content.trim()) return
    await window.api.sendMessage({
      channelId:    appStore.activeChannelId   ?? undefined,
      dmStudentId:  appStore.activeDmStudentId ?? undefined,
      authorId:     appStore.currentUser.id,
      content:      content.trim(),
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
    const base: Record<string, number> = { check: 0, thumb: 0, bulb: 0, question: 0, eye: 0 }
    if (dbJson) { try { Object.assign(base, JSON.parse(dbJson)) } catch {} }
    reactions[msgId] = base
    if (!userVotes[msgId]) userVotes[msgId] = new Set()
  }

  function toggleReaction(msgId: number, type: string) {
    const r    = reactions[msgId]
    const mine = userVotes[msgId]
    if (!r || !mine) return
    if (mine.has(type)) { mine.delete(type); r[type] = Math.max(0, (r[type] ?? 1) - 1) }
    else               { mine.add(type);    r[type] = (r[type] ?? 0) + 1 }
  }

  function clearSearch() {
    searchTerm.value = ''
  }

  return {
    messages, pinned, loading, searchTerm,
    reactions, userVotes,
    isGrouped, fetchMessages, fetchPinned,
    sendMessage, togglePin,
    initReactions, toggleReaction, clearSearch,
  }
})
