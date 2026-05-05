/**
 * useTypeRace — logique du mini-jeu typing speed.
 *
 * Etats :
 *   'idle'      : phrase chargee, en attente du compte a rebours / 1er char
 *   'countdown' : compte a rebours 3-2-1 avant le depart (v2.292)
 *   'playing'   : chrono arme, WPM echantillonne toutes les 500ms
 *   'done'      : 60s ecoulees OU phrase tapee a fond
 *
 * Score : WPM (1 mot = 5 caracteres) x precision, 0-1.
 *
 * Anti-triche :
 *   - Client : paste bloque dans la view.
 *   - Serveur : coherence wpm / durationMs / word count (route POST /scores).
 *
 * Anti-rejeu : les 20 dernieres phrase_id servies sont persistees dans
 * localStorage (`typerace:seen`) et envoyees au backend en `exclude=`.
 *
 * Signaux exposes pour la view :
 *   - wpmSamples : WPM a chaque tick 500ms, pour sparkline live
 *   - errorTick  : incremente a chaque nouveau char faux (trigger shake CSS)
 *   - cursorPos  : position du curseur (= typed.length)
 *   - streak     : nombre de chars consecutifs corrects (combo, v2.292)
 *   - bestStreak : meilleur streak de la partie courante (v2.292)
 *   - streakMilestone : palier atteint a l'instant (5/10/25/50/100), reset
 *                        apres un tick — pour declencher animation (v2.292)
 *   - countdownValue : 3, 2, 1, 0 ('GO!') pendant l'etat countdown (v2.292)
 *   - previousResult : score precedent quand on rejoue la meme phrase (v2.292)
 */
import { ref, computed } from 'vue'
import { useApi } from '@/composables/useApi'

const SEEN_KEY = 'typerace:seen'
const MAX_SEEN = 20
const GAME_DURATION_MS = 60_000
const SAMPLE_INTERVAL_MS = 500
const MAX_SAMPLES = 120 // 60s / 500ms
const CHARS_PER_WORD = 5
const COUNTDOWN_TICK_MS = 700
const COUNTDOWN_START = 3
const STREAK_MILESTONES = [5, 10, 25, 50, 100, 200]

type GameState = 'idle' | 'countdown' | 'playing' | 'done'

interface Phrase { id: number; text: string }
interface SubmitResult { id: number; score: number }
interface RoundResult { wpm: number; accuracy: number; score: number; bestStreak: number }

function loadSeenIds(): number[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (!raw) return []
    const ids = JSON.parse(raw)
    return Array.isArray(ids) ? ids.filter((n: unknown) => typeof n === 'number') : []
  } catch {
    return []
  }
}

function saveSeenId(id: number): void {
  try {
    const seen = loadSeenIds()
    const next = [id, ...seen.filter((x) => x !== id)].slice(0, MAX_SEEN)
    localStorage.setItem(SEEN_KEY, JSON.stringify(next))
  } catch { /* localStorage indisponible */ }
}

