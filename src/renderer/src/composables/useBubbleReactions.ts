/**
 * Gestion des réactions emoji sur les messages (toggle, picker, liste affichée).
 * Used by ChatBubble.vue
 */
import { ref, computed } from 'vue'
import { useMessagesStore } from '@/stores/messages'
import { AVAILABLE_REACTS, useQuickReacts } from './useQuickReacts'
import type { Message } from '@/types'

/**
 * Legacy export : utilise pour le context menu (quick-emoji row) et pour
 * le mapping type -> emoji dans reactionsToShow. Couvre tous les types
 * disponibles, pas juste les 4 rapides.
 */
export const REACT_TYPES = AVAILABLE_REACTS.map(r => ({ type: r.type, emoji: r.emoji }))

/**
 * Réactions sur un message : toggle, picker, liste à afficher.
 */
export function useBubbleReactions(msg: () => Message) {
  const messagesStore = useMessagesStore()
  const showPicker = ref(false)
  // Reactions rapides personnalisables (4 favoris) — reactif.
  const { quickReacts } = useQuickReacts()

  function quickReact(type: string) { messagesStore.toggleReaction(msg().id, type) }

  function pickReact(type: string) {
    messagesStore.toggleReaction(msg().id, type)
    showPicker.value = false
  }

  function pickEmojiReact(emoji: string) {
    messagesStore.toggleReaction(msg().id, emoji)
    showPicker.value = false
  }

  // Map des types (check/thumb/fire/...) vers leur emoji, couvre tout le
  // catalogue. Les reactions arbitraires (via emoji picker) sont keyed par
  // emoji directement : key = emoji.
  const TYPE_TO_EMOJI = new Map(REACT_TYPES.map(t => [t.type, t.emoji]))

  const reactionsToShow = computed(() => {
    const r    = messagesStore.reactions[msg().id] ?? {}
    const mine = messagesStore.userVotes[msg().id] ?? new Set()
    const out: { type: string; emoji: string; count: number; isMine: boolean }[] = []
    for (const [key, count] of Object.entries(r)) {
      const n = count as number
      if (!n || n <= 0) continue
      const emoji = TYPE_TO_EMOJI.get(key) ?? key
      out.push({ type: key, emoji, count: n, isMine: mine.has(key) })
    }
    return out
  })

  return {
    REACT_TYPES,
    /** 4 reactions rapides choisies par l'utilisateur (reactif). */
    QUICK_REACTS: quickReacts,
    showPicker, quickReact, pickReact, pickEmojiReact,
    reactionsToShow,
  }
}
