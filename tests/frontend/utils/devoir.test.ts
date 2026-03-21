/**
 * Tests unitaires pour les helpers métier liés aux devoirs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { typeLabel, TYPE_LABELS, extractDuration, isRattrapage, isEventType, needsSubmission, isExpired } from '@/utils/devoir'

describe('typeLabel', () => {
  it('returns French label for known types', () => {
    expect(typeLabel('livrable')).toBe('Livrable')
    expect(typeLabel('soutenance')).toBe('Soutenance')
    expect(typeLabel('cctl')).toBe('CCTL')
    expect(typeLabel('etude_de_cas')).toBe('Étude de cas')
    expect(typeLabel('memoire')).toBe('Mémoire')
    expect(typeLabel('autre')).toBe('Autre')
  })

  it('returns backward compat labels', () => {
    expect(typeLabel('devoir')).toBe('Devoir')
    expect(typeLabel('projet')).toBe('Projet')
    expect(typeLabel('jalon')).toBe('Jalon')
  })

  it('returns raw string for unknown types', () => {
    expect(typeLabel('unknown_type')).toBe('unknown_type')
    expect(typeLabel('')).toBe('')
  })
})

describe('extractDuration', () => {
  it('extracts duration from structured description', () => {
    expect(extractDuration('Durée : 20 min')).toBe('20 min')
    expect(extractDuration('Durée: 45 min')).toBe('45 min')
    expect(extractDuration('durée : 120 min')).toBe('120 min')
  })

  it('extracts from multi-line descriptions', () => {
    expect(extractDuration('**Session Initiale**\nDurée : 30 min\nSalle : B204')).toBe('30 min')
  })

  it('returns null when no duration found', () => {
    expect(extractDuration('Pas de durée ici')).toBeNull()
    expect(extractDuration(null)).toBeNull()
    expect(extractDuration('')).toBeNull()
  })
})

describe('isRattrapage', () => {
  it('detects rattrapage in title', () => {
    expect(isRattrapage({ title: 'CCTL Rattrapage - Module X' })).toBe(true)
    expect(isRattrapage({ title: 'Rattrapage Maths' })).toBe(true)
  })

  it('detects rattrapage in description', () => {
    expect(isRattrapage({ title: 'CCTL', description: '**Session Rattrapage**' })).toBe(true)
  })

  it('returns false when no rattrapage', () => {
    expect(isRattrapage({ title: 'CCTL - Module X' })).toBe(false)
    expect(isRattrapage({ title: 'CCTL', description: '**Session Initiale**' })).toBe(false)
    expect(isRattrapage({ title: '' })).toBe(false)
  })
})

describe('isEventType', () => {
  it('returns true for event types', () => {
    expect(isEventType('soutenance')).toBe(true)
    expect(isEventType('cctl')).toBe(true)
  })

  it('returns false for non-event types', () => {
    expect(isEventType('livrable')).toBe(false)
    expect(isEventType('memoire')).toBe(false)
    expect(isEventType('etude_de_cas')).toBe(false)
    expect(isEventType('autre')).toBe(false)
  })
})

describe('needsSubmission', () => {
  it('returns true when requires_submission is 1', () => {
    expect(needsSubmission({ requires_submission: 1 })).toBe(true)
  })

  it('returns false when requires_submission is 0', () => {
    expect(needsSubmission({ requires_submission: 0 })).toBe(false)
  })

  it('returns true when requires_submission is undefined', () => {
    expect(needsSubmission({})).toBe(true)
  })
})

describe('isExpired', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  const now = new Date('2026-03-21T12:00:00Z').getTime()

  it('returns true for past deadlines', () => {
    expect(isExpired('2026-03-20T00:00:00Z', now)).toBe(true)
    expect(isExpired('2026-03-21T11:59:59Z', now)).toBe(true)
  })

  it('returns false for future deadlines', () => {
    expect(isExpired('2026-03-22T00:00:00Z', now)).toBe(false)
    expect(isExpired('2026-04-01T00:00:00Z', now)).toBe(false)
  })

  it('returns true for exactly now', () => {
    expect(isExpired('2026-03-21T12:00:00Z', now)).toBe(true)
  })

  it('returns false for null/undefined deadline', () => {
    expect(isExpired(null, now)).toBe(false)
    expect(isExpired(undefined, now)).toBe(false)
  })
})
