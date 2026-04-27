/**
 * useCampaignBooking — composable pour la page publique etudiant /book/c/:token.
 *
 * Le token vaut pour 1 etudiant / 1 campagne. La page :
 *   1. Recupere les infos campagne + identite etudiant (le token resoud le student)
 *   2. Affiche les creneaux dispo
 *   3. Si tripartite, demande nom + email du tuteur entreprise
 *   4. Reservation -> mail tripartite + ICS attache
 */
import { ref } from 'vue'
import { fetchWithTimeout, isAbortError } from '@/utils/fetchWithTimeout'

const SERVER_URL = (import.meta.env?.VITE_SERVER_URL as string | undefined) || 'http://localhost:3001'

export interface CampaignInfo {
  campaignTitle: string
  description?: string
  durationMinutes: number
  color: string
  teacherName: string
  studentName: string
  studentEmail: string
  withTutor: boolean
  startDate: string
  endDate: string
  timezone?: string
  status: 'draft' | 'active' | 'closed'
  existingBooking: {
    bookingId: number
    startDatetime: string
    endDatetime: string
    joinUrl: string | null
    cancelToken: string
  } | null
}

export interface Slot {
  start: string
  end: string
  date: string
  time: string
}

export interface BookingResult {
  bookingId: number
  startDatetime: string
  endDatetime: string
  joinUrl: string | null
  cancelToken: string
  emailSent: boolean
}

export function useCampaignBooking(token: string) {
  const info = ref<CampaignInfo | null>(null)
  const slots = ref<Slot[]>([])
  const selectedSlot = ref<Slot | null>(null)
  const step = ref<'calendar' | 'details' | 'confirmation'>('calendar')
  const loading = ref(false)
  const error = ref('')
  const errorCode = ref('')
  const result = ref<BookingResult | null>(null)

  async function api<T>(path: string, opts?: RequestInit): Promise<{ ok: boolean; data?: T; error?: string; code?: string }> {
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

  async function fetchInfo() {
    loading.value = true; error.value = ''; errorCode.value = ''
    const r = await api<CampaignInfo>(`/api/bookings/public/campaign/${token}`)
    if (r.ok && r.data) {
      info.value = r.data
      if (r.data.existingBooking) {
        result.value = {
          bookingId: r.data.existingBooking.bookingId,
          startDatetime: r.data.existingBooking.startDatetime,
          endDatetime: r.data.existingBooking.endDatetime,
          joinUrl: r.data.existingBooking.joinUrl,
          cancelToken: r.data.existingBooking.cancelToken,
          emailSent: true,
        }
        step.value = 'confirmation'
      }
    } else {
      error.value = r.error || 'Lien invalide.'
      errorCode.value = r.code || ''
    }
    loading.value = false
  }

  async function fetchSlots() {
    loading.value = true
    const r = await api<{ slots: Slot[] }>(`/api/bookings/public/campaign/${token}/slots`)
    if (r.ok && r.data) slots.value = r.data.slots
    loading.value = false
  }

  function selectSlot(s: Slot) { selectedSlot.value = s; step.value = 'details' }
  function backToCalendar() { selectedSlot.value = null; step.value = 'calendar' }

  async function book(opts: { tutorName?: string; tutorEmail?: string }) {
    if (!selectedSlot.value || !info.value) return false
    loading.value = true; error.value = ''
    const body: Record<string, unknown> = { startDatetime: selectedSlot.value.start }
    if (info.value.withTutor) {
      body.tutorName = opts.tutorName
      body.tutorEmail = opts.tutorEmail
    }
    const r = await api<BookingResult>(`/api/bookings/public/campaign/${token}/book`, {
      method: 'POST', body: JSON.stringify(body),
    })
    if (r.ok && r.data) {
      result.value = r.data
      step.value = 'confirmation'
      loading.value = false
      return true
    }
    error.value = r.error || 'Erreur lors de la reservation.'
    errorCode.value = r.code || ''
    loading.value = false
    return false
  }

  return {
    info, slots, selectedSlot, step, loading, error, errorCode, result,
    fetchInfo, fetchSlots, selectSlot, backToCalendar, book,
  }
}
