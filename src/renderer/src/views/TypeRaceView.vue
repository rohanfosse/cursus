/**
 * TypeRaceView — vue plein ecran du mini-jeu typing speed (v2.171 redesign).
 *
 * Design : invisible input capturant le focus (Monkeytype-style), curseur
 * anime inline dans la phrase, radial timer central, sparkline WPM live,
 * shake sur erreur, mode focus (header/leaderboard fadent pendant la
 * frappe). Ecran de fin enrichi : courbe full, PB, changement de rang.
 */
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, RotateCw, Trophy, Sparkles, Target, Gauge } from 'lucide-vue-next'
import { useTypeRace } from '@/composables/useTypeRace'
import { useApi } from '@/composables/useApi'
import { useAppStore } from '@/stores/app'
import SparklineWpm from '@/components/typerace/SparklineWpm.vue'
import RadialTimer  from '@/components/typerace/RadialTimer.vue'

const router = useRouter()
const appStore = useAppStore()
const { api } = useApi()

const {
  state, phrase, typed, loading, lastResult,
  wpmSamples, errorTick, cursorPos,
  remainingMs, progress, wpm, score, accuracy,
  loadPhrase, onInput, cleanup,
  GAME_DURATION_MS,
} = useTypeRace()

const inputRef = ref<HTMLInputElement | null>(null)
const leaderboard = ref<Array<{ rank: number; name: string; bestScore: number; bestWpm: number }>>([])
const allTimeBest = ref(0)
const previousRank = ref<number | null>(null)

// Anti-shake retrigger : flag CSS reseterente via `key` incrementee
const shakeKey = ref(0)
watch(errorTick, (n) => { if (n > 0) shakeKey.value++ })

async function refreshLeaderboard() {
  const data = await api<Array<{ rank: number; name: string; bestScore: number; bestWpm: number }>>(
    () => window.api.typeRaceLeaderboard('day'),
    { silent: true },
  )
  if (data) leaderboard.value = data
}

async function loadMyStats() {
  const data = await api<{ allTime: { bestScore: number } }>(
    () => window.api.typeRaceMyStats(),
    { silent: true },
  )
  if (data) allTimeBest.value = data.allTime.bestScore
}

async function newRound() {
  // Capture le rang avant la partie pour calculer le delta apres
  const myRank = leaderboard.value.find((e) => e.name === appStore.currentUser?.name)?.rank ?? null
  previousRank.value = myRank
  await loadPhrase()
  await nextTick()
  inputRef.value?.focus()
}

function onPaste(e: ClipboardEvent) { e.preventDefault() }

// Focus de l'input : au click n'importe ou dans la zone de jeu
function focusInput() { inputRef.value?.focus() }

// Refetch leaderboard + stats en fin de partie
watch(state, async (s) => {
  if (s === 'done') {
    await refreshLeaderboard()
    await loadMyStats()
  }
})

// Raccourcis clavier : Tab rejoue, Esc retourne au dashboard
function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab' && state.value === 'done') {
    e.preventDefault()
    newRound()
  } else if (e.key === 'Escape') {
    goBack()
  }
}

onMounted(async () => {
  await loadMyStats()
  await refreshLeaderboard()
  await newRound()
  window.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  cleanup()
  window.removeEventListener('keydown', onGlobalKeydown)
})

// ── Rendu caractere par caractere (correct / incorrect / pending) ─────────

const charStates = computed(() => {
  if (!phrase.value) return []
  const text = phrase.value.text
  return [...text].map((ch, i) => {
    if (i >= typed.value.length) return { ch, state: 'pending' as const }
    if (typed.value[i] === ch) return { ch, state: 'correct' as const }
    return { ch, state: 'wrong' as const }
  })
})

// ── Derivees UX fin de partie ────────────────────────────────────────────

const isPersonalBest = computed(() =>
  state.value === 'done' && lastResult.value != null && lastResult.value.score > allTimeBest.value,
)

const currentRank = computed(() => {
  if (!appStore.currentUser) return null
  return leaderboard.value.find((e) => e.name === appStore.currentUser?.name)?.rank ?? null
})

const rankDelta = computed(() => {
  if (currentRank.value == null || previousRank.value == null) return null
  return previousRank.value - currentRank.value
})

const dayLeader = computed(() => leaderboard.value[0] ?? null)

function goBack() { router.push('/dashboard') }
</script>

