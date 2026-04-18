/**
 * Collaboration composable: Yjs CRDT + TipTap integration.
 * Manages the collaborative document state, awareness (cursors),
 * and persistence to the server.
 *
 * Resilience :
 *  - encodage base64 par chunks (evite RangeError sur > ~100KB avec spread)
 *  - serialisation des saves (evite resultats divergents)
 *  - retry avec backoff exponentiel en cas d'echec
 *  - clean-up strict des timers a destroy() (pas de save apres unmount)
 *  - generation numero pour ignorer les inits concurrentes
 */
import { ref, onBeforeUnmount, type Ref } from 'vue'
import * as Y from 'yjs'
import { useAppStore } from '@/stores/app'

// Colors for collaborative cursors
const CURSOR_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
]

const MAX_YJS_STATE_BYTES = 5 * 1024 * 1024 // mirror serveur
const DEBOUNCE_MS = 5_000
const AUTOSAVE_MS = 30_000
const MAX_RETRIES = 3

export interface CollabUser {
  name: string
  color: string
  userId: number
}

/** Encode a Uint8Array en base64 sans depasser la call stack (chunked). */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000 // 32KB chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk as unknown as number[])
  }
  return btoa(binary)
}

/** Decode base64 vers Uint8Array ; retourne null si invalide. */
function base64ToUint8(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

export function useCahierCollab(cahierId: Ref<number | null>) {
  const appStore = useAppStore()

  const ydoc = ref<Y.Doc | null>(null)
  const provider = ref<{ awareness: unknown; destroy: () => void } | null>(null)
  const connected = ref(false)
  const saving = ref(false)
  const saveError = ref<string | null>(null)
  const connectedUsers = ref<CollabUser[]>([])

  let saveInterval: ReturnType<typeof setInterval> | null = null
  let saveTimeout: ReturnType<typeof setTimeout> | null = null
  let retryTimeout: ReturnType<typeof setTimeout> | null = null
  let pendingSave = false   // une sauvegarde a ete demandee pendant que saving=true
  let initGeneration = 0    // invalide les callbacks async des inits precedents

  /** Initialize Yjs document and load state from server */
  async function init(id: number) {
    destroy()
    const myGen = ++initGeneration

    const doc = new Y.Doc()
    ydoc.value = doc

    // Load persisted state from server
    try {
      const res = await (window as any).api.getCahierYjsState(id)
      if (myGen !== initGeneration) { doc.destroy(); return }
      if (res?.ok && res.data) {
        const uint8 = base64ToUint8(res.data)
        if (uint8) {
          Y.applyUpdate(doc, uint8)
        } else {
          console.warn('[CahierCollab] Invalid base64 state from server')
        }
      }
    } catch (e) {
      console.warn('[CahierCollab] Failed to load Yjs state:', e)
    }

    if (myGen !== initGeneration) { doc.destroy(); return }

    // Setup awareness (cursor positions)
    const { Awareness } = await import('y-protocols/awareness')
    if (myGen !== initGeneration) { doc.destroy(); return }
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
      states.forEach((state: Record<string, unknown>) => {
        if (state.user) users.push(state.user as CollabUser)
      })
      connectedUsers.value = users
    })

    provider.value = { awareness, destroy: () => awareness.destroy() }
    connected.value = true

    // Auto-save every 30 seconds
    saveInterval = setInterval(() => { void save(id) }, AUTOSAVE_MS)

    // Save on document update (debounced)
    doc.on('update', () => {
      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(() => { void save(id) }, DEBOUNCE_MS)
    })
  }

  /** Save current Yjs state to server, with retry backoff. */
  async function save(id: number, attempt = 0): Promise<void> {
    if (!ydoc.value) return
    if (saving.value) {
      pendingSave = true
      return
    }
    saving.value = true
    saveError.value = null
    try {
      const state = Y.encodeStateAsUpdate(ydoc.value)
      if (state.length > MAX_YJS_STATE_BYTES) {
        saveError.value = 'Document trop volumineux (> 5 Mo)'
        console.error('[CahierCollab] State too large:', state.length)
        return
      }
      const base64 = uint8ToBase64(state)
      const res = await (window as any).api.saveCahierYjsState(id, base64)
      if (res && res.ok === false) {
        throw new Error(res.error || 'Erreur sauvegarde')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('[CahierCollab] Save failed:', msg)
      saveError.value = msg
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(30_000, 1_000 * Math.pow(2, attempt))
        if (retryTimeout) clearTimeout(retryTimeout)
        retryTimeout = setTimeout(() => {
          // Ne pas retry si destroy() entretemps (ydoc null)
          if (ydoc.value) void save(id, attempt + 1)
        }, delay)
      }
    } finally {
      saving.value = false
      if (pendingSave) {
        pendingSave = false
        // Une autre sauvegarde a ete demandee pendant celle-ci : replanifie proche
        if (saveTimeout) clearTimeout(saveTimeout)
        saveTimeout = setTimeout(() => { void save(id) }, 500)
      }
    }
  }

  /** Cleanup */
  function destroy() {
    initGeneration++ // invalide toute init async en cours
    if (saveInterval) { clearInterval(saveInterval); saveInterval = null }
    if (saveTimeout)  { clearTimeout(saveTimeout); saveTimeout = null }
    if (retryTimeout) { clearTimeout(retryTimeout); retryTimeout = null }

    // Tentative de sauvegarde finale (best effort, sans retry)
    if (ydoc.value && cahierId.value) {
      void save(cahierId.value)
    }
    provider.value?.destroy()
    provider.value = null
    ydoc.value?.destroy()
    ydoc.value = null
    connected.value = false
    connectedUsers.value = []
    pendingSave = false
  }

  onBeforeUnmount(destroy)

  return {
    ydoc,
    provider,
    connected,
    saving,
    saveError,
    connectedUsers,
    init,
    save,
    destroy,
  }
}
