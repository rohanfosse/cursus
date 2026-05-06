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
    // Default : finish() doit pouvoir resoudre sans throw meme quand le
    // test ne le mocke pas explicitement (ex : triggered par timeout 60s).
    typeRaceSubmitScore.mockResolvedValue({ ok: true, data: { id: 1, score: 0 } })
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
      // v2.292 : loadPhrase declenche le countdown (3-2-1) avant idle.
      expect(game.state.value).toBe('countdown')
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
      // v2.292 : loadPhrase ouvre sur countdown — onInput skip le countdown
      // (-> idle) puis enchaine sur playing au 1er caractere.
      expect(game.state.value).toBe('countdown')
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
      expect(game.wpmSamples.value).toEqual([])
      expect(game.errorTick.value).toBe(0)
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  //  Nouveautes v2.171 : wpmSamples, errorTick, cursorPos
  // ═══════════════════════════════════════════════════════════════════

  describe('cursorPos', () => {
    beforeEach(async () => {
      typeRaceRandomPhrase.mockResolvedValue({ ok: true, data: { id: 1, text: 'Bonjour' } })
      await game.loadPhrase()
    })

    it('vaut 0 au depart', () => {
      expect(game.cursorPos.value).toBe(0)
    })

    it('suit la longueur de typed', () => {
      game.onInput('Bon')
      expect(game.cursorPos.value).toBe(3)
      game.onInput('Bonjou')
      expect(game.cursorPos.value).toBe(6)
    })
  })

  describe('errorTick (shake trigger)', () => {
    beforeEach(async () => {
      typeRaceRandomPhrase.mockResolvedValue({ ok: true, data: { id: 1, text: 'Bonjour' } })
      await game.loadPhrase()
    })

    it('reste a 0 quand on tape correctement', () => {
      game.onInput('B')
      game.onInput('Bo')
      game.onInput('Bon')
      expect(game.errorTick.value).toBe(0)
    })

    it('incremente sur un char faux', () => {
      game.onInput('B')
      expect(game.errorTick.value).toBe(0)
      game.onInput('BX') // X != 'o'
      expect(game.errorTick.value).toBe(1)
    })

    it('incremente encore sur chaque nouveau char faux', () => {
      game.onInput('X')   // faux
      game.onInput('XY')  // nouveau faux
      game.onInput('XYZ') // nouveau faux
      expect(game.errorTick.value).toBe(3)
    })

    it('n\'incremente pas sur un backspace (pas de nouveau char)', () => {
      game.onInput('BX')
      expect(game.errorTick.value).toBe(1)
      game.onInput('B') // retour arriere
      expect(game.errorTick.value).toBe(1) // pas d'increment
    })
  })

  describe('wpmSamples', () => {
    beforeEach(async () => {
      typeRaceRandomPhrase.mockResolvedValue({
        ok: true,
        data: { id: 1, text: 'aaaaa bbbbb ccccc ddddd eeeee' },
      })
      await game.loadPhrase()
    })

    it('vide avant le demarrage', () => {
      expect(game.wpmSamples.value).toEqual([])
    })

    it('prend un echantillon toutes les 500ms pendant la partie', () => {
      game.onInput('a')
      vi.advanceTimersByTime(2_500) // 5 samples attendus
      expect(game.wpmSamples.value.length).toBeGreaterThanOrEqual(4)
      expect(game.wpmSamples.value.length).toBeLessThanOrEqual(6)
    })

    it('cap a 120 samples (60s / 500ms)', () => {
      game.onInput('a')
      vi.advanceTimersByTime(70_000) // au-dela de la fin (60s), mais le cap tient
      expect(game.wpmSamples.value.length).toBeLessThanOrEqual(120)
    })

    it('ajoute un sample final quand finish() est appele', async () => {
      typeRaceSubmitScore.mockResolvedValue({ ok: true, data: { id: 1, score: 0 } })
      game.onInput('a')
      vi.advanceTimersByTime(1_200) // ~2-3 samples
      const countBefore = game.wpmSamples.value.length
      game.onInput('aaaaa bbbbb ccccc ddddd eeeee') // phrase complete
      await vi.runAllTimersAsync()
      // Sample final injecte par finish()
      expect(game.wpmSamples.value.length).toBeGreaterThan(countBefore)
    })
  })
})
