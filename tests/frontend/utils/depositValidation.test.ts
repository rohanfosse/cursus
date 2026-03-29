import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateDeposit } from '@/utils/depositValidation'

// ─── Fichier null ──────────────────────────────────────────────────────────────
describe('validateDeposit — fichier null', () => {
  it('retourne valid:false si le fichier est null', () => {
    const result = validateDeposit(null)
    expect(result.valid).toBe(false)
  })

  it('retourne un message d\'erreur en français si le fichier est null', () => {
    const result = validateDeposit(null)
    expect(result.error).toBe('Aucun fichier selectionne.')
  })

  it('retourne valid:false si le fichier est null même avec une deadline future', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const result = validateDeposit(null, future)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Aucun fichier selectionne.')
  })
})

// ─── Délai dépassé ────────────────────────────────────────────────────────────
describe('validateDeposit — deadline dépassée', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('retourne valid:false si la deadline est dans le passé', () => {
    const result = validateDeposit(
      { name: 'rapport.pdf', size: 1000 },
      '2026-03-28T00:00:00Z',
    )
    expect(result.valid).toBe(false)
  })

  it('retourne le message "La date limite est depassee." si deadline passée', () => {
    const result = validateDeposit(
      { name: 'rapport.pdf', size: 1000 },
      '2026-01-01T00:00:00Z',
    )
    expect(result.error).toBe('La date limite est depassee.')
  })

  it('retourne valid:true si la deadline est dans le futur', () => {
    const result = validateDeposit(
      { name: 'rapport.pdf', size: 1000 },
      '2026-12-31T23:59:59Z',
    )
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('retourne valid:true si aucune deadline n\'est fournie', () => {
    const result = validateDeposit({ name: 'rapport.pdf', size: 1000 })
    expect(result.valid).toBe(true)
  })

  it('retourne valid:true si deadline est null', () => {
    const result = validateDeposit({ name: 'rapport.pdf', size: 1000 }, null)
    expect(result.valid).toBe(true)
  })

  it('retourne valid:true si deadline est undefined', () => {
    const result = validateDeposit({ name: 'rapport.pdf', size: 1000 }, undefined)
    expect(result.valid).toBe(true)
  })

  it('retourne valid:false pour une deadline exactement maintenant (passée)', () => {
    // Date.now() = 2026-03-29T12:00:00Z — une seconde avant est dans le passé
    const result = validateDeposit(
      { name: 'rapport.pdf', size: 1000 },
      '2026-03-29T11:59:59Z',
    )
    expect(result.valid).toBe(false)
  })
})

// ─── Délégation à validateFile ────────────────────────────────────────────────
describe('validateDeposit — délégation à fileValidation', () => {
  it('retourne valid:false si le fichier a une extension bloquée', () => {
    const result = validateDeposit({ name: 'virus.exe', size: 1000 })
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('transmet le message d\'erreur de fileValidation pour extension bloquée', () => {
    const result = validateDeposit({ name: 'malware.bat', size: 1000 })
    expect(result.error).toMatch(/type de fichier|extension/i)
  })

  it('retourne valid:false si le fichier dépasse 50 Mo', () => {
    const result = validateDeposit({ name: 'lourd.pdf', size: 50 * 1024 * 1024 + 1 })
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/50\s*Mo/i)
  })

  it('retourne valid:false pour path traversal', () => {
    const result = validateDeposit({ name: '../../etc/passwd', size: 100 })
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('retourne valid:true pour un fichier pdf valide sans deadline', () => {
    const result = validateDeposit({ name: 'rendu_final.pdf', size: 2 * 1024 * 1024 })
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })
})

// ─── Priorité des validations ─────────────────────────────────────────────────
describe('validateDeposit — ordre de validation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('retourne l\'erreur "fichier null" avant l\'erreur de deadline', () => {
    const result = validateDeposit(null, '2026-01-01T00:00:00Z')
    expect(result.error).toBe('Aucun fichier selectionne.')
  })

  it('retourne l\'erreur fileValidation avant l\'erreur de deadline', () => {
    // Extension bloquée + deadline passée → l'erreur fileValidation doit passer en premier
    const result = validateDeposit(
      { name: 'virus.exe', size: 1000 },
      '2026-01-01T00:00:00Z',
    )
    expect(result.valid).toBe(false)
    // Le message ne doit pas être celui de la deadline
    expect(result.error).not.toBe('La date limite est depassee.')
  })
})

// ─── Interface DepositValidationResult ───────────────────────────────────────
describe('validateDeposit — structure du résultat', () => {
  it('retourne { valid: true } sans champ error quand tout est valide', () => {
    const result = validateDeposit({ name: 'document.pdf', size: 500 })
    expect(result).toEqual({ valid: true })
  })

  it('retourne { valid: false, error: string } en cas d\'erreur', () => {
    const result = validateDeposit(null)
    expect(result.valid).toBe(false)
    expect(typeof result.error).toBe('string')
    expect(result.error!.length).toBeGreaterThan(0)
  })
})
