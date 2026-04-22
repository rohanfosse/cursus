import { describe, it, expect, beforeEach } from 'vitest'
import {
  useQuickReacts,
  AVAILABLE_REACTS,
} from '@/composables/useQuickReacts'

// v2 (MAX_SLOTS=5) — storage key bumpee pour eviter les etats legacy a 4.
const STORAGE_KEY = 'cc_quick_reacts_v2'
const DEFAULTS = ['check', 'thumb', 'fire', 'heart', 'eyes']

describe('useQuickReacts', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
    const { resetQuickReacts } = useQuickReacts()
    resetQuickReacts()
  })

  describe('defaults', () => {
    it('charge les 5 reactions par defaut au premier appel', () => {
      const { quickReacts, quickReactTypes } = useQuickReacts()
      expect(quickReactTypes.value).toEqual(DEFAULTS)
      expect(quickReacts.value).toHaveLength(5)
      expect(quickReacts.value.every(r => typeof r.emoji === 'string')).toBe(true)
    })

    it('AVAILABLE_REACTS couvre au moins 20 reactions pedagogiques', () => {
      expect(AVAILABLE_REACTS.length).toBeGreaterThanOrEqual(20)
      const types = AVAILABLE_REACTS.map(r => r.type)
      expect(new Set(types).size).toBe(types.length)
    })
  })

  describe('toggle', () => {
    it('ajoute un emoji non selectionne (sous la limite)', () => {
      const { toggleQuickReact, quickReactTypes } = useQuickReacts()
      // D'abord retirer un pour passer a 4
      toggleQuickReact('eyes')
      expect(quickReactTypes.value).toHaveLength(4)
      // Ajouter un nouveau
      toggleQuickReact('laugh')
      expect(quickReactTypes.value).toContain('laugh')
      expect(quickReactTypes.value).toHaveLength(5)
    })

    it('retire un emoji deja selectionne', () => {
      const { toggleQuickReact, quickReactTypes } = useQuickReacts()
      toggleQuickReact('heart')
      expect(quickReactTypes.value).not.toContain('heart')
      expect(quickReactTypes.value).toHaveLength(4)
    })

    it('refuse d\'ajouter un 6e emoji (deja 5 selectionnes)', () => {
      const { toggleQuickReact, quickReactTypes } = useQuickReacts()
      expect(quickReactTypes.value).toHaveLength(5)
      toggleQuickReact('laugh')
      expect(quickReactTypes.value).toHaveLength(5)
      expect(quickReactTypes.value).not.toContain('laugh')
    })

    it('refuse de retirer le dernier emoji (eviter etat vide)', () => {
      const { toggleQuickReact, quickReactTypes } = useQuickReacts()
      toggleQuickReact('check')
      toggleQuickReact('thumb')
      toggleQuickReact('fire')
      toggleQuickReact('heart')
      expect(quickReactTypes.value).toEqual(['eyes'])
      toggleQuickReact('eyes')
      expect(quickReactTypes.value).toEqual(['eyes'])
    })
  })

  describe('setAll', () => {
    it('remplace les 5 reactions', () => {
      const { setQuickReactTypes, quickReactTypes } = useQuickReacts()
      setQuickReactTypes(['laugh', 'clap', 'party', 'rocket', 'brain'])
      expect(quickReactTypes.value).toEqual(['laugh', 'clap', 'party', 'rocket', 'brain'])
    })

    it('refuse une liste de longueur != 5', () => {
      const { setQuickReactTypes, quickReactTypes } = useQuickReacts()
      const before = [...quickReactTypes.value]
      setQuickReactTypes(['laugh', 'clap'])
      expect(quickReactTypes.value).toEqual(before)
    })

    it('refuse des types inconnus', () => {
      const { setQuickReactTypes, quickReactTypes } = useQuickReacts()
      const before = [...quickReactTypes.value]
      setQuickReactTypes(['laugh', 'clap', 'bogus', 'rocket', 'brain'])
      expect(quickReactTypes.value).toEqual(before)
    })
  })

  describe('reset', () => {
    it('remet les 5 defauts', () => {
      const { toggleQuickReact, resetQuickReacts, quickReactTypes } = useQuickReacts()
      toggleQuickReact('heart')
      toggleQuickReact('laugh')
      resetQuickReacts()
      expect(quickReactTypes.value).toEqual(DEFAULTS)
    })
  })

  describe('persistance', () => {
    it('ecrit dans la cle v2 via toggle', () => {
      const { toggleQuickReact } = useQuickReacts()
      toggleQuickReact('heart')
      const stored = localStorage.getItem(STORAGE_KEY)
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored!)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).not.toContain('heart')
    })

    it('ecrit dans la cle v2 via setQuickReactTypes', () => {
      const { setQuickReactTypes } = useQuickReacts()
      setQuickReactTypes(['laugh', 'clap', 'party', 'rocket', 'brain'])
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
      expect(parsed).toEqual(['laugh', 'clap', 'party', 'rocket', 'brain'])
    })
  })
})