export function useTypeRace() {
  const { api } = useApi()

  const state      = ref<GameState>('idle')
  const phrase     = ref<Phrase | null>(null)
  const typed      = ref('')
  const startedAt  = ref<number | null>(null)
  const elapsedMs  = ref(0)
  const loading    = ref(false)
  const lastResult = ref<RoundResult | null>(null)
  /** v2.292 : score de la run precedente (utile pour mode "Rejouer la meme phrase"). */
  const previousResult = ref<RoundResult | null>(null)

  const errorTick = ref(0)
  const wpmSamples = ref<number[]>([])

  // ── Streak / Combo (v2.292) ──────────────────────────────────────────
  /** Streak courant : chars consecutifs corrects. Reset a 0 sur erreur ou backspace correctif. */
  const streak = ref(0)
  /** Meilleur streak de la partie courante. */
  const bestStreak = ref(0)
  /** Dernier palier atteint (5/10/25/...) — set transient, la view l'observe et reset apres animation. */
  const streakMilestone = ref(0)

  // ── Countdown (v2.292) ───────────────────────────────────────────────
  /** Valeur courante du compte a rebours : 3 -> 2 -> 1 -> 0 (GO) -> playing. */
  const countdownValue = ref(0)
  let countdownTimer: ReturnType<typeof setTimeout> | null = null

  let tickInterval: ReturnType<typeof setInterval> | null = null

  // ── Derives ──────────────────────────────────────────────────────────

  const cursorPos = computed(() => typed.value.length)

  const remainingMs = computed(() =>
    startedAt.value == null ? GAME_DURATION_MS : Math.max(0, GAME_DURATION_MS - elapsedMs.value),
  )

  const remainingSec = computed(() => Math.ceil(remainingMs.value / 1000))

  const progress = computed(() => {
    if (!phrase.value) return 0
    return Math.min(1, typed.value.length / phrase.value.text.length)
  })

  const correctChars = computed(() => {
    if (!phrase.value) return 0
    let n = 0
    const target = phrase.value.text
    const input = typed.value
    const len = Math.min(target.length, input.length)
    for (let i = 0; i < len; i++) if (input[i] === target[i]) n++
    return n
  })

  const accuracy = computed(() => {
    if (typed.value.length === 0) return 1
    return correctChars.value / typed.value.length
  })

  const wpm = computed(() => {
    if (!startedAt.value || elapsedMs.value <= 0) return 0
    const minutes = elapsedMs.value / 60_000
    return (typed.value.length / CHARS_PER_WORD) / minutes
  })

  const score = computed(() => Math.round(wpm.value * accuracy.value))

  // ── Actions ──────────────────────────────────────────────────────────

  async function loadPhrase(): Promise<void> {
    loading.value = true
    try {
      const excludeIds = loadSeenIds()
      const data = await api<Phrase>(() => window.api.typeRaceRandomPhrase(excludeIds))
      if (data) {
        phrase.value = data
        saveSeenId(data.id)
        // Reset complet (efface aussi previousResult — nouvelle phrase = pas
        // de comparaison "same phrase" possible).
        previousResult.value = null
        resetGame()
        startCountdown()
      }
    } finally {
      loading.value = false
    }
  }

  /**
   * Mode "Rejouer la meme phrase" (v2.292) : conserve la phrase et le
   * score precedent pour comparaison. Pas de soumission au leaderboard
   * pour le second run (anti-tricherie : on a vu la phrase une fois deja).
   */
  function retrySamePhrase(): void {
    if (!phrase.value || !lastResult.value) return
    previousResult.value = lastResult.value
    resetGame()
    startCountdown()
  }

  function resetGame(): void {
    state.value = 'idle'
    typed.value = ''
    startedAt.value = null
    elapsedMs.value = 0
    lastResult.value = null
    wpmSamples.value = []
    errorTick.value = 0
    streak.value = 0
    bestStreak.value = 0
    streakMilestone.value = 0
    stopTicker()
    cancelCountdown()
  }

  /**
   * Lance le compte a rebours 3-2-1-GO. Le user peut demarrer plus tot
   * en commencant a taper (skipCountdown).
   */
  function startCountdown(): void {
    cancelCountdown()
    state.value = 'countdown'
    countdownValue.value = COUNTDOWN_START
    tickCountdown()
  }

  function tickCountdown(): void {
    countdownTimer = setTimeout(() => {
      if (state.value !== 'countdown') return
      countdownValue.value--
      if (countdownValue.value < 0) {
        // Fin du countdown — bascule en idle, le 1er char demarrera le chrono.
        state.value = 'idle'
        countdownValue.value = 0
        countdownTimer = null
      } else {
        tickCountdown()
      }
    }, COUNTDOWN_TICK_MS)
  }

  function cancelCountdown(): void {
    if (countdownTimer) {
      clearTimeout(countdownTimer)
      countdownTimer = null
    }
    countdownValue.value = 0
  }

  function skipCountdown(): void {
    if (state.value !== 'countdown') return
    cancelCountdown()
    state.value = 'idle'
  }

  function onInput(value: string): void {
    if (state.value === 'done' || !phrase.value) return
    // Si le user tape pendant le countdown, on saute directement.
    if (state.value === 'countdown') skipCountdown()

    // Demarrage lazy : chrono arme au 1er char
    if (state.value === 'idle' && value.length > 0) {
      state.value = 'playing'
      startedAt.value = Date.now()
      startTicker()
    }

    // Detection d'un nouveau char et update du streak (v2.292).
    if (value.length > typed.value.length && phrase.value) {
      const lastIdx = value.length - 1
      const isCorrect = value[lastIdx] === phrase.value.text[lastIdx]
      if (isCorrect) {
        streak.value++
        if (streak.value > bestStreak.value) bestStreak.value = streak.value
        // Trigger un palier si on atteint un de [5,10,25,50,100,200].
        if (STREAK_MILESTONES.includes(streak.value)) {
          streakMilestone.value = streak.value
        }
      } else {
        streak.value = 0
        errorTick.value++
      }
    } else if (value.length < typed.value.length) {
      // Backspace : reset le streak (un correctif rompt la chaine perfect).
      streak.value = 0
    }

    typed.value = value

    if (phrase.value.text === value) finish()
  }

  /** La view consume streakMilestone puis le remet a 0 quand l'animation a tourne. */
  function consumeStreakMilestone(): void {
    streakMilestone.value = 0
  }

  function startTicker(): void {
    stopTicker()
    let lastSampleAt = 0
    tickInterval = setInterval(() => {
      if (startedAt.value == null) return
      elapsedMs.value = Date.now() - startedAt.value

      if (elapsedMs.value - lastSampleAt >= SAMPLE_INTERVAL_MS) {
        lastSampleAt = elapsedMs.value
        wpmSamples.value = [...wpmSamples.value, wpm.value].slice(-MAX_SAMPLES)
      }

      if (elapsedMs.value >= GAME_DURATION_MS) finish()
    }, 100)
  }

  function stopTicker(): void {
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null }
  }

  async function finish(): Promise<void> {
    if (state.value === 'done' || !phrase.value || startedAt.value == null) return
    state.value = 'done'
    const durationMs = Math.min(GAME_DURATION_MS, Date.now() - startedAt.value)
    elapsedMs.value = durationMs
    stopTicker()

    wpmSamples.value = [...wpmSamples.value, wpm.value].slice(-MAX_SAMPLES)

    const finalWpm = wpm.value
    const finalAccuracy = accuracy.value
    const finalScore = Math.round(finalWpm * finalAccuracy)

    lastResult.value = {
      wpm: finalWpm,
      accuracy: finalAccuracy,
      score: finalScore,
      bestStreak: bestStreak.value,
    }

    // v2.292 : on ne soumet le score au leaderboard QUE si la phrase n'a
    // pas deja ete jouee dans ce cycle (mode "Rejouer la meme phrase"
    // serait sinon un cheat — le user a memorise la phrase).
    const isReplay = previousResult.value != null
    if (!isReplay) {
      await api<SubmitResult>(() => window.api.typeRaceSubmitScore({
        phraseId:   phrase.value!.id,
        wpm:        Math.round(finalWpm * 10) / 10,
        accuracy:   Math.round(finalAccuracy * 1000) / 1000,
        durationMs,
      }))
    }
  }

  function cleanup(): void {
    stopTicker()
    cancelCountdown()
  }

  return {
    // State
    state, phrase, typed, loading, lastResult, previousResult,
    wpmSamples, errorTick,
    streak, bestStreak, streakMilestone,
    countdownValue,
    // Derives
    cursorPos, remainingMs, remainingSec, progress,
    correctChars, accuracy, wpm, score,
    // Actions
    loadPhrase, retrySamePhrase, resetGame, onInput, finish, cleanup,
    skipCountdown, consumeStreakMilestone,
    // Constants
    GAME_DURATION_MS,
  }
}