<template>
  <div
    class="tr-layout"
    :class="{ 'tr-focus': state === 'playing' }"
    @click="focusInput"
  >
    <!-- Header epure, fade en playing ────────────────────────────── -->
    <header class="tr-header">
      <button class="tr-icon-btn" :aria-label="'Retour au dashboard'" @click.stop="goBack">
        <ArrowLeft :size="18" />
      </button>
      <span class="tr-brand">TypeRace</span>
      <span class="tr-spacer" />
      <div v-if="currentRank" class="tr-rank-chip" :title="'Ton rang aujourd\'hui'">
        <Trophy :size="12" />
        <span>#{{ currentRank }}</span>
      </div>
    </header>

    <main class="tr-main">
      <!-- ═══ Zone de jeu ═══ -->
      <section v-if="phrase && state !== 'done'" class="tr-stage">
        <RadialTimer
          :remaining-ms="remainingMs"
          :total-ms="GAME_DURATION_MS"
          :size="110"
          :stroke="7"
        />

        <div class="tr-progress" :style="{ '--p': `${progress * 100}%` }" aria-hidden="true" />

        <!-- Phrase avec curseur anime inline -->
        <div
          :key="shakeKey"
          class="tr-phrase"
          :class="{ 'tr-shake': shakeKey > 0 }"
          role="text"
          :aria-label="`Phrase a taper : ${phrase.text}`"
        >
          <span
            v-for="(c, i) in charStates"
            :key="i"
            :class="[
              'tr-char',
              c.state === 'correct' ? 'tr-char--ok' : '',
              c.state === 'wrong'   ? 'tr-char--ko' : '',
            ]"
          >{{ c.ch }}<span v-if="i === cursorPos" class="tr-cursor" aria-hidden="true" /></span>
          <span v-if="cursorPos >= phrase.text.length" class="tr-cursor tr-cursor--end" aria-hidden="true" />
        </div>

        <!-- Input invisible : capture focus + frappe -->
        <input
          id="tr-input"
          ref="inputRef"
          :value="typed"
          class="tr-input-hidden"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          aria-label="Zone de saisie TypeRace"
          :disabled="loading"
          @input="onInput(($event.target as HTMLInputElement).value)"
          @paste="onPaste"
        />

        <!-- Sparkline WPM live + stats integrees -->
        <div v-if="state === 'playing'" class="tr-live">
          <SparklineWpm
            :samples="wpmSamples"
            :width="360"
            :height="54"
            :y-min="30"
            :target="dayLeader?.bestWpm ?? null"
            :stroke="2.5"
          />
          <div class="tr-live-stats">
            <div class="tr-live-stat">
              <Gauge :size="12" />
              <strong>{{ Math.round(wpm) }}</strong>
              <span>WPM</span>
            </div>
            <div class="tr-live-stat">
              <Target :size="12" />
              <strong>{{ Math.round(accuracy * 100) }}%</strong>
            </div>
            <div class="tr-live-stat tr-live-stat--score">
              <strong>{{ score }}</strong>
              <span>pts</span>
            </div>
          </div>
        </div>

        <p v-else class="tr-idle-hint">
          Tape la phrase pour armer le chrono. <kbd>Esc</kbd> pour quitter.
        </p>
      </section>

      <!-- ═══ Ecran de fin ═══ -->
      <section v-else-if="state === 'done' && lastResult" class="tr-end">
        <div v-if="isPersonalBest" class="tr-pb-badge">
          <Sparkles :size="14" />
          <span>Record personnel</span>
        </div>

        <div class="tr-end-score">
          <span class="tr-end-score-value">{{ lastResult.score }}</span>
          <span class="tr-end-score-unit">pts</span>
        </div>

        <div class="tr-end-metrics">
          <div class="tr-end-metric">
            <span class="tr-end-metric-label">WPM</span>
            <span class="tr-end-metric-value">{{ Math.round(lastResult.wpm) }}</span>
          </div>
          <div class="tr-end-metric">
            <span class="tr-end-metric-label">Precision</span>
            <span class="tr-end-metric-value">{{ Math.round(lastResult.accuracy * 100) }}%</span>
          </div>
          <div v-if="currentRank" class="tr-end-metric">
            <span class="tr-end-metric-label">Rang</span>
            <span class="tr-end-metric-value">
              #{{ currentRank }}
              <span v-if="rankDelta && rankDelta > 0" class="tr-rank-up">+{{ rankDelta }}</span>
              <span v-else-if="rankDelta && rankDelta < 0" class="tr-rank-down">{{ rankDelta }}</span>
            </span>
          </div>
        </div>

        <div v-if="wpmSamples.length > 1" class="tr-end-chart">
          <SparklineWpm
            :samples="wpmSamples"
            :width="480"
            :height="88"
            :y-min="30"
            :stroke="3"
          />
          <span class="tr-end-chart-caption">Evolution de ton WPM sur la partie</span>
        </div>

        <div class="tr-end-actions">
          <button class="tr-btn-primary" :disabled="loading" @click.stop="newRound">
            <RotateCw :size="16" />
            Rejouer <kbd>Tab</kbd>
          </button>
          <button class="tr-btn-ghost" @click.stop="goBack">Retour au dashboard</button>
        </div>
      </section>

      <!-- ═══ Leaderboard lateral ═══ -->
      <aside class="tr-leaderboard" aria-label="Classement du jour">
        <h2 class="tr-lb-title">
          <Trophy :size="13" /> Aujourd'hui
        </h2>
        <ol v-if="leaderboard.length" class="tr-lb-list">
          <li
            v-for="entry in leaderboard.slice(0, 10)"
            :key="entry.rank"
            class="tr-lb-row"
            :class="{
              'tr-lb-row--me': entry.name === appStore.currentUser?.name,
              'tr-lb-row--gold':   entry.rank === 1,
              'tr-lb-row--silver': entry.rank === 2,
              'tr-lb-row--bronze': entry.rank === 3,
            }"
          >
            <span class="tr-lb-rank">{{ entry.rank }}</span>
            <span class="tr-lb-name">{{ entry.name }}</span>
            <span class="tr-lb-bar" aria-hidden="true">
              <span class="tr-lb-bar-fill" :style="{
                width: leaderboard[0] ? `${(entry.bestScore / leaderboard[0].bestScore) * 100}%` : '0%'
              }" />
            </span>
            <span class="tr-lb-score">{{ entry.bestScore }}</span>
          </li>
        </ol>
        <p v-else class="tr-lb-empty">Personne n'a encore joue aujourd'hui. A toi !</p>
      </aside>
    </main>
  </div>
