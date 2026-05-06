/**
 * useArcadeGame — socle partage par Snake, Space Invaders et futurs jeux
 * arcade. Gere :
 *   - etat (idle/playing/done)
 *   - chrono + tracking durationMs
 *   - submit du score a la fin via /api/games/:gameId/scores
 *   - leaderboard du jour + stats perso (fetch au mount + refetch post-partie)
 *
 * Chaque jeu apporte sa logique metier (boucle, input, collisions) et
 * utilise ce composable pour l'orchestration plumbing.
 */
import { ref } from 'vue'
import { useApi } from '@/composables/useApi'

export type ArcadeGameState = 'idle' | 'playing' | 'done'
export type ArcadeScope     = 'day' | 'week' | 'all'

export interface ArcadeLeaderboardRow {
  rank: number
  userType: 'student' | 'teacher'
  userId: number
  name: string
  bestScore: number
  plays: number
}

export interface ArcadeMyStats {
  allTime: { plays: number; bestScore: number; avgScore: number }
  today:   { bestScore: number; plays: number }
  week:    { bestScore: number }
  history: Array<{ id: number; score: number; durationMs: number; createdAt: string }>
}

export function useArcadeGame(gameId: string) {
  const { api } = useApi()

  const state       = ref<ArcadeGameState>('idle')
  const score       = ref(0)
  const startedAt   = ref<number | null>(null)
  const elapsedMs   = ref(0)
  const lastResult  = ref<{ score: number; durationMs: number } | null>(null)

  const leaderboard = ref<ArcadeLeaderboardRow[]>([])
  const myStats     = ref<ArcadeMyStats | null>(null)
  const scope       = ref<ArcadeScope>('day')

  function startRun() {
    state.value = 'playing'
    score.value = 0
    startedAt.value = Date.now()
    elapsedMs.value = 0
    lastResult.value = null
  }

  function addScore(delta: number) {
    if (state.value !== 'playing') return
    score.value += delta
  }

  function tick() {
    if (state.value !== 'playing' || startedAt.value == null) return
    elapsedMs.value = Date.now() - startedAt.value
  }

  function reset() {
    state.value = 'idle'
    score.value = 0
    startedAt.value = null
    elapsedMs.value = 0
    lastResult.value = null
  }

  async function endRun(meta?: Record<string, unknown>) {
    if (state.value !== 'playing' || startedAt.value == null) return
    state.value = 'done'
    const durationMs = Math.max(500, Date.now() - startedAt.value)
    elapsedMs.value = durationMs
    lastResult.value = { score: score.value, durationMs }

    const payload = { score: score.value, durationMs, meta }
    window.api.logToFile?.('info', `game:${gameId}`, 'submit_attempt', payload)
    const result = await api<{ id: number; score: number }>(
      () => window.api.gameSubmitScore(gameId, payload),
      { silent: true },
    )
    if (result) {
      window.api.logToFile?.('info', `game:${gameId}`, 'submit_ok', { id: result.id, score: result.score })
    } else {
      // silent:true masque le toast — sans ce log, un score perdu serait
      // invisible. Important pour les jeux ou l'utilisateur enchaine vite
      // et ne verifierait pas le leaderboard.
      window.api.logToFile?.('error', `game:${gameId}`, 'submit_failed', payload)
    }
    // Refresh leaderboard + stats apres submit
    await Promise.all([refreshLeaderboard(), refreshMyStats()])
  }

  async function refreshLeaderboard(s: ArcadeScope = scope.value) {
    scope.value = s
    const data = await api<ArcadeLeaderboardRow[]>(
      () => window.api.gameLeaderboard(gameId, s),
      { silent: true },
    )
    if (data) leaderboard.value = data
  }

  async function setScope(s: ArcadeScope) {
    if (s === scope.value) return
    await refreshLeaderboard(s)
  }

  async function refreshMyStats() {
    const data = await api<ArcadeMyStats>(
      () => window.api.gameMyStats(gameId),
      { silent: true },
    )
    if (data) myStats.value = data
  }

  return {
    // state
    state, score, elapsedMs, lastResult,
    leaderboard, myStats, scope,
    // actions
    startRun, addScore, tick, endRun, reset,
    refreshLeaderboard, refreshMyStats, setScope,
  }
}
