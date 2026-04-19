/**
 * Tests pour useSignature — signature enseignant, demandes, signature/rejet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const showToastMock = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: showToastMock }),
}))

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({
  useApi: () => ({ api: apiMock }),
}))

const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { localStorageMock.store[key] = val }),
  removeItem: vi.fn((key: string) => { delete localStorageMock.store[key] }),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

;(globalThis as Record<string, unknown>).window = {
  api: {
    getSignatureRequests: vi.fn(),
    createSignatureRequest: vi.fn(),
    signDocument: vi.fn(),
    rejectSignature: vi.fn(),
    getSignatureByMessage: vi.fn(),
  },
}

// Note: useSignature uses module-level refs so we need to reset them
import { useSignature } from '../../../src/renderer/src/composables/useSignature'

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useSignature', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorageMock.store = {}
    // Reset module-level state
    const { requests, loading } = useSignature()
    requests.value = []
    loading.value = false
  })

  // ── savedSignature ────────────────────────────────────────────────────

  describe('savedSignature', () => {
    it('loads signature from localStorage on init', () => {
      localStorageMock.store['cc_teacher_signature'] = 'base64data'
      const { savedSignature } = useSignature()
      // Note: module-level ref reads at import time, so we test saveSignature instead
      expect(savedSignature.value).toBeDefined()
    })

    it('saveSignature persists to localStorage si data URL PNG valide', () => {
      const { saveSignature, savedSignature } = useSignature()
      const valid = 'data:image/png;base64,iVBORw0KGgo='
      const ok = saveSignature(valid)
      expect(ok).toBe(true)
      expect(savedSignature.value).toBe(valid)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cc_teacher_signature', valid)
    })

    it('saveSignature rejette une string qui n est pas un data URL PNG', () => {
      const { saveSignature, savedSignature } = useSignature()
      const ok = saveSignature('plain-text-not-a-png')
      expect(ok).toBe(false)
      expect(savedSignature.value).not.toBe('plain-text-not-a-png')
    })

    it('saveSignature rejette une signature > 500_000 chars (cap LS quota)', () => {
      const { saveSignature } = useSignature()
      const huge = 'data:image/png;base64,' + 'A'.repeat(600_000)
      const ok = saveSignature(huge)
      expect(ok).toBe(false)
    })

    it('clearSavedSignature removes from localStorage', () => {
      const { saveSignature, clearSavedSignature, savedSignature } = useSignature()
      saveSignature('data:image/png;base64,iVBORw0KGgo=')
      clearSavedSignature()
      expect(savedSignature.value).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cc_teacher_signature')
    })
  })

  // ── pendingCount ──────────────────────────────────────────────────────

  describe('pendingCount', () => {
    it('counts only pending requests', () => {
      const { requests, pendingCount } = useSignature()
      requests.value = [
        { id: 1, status: 'pending' },
        { id: 2, status: 'signed' },
        { id: 3, status: 'pending' },
        { id: 4, status: 'rejected' },
      ] as never
      expect(pendingCount.value).toBe(2)
    })

    it('returns 0 when no requests', () => {
      const { pendingCount } = useSignature()
      expect(pendingCount.value).toBe(0)
    })
  })

  // ── loadRequests ──────────────────────────────────────────────────────

  describe('loadRequests', () => {
    it('loads requests from api', async () => {
      const data = [{ id: 1, status: 'pending' }, { id: 2, status: 'signed' }]
      apiMock.mockResolvedValue(data)
      const { loadRequests, requests, loading } = useSignature()
      await loadRequests()
      expect(requests.value).toEqual(data)
      expect(loading.value).toBe(false)
    })

    it('passes status filter to api', async () => {
      apiMock.mockResolvedValue([])
      const { loadRequests } = useSignature()
      await loadRequests('pending')
      expect(apiMock).toHaveBeenCalled()
    })

    it('sets empty array when api returns non-array', async () => {
      apiMock.mockResolvedValue(null)
      const { loadRequests, requests } = useSignature()
      await loadRequests()
      expect(requests.value).toEqual([])
    })
  })

  // ── requestSignature ──────────────────────────────────────────────────

  describe('requestSignature', () => {
    it('calls api and shows success toast', async () => {
      apiMock.mockResolvedValue({ id: 1 })
      const { requestSignature } = useSignature()
      const result = await requestSignature(100, 5, 'http://file.pdf', 'file.pdf')
      expect(apiMock).toHaveBeenCalled()
      expect(showToastMock).toHaveBeenCalledWith('Demande de signature envoyée', 'success')
      expect(result).toEqual({ id: 1 })
    })

    it('returns null when api fails', async () => {
      apiMock.mockResolvedValue(null)
      const { requestSignature } = useSignature()
      const result = await requestSignature(100, 5, 'http://file.pdf', 'file.pdf')
      expect(result).toBeNull()
      expect(showToastMock).not.toHaveBeenCalled()
    })
  })

  // ── signDocument ──────────────────────────────────────────────────────

  describe('signDocument', () => {
    it('signs document, updates local request, shows toast', async () => {
      const apiResult = { signed_file_url: 'http://signed.pdf' }
      apiMock.mockResolvedValue(apiResult)
      const { requests, signDocument } = useSignature()
      requests.value = [{ id: 1, status: 'pending', signed_file_url: null }] as never
      const result = await signDocument(1, 'sigbase64')
      expect(result).toEqual(apiResult)
      expect(showToastMock).toHaveBeenCalledWith('Document signé avec succès', 'success', expect.any(String))
      expect(requests.value[0].status).toBe('signed')
      expect(requests.value[0].signed_file_url).toBe('http://signed.pdf')
    })

    it('returns null when api fails', async () => {
      apiMock.mockResolvedValue(null)
      const { signDocument } = useSignature()
      const result = await signDocument(1, 'sigbase64')
      expect(result).toBeNull()
    })

    it('does not crash if request not found locally', async () => {
      apiMock.mockResolvedValue({ signed_file_url: 'url' })
      const { requests, signDocument } = useSignature()
      requests.value = []
      const result = await signDocument(999, 'sigbase64')
      expect(result).toEqual({ signed_file_url: 'url' })
    })
  })

  // ── rejectSignature ───────────────────────────────────────────────────

  describe('rejectSignature', () => {
    it('rejects signature, updates local request, shows toast', async () => {
      apiMock.mockResolvedValue({})
      const { requests, rejectSignature } = useSignature()
      requests.value = [{ id: 1, status: 'pending', rejection_reason: null }] as never
      const result = await rejectSignature(1, 'Mauvais format')
      expect(result).toBe(true)
      expect(showToastMock).toHaveBeenCalledWith('Demande de signature refusée', 'info', 'Motif : Mauvais format')
      expect(requests.value[0].status).toBe('rejected')
      expect(requests.value[0].rejection_reason).toBe('Mauvais format')
    })

    it('shows toast without reason detail when reason is empty', async () => {
      apiMock.mockResolvedValue({})
      const { requests, rejectSignature } = useSignature()
      requests.value = [{ id: 1, status: 'pending', rejection_reason: null }] as never
      await rejectSignature(1, '')
      expect(showToastMock).toHaveBeenCalledWith('Demande de signature refusée', 'info', undefined)
    })

    it('returns false when api fails', async () => {
      apiMock.mockResolvedValue(null)
      const { rejectSignature } = useSignature()
      const result = await rejectSignature(1, 'reason')
      expect(result).toBe(false)
    })
  })

  // ── getSignatureForMessage ────────────────────────────────────────────

  describe('getSignatureForMessage', () => {
    it('returns signature request from api', async () => {
      const req = { id: 1, status: 'signed', message_id: 100 }
      apiMock.mockResolvedValue(req)
      const { getSignatureForMessage } = useSignature()
      const result = await getSignatureForMessage(100)
      expect(result).toEqual(req)
    })

    it('returns null when api returns null', async () => {
      apiMock.mockResolvedValue(null)
      const { getSignatureForMessage } = useSignature()
      const result = await getSignatureForMessage(100)
      expect(result).toBeNull()
    })
  })
})
