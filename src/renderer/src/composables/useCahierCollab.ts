/**
 * Collaboration composable : Yjs CRDT + Hocuspocus WebSocket.
 *
 * Client attache un HocuspocusProvider par cahier. Le serveur :
 *   - verifie le JWT + ownership (canAccessCahier, source partagee avec HTTP)
 *   - charge le yjs_state BLOB au premier connect
 *   - persiste sur chaque update (debounce 2s cote Hocuspocus)
 *   - broadcast les updates a tous les clients du room
 *
 * Etats exposes au UI :
 *   connected  : socket ouvert
 *   saving     : updates locales en cours de sync
 *   kicked     : auth refusee -> l'editeur doit passer en read-only
 *   saveError  : message d'erreur derniere operation
 */
import { ref, shallowRef, onBeforeUnmount, type Ref } from 'vue'
import { HocuspocusProvider, type HocuspocusProviderConfiguration } from '@hocuspocus/provider'
import * as Y from 'yjs'
import { useAppStore } from '@/stores/app'
import { getAuthToken } from '@/utils/auth'

// Palette curseurs collaborateurs - stable par user id
const CURSOR_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
]

export function colorForUser(userId: number): string {
  const idx = Math.abs(userId) % CURSOR_COLORS.length
  return CURSOR_COLORS[idx]
}

export interface CollabUser {
  name: string
  color: string
  userId: number
}

/** Convert http(s) -> ws(s) en utilisant l'API URL (robuste aux paths contenant "http"). */
function toWsUrl(httpUrl: string): string {
  const u = new URL(httpUrl)
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
  return u.toString().replace(/\/$/, '')
}

function getServerUrl(): string {
  const envUrl = import.meta.env?.VITE_SERVER_URL as string | undefined
  return envUrl || 'http://localhost:3001'
}

export function useCahierCollab(_cahierId: Ref<number | null>) {
  const appStore = useAppStore()

  const ydoc = shallowRef<Y.Doc | null>(null)
  const provider = shallowRef<HocuspocusProvider | null>(null)
  const connected = ref(false)
  const saving = ref(false)
  const saveError = ref<string | null>(null)
  const kicked = ref(false)
  const connectedUsers = ref<CollabUser[]>([])

  let initGeneration = 0
  let awarenessHandler: (() => void) | null = null

  /** Connect to the Hocuspocus server for the given cahier. */
  async function init(id: number) {
    destroy()
    const myGen = ++initGeneration

    const token = getAuthToken()
    if (!token) {
      saveError.value = 'Non authentifie'
      kicked.value = true
      return
    }

    const doc = new Y.Doc()
    ydoc.value = doc

    const config: HocuspocusProviderConfiguration = {
      url: `${toWsUrl(getServerUrl())}/collaboration`,
      name: `cahier-${id}`,
      document: doc,
      token,
      onStatus({ status }) {
        if (myGen !== initGeneration) return
        connected.value = status === 'connected'
      },
      onSynced({ state }) {
        if (myGen !== initGeneration) return
        if (state) saving.value = false
      },
      onAuthenticationFailed({ reason }) {
        if (myGen !== initGeneration) return
        saveError.value = reason || 'Authentification refusee'
        kicked.value = true
        connected.value = false
      },
      onDisconnect() {
        if (myGen !== initGeneration) return
        connected.value = false
      },
    }
    const hp = new HocuspocusProvider(config)

    if (myGen !== initGeneration) { hp.destroy(); doc.destroy(); return }
    provider.value = hp

    // Awareness : expose l'utilisateur courant + observe les autres
    const user = appStore.currentUser
    if (user) {
      hp.awareness?.setLocalStateField('user', {
        name: user.name,
        color: colorForUser(user.id),
        userId: user.id,
      })
    }

    const handler = () => {
      if (myGen !== initGeneration) return
      const states = hp.awareness?.getStates()
      const users: CollabUser[] = []
      states?.forEach((state) => {
        const maybe = (state as Record<string, unknown>).user
        if (maybe && typeof maybe === 'object') {
          const u = maybe as Partial<CollabUser>
          if (typeof u.name === 'string' && typeof u.color === 'string' && typeof u.userId === 'number') {
            users.push({ name: u.name, color: u.color, userId: u.userId })
          }
        }
      })
      connectedUsers.value = users
    }
    awarenessHandler = handler
    hp.awareness?.on('change', handler)

    // Indicateur passif : doc.update local -> saving=true, reset par onSynced
    doc.on('update', (_update, origin) => {
      if (origin !== hp) saving.value = true
    })
  }

  /** Flush avant fermeture : HocuspocusProvider envoie ses updates queued sur disconnect. */
  function flush() {
    const hp = provider.value
    if (!hp) return
    try { hp.disconnect() } catch { /* ignore */ }
  }

  function onBeforeUnload() { flush() }
  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') flush()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('beforeunload', onBeforeUnload)

  /** Cleanup idempotent */
  function destroy() {
    initGeneration++
    const hp = provider.value
    if (hp && awarenessHandler) {
      try { hp.awareness?.off('change', awarenessHandler) } catch { /* ignore */ }
    }
    awarenessHandler = null
    hp?.destroy()
    provider.value = null
    ydoc.value?.destroy()
    ydoc.value = null
    connected.value = false
    connectedUsers.value = []
    saving.value = false
    saveError.value = null
    kicked.value = false
  }

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('beforeunload', onBeforeUnload)
    destroy()
  })

  return {
    ydoc,
    provider,
    connected,
    saving,
    saveError,
    kicked,
    connectedUsers,
    init,
    flush,
    destroy,
  }
}
