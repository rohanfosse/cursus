/**
 * Bookmark (favoris) d'un message — stockage localStorage avec métadonnées.
 * Used by ChatBubble.vue
 */
import { ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { STORAGE_KEYS } from '@/constants'
import type { Message } from '@/types'

interface SavedMessage {
  id: number
  authorName: string
  authorInitials: string
  content: string
  createdAt: string
  isDm: boolean
  channelName: string | null
  dmStudentId: number | null
}

function getSavedMessages(): SavedMessage[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS) || '[]')
    if (!Array.isArray(raw)) return []
    // Compatibilité : ancien format = number[]
    if (raw.length > 0 && typeof raw[0] === 'number') return []
    return raw as SavedMessage[]
  } catch { return [] }
}

/**
 * Bookmark (favoris) d'un message — stockage localStorage.
 */
export function useBubbleBookmarks(msg: () => Message) {
  const appStore = useAppStore()

  const isBookmarked = ref(getSavedMessages().some(m => m.id === msg().id))

  function toggleBookmark() {
    const saved = getSavedMessages()
    const idx = saved.findIndex(m => m.id === msg().id)
    if (idx === -1) {
      saved.push({
        id:             msg().id,
        authorName:     msg().author_name,
        authorInitials: msg().author_initials ?? msg().author_name.slice(0, 2).toUpperCase(),
        content:        msg().content.slice(0, 200),
        createdAt:      msg().created_at,
        isDm:           msg().dm_student_id != null,
        channelName:    appStore.activeChannelName || null,
        dmStudentId:    msg().dm_student_id ?? null,
      })
      isBookmarked.value = true
    } else {
      saved.splice(idx, 1)
      isBookmarked.value = false
    }
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(saved))
  }

  return { isBookmarked, toggleBookmark }
}
