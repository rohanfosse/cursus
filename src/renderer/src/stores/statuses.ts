import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi'

export interface UserStatus {
  emoji: string | null
  text: string | null
  expiresAt: string | null
}

/**
 * Store global des statuts utilisateurs.
 *
 * Map<userId, UserStatus> — alimente par :
 *   1. GET /api/statuses au login (chargement initial)
 *   2. presence:update (fallback si un user se connecte avec un statut deja set)
 *   3. status:change (temps reel : set / clear / expiration cote cron)
 *
 * Utilise par Avatar.vue (badge emoji), listes de membres, onlineUsers.
 */
export const useStatusesStore = defineStore('statuses', () => {
  const { api } = useApi()

  const byUserId = ref<Map<number, UserStatus>>(new Map())
  const mine = ref<UserStatus | null>(null)
  const loaded = ref(false)

  function get(userId: number): UserStatus | null {
    return byUserId.value.get(userId) ?? null
  }

  const activeCount = computed(() => byUserId.value.size)

  async function init(userId: number | null): Promise<void> {
    if (loaded.value) return
    const all = await api(() => window.api.listUserStatuses(), { silent: true })
    if (all) {
      const m = new Map<number, UserStatus>()
      for (const s of all) m.set(s.userId, { emoji: s.emoji, text: s.text, expiresAt: s.expiresAt })
      byUserId.value = m
      if (userId != null) mine.value = m.get(userId) ?? null
      loaded.value = true
    }
  }

  /** Applique un changement de statut re cu via socket. */
  function apply(userId: number, status: UserStatus | null): void {
    const next = new Map(byUserId.value)
    if (!status || (!status.emoji && !status.text)) next.delete(userId)
    else next.set(userId, status)
    byUserId.value = next
  }

  /** Remplace en bloc (appele par presence:update). */
  function applyBulk(statuses: Array<{ userId: number; status: UserStatus | null }>): void {
    const next = new Map(byUserId.value)
    for (const { userId, status } of statuses) {
      if (!status || (!status.emoji && !status.text)) next.delete(userId)
      else next.set(userId, status)
    }
    byUserId.value = next
  }

  async function setMine(status: UserStatus | null): Promise<boolean> {
    if (!status || (!status.emoji && !status.text)) {
      const res = await api(() => window.api.clearMyStatus(), { context: 'edit' })
      if (res) {
        mine.value = null
        return true
      }
      return false
    }
    const res = await api(() => window.api.setMyStatus(status), { context: 'edit' })
    if (res) {
      mine.value = { emoji: res.emoji, text: res.text, expiresAt: res.expiresAt }
      return true
    }
    return false
  }

  function reset(): void {
    byUserId.value = new Map()
    mine.value = null
    loaded.value = false
  }

  return { byUserId, mine, loaded, activeCount, get, init, apply, applyBulk, setMine, reset }
})
