import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { safeGetJSON, safeSetJSON } from '@/utils/safeStorage'

// ─── Helpers — mock localStorage ─────────────────────────────────────────────
function buildLocalStorageMock(overrides: Partial<Storage> = {}): Storage {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length },
    ...overrides,
  }
}

// ─── safeGetJSON ───────────────────────────────────────────────────────────────
describe('safeGetJSON', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', buildLocalStorageMock())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retourne la valeur parsée si la clé existe avec du JSON valide', () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Alice' }))
    const result = safeGetJSON('user', null)
    expect(result).toEqual({ id: 1, name: 'Alice' })
  })

  it('retourne le fallback si la clé est absente', () => {
    const result = safeGetJSON('inexistante', 42)
    expect(result).toBe(42)
  })

  it('retourne le fallback si la valeur est du JSON corrompu', () => {
    localStorage.setItem('bad', 'not-valid-json{{{')
    const result = safeGetJSON('bad', 'default')
    expect(result).toBe('default')
  })

  it('retourne le fallback pour une chaîne JSON mal formée (guillemet manquant)', () => {
    localStorage.setItem('broken', '{"name": "Alice"')
    const result = safeGetJSON<{ name: string } | null>('broken', null)
    expect(result).toBeNull()
  })

  it('retourne le fallback si getItem lève une exception', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('SecurityError') },
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    })
    const result = safeGetJSON('key', 'fallback')
    expect(result).toBe('fallback')
  })

  it('retourne le fallback si localStorage est désactivé (accès global lance une exception)', () => {
    // Simule un environnement où localStorage lui-même lance lors de l'accès
    vi.stubGlobal('localStorage', null)
    const result = safeGetJSON('key', [])
    expect(result).toEqual([])
  })

  it('retourne un tableau vide comme fallback si la clé est absente', () => {
    const result = safeGetJSON<number[]>('liste', [])
    expect(result).toEqual([])
  })

  it('retourne false comme fallback (valeur falsy)', () => {
    const result = safeGetJSON('absent', false)
    expect(result).toBe(false)
  })

  it('retourne 0 comme fallback (valeur numérique falsy)', () => {
    const result = safeGetJSON('absent', 0)
    expect(result).toBe(0)
  })

  it('parse correctement un booléen stocké', () => {
    localStorage.setItem('flag', JSON.stringify(true))
    const result = safeGetJSON('flag', false)
    expect(result).toBe(true)
  })

  it('parse correctement un nombre stocké', () => {
    localStorage.setItem('count', JSON.stringify(99))
    const result = safeGetJSON('count', 0)
    expect(result).toBe(99)
  })

  it('parse correctement un tableau stocké', () => {
    localStorage.setItem('ids', JSON.stringify([1, 2, 3]))
    const result = safeGetJSON<number[]>('ids', [])
    expect(result).toEqual([1, 2, 3])
  })

  it('ne lève jamais d\'exception — ne doit pas rejeter', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new TypeError('Simulated crash') },
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    })
    expect(() => safeGetJSON('key', 'safe')).not.toThrow()
  })
})

// ─── safeSetJSON ───────────────────────────────────────────────────────────────
describe('safeSetJSON', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', buildLocalStorageMock())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('retourne true et persiste la valeur en cas de succès', () => {
    const ok = safeSetJSON('user', { id: 1 })
    expect(ok).toBe(true)
    expect(JSON.parse(localStorage.getItem('user')!)).toEqual({ id: 1 })
  })

  it('retourne false si setItem lève une QuotaExceededError', () => {
    vi.stubGlobal('localStorage', {
      ...buildLocalStorageMock(),
      setItem: () => { throw new DOMException('QuotaExceededError') },
    })
    const ok = safeSetJSON('key', { data: 'heavy' })
    expect(ok).toBe(false)
  })

  it('retourne false si localStorage est désactivé (setItem lance)', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: () => { throw new Error('Storage disabled') },
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    })
    const ok = safeSetJSON('key', 'value')
    expect(ok).toBe(false)
  })

  it('retourne false si localStorage global est null', () => {
    vi.stubGlobal('localStorage', null)
    const ok = safeSetJSON('key', 'value')
    expect(ok).toBe(false)
  })

  it('stocke un tableau correctement', () => {
    const ok = safeSetJSON('liste', [1, 2, 3])
    expect(ok).toBe(true)
    expect(JSON.parse(localStorage.getItem('liste')!)).toEqual([1, 2, 3])
  })

  it('stocke un booléen correctement', () => {
    const ok = safeSetJSON('flag', false)
    expect(ok).toBe(true)
    expect(JSON.parse(localStorage.getItem('flag')!)).toBe(false)
  })

  it('stocke un nombre correctement', () => {
    const ok = safeSetJSON('count', 42)
    expect(ok).toBe(true)
    expect(JSON.parse(localStorage.getItem('count')!)).toBe(42)
  })

  it('stocke null correctement', () => {
    const ok = safeSetJSON('nothing', null)
    expect(ok).toBe(true)
    expect(JSON.parse(localStorage.getItem('nothing')!)).toBeNull()
  })

  it('retourne false si JSON.stringify lève une exception (référence circulaire)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const circular: any = {}
    circular.self = circular
    const ok = safeSetJSON('circular', circular)
    expect(ok).toBe(false)
  })

  it('ne lève jamais d\'exception — ne doit pas rejeter', () => {
    vi.stubGlobal('localStorage', null)
    expect(() => safeSetJSON('key', { data: 'test' })).not.toThrow()
  })
})

// ─── Intégration safeGetJSON + safeSetJSON ────────────────────────────────────
describe('safeGetJSON + safeSetJSON — round-trip', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', buildLocalStorageMock())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trip objet complexe', () => {
    const data = { id: 42, tags: ['a', 'b'], nested: { x: true } }
    safeSetJSON('complex', data)
    const result = safeGetJSON('complex', null)
    expect(result).toEqual(data)
  })

  it('round-trip tableau vide', () => {
    safeSetJSON('empty', [])
    const result = safeGetJSON<unknown[]>('empty', [1, 2])
    expect(result).toEqual([])
  })
})
