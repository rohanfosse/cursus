/**
 * Tests pour useOpenExternal — ouverture securisee de liens externes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockShowToast = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

const mockAppStore = {
  isOnline: true,
}
vi.mock('@/stores/app', () => ({
  useAppStore: () => mockAppStore,
}))

const mockOpenExternal = vi.fn()
;(globalThis as any).window = {
  ...(globalThis as any).window,
  api: { openExternal: mockOpenExternal },
}

import { useOpenExternal } from '@/composables/useOpenExternal'

beforeEach(() => {
  vi.clearAllMocks()
  mockAppStore.isOnline = true
  mockOpenExternal.mockResolvedValue({ ok: true })
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('openExternal', () => {
  it('opens a valid https URL', () => {
    const { openExternal } = useOpenExternal()
    const result = openExternal('https://example.com')
    expect(result).toBe(true)
    expect(mockOpenExternal).toHaveBeenCalledWith('https://example.com')
  })

  it('opens a valid http URL', () => {
    const { openExternal } = useOpenExternal()
    const result = openExternal('http://example.com')
    expect(result).toBe(true)
    expect(mockOpenExternal).toHaveBeenCalledWith('http://example.com')
  })

  it('prepends https:// when no protocol', () => {
    const { openExternal } = useOpenExternal()
    openExternal('example.com')
    expect(mockOpenExternal).toHaveBeenCalledWith('https://example.com')
  })

  it('preserves mailto: protocol', () => {
    const { openExternal } = useOpenExternal()
    openExternal('mailto:test@example.com')
    expect(mockOpenExternal).toHaveBeenCalledWith('mailto:test@example.com')
  })

  it('returns false and shows toast for empty URL', () => {
    const { openExternal } = useOpenExternal()
    const result = openExternal('')
    expect(result).toBe(false)
    expect(mockShowToast).toHaveBeenCalledWith('Lien vide.')
    expect(mockOpenExternal).not.toHaveBeenCalled()
  })

  it('returns false and shows toast for whitespace-only URL', () => {
    const { openExternal } = useOpenExternal()
    const result = openExternal('   ')
    expect(result).toBe(false)
    expect(mockShowToast).toHaveBeenCalledWith('Lien vide.')
  })

  it('returns false when offline', () => {
    mockAppStore.isOnline = false
    const { openExternal } = useOpenExternal()
    const result = openExternal('https://example.com')
    expect(result).toBe(false)
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining('Hors-ligne'),
      'error',
    )
    expect(mockOpenExternal).not.toHaveBeenCalled()
  })

  it('shows error toast when window.api.openExternal fails', async () => {
    mockOpenExternal.mockResolvedValue({ ok: false, error: 'blocked' })
    const { openExternal } = useOpenExternal()
    const result = openExternal('https://example.com')
    expect(result).toBe(true) // returns true synchronously
    // Wait for the async error handling
    await vi.waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('blocked', 'error')
    })
  })

  it('shows generic error when API returns no error message', async () => {
    mockOpenExternal.mockResolvedValue({ ok: false })
    const { openExternal } = useOpenExternal()
    openExternal('https://example.com')
    await vi.waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Impossible'),
        'error',
      )
    })
  })

  it('trims whitespace from URL', () => {
    const { openExternal } = useOpenExternal()
    openExternal('  https://example.com  ')
    expect(mockOpenExternal).toHaveBeenCalledWith('https://example.com')
  })

  it('does not show error toast on success', async () => {
    mockOpenExternal.mockResolvedValue({ ok: true })
    const { openExternal } = useOpenExternal()
    openExternal('https://example.com')
    // Let the promise resolve
    await new Promise(r => setTimeout(r, 0))
    expect(mockShowToast).not.toHaveBeenCalled()
  })
})
