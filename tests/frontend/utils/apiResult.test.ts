import { describe, it, expect } from 'vitest'
import { success, failure, isOk } from '@/utils/apiResult'
import type { ApiResult, ApiSuccess, ApiError } from '@/utils/apiResult'

// ─── success() ────────────────────────────────────────────────────────────────
describe('success', () => {
  it('retourne { ok: true, data } pour une donnée quelconque', () => {
    const result = success({ id: 1, name: 'Alice' })
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ id: 1, name: 'Alice' })
  })

  it('retourne { ok: true, data: null } pour null', () => {
    const result = success(null)
    expect(result.ok).toBe(true)
    expect(result.data).toBeNull()
  })

  it('retourne { ok: true, data: [] } pour un tableau vide', () => {
    const result = success([])
    expect(result.ok).toBe(true)
    expect(result.data).toEqual([])
  })

  it('retourne { ok: true, data: 0 } pour zéro', () => {
    const result = success(0)
    expect(result.ok).toBe(true)
    expect(result.data).toBe(0)
  })

  it('retourne { ok: true, data: false } pour false', () => {
    const result = success(false)
    expect(result.ok).toBe(true)
    expect(result.data).toBe(false)
  })

  it('retourne { ok: true, data: "" } pour chaîne vide', () => {
    const result = success('')
    expect(result.ok).toBe(true)
    expect(result.data).toBe('')
  })

  it('ne contient pas de champ "error"', () => {
    const result = success('hello') as ApiSuccess<string>
    expect('error' in result).toBe(false)
  })
})

// ─── failure() ────────────────────────────────────────────────────────────────
describe('failure', () => {
  it('retourne { ok: false } pour n\'importe quel code', () => {
    const result = failure('Erreur réseau', 'network')
    expect(result.ok).toBe(false)
  })

  it('contient le message d\'erreur fourni', () => {
    const result = failure('Accès refusé', 'auth')
    expect(result.error).toBe('Accès refusé')
  })

  it('contient le code "network"', () => {
    const result = failure('Erreur réseau', 'network')
    expect(result.code).toBe('network')
  })

  it('contient le code "auth"', () => {
    const result = failure('Non autorisé', 'auth')
    expect(result.code).toBe('auth')
  })

  it('contient le code "validation"', () => {
    const result = failure('Données invalides', 'validation')
    expect(result.code).toBe('validation')
  })

  it('contient le code "server"', () => {
    const result = failure('Erreur interne', 'server')
    expect(result.code).toBe('server')
  })

  it('contient le code "timeout"', () => {
    const result = failure('Requête expirée', 'timeout')
    expect(result.code).toBe('timeout')
  })

  it('ne contient pas de champ "data"', () => {
    const result = failure('oops', 'server') as ApiError
    expect('data' in result).toBe(false)
  })
})

// ─── isOk() ───────────────────────────────────────────────────────────────────
describe('isOk', () => {
  it('retourne true pour un résultat success', () => {
    const result: ApiResult<string> = success('données')
    expect(isOk(result)).toBe(true)
  })

  it('retourne false pour un résultat failure', () => {
    const result: ApiResult<string> = failure('erreur', 'server')
    expect(isOk(result)).toBe(false)
  })

  it('agit comme type guard — data accessible sans cast après isOk', () => {
    const result: ApiResult<{ id: number }> = success({ id: 42 })
    if (isOk(result)) {
      // TypeScript doit inférer result.data ici sans erreur
      expect(result.data.id).toBe(42)
    } else {
      // Ce bloc ne doit pas être atteint
      expect(true).toBe(false)
    }
  })

  it('agit comme type guard — error accessible sans cast après !isOk', () => {
    const result: ApiResult<string> = failure('timeout réseau', 'timeout')
    if (!isOk(result)) {
      expect(result.error).toBe('timeout réseau')
      expect(result.code).toBe('timeout')
    } else {
      expect(true).toBe(false)
    }
  })
})

// ─── Composabilité / utilisation réelle ───────────────────────────────────────
describe('ApiResult — composabilité', () => {
  it('peut être utilisé dans un tableau de résultats mixtes', () => {
    const results: Array<ApiResult<number>> = [
      success(1),
      failure('Erreur', 'network'),
      success(3),
    ]
    const okResults = results.filter(isOk)
    expect(okResults).toHaveLength(2)
    // TypeScript infère correctement le type dans le filtre
    okResults.forEach(r => expect(r.data).toBeGreaterThan(0))
  })

  it('success avec un objet complexe préserve la structure', () => {
    const payload = {
      items: [{ id: 'a' }, { id: 'b' }],
      total: 2,
      page: 1,
    }
    const result = success(payload)
    expect(isOk(result)).toBe(true)
    if (isOk(result)) {
      expect(result.data.items).toHaveLength(2)
      expect(result.data.total).toBe(2)
    }
  })

  it('failure avec message vide est toujours un ApiError valide', () => {
    const result = failure('', 'validation')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('')
    expect(result.code).toBe('validation')
  })
})

// ─── Types exportés (vérification de structure à la compilation) ─────────────
describe('ApiResult — types exportés', () => {
  it('ApiSuccess a ok: true et data', () => {
    const s: ApiSuccess<string> = { ok: true, data: 'hello' }
    expect(s.ok).toBe(true)
    expect(s.data).toBe('hello')
  })

  it('ApiError a ok: false, error et code', () => {
    const e: ApiError = { ok: false, error: 'msg', code: 'auth' }
    expect(e.ok).toBe(false)
    expect(e.error).toBe('msg')
    expect(e.code).toBe('auth')
  })
})
