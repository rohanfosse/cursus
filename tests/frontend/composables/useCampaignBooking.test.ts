/**
 * Tests pour useCampaignBooking — page publique etudiant /book/c/:token.
 *
 * Le composable gere : fetchInfo (info + booking deja existant),
 * fetchSlots, selectSlot/backToCalendar, et book (POST avec ou sans tuteur).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// fetchWithTimeout est mocke pour controler les reponses HTTP. isAbortError
// retourne true si l'erreur a un nom 'AbortError'.
const fetchMock = vi.fn()
vi.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: (url: string, opts?: RequestInit) => fetchMock(url, opts),
  isAbortError: (e: unknown) => e instanceof Error && e.name === 'AbortError',
}))

import { useCampaignBooking } from '@/composables/useCampaignBooking'

const TOKEN = 'tok-abc-123'

function jsonRes(payload: unknown) {
  return { json: async () => payload }
}

const baseInfoPayload = {
  campaignTitle: 'Visite tripartite A4',
  description: 'Bilan mi-stage',
  durationMinutes: 30,
  color: '#6366f1',
  teacherName: 'Jean Dupont',
  studentName: 'Alice Martin',
  studentEmail: 'alice@cesi.fr',
  withTutor: true,
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  status: 'active',
  existingBooking: null,
}

describe('useCampaignBooking', () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  // ── fetchInfo ─────────────────────────────────────────────────────────────

  describe('fetchInfo', () => {
    it('remplit info quand le serveur repond ok et reste step=calendar', async () => {
      fetchMock.mockResolvedValueOnce(jsonRes({ ok: true, data: baseInfoPayload }))
      const cb = useCampaignBooking(TOKEN)
      await cb.fetchInfo()
      expect(cb.info.value?.campaignTitle).toBe('Visite tripartite A4')
      expect(cb.step.value).toBe('calendar')
      expect(cb.error.value).toBe('')
    })

    it('passe directement a step=confirmation si l\'etudiant a deja reserve', async () => {
      const existing = {
        ...baseInfoPayload,
        existingBooking: {
          bookingId: 42,
          startDatetime: '2026-05-15T14:00:00.000Z',
          endDatetime: '2026-05-15T14:30:00.000Z',
          joinUrl: 'https://meet.jit.si/abc',
          cancelToken: 'cancel-tok',
        },
      }
      fetchMock.mockResolvedValueOnce(jsonRes({ ok: true, data: existing }))
      const cb = useCampaignBooking(TOKEN)
      await cb.fetchInfo()
      expect(cb.step.value).toBe('confirmation')
      expect(cb.result.value?.bookingId).toBe(42)
      expect(cb.result.value?.emailSent).toBe(true)
    })

    it('mappe error et errorCode quand res.ok=false', async () => {
      fetchMock.mockResolvedValueOnce(jsonRes({
        ok: false, error: 'Lien expire', code: 'closed',
      }))
      const cb = useCampaignBooking(TOKEN)
      await cb.fetchInfo()
      expect(cb.info.value).toBeNull()
      expect(cb.error.value).toBe('Lien expire')
      expect(cb.errorCode.value).toBe('closed')
    })

    it('gere une erreur reseau avec un message generique', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network'))
      const cb = useCampaignBooking(TOKEN)
      await cb.fetchInfo()
      expect(cb.error.value).toContain('connexion')
    })

    it('detecte un timeout (AbortError) avec un message specifique', async () => {
      const e = new Error('aborted'); e.name = 'AbortError'
      fetchMock.mockRejectedValueOnce(e)
      const cb = useCampaignBooking(TOKEN)
      await cb.fetchInfo()
      expect(cb.error.value).toContain('Temps d')
    })

    it('passe loading a true pendant l\'appel et false apres', async () => {
      let resolve!: (v: unknown) => void
      fetchMock.mockReturnValueOnce(new Promise((r) => { resolve = r }))
      const cb = useCampaignBooking(TOKEN)
      const p = cb.fetchInfo()
      expect(cb.loading.value).toBe(true)
      resolve(jsonRes({ ok: true, data: baseInfoPayload }))
      await p
      expect(cb.loading.value).toBe(false)
    })

    it('appelle l\'endpoint avec le token dans l\'URL', async () => {
      fetchMock.mockResolvedValueOnce(jsonRes({ ok: true, data: baseInfoPayload }))
      const cb = useCampaignBooking(TOKEN)
      await cb.fetchInfo()
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/api/bookings/public/campaign/${TOKEN}`),
        expect.any(Object),
      )
    })
  })

  // ── fetchSlots ────────────────────────────────────────────────────────────

  describe('fetchSlots', () => {
    it('remplit slots quand l\'API repond ok', async () => {
      const slots = [
        { start: '2026-05-15T14:00:00.000Z', end: '2026-05-15T14:30:00.000Z', date: '2026-05-15', time: '14:00' },
        { start: '2026-05-15T14:30:00.000Z', end: '2026-05-15T15:00:00.000Z', date: '2026-05-15', time: '14:30' },
      ]
      fetchMock.mockResolvedValueOnce(jsonRes({ ok: true, data: { slots } }))
      const cb = useCampaignBooking(TOKEN)
      await cb.fetchSlots()
      expect(cb.slots.value).toHaveLength(2)
      expect(cb.slots.value[0].time).toBe('14:00')
    })

    it('laisse slots vide si ok=false (pas de crash, pas de toast en silencieux)', async () => {
      fetchMock.mockResolvedValueOnce(jsonRes({ ok: false, error: 'oops' }))
      const cb = useCampaignBooking(TOKEN)
      await cb.fetchSlots()
      expect(cb.slots.value).toEqual([])
    })
  })

  // ── selectSlot / backToCalendar ──────────────────────────────────────────

  describe('selectSlot et backToCalendar', () => {
    it('selectSlot remplit selectedSlot et passe a step=details', () => {
      const cb = useCampaignBooking(TOKEN)
      const slot = { start: '2026-05-15T14:00:00.000Z', end: '2026-05-15T14:30:00.000Z', date: '2026-05-15', time: '14:00' }
      cb.selectSlot(slot)
      expect(cb.selectedSlot.value).toEqual(slot)
      expect(cb.step.value).toBe('details')
    })

    it('backToCalendar reset selectedSlot et revient a step=calendar', () => {
      const cb = useCampaignBooking(TOKEN)
      cb.selectSlot({ start: 'a', end: 'b', date: '2026-05-15', time: '14:00' })
      cb.backToCalendar()
      expect(cb.selectedSlot.value).toBeNull()
      expect(cb.step.value).toBe('calendar')
    })
  })

  // ── book ─────────────────────────────────────────────────────────────────

  describe('book', () => {
    async function setupWithSlot(withTutor = true) {
      fetchMock.mockResolvedValueOnce(jsonRes({
        ok: true, data: { ...baseInfoPayload, withTutor },
      }))
      const cb = useCampaignBooking(TOKEN)
      await cb.fetchInfo()
      cb.selectSlot({
        start: '2026-05-15T14:00:00.000Z',
        end: '2026-05-15T14:30:00.000Z',
        date: '2026-05-15',
        time: '14:00',
      })
      return cb
    }

    it('renvoie false sans appel API si pas de slot selectionne', async () => {
      fetchMock.mockResolvedValueOnce(jsonRes({ ok: true, data: baseInfoPayload }))
      const cb = useCampaignBooking(TOKEN)
      await cb.fetchInfo()
      const ok = await cb.book({ tutorName: 'X', tutorEmail: 'x@y.com' })
      expect(ok).toBe(false)
      expect(fetchMock).toHaveBeenCalledTimes(1) // seul fetchInfo
    })

    it('renvoie false sans appel API si info pas chargee', async () => {
      const cb = useCampaignBooking(TOKEN)
      const ok = await cb.book({})
      expect(ok).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('inclut tuteur dans le body si withTutor=true', async () => {
      const cb = await setupWithSlot(true)
      fetchMock.mockResolvedValueOnce(jsonRes({
        ok: true,
        data: {
          bookingId: 99,
          startDatetime: '2026-05-15T14:00:00.000Z',
          endDatetime: '2026-05-15T14:30:00.000Z',
          joinUrl: null, cancelToken: 'cnl', emailSent: true,
        },
      }))
      const ok = await cb.book({ tutorName: 'Bob', tutorEmail: 'bob@entreprise.fr' })
      expect(ok).toBe(true)
      const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]
      const body = JSON.parse(lastCall[1].body)
      expect(body).toEqual({
        startDatetime: '2026-05-15T14:00:00.000Z',
        tutorName: 'Bob',
        tutorEmail: 'bob@entreprise.fr',
      })
      expect(cb.step.value).toBe('confirmation')
      expect(cb.result.value?.bookingId).toBe(99)
    })

    it('omet tuteur dans le body si withTutor=false', async () => {
      const cb = await setupWithSlot(false)
      fetchMock.mockResolvedValueOnce(jsonRes({
        ok: true,
        data: {
          bookingId: 100, startDatetime: 'a', endDatetime: 'b',
          joinUrl: null, cancelToken: 'cnl', emailSent: true,
        },
      }))
      await cb.book({ tutorName: 'Bob', tutorEmail: 'bob@entreprise.fr' })
      const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]
      const body = JSON.parse(lastCall[1].body)
      expect(body).toEqual({ startDatetime: '2026-05-15T14:00:00.000Z' })
    })

    it('mappe error et errorCode quand l\'API rejette le booking', async () => {
      const cb = await setupWithSlot(true)
      fetchMock.mockResolvedValueOnce(jsonRes({
        ok: false, error: 'Slot deja pris', code: 'slot_taken',
      }))
      const ok = await cb.book({ tutorName: 'Bob', tutorEmail: 'bob@entreprise.fr' })
      expect(ok).toBe(false)
      expect(cb.error.value).toBe('Slot deja pris')
      expect(cb.errorCode.value).toBe('slot_taken')
      expect(cb.step.value).toBe('details') // reste sur details, pas confirmation
    })

    it('reset loading=false meme si l\'API throw', async () => {
      const cb = await setupWithSlot(true)
      fetchMock.mockRejectedValueOnce(new Error('network'))
      await cb.book({ tutorName: 'Bob', tutorEmail: 'bob@entreprise.fr' })
      expect(cb.loading.value).toBe(false)
    })

    it('utilise POST + JSON pour l\'endpoint book', async () => {
      const cb = await setupWithSlot(true)
      fetchMock.mockResolvedValueOnce(jsonRes({
        ok: true,
        data: { bookingId: 1, startDatetime: 'a', endDatetime: 'b', joinUrl: null, cancelToken: 't', emailSent: true },
      }))
      await cb.book({ tutorName: 'Bob', tutorEmail: 'bob@entreprise.fr' })
      const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]
      expect(lastCall[0]).toContain(`/api/bookings/public/campaign/${TOKEN}/book`)
      expect(lastCall[1].method).toBe('POST')
      expect(lastCall[1].headers['Content-Type']).toBe('application/json')
    })
  })
})
