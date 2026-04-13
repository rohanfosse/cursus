/**
 * Collaboration composable: Yjs CRDT + TipTap integration.
 * Manages the collaborative document state, awareness (cursors),
 * and persistence to the server.
 */
import { ref, onBeforeUnmount, type Ref } from 'vue'
import * as Y from 'yjs'
import { useAppStore } from '@/stores/app'

// Colors for collaborative cursors
const CURSOR_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
]

export interface CollabUser {
  name: string
  color: string
  userId: number
}

export function useCahierCollab(cahierId: Ref<number | null>) {
  const appStore = useAppStore()

  const ydoc = ref<Y.Doc | null>(null)
  const provider = ref<{ awareness: any; destroy: () => void } | null>(null)
  const connected = ref(false)
  const saving = ref(false)
  const connectedUsers = ref<CollabUser[]>([])

  let saveInterval: ReturnType<typeof setInterval> | null = null

  /** Initialize Yjs document and load state from server */
  async function init(id: number) {
    destroy()

    const doc = new Y.Doc()
    ydoc.value = doc

    // Load persisted state from server
    try {
      const res = await window.api.getCahierYjsState(id)
      if (res?.ok && res.data) {
        const uint8 = Uint8Array.from(atob(res.data), c => c.charCodeAt(0))
        Y.applyUpdate(doc, uint8)
      }
    } catch (e) {
      console.warn('[CahierCollab] Failed to load Yjs state:', e)
    }

    // Setup awareness (cursor positions)
    const { Awareness } = await import('y-protocols/awareness')
    const awareness = new Awareness(doc)

    const user = appStore.currentUser
    if (user) {
      const colorIdx = user.id % CURSOR_COLORS.length
      awareness.setLocalStateField('user', {
        name: user.name,
        color: CURSOR_COLORS[colorIdx],
        userId: user.id,
      })
    }

    // Track connected users
    awareness.on('change', () => {
      const states = awareness.getStates()
      const users: CollabUser[] = []
      states.forEach((state: any) => {
        if (state.user) users.push(state.user)
      })
      connectedUsers.value = users
    })

    provider.value = { awareness, destroy: () => awareness.destroy() }
    connected.value = true

    // Auto-save every 30 seconds
    saveInterval = setInterval(() => save(id), 30_000)

    // Save on document update (debounced)
    let saveTimeout: ReturnType<typeof setTimeout> | null = null
    doc.on('update', () => {
      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(() => save(id), 5_000)
    })
  }

  /** Save current Yjs state to server */
  async function save(id: number) {
    if (!ydoc.value || saving.value) return
    saving.value = true
    try {
      const state = Y.encodeStateAsUpdate(ydoc.value)
      const base64 = btoa(String.fromCharCode(...state))
      await window.api.saveCahierYjsState(id, base64)
    } catch (e) {
      console.warn('[CahierCollab] Save failed:', e)
    } finally {
      saving.value = false
    }
  }

  /** Cleanup */
  function destroy() {
    if (saveInterval) { clearInterval(saveInterval); saveInterval = null }
    if (ydoc.value && cahierId.value) {
      // Final save before cleanup
      save(cahierId.value)
    }
    provider.value?.destroy()
    provider.value = null
    ydoc.value?.destroy()
    ydoc.value = null
    connected.value = false
    connectedUsers.value = []
  }

  onBeforeUnmount(destroy)

  return {
    ydoc,
    provider,
    connected,
    saving,
    connectedUsers,
    init,
    save,
    destroy,
  }
}
