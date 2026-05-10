/**
 * useUnreadCounts - compteurs de "non lus" centralises pour les badges UI.
 *
 * Avant cet extract, NavRail / MobileNav / MobileAppsSheet / App.vue
 * recalculaient chacun leurs `Object.values(...).reduce(...)` sur `unread`,
 * `unreadDms`, `mentionChannels` et `notificationHistory.filter(!read)`.
 * Resultat : 4 implementations divergentes (l'une exclut messages,
 * l'autre inclut grade/deadline, etc.) et un risque que le badge de la
 * barre des taches Windows affiche un total different du badge dans
 * l'UI sur la meme machine.
 *
 * Ce composable expose des refs computed deduplques. Pinia memoise via
 * la reactivite ; chaque computed ne rerun que si la source change.
 */
import { computed, type ComputedRef } from 'vue'
import { useAppStore } from '@/stores/app'

interface UnreadCounts {
  /** Total messages non lus dans les canaux (toutes mentions confondues). */
  channelUnread:    ComputedRef<number>
  /** Total mentions @ recues dans des canaux. */
  channelMentions:  ComputedRef<number>
  /** Total messages directs non lus (par auteur). */
  dmUnread:         ComputedRef<number>
  /** DM + mentions canal. Utilise pour le badge rouge de l'icone Messages. */
  messagesBadge:    ComputedRef<number>
  /** Notifications non lues, toutes categories. */
  notificationsUnread: ComputedRef<number>
  /** Notifications "actionnables" (grade, deadline, assignment, spark, pulse, live).
   *  Sert au badge barre des taches Windows : on ne flash pas pour un message
   *  qui s'affiche deja avec son propre badge. */
  taskbarBadge:     ComputedRef<number>
}

function sumValues(record: Record<string | number, number> | undefined): number {
  if (!record) return 0
  let total = 0
  for (const v of Object.values(record)) total += v
  return total
}

const TASKBAR_NOTIF_CATEGORIES = new Set(['grade', 'deadline', 'assignment', 'spark', 'pulse', 'live'])

export function useUnreadCounts(): UnreadCounts {
  const appStore = useAppStore()

  const channelUnread    = computed(() => sumValues(appStore.unread))
  const channelMentions  = computed(() => sumValues(appStore.mentionChannels))
  const dmUnread         = computed(() => sumValues(appStore.unreadDms))
  const messagesBadge    = computed(() => dmUnread.value + channelMentions.value)
  const notificationsUnread = computed(() =>
    appStore.notificationHistory.reduce((acc, n) => acc + (n.read ? 0 : 1), 0),
  )
  const taskbarBadge = computed(() => {
    const dm  = dmUnread.value
    const men = channelMentions.value
    const notif = appStore.notificationHistory.reduce(
      (acc, n) => acc + (!n.read && TASKBAR_NOTIF_CATEGORIES.has(n.category) ? 1 : 0),
      0,
    )
    return dm + men + notif
  })

  return {
    channelUnread,
    channelMentions,
    dmUnread,
    messagesBadge,
    notificationsUnread,
    taskbarBadge,
  }
}
