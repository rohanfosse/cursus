/**
 * useTypeRace — logique du mini-jeu typing speed.
 *
 * Etats :
 *   'idle'    : avant la 1ere frappe, phrase affichee en attente
 *   'playing' : chrono demarre (set au 1er keystroke)
 *   'done'    : 60s ecoulees OU phrase tapee entierement
 *
 * Score : WPM (mots par minute, 1 mot = 5 caracteres conventionnels)
 *   x precision (0-1). Calcule et envoye au serveur a la fin.
 *
 * Anti-triche cote client :
 *   - onPaste est bloque (preventDefault) sur la zone de saisie.
 *   - Le serveur re-valide coherence wpm / durationMs / phrase (cf. route).
 *
 * Anti-rejeu immediat : les 20 derniers ids servis sont persistes en
 * localStorage (cle `typerace:seen`) et envoyes au backend en `exclude=`.
 */
import { ref, computed } from 'vue'
import { useApi } from '@/composables/useApi'

const SEEN_KEY = 'typerace:seen'
const MAX_SEEN = 20
const GAME_DURATION_MS = 60_000
/** Convention typing race : 1 mot = 5 caracteres. */
const CHARS_PER_WORD = 5

type GameState = 'idle' | 'playing' | 'done'

interface Phrase {
  id: number
  text: string
}

interface SubmitResult {
  id: number
  score: number
}

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
  } catch { /* localStorage indisponible : no-op */ }
}

export function useTypeRace() {
  const { api } = useApi()

  const state       = ref<GameState>('idle')
  const phrase      = ref<Phrase | null>(null)
  const typed       = ref('')
  const startedAt   = ref<number | null>(null)
  const elapsedMs   = ref(0)
  const loading     = ref(false)
  const lastResult  = ref<{ wpm: number; accuracy: number; score: number; rank?: number | null } | null>(null)

  let tickInterval: ReturnType<typeof setInterval> | null = null

  // ── Derives ────────────────────────────────────────────────────────────

  const remainingMs = computed(() =>
    startedAt.value == null ? GAME_DURATION_MS : Math.max(0, GAME_DURATION_MS - elapsedMs.value),
  )

  const remainingSec = computed(() => Math.ceil(remainingMs.value / 1000))

  const progress = computed(() => {
    if (!phrase.value) return 0
    return Math.min(1, typed.value.length / phrase.value.text.length)
  })

  /** Nombre de caracteres tapes correctement au fil de la frappe (progression). */
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

  // ── Actions ────────────────────────────────────────────────────────────

  async function loadPhrase(): Promise<void> {
    loading.value = true
    try {
      const excludeIds = loadSeenIds()
      const data = await api<Phrase>(() => window.api.typeRaceRandomPhrase(excludeIds))
      if (data) {
        phrase.value = data
        saveSeenId(data.id)
        resetGame()
      }
    } finally {
      loading.value = false
    }
  }

  function resetGame(): void {
    state.value = 'idle'
    typed.value = ''
    startedAt.value = null
    elapsedMs.value = 0
    lastResult.value = null
    stopTicker()
  }

  function onInput(value: string): void {
    if (state.value === 'done' || !phrase.value) return

    // Demarrage lazy au 1er caractere
    if (state.value === 'idle' && value.length > 0) {
      state.value = 'playing'
      startedAt.value = Date.now()
      startTicker()
    }

    typed.value = value

    // Fin si phrase tapee integralement
    if (phrase.value.text === value) {
      finish()
    }
  }

  function startTicker(): void {
    stopTicker()
    tickInterval = setInterval(() => {
      if (startedAt.value == null) return
      elapsedMs.value = Date.now() - startedAt.value
      if (elapsedMs.value >= GAME_DURATION_MS) {
        finish()
      }
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

    const finalWpm = wpm.value
    const finalAccuracy = accuracy.value
    const finalScore = Math.round(finalWpm * finalAccuracy)

    lastResult.value = { wpm: finalWpm, accuracy: finalAccuracy, score: finalScore, rank: null }

    const payload = {
      phraseId:   phrase.value.id,
      wpm:        Math.round(finalWpm * 10) / 10,
      accuracy:   Math.round(finalAccuracy * 1000) / 1000,
      durationMs,
    }
    await api<SubmitResult>(() => window.api.typeRaceSubmitScore(payload))
  }

  function cleanup(): void {
    stopTicker()
  }

  return {
    // State
    state,
    phrase,
    typed,
    loading,
    lastResult,
    // Derives
    remainingMs,
    remainingSec,
    progress,
    correctChars,
    accuracy,
    wpm,
    score,
    // Actions
    loadPhrase,
    resetGame,
    onInput,
    finish,
    cleanup,
  }
}
