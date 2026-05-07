/**
 * Tests pour l'extracteur de metadonnees des events ICS externes (cours
 * Outlook publies). Valide les patterns CESI : Workshop, Prosit, Autonomie,
 * intervenant w/, salle.
 */
import { describe, it, expect } from 'vitest'
import { enrichExternalEvent, colorForKind } from '@/utils/externalEventEnrichment'

describe('enrichExternalEvent', () => {
  describe('Workshop', () => {
    it('extracts workshop number + description + intervenant', () => {
      const r = enrichExternalEvent({
        summary: "Workshop 1 - Création d'une API w/ M. Deshors",
      })
      expect(r.kind).toBe('workshop')
      expect(r.kindNumber).toBe(1)
      expect(r.kindLabel).toBe('Workshop 1')
      expect(r.cleanTitle).toBe("Création d'une API")
      expect(r.intervenant).toBe('M. Deshors')
    })

    it('handles long workshop description', () => {
      const r = enrichExternalEvent({
        summary: "Workshop 4 - Création d'une page d'authentification sur l'application front-end + liaison avec le service d'authentification w/ M. Deshors",
      })
      expect(r.kindNumber).toBe(4)
      expect(r.cleanTitle).toMatch(/^Création/)
      expect(r.intervenant).toBe('M. Deshors')
    })

    it('handles WS shorthand', () => {
      const r = enrichExternalEvent({ summary: 'WS3 - Authentification' })
      expect(r.kind).toBe('workshop')
      expect(r.kindNumber).toBe(3)
      expect(r.cleanTitle).toBe('Authentification')
    })

    it('handles workshop without description', () => {
      const r = enrichExternalEvent({ summary: 'Workshop 5' })
      expect(r.kind).toBe('workshop')
      expect(r.kindNumber).toBe(5)
      expect(r.cleanTitle).toBe('Workshop 5')
      expect(r.intervenant).toBeNull()
    })

    it('handles workshop with only intervenant', () => {
      const r = enrichExternalEvent({ summary: 'Workshop 2 w/ Mme. Lambert' })
      expect(r.kind).toBe('workshop')
      expect(r.kindNumber).toBe(2)
      expect(r.intervenant).toBe('Mme. Lambert')
    })
  })

  describe('Prosit', () => {
    it('extracts variant + number', () => {
      const r = enrichExternalEvent({ summary: 'Prosit Aller 3' })
      expect(r.kind).toBe('prosit')
      expect(r.kindNumber).toBe(3)
      expect(r.kindVariant).toBe('Aller')
      expect(r.kindLabel).toBe('Prosit Aller 3')
    })

    it('extracts Retour variant', () => {
      const r = enrichExternalEvent({ summary: 'Prosit Retour 7' })
      expect(r.kindVariant).toBe('Retour')
      expect(r.kindNumber).toBe(7)
    })

    it('handles short Prosit N form', () => {
      const r = enrichExternalEvent({ summary: 'Prosit 2' })
      expect(r.kind).toBe('prosit')
      expect(r.kindNumber).toBe(2)
      expect(r.kindVariant).toBeNull()
    })
  })

  describe('Autonomie', () => {
    it('extracts P-numbered autonomie', () => {
      const r = enrichExternalEvent({ summary: 'P3 - Autonomie' })
      expect(r.kind).toBe('autonomie')
      expect(r.kindNumber).toBe(3)
      expect(r.kindLabel).toBe('Autonomie P3')
    })
  })

  describe('Other CESI patterns', () => {
    it('detects Lancement de bloc', () => {
      const r = enrichExternalEvent({ summary: 'Lancement du Bloc + Projet' })
      expect(r.kind).toBe('lancement')
      expect(r.kindLabel).toBe('Lancement de bloc')
    })

    it('detects TOMIC (eval)', () => {
      expect(enrichExternalEvent({ summary: '/!\\ TOMIC /!\\' }).kind).toBe('eval')
      expect(enrichExternalEvent({ summary: 'Révision TOMIC' }).kindLabel).toBe('Revision TOMIC')
    })

    it('detects Anglais (langue)', () => {
      expect(enrichExternalEvent({ summary: 'Anglais' }).kind).toBe('langue')
    })

    it('detects Projet', () => {
      expect(enrichExternalEvent({ summary: 'Projet' }).kind).toBe('projet')
    })

    it('detects Entreprise (period)', () => {
      expect(enrichExternalEvent({ summary: 'Entreprise' }).kind).toBe('period')
    })

    it('detects Férié', () => {
      expect(enrichExternalEvent({ summary: 'Férié !' }).kind).toBe('ferie')
    })

    it('falls back to autre with cleanTitle = summary', () => {
      const r = enrichExternalEvent({ summary: "Développement d'application distribuée" })
      expect(r.kind).toBe('autre')
      expect(r.cleanTitle).toBe("Développement d'application distribuée")
    })
  })

  describe('Salle inference', () => {
    it('infers Salle B12 from title when location empty', () => {
      const r = enrichExternalEvent({
        summary: 'Workshop 2 - Auth Salle B12',
        location: '',
      })
      expect(r.inferredLocation).toBe('Salle B12')
    })

    it('does not override existing location', () => {
      const r = enrichExternalEvent({
        summary: 'Workshop 2 - Auth Salle B12',
        location: 'Bureau perso',
      })
      expect(r.inferredLocation).toBeNull()
    })

    it('infers Amphi A', () => {
      const r = enrichExternalEvent({
        summary: 'Soutenance promo Amphi A',
        location: '',
      })
      expect(r.inferredLocation).toBe('Amphi A')
    })

    it('infers Lab 3', () => {
      const r = enrichExternalEvent({
        summary: 'Workshop 5 Lab 3',
        location: '',
      })
      expect(r.inferredLocation).toBe('Lab 3')
    })
  })

  describe('Edge cases', () => {
    it('returns empty kind=autre for empty input', () => {
      const r = enrichExternalEvent({ summary: '' })
      expect(r.kind).toBe('autre')
      expect(r.cleanTitle).toBe('')
    })

    it('handles null/undefined gracefully', () => {
      const r = enrichExternalEvent({ summary: null, location: null, description: null })
      expect(r.kind).toBe('autre')
    })

    it('trims intervenant trailing punctuation', () => {
      const r = enrichExternalEvent({ summary: 'Workshop 1 - desc w/ M. Dupont.' })
      expect(r.intervenant).toBe('M. Dupont')
    })

    it('handles intervenant followed by comment in parens (skipped)', () => {
      const r = enrichExternalEvent({ summary: 'Workshop 1 - desc w/ M. Dupont (suppleant)' })
      expect(r.intervenant).toBe('M. Dupont')
    })
  })
})

describe('colorForKind', () => {
  it('returns distinct colors for each kind', () => {
    const colors = new Set([
      colorForKind('workshop'),
      colorForKind('prosit'),
      colorForKind('autonomie'),
      colorForKind('lancement'),
      colorForKind('soutenance'),
      colorForKind('eval'),
      colorForKind('langue'),
      colorForKind('projet'),
      colorForKind('period'),
      colorForKind('ferie'),
      colorForKind('autre'),
    ])
    // au moins 8 couleurs distinctes (eval+soutenance peuvent coincider)
    expect(colors.size).toBeGreaterThanOrEqual(8)
  })

  it('returns hex color for known kind', () => {
    expect(colorForKind('workshop')).toMatch(/^#[0-9a-f]{6}$/i)
  })
})