</template>

<style scoped>
/* ── Layout & focus mode ─────────────────────────────────────────── */
.tr-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background:
    radial-gradient(ellipse at top, rgba(var(--accent-rgb), .08), transparent 60%),
    var(--bg-canvas);
  cursor: text;
}

.tr-focus .tr-header,
.tr-focus .tr-leaderboard {
  opacity: .35;
  transition: opacity .4s ease;
  pointer-events: auto;
}
.tr-focus .tr-header:hover,
.tr-focus .tr-leaderboard:hover {
  opacity: 1;
}

.tr-header {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 20px; height: 56px;
  border-bottom: 1px solid var(--border);
  background: transparent;
  flex-shrink: 0;
  transition: opacity .4s ease;
}
.tr-brand {
  font-size: 13px; font-weight: 800; letter-spacing: .5px;
  text-transform: uppercase; color: var(--text-primary);
}
.tr-spacer { flex: 1; }
.tr-icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 6px;
  border: none; background: transparent; color: var(--text-secondary);
  cursor: pointer; transition: background .12s;
}
.tr-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.tr-rank-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 999px;
  background: var(--accent-subtle); color: var(--accent);
  font-size: 12px; font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.tr-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 24px;
  padding: 24px 32px 32px;
  min-height: 0;
  overflow: hidden;
}

/* ── Zone de jeu (stage) ─────────────────────────────────────────── */
.tr-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  padding: 24px 20px;
  min-height: 0;
  overflow: auto;
}

.tr-progress {
  width: min(720px, 100%);
  height: 3px;
  background: var(--border);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
}
.tr-progress::after {
  content: '';
  position: absolute; inset: 0 auto 0 0;
  width: var(--p, 0%);
  background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent), white 25%));
  transition: width 80ms linear;
  border-radius: 2px;
}

/* Phrase : grande, lisible, curseur inline anime */
.tr-phrase {
  max-width: 820px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: clamp(18px, 2.2vw, 26px);
  line-height: 1.7;
  letter-spacing: .3px;
  color: var(--text-muted);
  white-space: pre-wrap;
  text-align: left;
  user-select: none;
  padding: 0 8px;
}

.tr-char {
  position: relative;
  transition: color 80ms ease, background 80ms ease;
}
.tr-char--ok { color: var(--text-primary); }
.tr-char--ko {
  color: var(--color-danger);
  background: rgba(var(--color-danger-rgb), .14);
  border-radius: 2px;
}

/* Curseur anime */
.tr-cursor {
  position: absolute;
  left: 0; top: 6%;
  width: 2px;
  height: 88%;
  background: var(--accent);
  border-radius: 1px;
  animation: tr-blink 1s steps(2) infinite;
}
.tr-cursor--end {
  position: relative;
  display: inline-block;
  vertical-align: text-bottom;
  top: 0;
  height: 1em;
  margin-left: -1px;
}

@keyframes tr-blink {
  0%, 50%  { opacity: 1; }
  51%, 100%{ opacity: 0; }
}

/* Shake sur erreur : le v-bind:key incremente retrigger l'anim */
.tr-shake { animation: tr-shake 180ms cubic-bezier(.36,.07,.19,.97); }
@keyframes tr-shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-3px); }
  40%, 60% { transform: translateX(3px); }
}

