/**
 * useDemoMessagesPoll - poll silencieux du canal/DM actif en mode demo
 * pour faire apparaitre les messages inseres par les bots (demoBots.js)
 * sans changer de canal manuellement.
 *
 * Rationale : en demo, pas de socket.io, donc les messages crees en arriere-
 * plan par les bots (typing -> insert apres 2.5s) restent invisibles tant
 * que le visiteur ne switche pas de canal. Resultat ergo : il voit
 * "Sara est en train d'ecrire..." mais aucun message ne suit.
 *
 * Strategie : toutes les 10s, on refait getChannelMessagesPage /
 * getDmMessagesPage sur la conversation active et on upsert les messages
 * dont l'id est superieur au max courant. Pas de set loading=true, pas
 * de remplacement de l'array : just append. Aucun flicker.
 */
import { onUnmounted, watch } from 'vue'
import { useAppStore }      from '@/stores/app'
import { useMessagesStore } from '@/stores/messages'
import type { Message }      from '@/types'

const POLL_INTERVAL_MS = 10_000

export function useDemoMessagesPoll(): void {
  const appStore      = useAppStore()
  const messagesStore = useMessagesStore()
  let timer: ReturnType<typeof setTimeout> | null = null

  async function pollOnce(): Promise<void> {
    if (!appStore.currentUser?.demo) return
    const channelId   = appStore.activeChannelId
    const dmStudentId = appStore.activeDmStudentId
    if (!channelId && !dmStudentId) return
    // Skip si l'utilisateur est en train de chercher : eviter d'ecraser
    // les resultats de recherche par les messages live.
    if (messagesStore.searchTerm) return

    let messages: Message[] | null = null
    try {
      if (channelId) {
        const res = await window.api.getChannelMessagesPage(channelId)
        if (res?.ok && Array.isArray(res.data)) messages = res.data
      } else if (dmStudentId) {
        const peer = appStore.activeDmPeerId ?? undefined
        const res = await window.api.getDmMessagesPage(dmStudentId, undefined, peer)
        if (res?.ok && Array.isArray(res.data)) messages = res.data
      }
    } catch { return }

    if (!messages || !messages.length) return

    // L'API renvoie la page en ordre DESC (id decroissant). On upsert tous
    // les messages dont l'id depasse le max actuellement affiche : c'est
    // le moyen le plus simple de capter les nouveaux inserts bot.
    const currentMaxId = messagesStore.messages.length
      ? Math.max(...messagesStore.messages.map((m: Message) => m.id))
      : 0

    const newMessages = messages.filter((m: Message) => m.id > currentMaxId)
    if (!newMessages.length) return

    // Upsert dans l'ordre chronologique (id ASC) pour conserver l'ordre.
    for (const m of newMessages.sort((a: Message, b: Message) => a.id - b.id)) {
      messagesStore.upsertMessage(m)
    }
  }

  function schedule(): void {
    timer = setTimeout(() => {
      pollOnce().finally(() => {
        if (appStore.currentUser?.demo) schedule()
        else timer = null
      })
    }, POLL_INTERVAL_MS)
  }

  function start(): void { if (!timer) schedule() }
  function stop(): void  { if (timer) { clearTimeout(timer); timer = null } }

  watch(
    () => appStore.currentUser?.demo === true,
    (isDemo) => { if (isDemo) start(); else stop() },
    { immediate: true },
  )

  onUnmounted(stop)
}
