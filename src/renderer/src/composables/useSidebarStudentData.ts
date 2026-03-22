/**
 * Composable bridging existing store data into sidebar-ready computeds for students.
 * Smart focus channels, next action, project progress, focus mode filtering.
 */
import { ref, computed, type Ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { deadlineClass } from '@/utils/date'
import type { Channel, Student } from '@/types'

export interface SmartFocusChannel {
  channel: Channel
  reason: string
  urgency: 'high' | 'medium' | 'low'
}

export interface NextAction {
  id: number
  title: string
  type: string
  category: string | null
  deadline: string
  isOverdue: boolean
}

export interface ProjectProgress {
  submitted: number
  total: number
  overdue: number
  pct: number
}

export function useSidebarStudentData(channels: Ref<Channel[]>) {
  const appStore = useAppStore()
  const travauxStore = useTravauxStore()

  let _fetched = false

  // Lazy load devoirs once
  function ensureDevoirs() {
    if (!_fetched && travauxStore.devoirs.length === 0) {
      _fetched = true
      travauxStore.fetchStudentDevoirs()
    }
  }

  // ── Smart Focus Channels ────────────────────────────────────────────────
  const smartFocusChannels = computed((): SmartFocusChannel[] => {
    ensureDevoirs()
    const now = Date.now()
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000
    const results: SmartFocusChannel[] = []

    for (const ch of channels.value) {
      const unreadCount = appStore.unread[ch.id] ?? 0

      // Check if any devoir on this channel has deadline < 3 days
      const urgentDevoir = travauxStore.devoirs.find(
        (d) =>
          d.channel_id === ch.id &&
          d.depot_id == null &&
          d.requires_submission !== 0 &&
          new Date(d.deadline).getTime() - now < THREE_DAYS,
      )

      if (urgentDevoir) {
        const dc = deadlineClass(urgentDevoir.deadline)
        const urgency: 'high' | 'medium' | 'low' =
          dc === 'deadline-passed' || dc === 'deadline-critical'
            ? 'high'
            : dc === 'deadline-soon'
              ? 'medium'
              : 'low'
        results.push({
          channel: ch,
          reason: `Deadline proche`,
          urgency,
        })
      } else if (unreadCount > 0) {
        results.push({
          channel: ch,
          reason: `${unreadCount} non lu${unreadCount > 1 ? 's' : ''}`,
          urgency: 'low',
        })
      }
    }

    // Sort by urgency (high first), then take max 3
    const order = { high: 0, medium: 1, low: 2 }
    results.sort((a, b) => order[a.urgency] - order[b.urgency])
    return results.slice(0, 3)
  })

  // ── Next Action ─────────────────────────────────────────────────────────
  const nextAction = computed((): NextAction | null => {
    ensureDevoirs()
    const pending = travauxStore.devoirs.filter(
      (d) => d.depot_id == null && d.requires_submission !== 0,
    )
    if (pending.length === 0) return null

    // Sort by deadline ascending (closest first)
    const sorted = [...pending].sort(
      (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
    )
    const d = sorted[0]
    return {
      id: d.id,
      title: d.title,
      type: d.type,
      category: d.category,
      deadline: d.deadline,
      isOverdue: new Date(d.deadline).getTime() < Date.now(),
    }
  })

  // ── Project Progress ────────────────────────────────────────────────────
  const projectProgress = computed((): Record<string, ProjectProgress> => {
    ensureDevoirs()
    const map: Record<string, ProjectProgress> = {}

    for (const d of travauxStore.devoirs) {
      const cat = d.category?.trim()
      if (!cat) continue
      if (!map[cat]) map[cat] = { submitted: 0, total: 0, overdue: 0, pct: 0 }
      map[cat].total++
      if (d.depot_id != null) {
        map[cat].submitted++
      } else if (new Date(d.deadline).getTime() < Date.now()) {
        map[cat].overdue++
      }
    }

    for (const key of Object.keys(map)) {
      map[key].pct =
        map[key].total > 0
          ? Math.round((map[key].submitted / map[key].total) * 100)
          : 0
    }

    return map
  })

  // ── Total Unread ────────────────────────────────────────────────────────
  const totalUnread = computed(() => {
    let sum = 0
    for (const v of Object.values(appStore.unread)) sum += v
    return sum
  })

  // ── Focus Mode ──────────────────────────────────────────────────────────
  const focusModeActive = ref(false)

  function focusFilterChannels(chs: Channel[]): Channel[] {
    if (!focusModeActive.value) return chs
    // In focus mode, hide channels with no unread and no pending devoirs
    return chs.filter((ch) => {
      const hasUnread = (appStore.unread[ch.id] ?? 0) > 0
      const hasPendingDevoir = travauxStore.devoirs.some(
        (d) =>
          d.channel_id === ch.id &&
          d.depot_id == null &&
          d.requires_submission !== 0,
      )
      return hasUnread || hasPendingDevoir
    })
  }

  function focusFilterDms(dms: Student[]): Student[] {
    if (!focusModeActive.value) return dms
    // In focus mode, hide DMs without recent messages (unread)
    return dms.filter((s) => {
      return !!appStore.unreadDms[s.name]
    })
  }

  return {
    smartFocusChannels,
    nextAction,
    projectProgress,
    totalUnread,
    focusModeActive,
    focusFilterChannels,
    focusFilterDms,
  }
}
