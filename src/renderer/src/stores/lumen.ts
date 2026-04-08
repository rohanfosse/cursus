/** Store Lumen — cours markdown publies par les enseignants. */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi'
import type { LumenCourse } from '@/types'

export const useLumenStore = defineStore('lumen', () => {
  const { api } = useApi()

  // ── Etat ──────────────────────────────────────────────────────────────────
  const courses       = ref<LumenCourse[]>([])
  const currentCourse = ref<LumenCourse | null>(null)
  const loading       = ref(false)

  // Cours publies non lus par l'etudiant courant pour la promo active.
  // Alimente le badge rail Lumen et le widget dashboard "Nouveaux cours".
  const unreadCourses = ref<LumenCourse[]>([])
  const unreadCount   = ref(0)

  // ── Computed ─────────────────────────────────────────────────────────────
  const publishedCourses = computed(() => courses.value.filter(c => c.status === 'published'))
  const draftCourses     = computed(() => courses.value.filter(c => c.status === 'draft'))

  // ── Actions ──────────────────────────────────────────────────────────────

  async function fetchCoursesForPromo(promoId: number): Promise<void> {
    loading.value = true
    try {
      const data = await api<LumenCourse[]>(
        () => window.api.getLumenCoursesForPromo(promoId),
        { silent: true },
      )
      courses.value = data ?? []
    } finally {
      loading.value = false
    }
  }

  async function fetchCourse(id: number): Promise<LumenCourse | null> {
    loading.value = true
    try {
      const data = await api<LumenCourse>(() => window.api.getLumenCourse(id))
      if (data) currentCourse.value = data
      return data
    } finally {
      loading.value = false
    }
  }

  async function createCourse(payload: { promoId: number; projectId?: number | null; title: string; summary?: string; content?: string }): Promise<LumenCourse | null> {
    loading.value = true
    try {
      const data = await api<LumenCourse>(() => window.api.createLumenCourse(payload))
      if (data) {
        courses.value = [data, ...courses.value]
        currentCourse.value = data
      }
      return data
    } finally {
      loading.value = false
    }
  }

  async function updateCourse(id: number, payload: { title?: string; summary?: string; content?: string; projectId?: number | null }): Promise<LumenCourse | null> {
    const data = await api<LumenCourse>(() => window.api.updateLumenCourse(id, payload))
    if (data) {
      const idx = courses.value.findIndex(c => c.id === id)
      if (idx !== -1) courses.value = [...courses.value.slice(0, idx), data, ...courses.value.slice(idx + 1)]
      if (currentCourse.value?.id === id) currentCourse.value = data
    }
    return data
  }

  async function publishCourse(id: number): Promise<boolean> {
    const data = await api<LumenCourse>(() => window.api.publishLumenCourse(id))
    if (data) {
      const idx = courses.value.findIndex(c => c.id === id)
      if (idx !== -1) courses.value = [...courses.value.slice(0, idx), data, ...courses.value.slice(idx + 1)]
      if (currentCourse.value?.id === id) currentCourse.value = data
      return true
    }
    return false
  }

  async function unpublishCourse(id: number): Promise<boolean> {
    const data = await api<LumenCourse>(() => window.api.unpublishLumenCourse(id))
    if (data) {
      const idx = courses.value.findIndex(c => c.id === id)
      if (idx !== -1) courses.value = [...courses.value.slice(0, idx), data, ...courses.value.slice(idx + 1)]
      if (currentCourse.value?.id === id) currentCourse.value = data
      return true
    }
    return false
  }

  async function deleteCourse(id: number): Promise<boolean> {
    const data = await api<{ id: number; deleted: boolean }>(() => window.api.deleteLumenCourse(id))
    if (data?.deleted) {
      courses.value = courses.value.filter(c => c.id !== id)
      if (currentCourse.value?.id === id) currentCourse.value = null
      return true
    }
    return false
  }

  function clearCurrentCourse() {
    currentCourse.value = null
  }

  // ── Tracking lecture etudiant ────────────────────────────────────────────

  /** Charge les cours publies non lus de l'etudiant pour une promo. */
  async function fetchUnread(promoId: number): Promise<void> {
    const data = await api<{ count: number; courses: LumenCourse[] }>(
      () => window.api.getLumenUnreadForPromo(promoId),
      { silent: true },
    )
    if (data) {
      unreadCourses.value = data.courses
      unreadCount.value   = data.count
    }
  }

  /**
   * Marque un cours comme lu (best-effort, fire-and-forget cote UX).
   * Mise a jour optimiste : retire le cours de la liste non-lus immediatement.
   * Idempotent : appeler plusieurs fois ne casse rien.
   */
  async function markAsRead(courseId: number): Promise<void> {
    const wasUnread = unreadCourses.value.some(c => c.id === courseId)
    if (wasUnread) {
      unreadCourses.value = unreadCourses.value.filter(c => c.id !== courseId)
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
    try {
      await api(() => window.api.markLumenCourseRead(courseId), { silent: true })
    } catch {
      // Echec silencieux : le prochain fetchUnread resynchronisera l'etat.
    }
  }

  /**
   * Reset complet : utilise au logout ou changement de promo pour eviter
   * de mixer les compteurs entre promos.
   */
  function resetUnread() {
    unreadCourses.value = []
    unreadCount.value = 0
  }

  /**
   * Handler socket : un cours vient d'etre publie sur la promo active.
   * Recharge la liste des cours et le compteur de non-lus.
   */
  async function onCoursePublished(promoId: number, activePromoId: number | null) {
    if (activePromoId !== promoId) return
    await Promise.all([
      fetchCoursesForPromo(promoId),
      fetchUnread(promoId),
    ])
  }

  return {
    courses, currentCourse, loading,
    unreadCourses, unreadCount,
    publishedCourses, draftCourses,
    fetchCoursesForPromo, fetchCourse,
    createCourse, updateCourse,
    publishCourse, unpublishCourse, deleteCourse,
    clearCurrentCourse,
    fetchUnread, markAsRead, resetUnread, onCoursePublished,
  }
})
