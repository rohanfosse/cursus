/**
 * useBooking — composable pour la gestion des types d'evenements,
 * disponibilites, reservations et OAuth Microsoft.
 */
import { ref, computed } from 'vue'
import { useToast } from '@/composables/useToast'
import { formatBookingDate, formatBookingTime } from '@/utils/bookingDate'
import { SERVER_URL } from '@/composables/useBookingApi'
import { toRawPayload } from '@/utils/ipcSafe'

// ── Types ────────────────────────────────────────────────────────────────────

export interface EventType {
  id: number
  title: string
  slug: string
  description?: string
  duration_minutes: number
  buffer_minutes: number
  timezone: string
  color: string
  fallback_visio_url?: string
  is_active: number
  is_public: number
  use_jitsi: number
  created_at: string
}

export interface AvailabilityRule {
  id: number
  day_of_week: number
  start_time: string
  end_time: string
}

export interface Booking {
  id: number
  date: string
  start_time: string
  end_time: string
  student_name?: string
  tutor_name?: string
  status: string
  event_type_title?: string
  visio_url?: string
}

// ── Composable ───────────────────────────────────────────────────────────────

export function useBooking() {
  const { showToast } = useToast()

  const loading = ref(true)
  const eventTypes = ref<EventType[]>([])
  const availability = ref<AvailabilityRule[]>([])
  const bookings = ref<Booking[]>([])
  const savingAvailability = ref(false)

  const sortedBookings = computed(() => {
    return [...bookings.value].sort((a, b) => {
      const da = `${a.date}T${a.start_time}`
      const db = `${b.date}T${b.start_time}`
      return da.localeCompare(db)
    })
  })

  const rulesByDay = computed(() => {
    const map: Record<number, AvailabilityRule[]> = {}
    for (const r of availability.value) {
      (map[r.day_of_week] ??= []).push(r)
    }
    return map
  })

  // ── Fetch all data ─────────────────────────────────────────────────────

  async function fetchAll() {
    loading.value = true
    try {
      const [etRes, avRes, bkRes] = await Promise.all([
        window.api.getBookingEventTypes(),
        window.api.getBookingAvailability(),
        window.api.getMyBookings(),
      ])
      if (etRes.ok && etRes.data) eventTypes.value = etRes.data
      if (avRes.ok && avRes.data) availability.value = avRes.data
      if (bkRes.ok && bkRes.data) bookings.value = bkRes.data as Booking[]
    } catch {
      showToast('Erreur lors du chargement des donnees de reservation', 'error')
    } finally {
      loading.value = false
    }
  }

  // ── Event Types ────────────────────────────────────────────────────────

  async function createEventType(data: {
    title: string; slug: string; description?: string
    duration_minutes: number; buffer_minutes?: number; timezone?: string; color: string; fallback_visio_url?: string
  }) {
    try {
      const res = await window.api.createBookingEventType(toRawPayload(data))
      if (res.ok) {
        showToast('Type de rendez-vous cree', 'success')
        const etRes = await window.api.getBookingEventTypes()
        if (etRes.ok && etRes.data) eventTypes.value = etRes.data
        return true
      }
      showToast(res.error || 'Erreur lors de la creation', 'error')
      return false
    } catch {
      showToast('Erreur lors de la creation du type', 'error')
      return false
    }
  }

  async function toggleActive(et: EventType) {
    try {
      const next = et.is_active ? 0 : 1
      const res = await window.api.updateBookingEventType(et.id, { is_active: next })
      if (res.ok) {
        eventTypes.value = eventTypes.value.map(e =>
          e.id === et.id ? { ...e, is_active: next } : e,
        )
      } else {
        showToast(res.error || 'Erreur', 'error')
      }
    } catch {
      showToast('Erreur lors de la mise a jour', 'error')
    }
  }

  /** Active/desactive le mode "lien public ouvert" (Calendly classique). */
  async function togglePublic(et: EventType) {
    try {
      const next = et.is_public ? 0 : 1
      const res = await window.api.updateBookingEventType(et.id, { is_public: next })
      if (res.ok) {
        // Le backend peut allonger le slug a l'activation (anti-enumeration) ;
        // on relit l'event-type plutot que de patcher localement.
        const refreshed = res.data as EventType | undefined
        if (refreshed && refreshed.id) {
          const slugChanged = refreshed.slug !== et.slug
          eventTypes.value = eventTypes.value.map(e => e.id === et.id ? refreshed : e)
          if (next && slugChanged) {
            showToast(`Lien public active. Slug allonge en "${refreshed.slug}" pour la securite.`, 'success')
          } else {
            showToast(next ? 'Lien public active' : 'Lien public desactive', 'success')
          }
        } else {
          eventTypes.value = eventTypes.value.map(e =>
            e.id === et.id ? { ...e, is_public: next } : e,
          )
          showToast(next ? 'Lien public active' : 'Lien public desactive', 'success')
        }
      } else {
        showToast(res.error || 'Erreur', 'error')
      }
    } catch {
      showToast('Erreur lors de la mise a jour', 'error')
    }
  }

  /** URL partageable du lien public ouvert (utilise meme si is_public = 0 pour preview). */
  function getPublicUrl(et: EventType): string {
    return `${SERVER_URL}/#/book/e/${et.slug}`
  }

  /** Active/desactive la generation auto d'un lien Jitsi Meet par reservation. */
  async function toggleJitsi(et: EventType) {
    try {
      const next = et.use_jitsi ? 0 : 1
      const res = await window.api.updateBookingEventType(et.id, { use_jitsi: next })
      if (res.ok) {
        eventTypes.value = eventTypes.value.map(e =>
          e.id === et.id ? { ...e, use_jitsi: next } : e,
        )
        showToast(next ? 'Jitsi Meet active : un lien unique sera genere par RDV' : 'Jitsi Meet desactive', 'success')
      } else {
        showToast(res.error || 'Erreur', 'error')
      }
    } catch {
      showToast('Erreur lors de la mise a jour', 'error')
    }
  }

  async function deleteEventType(id: number) {
    if (!confirm('Supprimer ce type de rendez-vous ? Les liens existants seront invalides.')) return
    try {
      const res = await window.api.deleteBookingEventType(id)
      if (res.ok) {
        eventTypes.value = eventTypes.value.filter(e => e.id !== id)
        showToast('Type supprime', 'success')
      } else {
        showToast(res.error || 'Erreur lors de la suppression', 'error')
      }
    } catch {
      showToast('Erreur lors de la suppression', 'error')
    }
  }

  async function generateLink(eventTypeId: number, studentId: number) {
    try {
      const res = await window.api.createBookingToken(eventTypeId, studentId)
      if (res.ok && res.data) {
        return res.data.bookingUrl
      }
      showToast(res.error || 'Erreur lors de la generation du lien', 'error')
      return null
    } catch {
      showToast('Erreur lors de la generation du lien', 'error')
      return null
    }
  }

  async function generateBulkLinks(eventTypeId: number, promoId: number) {
    try {
      const res = await window.api.createBulkBookingTokens(eventTypeId, promoId)
      if (res.ok && res.data) {
        showToast(`${res.data.length} liens generes`, 'success')
        return res.data
      }
      showToast(res.error || 'Erreur lors de la generation', 'error')
      return null
    } catch {
      showToast('Erreur lors de la generation en masse', 'error')
      return null
    }
  }

  // ── Availability ───────────────────────────────────────────────────────

  function addSlot(day: number, start: string, end: string) {
    if (!start || !end || start >= end) {
      showToast('Horaires invalides', 'error')
      return false
    }
    availability.value = [
      ...availability.value,
      { id: -(Date.now() + day), day_of_week: day, start_time: start, end_time: end },
    ]
    return true
  }

  function removeSlot(rule: AvailabilityRule) {
    availability.value = availability.value.filter(r => r !== rule)
  }

  async function saveAvailability() {
    savingAvailability.value = true
    try {
      const rules = availability.value.map(r => ({
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
      }))
      const res = await window.api.setBookingAvailability(rules)
      if (res.ok) {
        showToast('Disponibilites enregistrees', 'success')
        const avRes = await window.api.getBookingAvailability()
        if (avRes.ok && avRes.data) availability.value = avRes.data
      } else {
        showToast(res.error || 'Erreur lors de la sauvegarde', 'error')
      }
    } catch {
      showToast('Erreur lors de la sauvegarde', 'error')
    } finally {
      savingAvailability.value = false
    }
  }

  // ── Creation directe (style Outlook) ─────────────────────────────────────
  //
  // Le prof cree un RDV pour 1+ etudiants sans passer par le flow public-token
  // (pas d'email d'invite, pas de tutor externe). Backend = POST /direct.

  async function createDirectBooking(payload: {
    eventTypeId: number
    studentIds: number[]
    startDatetime: string
    durationMinutes?: number
  }): Promise<{ created: number; skipped: number; eventTypeTitle?: string } | null> {
    try {
      const res = await window.api.createBookingDirect(toRawPayload(payload))
      if (res.ok && res.data) {
        const data = res.data as { created: Array<unknown>; skipped: Array<unknown>; eventTypeTitle?: string }
        const created = data.created.length
        const skipped = data.skipped.length
        if (created > 0) {
          const msg = skipped > 0
            ? `${created} RDV cree(s), ${skipped} ignore(s) (creneau deja pris).`
            : created === 1 ? 'RDV cree.' : `${created} RDV crees.`
          showToast(msg, 'success')
        } else {
          showToast('Aucun RDV cree — creneau deja pris pour tous les etudiants.', 'error')
        }
        await fetchAll()  // refresh la liste pour le calendrier
        return { created, skipped, eventTypeTitle: data.eventTypeTitle }
      }
      showToast(res.error || 'Erreur lors de la creation du RDV', 'error')
      return null
    } catch {
      showToast('Erreur lors de la creation du RDV', 'error')
      return null
    }
  }

  // ── Real-time socket listeners ──────────────────────────────────────────

  let unsubBookingNew: (() => void) | null = null
  let unsubBookingCancelled: (() => void) | null = null

  function initSocketListeners() {
    unsubBookingNew = window.api.onBookingNew((data) => {
      showToast(`Nouveau RDV : ${data.tutorName} pour ${data.eventTitle}`, 'success')
      fetchAll() // refresh bookings list
    })
    unsubBookingCancelled = window.api.onBookingCancelled((data) => {
      showToast(`RDV annule : ${data.tutorName} (${data.eventTitle})`, 'error')
      fetchAll()
    })
  }

  function disposeSocketListeners() {
    unsubBookingNew?.()
    unsubBookingCancelled?.()
    unsubBookingNew = null
    unsubBookingCancelled = null
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  const formatDate = formatBookingDate
  const formatTime = formatBookingTime

  function statusLabel(status: string): string {
    const map: Record<string, string> = {
      confirmed: 'Confirme', pending: 'En attente',
      cancelled: 'Annule', completed: 'Termine',
    }
    return map[status] || status
  }

  function statusClass(status: string): string {
    if (status === 'confirmed' || status === 'completed') return 'badge-success'
    if (status === 'pending') return 'badge-warning'
    if (status === 'cancelled') return 'badge-danger'
    return ''
  }

  return {
    // State
    loading,
    eventTypes, availability, bookings,
    savingAvailability,
    // Computed
    sortedBookings, rulesByDay,
    // Actions
    fetchAll,
    createEventType, toggleActive, togglePublic, toggleJitsi, getPublicUrl, deleteEventType, generateLink, generateBulkLinks,
    addSlot, removeSlot, saveAvailability,
    createDirectBooking,
    initSocketListeners, disposeSocketListeners,
    // Helpers
    formatDate, formatTime, statusLabel, statusClass,
  }
}

/**
 * Type partage pour les composants enfants qui consomment l'instance unique
 * de useBooking creee par TabBooking. Permet de typer les props sans avoir
 * a redeclarer chaque ref individuellement.
 */
export type BookingHandle = ReturnType<typeof useBooking>
