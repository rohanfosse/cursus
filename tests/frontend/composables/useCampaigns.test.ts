/**
 * Tests pour useCampaigns — gestion des campagnes de RDV (visites tripartites).
 *
 * Cycle de vie : draft -> active -> closed.
 * On mocke window.api et useToast, et on verifie que :
 *  - les CRUD synchronisent l'etat local + emettent un toast adapte
 *  - les filtres calcules (active/draft/closed) sont coherents
 *  - les erreurs reseau ou backend ne crashent pas le composable
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const showToast = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast }),
}))

const getBookingCampaigns    = vi.fn()
const getBookingCampaign     = vi.fn()
const createBookingCampaign  = vi.fn()
const updateBookingCampaign  = vi.fn()
const deleteBookingCampaign  = vi.fn()
const launchBookingCampaign  = vi.fn()
const remindBookingCampaign  = vi.fn()
const closeBookingCampaign   = vi.fn()

const confirmMock = vi.fn(() => true)

vi.stubGlobal('window', {
  api: {
    getBookingCampaigns,
    getBookingCampaign,
    createBookingCampaign,
    updateBookingCampaign,
    deleteBookingCampaign,
    launchBookingCampaign,
    remindBookingCampaign,
    closeBookingCampaign,
  },
  confirm: confirmMock,
})

// useCampaigns.deleteCampaign appelle `confirm()` en bare (resolu via le scope
// global, pas via window dans Node + vi.stubGlobal). On stub donc aussi
// globalThis pour que les deux references pointent sur le meme mock.
vi.stubGlobal('confirm', confirmMock)

import { useCampaigns, type Campaign, type CampaignDraft } from '@/composables/useCampaigns'

function makeCampaign(over: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    teacher_id: 10,
    event_type_id: null,
    title: 'Visite mi-parcours A4',
    description: null,
    duration_minutes: 30,
    buffer_minutes: 0,
    color: '#6366f1',
    start_date: '2026-05-01',
    end_date: '2026-05-31',
    hebdo_rules: [{ dayOfWeek: 2, startTime: '14:00', endTime: '17:00' }],
    excluded_dates: [],
    promo_id: 42,
    with_tutor: 1,
    notify_email: null,
    use_jitsi: 1,
    fallback_visio_url: null,
    timezone: 'Europe/Paris',
    status: 'draft',
    launched_at: null,
    created_at: '2026-04-27T10:00:00Z',
    invite_count: 12,
    booked_count: 0,
    ...over,
  }
}

const draft: CampaignDraft = {
  title: 'Test',
  durationMinutes: 30,
  color: '#6366f1',
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  hebdoRules: [{ dayOfWeek: 2, startTime: '14:00', endTime: '17:00' }],
  promoId: 42,
}

describe('useCampaigns', () => {
  beforeEach(() => {
    showToast.mockClear()
    getBookingCampaigns.mockReset()
    getBookingCampaign.mockReset()
    createBookingCampaign.mockReset()
    updateBookingCampaign.mockReset()
    deleteBookingCampaign.mockReset()
    launchBookingCampaign.mockReset()
    remindBookingCampaign.mockReset()
    closeBookingCampaign.mockReset()
    confirmMock.mockReturnValue(true)
  })

  // ── fetchAll ──────────────────────────────────────────────────────────────

  describe('fetchAll', () => {
    it('remplit campaigns et passe loading=false a la fin', async () => {
      const list = [makeCampaign(), makeCampaign({ id: 2, status: 'active' })]
      getBookingCampaigns.mockResolvedValue({ ok: true, data: list })
      const c = useCampaigns()
      const p = c.fetchAll()
      expect(c.loading.value).toBe(true)
      await p
      expect(c.campaigns.value).toHaveLength(2)
      expect(c.loading.value).toBe(false)
    })

    it('toast erreur si l\'appel throw', async () => {
      getBookingCampaigns.mockRejectedValue(new Error('boom'))
      const c = useCampaigns()
      await c.fetchAll()
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('chargement'), 'error')
      expect(c.loading.value).toBe(false)
    })

    it('garde l\'etat precedent quand res.ok=false (pas de crash)', async () => {
      getBookingCampaigns.mockResolvedValue({ ok: false, error: 'oops' })
      const c = useCampaigns()
      await c.fetchAll()
      expect(c.campaigns.value).toEqual([])
    })
  })

  // ── filtres calcules ─────────────────────────────────────────────────────

  describe('filtres calcules', () => {
    it('separe active/draft/closed', async () => {
      const list = [
        makeCampaign({ id: 1, status: 'draft' }),
        makeCampaign({ id: 2, status: 'active' }),
        makeCampaign({ id: 3, status: 'active' }),
        makeCampaign({ id: 4, status: 'closed' }),
      ]
      getBookingCampaigns.mockResolvedValue({ ok: true, data: list })
      const c = useCampaigns()
      await c.fetchAll()
      expect(c.draftCampaigns.value).toHaveLength(1)
      expect(c.activeCampaigns.value).toHaveLength(2)
      expect(c.closedCampaigns.value).toHaveLength(1)
    })
  })

  // ── createCampaign ───────────────────────────────────────────────────────

  describe('createCampaign', () => {
    it('rafraichit la liste et toast succes avec le nombre d\'invites', async () => {
      const created = makeCampaign({ id: 99, title: 'Nouvelle', invite_count: 15 })
      createBookingCampaign.mockResolvedValue({ ok: true, data: created })
      getBookingCampaigns.mockResolvedValue({ ok: true, data: [created] })
      const c = useCampaigns()
      const result = await c.createCampaign(draft)
      expect(result?.id).toBe(99)
      expect(getBookingCampaigns).toHaveBeenCalled()
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('15 etudiants pre-invites'),
        'success',
      )
    })

    it('retourne null et toast erreur quand res.ok=false', async () => {
      createBookingCampaign.mockResolvedValue({ ok: false, error: 'titre requis' })
      const c = useCampaigns()
      const result = await c.createCampaign(draft)
      expect(result).toBeNull()
      expect(showToast).toHaveBeenCalledWith('titre requis', 'error')
    })

    it('retourne null et toast generique sur exception', async () => {
      createBookingCampaign.mockRejectedValue(new Error('network'))
      const c = useCampaigns()
      const result = await c.createCampaign(draft)
      expect(result).toBeNull()
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('creation'), 'error')
    })

    it('affiche "0 etudiants pre-invites" quand invite_count est absent', async () => {
      createBookingCampaign.mockResolvedValue({
        ok: true,
        data: makeCampaign({ id: 5, invite_count: undefined }),
      })
      getBookingCampaigns.mockResolvedValue({ ok: true, data: [] })
      const c = useCampaigns()
      await c.createCampaign(draft)
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('0 etudiants'),
        'success',
      )
    })
  })

  // ── updateCampaign ───────────────────────────────────────────────────────

  describe('updateCampaign', () => {
    it('renvoie true et toast succes quand l\'API repond ok', async () => {
      updateBookingCampaign.mockResolvedValue({ ok: true })
      getBookingCampaigns.mockResolvedValue({ ok: true, data: [] })
      const c = useCampaigns()
      expect(await c.updateCampaign(1, { title: 'Nouveau titre' })).toBe(true)
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('mise a jour'), 'success')
    })

    it('renvoie false quand l\'API repond ok=false', async () => {
      updateBookingCampaign.mockResolvedValue({ ok: false, error: 'invalide' })
      const c = useCampaigns()
      expect(await c.updateCampaign(1, {})).toBe(false)
      expect(showToast).toHaveBeenCalledWith('invalide', 'error')
    })

    it('renvoie false sur exception sans crasher', async () => {
      updateBookingCampaign.mockRejectedValue(new Error('boom'))
      const c = useCampaigns()
      expect(await c.updateCampaign(1, {})).toBe(false)
    })
  })

  // ── deleteCampaign ───────────────────────────────────────────────────────

  describe('deleteCampaign', () => {
    it('annule sans appeler l\'API si confirm() retourne false', async () => {
      confirmMock.mockReturnValue(false)
      const c = useCampaigns()
      expect(await c.deleteCampaign(1)).toBe(false)
      expect(deleteBookingCampaign).not.toHaveBeenCalled()
    })

    it('appelle l\'API + refetch + toast quand confirme et ok', async () => {
      deleteBookingCampaign.mockResolvedValue({ ok: true })
      getBookingCampaigns.mockResolvedValue({ ok: true, data: [] })
      const c = useCampaigns()
      expect(await c.deleteCampaign(1)).toBe(true)
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('supprimee'), 'success')
    })

    it('retourne false et toast erreur quand l\'API rejette', async () => {
      deleteBookingCampaign.mockResolvedValue({ ok: false, error: 'liee a des bookings' })
      const c = useCampaigns()
      expect(await c.deleteCampaign(1)).toBe(false)
      expect(showToast).toHaveBeenCalledWith('liee a des bookings', 'error')
    })
  })

  // ── launchCampaign ───────────────────────────────────────────────────────

  describe('launchCampaign', () => {
    it('toast avec le nombre de mails envoyes et refetch', async () => {
      launchBookingCampaign.mockResolvedValue({ ok: true, data: { sent: 12 } })
      getBookingCampaigns.mockResolvedValue({ ok: true, data: [] })
      const c = useCampaigns()
      expect(await c.launchCampaign(1)).toBe(true)
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('12 mail(s) envoye(s)'),
        'success',
      )
    })

    it('retourne false et propage l\'erreur backend', async () => {
      launchBookingCampaign.mockResolvedValue({ ok: false, error: 'deja lancee' })
      const c = useCampaigns()
      expect(await c.launchCampaign(1)).toBe(false)
      expect(showToast).toHaveBeenCalledWith('deja lancee', 'error')
    })
  })

  // ── remindCampaign ───────────────────────────────────────────────────────

  describe('remindCampaign', () => {
    it('toast avec le ratio relances/en attente', async () => {
      remindBookingCampaign.mockResolvedValue({ ok: true, data: { sent: 3, pending: 5 } })
      const c = useCampaigns()
      expect(await c.remindCampaign(1)).toBe(true)
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('3 relance(s)') && expect.stringContaining('5 en attente'),
        'success',
      )
    })

    it('ne refetch pas (relance ne change pas la liste) — verifie l\'appel API uniquement', async () => {
      remindBookingCampaign.mockResolvedValue({ ok: true, data: { sent: 0, pending: 0 } })
      const c = useCampaigns()
      await c.remindCampaign(1)
      expect(getBookingCampaigns).not.toHaveBeenCalled()
    })
  })

  // ── closeCampaign ────────────────────────────────────────────────────────

  describe('closeCampaign', () => {
    it('refetch et toast quand ok', async () => {
      closeBookingCampaign.mockResolvedValue({ ok: true })
      getBookingCampaigns.mockResolvedValue({ ok: true, data: [] })
      const c = useCampaigns()
      expect(await c.closeCampaign(1)).toBe(true)
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('cloturee'), 'success')
    })

    it('renvoie false silencieusement si exception (cas non bloquant)', async () => {
      closeBookingCampaign.mockRejectedValue(new Error('boom'))
      const c = useCampaigns()
      expect(await c.closeCampaign(1)).toBe(false)
    })
  })

  // ── fetchDetail ──────────────────────────────────────────────────────────

  describe('fetchDetail', () => {
    it('remplit detail quand l\'API repond ok', async () => {
      const full = makeCampaign({ id: 7, invites: [] })
      getBookingCampaign.mockResolvedValue({ ok: true, data: full })
      const c = useCampaigns()
      await c.fetchDetail(7)
      expect(c.detail.value?.id).toBe(7)
    })

    it('toast erreur si ok=false', async () => {
      getBookingCampaign.mockResolvedValue({ ok: false, error: 'introuvable' })
      const c = useCampaigns()
      await c.fetchDetail(99)
      expect(showToast).toHaveBeenCalledWith('introuvable', 'error')
      expect(c.detail.value).toBeNull()
    })
  })
})
