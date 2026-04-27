/**
 * usePublicBooking — composable for the public-facing booking page.
 * Uses fetch() directly (not window.api) so it works in both Electron and web.
 */
import { ref } from 'vue'
import { fetchWithTimeout, isAbortError } from '@/utils/fetchWithTimeout'

const SERVER_URL = (import.meta.env?.VITE_SERVER_URL as string | undefined) || 'http://localhost:3001'

// ── Types ────────────────────────────────────────────────────────────────────

export type PublicBookingMode = 'token' | 'event'

export interface BookingEventInfo {
  eventTitle: string
  description?: string
  durationMinutes: number
  teacherName: string
  /** Pre-rempli uniquement en mode token nominatif. Absent en mode 'event' (lien public ouvert). */
  studentName?: string
  color: string
  timezone?: string
}

export interface BookingSlot {
  start: string
  end: string
  date: string
  time: string
}

export interface BookingResult {
  bookingId: number
  teamsJoinUrl: string | null
  startDatetime: string
  endDatetime: string
}

// ── Composable ───────────────────────────────────────────────────────────────

/**
 * Composable pour la page publique de reservation.
 * - mode 'token' (defaut) : lien nominatif /book/:token
 * - mode 'event'          : lien public ouvert /book/e/:slug
 *
 * Les deux modes partagent le meme flow UI ; seules les URLs API et le nom
 * des champs envoyes au POST /book different.
 */
export function usePublicBooking(identifier: string, mode: PublicBookingMode = 'token') {
  const eventInfo = ref<BookingEventInfo | null>(null)
  const slots = ref<BookingSlot[]>([])
  const selectedSlot = ref<BookingSlot | null>(null)
  const step = ref<'calendar' | 'details' | 'confirmation'>('calendar')
  const loading = ref(false)
  const error = ref('')
  /** Code d'erreur du backend (ex: 'closed', 'not_found', 'invalid_link') pour
   *  permettre a l'UI d'afficher un message specifique. */
  const errorCode = ref('')
  const bookingResult = ref<BookingResult | null>(null)

  const basePath = mode === 'event'
    ? `/api/bookings/public/event/${encodeURIComponent(identifier)}`
    : `/api/bookings/public/${encodeURIComponent(identifier)}`

  async function apiFetch<T>(path: string, opts?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string; code?: string }> {
    try {
      const res = await fetchWithTimeout(`${SERVER_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
      })
      return await res.json()
    } catch (err) {
      if (isAbortError(err)) return { ok: false, error: 'Temps d attente depasse.' }
      return { ok: false, error: 'Erreur de connexion au serveur.' }
    }
  }

  async function fetchEventInfo() {
    loading.value = true
    error.value = ''
    errorCode.value = ''
    const res = await apiFetch<BookingEventInfo>(basePath)
    if (res.ok && res.data) {
      eventInfo.value = res.data
    } else {
      error.value = res.error || 'Lien de reservation invalide.'
      errorCode.value = res.code || ''
    }
    loading.value = false
  }

  /**
   * Charge les creneaux des `weeks` semaines en parallele et les fusionne
   * (deduplication par start ISO). Utilise pour alimenter le calendrier
   * mensuel d'un coup au lieu de paginer.
   */
  async function fetchSlotsRange(weeks = 8) {
    loading.value = true
    try {
      const fetches = Array.from({ length: weeks }, (_, i) =>
        apiFetch<{ slots: BookingSlot[]; weekStart: string }>(`${basePath}/slots?weekOffset=${i}`),
      )
      const results = await Promise.all(fetches)
      const seen = new Set<string>()
      const all: BookingSlot[] = []
      for (const r of results) {
        if (!r.ok || !r.data) continue
        for (const s of r.data.slots) {
          if (seen.has(s.start)) continue
          seen.add(s.start)
          all.push(s)
        }
      }
      all.sort((a, b) => a.start.localeCompare(b.start))
      slots.value = all
    } finally {
      loading.value = false
    }
  }

  function selectSlot(slot: BookingSlot) {
    selectedSlot.value = slot
    step.value = 'details'
  }

  function backToCalendar() {
    selectedSlot.value = null
    step.value = 'calendar'
  }

  async function bookSlot(attendeeName: string, attendeeEmail: string, captchaToken?: string) {
    if (!selectedSlot.value) return false
    loading.value = true
    error.value = ''
    errorCode.value = ''
    // Le backend public/event utilise attendeeName/attendeeEmail + captchaToken ;
    // les liens nominatifs gardent les noms historiques tutorName/tutorEmail.
    const body = mode === 'event'
      ? { attendeeName, attendeeEmail, startDatetime: selectedSlot.value.start, captchaToken }
      : { tutorName: attendeeName, tutorEmail: attendeeEmail, startDatetime: selectedSlot.value.start }
    const res = await apiFetch<BookingResult>(`${basePath}/book`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (res.ok && res.data) {
      bookingResult.value = res.data
      step.value = 'confirmation'
      loading.value = false
      return true
    }
    error.value = res.error || 'Erreur lors de la reservation.'
    errorCode.value = res.code || ''
    loading.value = false
    return false
  }

  // ICS download URL
  function icsUrl(): string | null {
    if (!bookingResult.value) return null
    return `${SERVER_URL}${basePath}/booking/${bookingResult.value.bookingId}/ics`
  }

  return {
    eventInfo, slots, selectedSlot, step,
    loading, error, errorCode, bookingResult,
    fetchEventInfo, fetchSlotsRange, selectSlot, backToCalendar, bookSlot,
    icsUrl,
  }
}
