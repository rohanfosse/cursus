/**
 * Gestion des réactions emoji sur les messages (toggle, picker, liste affichée).
 * Used by ChatBubble.vue
 */
import { ref, computed } from 'vue'
import { useMessagesStore } from '@/stores/messages'
import type { Message } from '@/types'

const REACT_TYPES = [
  { type: 'check', emoji: '✅' },
  { type: 'thumb', emoji: '👍' },
  { type: 'fire',  emoji: '🔥' },
  { type: 'heart', emoji: '❤️' },
  { type: 'think', emoji: '🤔' },
  { type: 'eyes',  emoji: '👀' },
]

const QUICK_REACTS = REACT_TYPES.slice(0, 4)

/**
 * Réactions sur un message : toggle, picker, liste à afficher.
 */
export function useBubbleReactions(msg: () => Message) {
  const messagesStore = useMessagesStore()
  const showPicker = ref(false)

  function quickReact(type: string) { messagesStore.toggleReaction(msg().id, type) }

  function pickReact(type: string) {
    messagesStore.toggleReaction(msg().id, type)
    showPicker.value = false
  }

  function pickEmojiReact(emoji: string) {
    messagesStore.toggleReaction(msg().id, emoji)
    showPicker.value = false
  }

  const reactionsToShow = computed(() => {
    const r    = messagesStore.reactions[msg().id] ?? {}
    const mine = messagesStore.userVotes[msg().id] ?? new Set()
    return REACT_TYPES.filter((t) => (r[t.type] ?? 0) > 0).map((t) => ({
      ...t,
      count:  r[t.type] as number,
      isMine: mine.has(t.type),
    }))
  })

  return {
    REACT_TYPES, QUICK_REACTS,
    showPicker, quickReact, pickReact, pickEmojiReact,
    reactionsToShow,
  }
}