/* Input invisible mais focusable */
.tr-input-hidden {
  position: absolute;
  left: -9999px;
  opacity: 0;
  pointer-events: none;
}

/* Stats live + sparkline */
.tr-live {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: min(440px, 100%);
}
.tr-live-stats {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 8px 18px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-sidebar);
  font-variant-numeric: tabular-nums;
}
.tr-live-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
}
.tr-live-stat strong {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-primary);
}
.tr-live-stat--score strong { color: var(--accent); }

.tr-idle-hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
}
kbd {
  display: inline-block;
  padding: 1px 6px;
  margin: 0 2px;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 4px;
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  color: var(--text-secondary);
  background: var(--bg-elevated);
}

/* ── Ecran de fin ────────────────────────────────────────────────── */
.tr-end {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  min-height: 0;
  padding: 16px;
  overflow: auto;
  text-align: center;
}

.tr-pb-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: linear-gradient(90deg, #eab308, #f59e0b);
  color: #1a1a1a;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .3px;
  text-transform: uppercase;
  animation: tr-pb-glow 2s ease-in-out infinite;
  box-shadow: 0 0 0 0 rgba(245, 158, 11, .4);
}
@keyframes tr-pb-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, .5); }
  50%      { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
}

.tr-end-score {
  display: flex;
  align-items: baseline;
  gap: 6px;
  line-height: 1;
}
.tr-end-score-value {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 96px;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: -3px;
  font-variant-numeric: tabular-nums;
}
.tr-end-score-unit {
  font-size: 18px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-muted);
}

.tr-end-metrics {
  display: flex;
  gap: 18px;
  padding: 14px 22px;
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.tr-end-metric { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 70px; }
.tr-end-metric-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
  font-weight: 700;
}
.tr-end-metric-value {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}
.tr-rank-up {
  font-size: 12px;
  font-weight: 700;
  color: #22c55e;
}
.tr-rank-down {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-danger);
}

.tr-end-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}
.tr-end-chart-caption {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}

.tr-end-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.tr-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font);
  cursor: pointer;
  transition: filter .12s, transform .06s;
}
.tr-btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
.tr-btn-primary:active { transform: translateY(1px); }
.tr-btn-primary:disabled { opacity: .6; cursor: not-allowed; }
.tr-btn-primary kbd {
  background: rgba(255, 255, 255, .15);
  border-color: rgba(255, 255, 255, .2);
  color: #fff;
}

.tr-btn-ghost {
  padding: 10px 18px;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  transition: background .12s;
}
.tr-btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ── Leaderboard ─────────────────────────────────────────────────── */
.tr-leaderboard {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: auto;
  transition: opacity .4s ease;
}

.tr-lb-title {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 800;
  text-transform: uppercase; letter-spacing: .5px;
  color: var(--text-secondary); margin: 0;
}

.tr-lb-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 3px; }

.tr-lb-row {
  display: grid;
  grid-template-columns: 22px 1fr 60px auto;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 12.5px;
  color: var(--text-secondary);
  transition: background .12s;
}
.tr-lb-row:hover { background: var(--bg-hover); color: var(--text-primary); }
.tr-lb-row--me {
  background: var(--accent-subtle);
  color: var(--accent);
  font-weight: 700;
}

.tr-lb-rank {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}
.tr-lb-row--gold   .tr-lb-rank { color: #eab308; font-size: 13px; }
.tr-lb-row--silver .tr-lb-rank { color: #94a3b8; font-size: 13px; }
.tr-lb-row--bronze .tr-lb-rank { color: #c2884d; font-size: 13px; }

.tr-lb-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tr-lb-bar {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
  display: block;
}
.tr-lb-bar-fill {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width .4s ease;
}
.tr-lb-row--gold   .tr-lb-bar-fill { background: #eab308; }
.tr-lb-row--silver .tr-lb-bar-fill { background: #94a3b8; }
.tr-lb-row--bronze .tr-lb-bar-fill { background: #c2884d; }

.tr-lb-score {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  min-width: 34px;
  text-align: right;
  color: var(--text-primary);
}

.tr-lb-empty {
  margin: 0;
  padding: 16px 10px;
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
}

/* ── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .tr-main { grid-template-columns: 1fr; }
  .tr-leaderboard { order: 2; max-height: 260px; }
  .tr-phrase { font-size: 18px; }
  .tr-end-score-value { font-size: 72px; }
}

@media (prefers-reduced-motion: reduce) {
  .tr-cursor, .tr-shake, .tr-pb-badge { animation: none !important; }
  .tr-progress::after { transition: none !important; }
}
</style>
