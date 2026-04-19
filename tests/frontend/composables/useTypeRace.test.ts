/**
 * Tests pour useTypeRace — composable du mini-jeu typing speed (v2.170).
 * Valide : machine d'etats (idle -> playing -> done), calculs WPM/precision,
 * anti-rejeu via localStorage, submit automatique en fin de partie.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const api = vi.fn(async (call: () => Promise<{ ok: boolean; data?: unknown }>) => {
  const res = await call()
  return res.ok ? (res.data ?? null) : null
})

vi.mock('@/composables/useApi', () => ({
  useApi: () => ({ api }),
}))

const typeRaceRandomPhrase = vi.fn()
const typeRaceSubmitScore  = vi.fn()

vi.stubGlobal('window', {
  api: { typeRaceRandomPhrase, typeRaceSubmitScore },
})

// localStorage mock
const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v) },
  removeItem: (k: string) => { storage.delete(k) },
  clear: () => { storage.clear() },
})

import { useTypeRace } from '@/composables/useTypeRace'

describe('useTypeRace', () => {
  let game: ReturnType<typeof useTypeRace>

  beforeEach(() => {
    api.mockClear()
    typeRaceRandomPhrase.mockReset()
    typeRaceSubmitScore.mockReset()
    storage.clear()
    vi.useFakeTimers()
    game = useTypeRace()
  })

  afterEach(() => {
    game.cleanup()
    vi.useRealTimers()
  })

  describe('etat initial', () => {
    it('state = idle, phrase = null, typed vide', () => {
      expect(game.state.value).toBe('idle')
      expect(game.phrase.value).toBeNull()
      expect(game.typed.value).toBe('')
      expect(game.wpm.value).toBe(0)
      expect(game.score.value).toBe(0)
      expect(game.accuracy.value).toBe(1) // vide = 100% (pas d'erreurs)
    })

    it('remainingSec vaut 60 au depart', () => {
      expect(game.remainingSec.value).toBe(60)
    })
  })

  describe('loadPhrase', () => {
    it('charge une phrase depuis window.api + reset le jeu', async () => {
      typeRaceRandomPhrase.mockResolvedValue({
        ok: true,
        data: { id: 42, text: 'Bonjour le monde' },
      })
      await game.loadPhrase()
      expect(game.phrase.value).toEqual({ id: 42, text: 'Bonjour le monde' })
      expect(game.state.value).toBe('idle')
    })

    it('passe les seen ids au backend pour exclusion', async () => {
      storage.set('typerace:seen', JSON.stringify([10, 11, 12]))
      typeRaceRandomPhrase.mockResolvedValue({ ok: true, data: { id: 1, text: 'A' } })
      await game.loadPhrase()
      expect(typeRaceRandomPhrase).toHaveBeenCalledWith([10, 11, 12])
    })

    it('persiste le nouvel id dans localStorage (tete de liste)', async () => {
      storage.set('typerace:seen', JSON.stringify([1, 2]))
      typeRaceRandomPhrase.mockResolvedValue({ ok: true, data: { id: 42, text: 'X' } })
      await game.loadPhrase()
      const seen = JSON.parse(storage.get('typerace:seen')!)
      expect(seen[0]).toBe(42)
      expect(seen).toContain(1)
      expect(seen).toContain(2)
    })

    it('deduplique les ids (pas de doublon dans seen)', async () => {
      storage.set('typerace:seen', JSON.stringify([5]))
      typeRaceRandomPhrase.mockResolvedValue({ ok: true, data: { id: 5, text: 'X' } })
      await game.loadPhrase()
      const seen = JSON.parse(storage.get('typerace:seen')!)
      expect(seen).toEqual([5]) // pas [5, 5]
    })

    it('cap la liste seen a 20', async () => {
      const seen20 = Array.from({ length: 20 }, (_, i) => i + 1)
      storage.set('typerace:seen', JSON.stringify(seen20))
      typeRaceRandomPhrase.mockResolvedValue({ ok: true, data: { id: 99, text: 'X' } })
      await game.loadPhrase()
      const next = JSON.parse(storage.get('typerace:seen')!)
      expect(next.length).toBe(20)
      expect(next[0]).toBe(99)
      // Le plus vieux (20) est tombe
      expect(next).not.toContain(20)
    })
  })

  describe('machine d\'etats', () => {
    beforeEach(async () => {
      typeRaceRandomPhrase.mockResolvedValue({
        ok: true,
        data: { id: 1, text: 'Bonjour' },
      })
      await game.loadPhrase()
    })

    it('idle -> playing au 1er caractere', () => {
      expect(game.state.value).toBe('idle')
      game.onInput('B')
      expect(game.state.value).toBe('playing')
    })

    it('reste playing si on continue a taper', () => {
      game.onInput('B')
      game.onInput('Bo')
      expect(game.state.value).toBe('playing')
    })

    it('passe a done quand la phrase est tapee entierement', async () => {
      typeRaceSubmitScore.mockResolvedValue({ ok: true, data: { id: 1, score: 0 } })
      game.onInput('B')
      vi.advanceTimersByTime(500)
      game.onInput('Bonjour')
      // finish() est async interne, on attend les microtasks
      await vi.runAllTimersAsync()
      expect(game.state.value).toBe('done')
    })

    it('passe a done quand le chrono atteint 60s', async () => {
      typeRaceSubmitScore.mockResolvedValue({ ok: true, data: { id: 1, score: 0 } })
      game.onInput('B')
      vi.advanceTimersByTime(60_001)
      await vi.runAllTimersAsync()
      expect(game.state.value).toBe('done')
    })

    it('onInput no-op apres done', async () => {
      typeRaceSubmitScore.mockResolvedValue({ ok: true, data: { id: 1, score: 0 } })
      game.onInput('Bonjour')
      await vi.runAllTimersAsync()
      expect(game.state.value).toBe('done')
      const before = game.typed.value
      game.onInput('Bonjour extra')
      expect(game.typed.value).toBe(before)
    })
  })

  describe('calculs WPM / precision', () => {
    beforeEach(async () => {
      // Phrase de 25 caracteres (5 mots de 5 chars)
      typeRaceRandomPhrase.mockResolvedValue({
        ok: true,
        data: { id: 1, text: 'aaaaa bbbbb ccccc ddddd eeeee' },
      })
      await game.loadPhrase()
    })

    it('accuracy = 1.0 quand tout est correct', () => {
      game.onInput('aaaaa')
      expect(game.accuracy.value).toBe(1)
    })

    it('accuracy chute quand on tape une lettre fausse', () => {
      game.onInput('aaXaa')
      expect(game.accuracy.value).toBeCloseTo(4 / 5, 2)
    })

    it('correctChars compte les bons caracteres', () => {
      game.onInput('aaaXX')
      expect(game.correctChars.value).toBe(3)
    })

    it('WPM = 60 quand on tape 10 chars (2 mots) en 12s', () => {
      // Pas de tick dans l'horloge : on start + advance puis on relit wpm
      game.onInput('a')
      vi.advanceTimersByTime(12_000)
      game.onInput('aaaaa bbbb')
      // 10 chars / 5 = 2 mots en 12/60 = 0.2 min -> 10 WPM
      expect(game.wpm.value).toBeCloseTo(10, 0)
    })
  })

  describe('soumission automatique', () => {
    beforeEach(async () => {
      typeRaceRandomPhrase.mockResolvedValue({
        ok: true,
        data: { id: 7, text: 'Bonjour' },
      })
      await game.loadPhrase()
      typeRaceSubmitScore.mockResolvedValue({ ok: true, data: { id: 1, score: 60 } })
    })

    it('appelle window.api.typeRaceSubmitScore en fin de partie', async () => {
      game.onInput('B')
      vi.advanceTimersByTime(5000)
      game.onInput('Bonjour')
      await vi.runAllTimersAsync()
      expect(typeRaceSubmitScore).toHaveBeenCalledOnce()
      const payload = typeRaceSubmitScore.mock.calls[0][0]
      expect(payload.phraseId).toBe(7)
      expect(payload.durationMs).toBeGreaterThan(0)
      expect(payload.durationMs).toBeLessThanOrEqual(60_000)
    })

    it('ne soumet pas 2x quand finish est appele deux fois', async () => {
      game.onInput('Bonjour')
      await vi.runAllTimersAsync()
      await game.finish() // appel manuel redondant
      expect(typeRaceSubmitScore).toHaveBeenCalledOnce()
    })

    it('lastResult contient wpm, accuracy, score', async () => {
      game.onInput('Bonjour')
      await vi.runAllTimersAsync()
      expect(game.lastResult.value).not.toBeNull()
      expect(game.lastResult.value?.score).toBeGreaterThanOrEqual(0)
      expect(game.lastResult.value?.accuracy).toBeCloseTo(1, 2)
    })
  })

  describe('resetGame', () => {
    it('remet state a idle + typed vide', async () => {
      typeRaceRandomPhrase.mockResolvedValue({ ok: true, data: { id: 1, text: 'X' } })
      await game.loadPhrase()
      game.onInput('a')
      expect(game.state.value).toBe('playing')
      game.resetGame()
      expect(game.state.value).toBe('idle')
      expect(game.typed.value).toBe('')
      expect(game.lastResult.value).toBeNull()
    })
  })
})
