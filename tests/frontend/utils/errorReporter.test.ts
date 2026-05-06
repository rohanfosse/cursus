/**
 * Tests pour l'utilitaire client-side de report d'erreurs (errorReporter.ts).
 *
 * Couvre :
 * - Normalisation de differents types d'erreurs (Error, string, object, non-serializable)
 * - Envoi POST vers /api/report-error avec le bon body
 * - Dedup d'erreurs identiques dans une fenetre de 1s
 * - Cap de 50 rapports par session
 * - Garde-fou contre la recursion (report qui throw → pas de boucle)
 * - Resilience : silencieux en cas d'echec reseau
 * - Header Authorization si token present
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reportError, __resetErrorReporterForTests__, isBenignError } from '@/utils/errorReporter'

const SESSION_KEY = 'cc_session'

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  __resetErrorReporterForTests__()
  localStorage.clear()

  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  ;(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch

  // window.location.pathname dans jsdom est '/' par defaut, suffisant
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('normalization', () => {
  it('serialise une Error avec son message et sa stack', async () => {
    const err = new Error('boom')
    await reportError(err)

    expect(fetchMock).toHaveBeenCalledOnce()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.message).toBe('boom')
    expect(body.stack).toBeTruthy()
    expect(body.stack).toContain('boom')
  })

  it('accepte une string en guise d\'erreur', async () => {
    await reportError('something broke')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.message).toBe('something broke')
    expect(body.stack).toBeNull()
  })

  it('serialise un objet arbitraire via JSON.stringify', async () => {
    await reportError({ code: 42, reason: 'nope' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.message).toContain('42')
    expect(body.message).toContain('nope')
  })

  it('ne crash pas sur une valeur non-serialisable (cycle)', async () => {
    const cycle: Record<string, unknown> = { a: 1 }
    cycle.self = cycle
    await reportError(cycle)
    // Peu importe le message exact, ce qui compte c'est de ne pas avoir throw
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('fallback sur "Unknown error" quand Error sans message', async () => {
    const err = new Error()
    err.name = 'MyError'
    await reportError(err)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.message).toBe('MyError')
  })
})

describe('dedup', () => {
  it('n\'envoie pas deux fois la meme erreur dans la fenetre de dedup', async () => {
    await reportError(new Error('same'))
    await reportError(new Error('same'))
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('envoie deux erreurs differentes consecutives', async () => {
    await reportError(new Error('first'))
    await reportError(new Error('second'))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('renvoie la meme erreur apres la fenetre de dedup', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      await reportError(new Error('same'))

      vi.setSystemTime(new Date('2026-01-01T00:00:02Z')) // +2s > 1s
      await reportError(new Error('same'))
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('session cap', () => {
  it('s\'arrete apres 50 rapports pour eviter un DOS', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
      // Envoyer 60 erreurs distinctes, en avancant le temps pour contourner le dedup
      for (let i = 0; i < 60; i++) {
        vi.setSystemTime(new Date(2026, 0, 1, 0, 0, i * 2))
        await reportError(new Error(`err-${i}`))
      }
      expect(fetchMock.mock.calls.length).toBe(50)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('auth header', () => {
  it('ajoute Authorization: Bearer si un token existe dans localStorage', async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'abc123' }))
    await reportError(new Error('auth-test'))
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer abc123')
  })

  it('ne casse pas sans token', async () => {
    await reportError(new Error('anon'))
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })
})

describe('body payload', () => {
  it('POST vers /api/report-error avec keepalive', async () => {
    await reportError(new Error('payload-test'))
    expect(fetchMock).toHaveBeenCalledWith('/api/report-error', expect.objectContaining({
      method: 'POST',
      keepalive: true,
    }))
  })

  it('inclut le source et la page dans le body', async () => {
    await reportError(new Error('ctx'), { source: 'vue', page: '/messages' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.source).toBe('vue')
    expect(body.page).toBe('/messages')
  })

  it('source=manual par defaut si non specifie', async () => {
    await reportError(new Error('default'))
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.source).toBe('manual')
  })
})

describe('resilience', () => {
  it('est silencieux si fetch rejette', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    await expect(reportError(new Error('will-fail'))).resolves.toBeUndefined()
  })

  it('ne boucle pas si le handler est lui-meme appele de maniere reentrante', async () => {
    // Simule une Error dont la stack trace throw quand on la touche
    // (cas extreme rare mais cite dans les issues Vue)
    let callCount = 0
    fetchMock.mockImplementation(async () => {
      callCount++
      // Le mock lui-meme appelle reportError → doit etre ignore par le garde-fou
      if (callCount === 1) {
        await reportError(new Error('reentrant'))
      }
      return { ok: true }
    })
    await reportError(new Error('initial'))
    // Un seul call en tout : le reentrant est bloque
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe('isBenignError', () => {
  it('matche "tooltipContainer does not exist" (vendor minifie non localise)', () => {
    expect(isBenignError(new Error('tooltipContainer does not exist'))).toBe(true)
    expect(isBenignError('Error: tooltipContainer does not exist')).toBe(true)
  })

  it('matche les ResizeObserver loop messages (bruit navigateur)', () => {
    expect(isBenignError(new Error('ResizeObserver loop limit exceeded'))).toBe(true)
    expect(isBenignError(new Error('ResizeObserver loop completed with undelivered notifications.'))).toBe(true)
  })

  it('ignore les erreurs reelles', () => {
    expect(isBenignError(new Error('TypeError: x is undefined'))).toBe(false)
    expect(isBenignError('boom')).toBe(false)
    expect(isBenignError(null)).toBe(false)
    expect(isBenignError({})).toBe(false)
  })

  it('reportError skip le POST pour une erreur benigne', async () => {
    await reportError(new Error('tooltipContainer does not exist'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reportError envoie pour une erreur reelle apres une benigne (dedup independant)', async () => {
    await reportError(new Error('tooltipContainer does not exist'))
    expect(fetchMock).not.toHaveBeenCalled()
    await reportError(new Error('real error'))
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
