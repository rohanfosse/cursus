/**
 * Tests pour useDevoirContextMenu — publier, dupliquer, supprimer, ouvrir devoirs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const showToastMock = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: showToastMock }),
}))

const confirmMock = vi.fn()
vi.mock('@/composables/useConfirm', () => ({
  useConfirm: () => ({ confirm: confirmMock }),
}))

vi.mock('@/stores/modals', () => {
  const store = { gestionDevoir: false }
  return { useModalsStore: () => store }
})

vi.mock('@/stores/travaux', () => {
  const openTravail = vi.fn()
  const store = { openTravail }
  return { useTravauxStore: () => store, _openTravail: openTravail }
})

;(globalThis as Record<string, unknown>).window = {
  api: {
    updateTravailPublished: vi.fn(),
    createTravail: vi.fn(),
    deleteTravail: vi.fn(),
  },
}

import { useDevoirContextMenu } from '../../../src/renderer/src/composables/useDevoirContextMenu'
import { useAppStore } from '../../../src/renderer/src/stores/app'
import { _openTravail as travauxOpenTravailMock } from '@/stores/travaux'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeDevoir(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Mon Devoir',
    description: 'desc',
    deadline: '2026-04-15',
    channel_id: 10,
    type: 'devoir',
    category: 'Math',
    is_published: true,
    ...overrides,
  }
}

function makeMouseEvent(): MouseEvent {
  return { clientX: 100, clientY: 200, preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as MouseEvent
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useDevoirContextMenu', () => {
  let appStore: ReturnType<typeof useAppStore>
  let loadView: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    appStore = useAppStore()
    loadView = vi.fn().mockResolvedValue(undefined)
    vi.clearAllMocks()
  })

  // ── openCtxMenu / closeCtxMenu ──────────────────────────────────────────

  describe('openCtxMenu / closeCtxMenu', () => {
    it('opens context menu with devoir and coordinates', () => {
      const { openCtxMenu, ctxMenu } = useDevoirContextMenu(loadView)
      const d = makeDevoir()
      openCtxMenu(makeMouseEvent(), d as never)
      expect(ctxMenu.value.x).toBe(100)
      expect(ctxMenu.value.y).toBe(200)
      expect(ctxMenu.value.devoir).toEqual(d)
    })

    it('closeCtxMenu resets state', () => {
      const { openCtxMenu, closeCtxMenu, ctxMenu } = useDevoirContextMenu(loadView)
      openCtxMenu(makeMouseEvent(), makeDevoir() as never)
      closeCtxMenu()
      expect(ctxMenu.value.devoir).toBeNull()
      expect(ctxMenu.value.x).toBe(0)
      expect(ctxMenu.value.y).toBe(0)
    })
  })

  // ── ctxPublishToggle ──────────────────────────────────────────────────

  describe('ctxPublishToggle', () => {
    it('publishes an unpublished devoir', async () => {
      ;(window.api as Record<string, unknown>).updateTravailPublished = vi.fn().mockResolvedValue({ ok: true })
      const { openCtxMenu, ctxPublishToggle, ctxMenu } = useDevoirContextMenu(loadView)
      openCtxMenu(makeMouseEvent(), makeDevoir({ is_published: false }) as never)
      await ctxPublishToggle()
      expect((window.api as { updateTravailPublished: ReturnType<typeof vi.fn> }).updateTravailPublished).toHaveBeenCalledWith({ travailId: 1, published: true })
      expect(showToastMock).toHaveBeenCalledWith('Devoir publié.', 'success')
      expect(loadView).toHaveBeenCalled()
      expect(ctxMenu.value.devoir).toBeNull()
    })

    it('depublishes a published devoir', async () => {
      ;(window.api as Record<string, unknown>).updateTravailPublished = vi.fn().mockResolvedValue({ ok: true })
      const { openCtxMenu, ctxPublishToggle } = useDevoirContextMenu(loadView)
      openCtxMenu(makeMouseEvent(), makeDevoir({ is_published: true }) as never)
      await ctxPublishToggle()
      expect((window.api as { updateTravailPublished: ReturnType<typeof vi.fn> }).updateTravailPublished).toHaveBeenCalledWith({ travailId: 1, published: false })
      expect(showToastMock).toHaveBeenCalledWith('Devoir dépublié.', 'success')
    })

    it('shows error toast on failure', async () => {
      ;(window.api as Record<string, unknown>).updateTravailPublished = vi.fn().mockRejectedValue(new Error('fail'))
      const { openCtxMenu, ctxPublishToggle } = useDevoirContextMenu(loadView)
      openCtxMenu(makeMouseEvent(), makeDevoir() as never)
      await ctxPublishToggle()
      expect(showToastMock).toHaveBeenCalledWith('Erreur.', 'error')
    })

    it('does nothing when no devoir selected', async () => {
      const { ctxPublishToggle } = useDevoirContextMenu(loadView)
      await ctxPublishToggle()
      expect(showToastMock).not.toHaveBeenCalled()
    })
  })

  // ── ctxDuplicate ──────────────────────────────────────────────────────

  describe('ctxDuplicate', () => {
    it('duplicates devoir when confirmed', async () => {
      confirmMock.mockResolvedValue(true)
      ;(window.api as Record<string, unknown>).createTravail = vi.fn().mockResolvedValue({ ok: true })
      const { openCtxMenu, ctxDuplicate } = useDevoirContextMenu(loadView)
      openCtxMenu(makeMouseEvent(), makeDevoir() as never)
      await ctxDuplicate()
      expect(confirmMock).toHaveBeenCalled()
      expect((window.api as { createTravail: ReturnType<typeof vi.fn> }).createTravail).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Mon Devoir (copie)', published: false }),
      )
      expect(showToastMock).toHaveBeenCalledWith('Devoir dupliqué (brouillon).', 'success')
      expect(loadView).toHaveBeenCalled()
    })

    it('does nothing when user cancels', async () => {
      confirmMock.mockResolvedValue(false)
      const { openCtxMenu, ctxDuplicate } = useDevoirContextMenu(loadView)
      openCtxMenu(makeMouseEvent(), makeDevoir() as never)
      await ctxDuplicate()
      expect((window.api as { createTravail: ReturnType<typeof vi.fn> }).createTravail).not.toHaveBeenCalled()
    })

    it('shows error toast on api failure', async () => {
      confirmMock.mockResolvedValue(true)
      ;(window.api as Record<string, unknown>).createTravail = vi.fn().mockRejectedValue(new Error('fail'))
      const { openCtxMenu, ctxDuplicate } = useDevoirContextMenu(loadView)
      openCtxMenu(makeMouseEvent(), makeDevoir() as never)
      await ctxDuplicate()
      expect(showToastMock).toHaveBeenCalledWith('Erreur lors de la duplication.', 'error')
    })

    it('does nothing when no devoir selected', async () => {
      const { ctxDuplicate } = useDevoirContextMenu(loadView)
      await ctxDuplicate()
      expect(confirmMock).not.toHaveBeenCalled()
    })
  })

  // ── ctxDelete ─────────────────────────────────────────────────────────

  describe('ctxDelete', () => {
    it('deletes devoir when confirmed', async () => {
      confirmMock.mockResolvedValue(true)
      ;(window.api as Record<string, unknown>).deleteTravail = vi.fn().mockResolvedValue({ ok: true })
      const { openCtxMenu, ctxDelete } = useDevoirContextMenu(loadView)
      openCtxMenu(makeMouseEvent(), makeDevoir() as never)
      await ctxDelete()
      expect((window.api as { deleteTravail: ReturnType<typeof vi.fn> }).deleteTravail).toHaveBeenCalledWith(1)
      expect(showToastMock).toHaveBeenCalledWith('Devoir supprimé.', 'success')
      expect(loadView).toHaveBeenCalled()
    })

    it('does nothing when user cancels', async () => {
      confirmMock.mockResolvedValue(false)
      const { openCtxMenu, ctxDelete } = useDevoirContextMenu(loadView)
      openCtxMenu(makeMouseEvent(), makeDevoir() as never)
      await ctxDelete()
      expect((window.api as { deleteTravail: ReturnType<typeof vi.fn> }).deleteTravail).not.toHaveBeenCalled()
    })

    it('shows error toast on failure', async () => {
      confirmMock.mockResolvedValue(true)
      ;(window.api as Record<string, unknown>).deleteTravail = vi.fn().mockRejectedValue(new Error('fail'))
      const { openCtxMenu, ctxDelete } = useDevoirContextMenu(loadView)
      openCtxMenu(makeMouseEvent(), makeDevoir() as never)
      await ctxDelete()
      expect(showToastMock).toHaveBeenCalledWith('Erreur.', 'error')
    })

    it('does nothing when no devoir selected', async () => {
      const { ctxDelete } = useDevoirContextMenu(loadView)
      await ctxDelete()
      expect(confirmMock).not.toHaveBeenCalled()
    })
  })

  // ── ctxOpen ───────────────────────────────────────────────────────────

  describe('ctxOpen', () => {
    it('opens devoir modal and sets store state', () => {
      const { openCtxMenu, ctxOpen, ctxMenu } = useDevoirContextMenu(loadView)
      openCtxMenu(makeMouseEvent(), makeDevoir({ id: 42 }) as never)
      ctxOpen()
      expect(appStore.currentTravailId).toBe(42)
      expect(travauxOpenTravailMock).toHaveBeenCalledWith(42)
      expect(ctxMenu.value.devoir).toBeNull()
    })

    it('does nothing when no devoir selected', () => {
      const { ctxOpen } = useDevoirContextMenu(loadView)
      ctxOpen()
      expect(travauxOpenTravailMock).not.toHaveBeenCalled()
    })
  })
})
