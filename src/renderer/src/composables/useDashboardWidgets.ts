// ─── Composable : widgets du Dashboard (DMs, bookmarks, canaux, agenda…) ────
import { ref, computed, onUnmounted } from 'vue'
import { useRouter }       from 'vue-router'
import { useAppStore }     from '@/stores/app'
import { useModalsStore }  from '@/stores/modals'
import { useApi }          from '@/composables/useApi'
import { useToast }        from '@/composables/useToast'
import { STORAGE_KEYS }    from '@/constants'
import type { Ref }        from 'vue'
import type { GanttRow }   from './useDashboardTeacher'

// ── Types ────────────────────────────────────────────────────────────────────
export interface UnreadDmEntry { name: string; count: number }

export interface SavedMessage {
  id: number
  authorName: string
  authorInitials: string
  content: string
  createdAt: string
  isDm: boolean
  channelName: string | null
  dmStudentId: number | null
}

export interface AgendaItem {
  id: number | string
  type: 'deadline' | 'reminder' | 'soutenance'
  title: string
  time: string
  room: string | null
  channelName: string | null
}

export function useDashboardWidgets(
  allStudents: Ref<{ id: number; promo_id: number; name?: string }[]>,
  ganttFiltered: Ref<GanttRow[]>,
  allReminders: Ref<{ id: number; done: number; date: string; title: string }[]>,
  promos: Ref<{ id: number; name: string; color: string }[]>,
  reloadPromos: () => Promise<void>,
) {
  const appStore = useAppStore()
  const modals   = useModalsStore()
  const router   = useRouter()
  const { api }  = useApi()
  const { showToast } = useToast()

  // ── DMs non lus ──────────────────────────────────────────────────────────
  const unreadDmEntries = computed((): UnreadDmEntry[] => {
    return Object.entries(appStore.unreadDms)
      .filter(([, count]) => count > 0)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  })

  const totalUnreadDms = computed(() => unreadDmEntries.value.reduce((s, e) => s + e.count, 0))

  function openDmFromDashboard(name: string) {
    const student = allStudents.value.find(s => s.name === name)
    if (student) {
      const promoId = appStore.activePromoId ?? student.promo_id ?? 0
      appStore.openDm(student.id, promoId, name)
      router.push('/messages')
    }
  }

  // ── Messages enregistrés ────────────────────────────────────────────────
  function getSavedMessages(): SavedMessage[] {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKMARKS) || '[]')
      if (!Array.isArray(raw)) return []
      if (raw.length > 0 && typeof raw[0] === 'number') return []
      return raw as SavedMessage[]
    } catch { return [] }
  }

  const savedMessages = ref<SavedMessage[]>(getSavedMessages())

  function removeSavedMessage(msgId: number) {
    const filtered = getSavedMessages().filter(m => m.id !== msgId)
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(filtered))
    savedMessages.value = filtered
    showToast('Message retiré des favoris.', 'info')
  }

  function goToSavedMessage(msg: SavedMessage) {
    if (msg.isDm && msg.dmStudentId) {
      const student = allStudents.value.find(s => s.id === msg.dmStudentId)
      if (student) {
        appStore.openDm(student.id, appStore.activePromoId ?? student.promo_id ?? 0, msg.authorName)
      }
    }
    router.push('/messages')
  }

  function onStorageChange(e: StorageEvent) {
    if (e.key === STORAGE_KEYS.BOOKMARKS) savedMessages.value = getSavedMessages()
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorageChange)
  function cleanupStorage() { window.removeEventListener('storage', onStorageChange) }

  // ── Derniers messages de canal ──────────────────────────────────────────
  const recentChannelActivity = computed(() =>
    appStore.notificationHistory
      .filter(n => n.channelId != null && !n.dmStudentId)
      .slice(0, 5),
  )

  function goToChannel(channelId: number, channelName: string) {
    const promo = appStore.activePromoId ?? promos.value[0]?.id ?? 0
    appStore.openChannel(channelId, promo, channelName)
    router.push('/messages')
  }

  // ── Mentions non lues ──────────────────────────────────────────────────
  const unreadMentions = computed(() =>
    appStore.notificationHistory
      .filter(n => n.isMention && !n.read)
      .slice(0, 5),
  )

  const totalUnreadMentions = computed(() =>
    appStore.notificationHistory.filter(n => n.isMention && !n.read).length,
  )

  // ── Prochaines 48h ─────────────────────────────────────────────────────
  const next48h = computed((): AgendaItem[] => {
    const now = Date.now()
    const limit = now + 48 * 3600_000

    const deadlines: AgendaItem[] = ganttFiltered.value
      .filter(t => t.published && new Date(t.deadline).getTime() > now && new Date(t.deadline).getTime() <= limit)
      .map(t => ({
        id: t.id,
        type: t.type === 'soutenance' ? 'soutenance' : 'deadline',
        title: t.title,
        time: t.deadline,
        room: (t as { room?: string | null }).room ?? null,
        channelName: t.channel_name,
      }))

    const reminders: AgendaItem[] = allReminders.value
      .filter(r => !r.done && new Date(r.date).getTime() > now && new Date(r.date).getTime() <= limit)
      .map(r => ({
        id: `rem-${r.id}`,
        type: 'reminder' as const,
        title: r.title,
        time: r.date,
        room: null,
        channelName: null,
      }))

    return [...deadlines, ...reminders].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  })

  // ── Brouillons oubliés ────────────────────────────────────────────────
  const forgottenDrafts = computed(() => {
    const now = Date.now()
    const week = 7 * 86_400_000
    return ganttFiltered.value
      .filter(t => !t.published && new Date(t.deadline).getTime() > now && new Date(t.deadline).getTime() < now + week)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  })

  async function publishDraft(travailId: number) {
    const result = await api(() => window.api.updateTravailPublished({ travailId, published: true }))
    if (result !== null) {
      showToast('Devoir publié.', 'success')
      await reloadPromos()
    }
  }

  // ── Devoirs sans ressources ───────────────────────────────────────────
  const devoirsWithoutResources = ref<GanttRow[]>([])

  async function checkDevoirsResources() {
    const published = ganttFiltered.value.filter(t => t.published).slice(0, 20)
    const missing: GanttRow[] = []
    for (const t of published) {
      const data = await api<{ id: number }[]>(
        () => window.api.getRessources(t.id) as Promise<{ ok: boolean; data?: { id: number }[] }>,
      )
      if (!data || data.length === 0) missing.push(t)
    }
    devoirsWithoutResources.value = missing
  }

  return {
    // DMs
    unreadDmEntries, totalUnreadDms, openDmFromDashboard,
    // Saved messages
    savedMessages, removeSavedMessage, goToSavedMessage, cleanupStorage,
    // Channel activity
    recentChannelActivity, goToChannel,
    // Mentions
    unreadMentions, totalUnreadMentions,
    // Agenda 48h
    next48h,
    // Forgotten drafts
    forgottenDrafts, publishDraft,
    // Devoirs without resources
    devoirsWithoutResources, checkDevoirsResources,
  }
}
