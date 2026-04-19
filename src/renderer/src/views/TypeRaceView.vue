/**
 * TypeRaceView — vue plein ecran du mini-jeu typing speed.
 *
 * Spec (v2.170) : phrase FR aleatoire, 60s max pour la taper, score =
 * WPM x precision, leaderboard brut par promo. Objectif : chambrage.
 *
 * Anti-triche cote client : paste desactive, focus clavier force, perte
 * de focus ne stoppe pas le chrono (on continue de compter meme si l'onglet
 * est en arriere-plan).
 */
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, RotateCw, Play, Trophy, Clock } from 'lucide-vue-next'
import { useTypeRace } from '@/composables/useTypeRace'
import { useApi } from '@/composables/useApi'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const appStore = useAppStore()
const { api } = useApi()

const {
  state, phrase, typed, loading, lastResult,
  remainingSec, progress, wpm, score, accuracy,
  loadPhrase, resetGame, onInput, cleanup,
} = useTypeRace()

const inputRef = ref<HTMLInputElement | null>(null)
const leaderboard = ref<Array<{ rank: number; name: string; bestScore: number; bestWpm: number }>>([])

async function refreshLeaderboard() {
  const data = await api<Array<{ rank: number; name: string; bestScore: number; bestWpm: number }>>(
    () => window.api.typeRaceLeaderboard('day'),
    { silent: true },
  )
  if (data) leaderboard.value = data
}

async function newRound() {
  await loadPhrase()
  await nextTick()
  inputRef.value?.focus()
}

// Anti-paste : refuse silencieusement le paste dans la zone
function onPaste(e: ClipboardEvent) {
  e.preventDefault()
}

// Quand le jeu finit, refresh du leaderboard
watch(state, (s) => {
  if (s === 'done') refreshLeaderboard()
})

onMounted(async () => {
  await newRound()
  await refreshLeaderboard()
})

onBeforeUnmount(cleanup)

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

const myRank = computed(() => {
  if (!appStore.currentUser || state.value !== 'done') return null
  const entry = leaderboard.value.find((e) => e.name === appStore.currentUser?.name)
  return entry?.rank ?? null
})

function goBack() {
  router.push('/dashboard')
}
</script>

<template>
  <div class="tr-layout">
    <header class="tr-header">
      <button class="tr-back" @click="goBack" title="Retour au dashboard" aria-label="Retour">
        <ArrowLeft :size="18" />
      </button>
      <h1 class="tr-title">TypeRace</h1>
      <div class="tr-timer" :class="{ 'tr-timer--danger': remainingSec <= 10 && state === 'playing' }">
        <Clock :size="14" />
        <span>{{ remainingSec }}s</span>
      </div>
    </header>

    <main class="tr-main">
      <!-- ═══ Zone de jeu ═══ -->
      <section class="tr-game" v-if="phrase && state !== 'done'">
        <div class="tr-progress-bar" aria-hidden="true">
          <div class="tr-progress-fill" :style="{ width: `${progress * 100}%` }" />
        </div>

        <p class="tr-phrase" aria-label="Phrase a taper">
          <span
            v-for="(c, i) in charStates"
            :key="i"
            :class="[
              'tr-char',
              c.state === 'correct' ? 'tr-char--ok' : '',
              c.state === 'wrong'   ? 'tr-char--ko' : '',
            ]"
          >{{ c.ch }}</span>
        </p>

        <label class="tr-label" for="tr-input">Tape la phrase ci-dessus</label>
        <input
          id="tr-input"
          ref="inputRef"
          :value="typed"
          class="tr-input"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          aria-label="Zone de saisie TypeRace"
          :disabled="loading"
          @input="onInput(($event.target as HTMLInputElement).value)"
          @paste="onPaste"
        />

        <div class="tr-live-stats" v-if="state === 'playing'">
          <div class="tr-stat">
            <span class="tr-stat-label">WPM</span>
            <span class="tr-stat-value">{{ Math.round(wpm) }}</span>
          </div>
          <div class="tr-stat">
            <span class="tr-stat-label">Precision</span>
            <span class="tr-stat-value">{{ Math.round(accuracy * 100) }}%</span>
          </div>
          <div class="tr-stat">
            <span class="tr-stat-label">Score</span>
            <span class="tr-stat-value">{{ score }}</span>
          </div>
        </div>

        <p v-else class="tr-hint">Commence a taper pour lancer le chrono.</p>
      </section>

      <!-- ═══ Ecran de fin ═══ -->
      <section class="tr-done" v-else-if="state === 'done' && lastResult">
        <div class="tr-done-score">
          <span class="tr-done-score-value">{{ lastResult.score }}</span>
          <span class="tr-done-score-label">points</span>
        </div>
        <div class="tr-done-stats">
          <div><strong>{{ Math.round(lastResult.wpm) }}</strong> WPM</div>
          <div><strong>{{ Math.round(lastResult.accuracy * 100) }}%</strong> precision</div>
          <div v-if="myRank">
            <Trophy :size="14" /> <strong>#{{ myRank }}</strong> aujourd'hui
          </div>
        </div>
        <button class="tr-btn-primary" @click="newRound">
          <RotateCw :size="16" /> Rejouer
        </button>
      </section>

      <!-- ═══ Leaderboard lateral ═══ -->
      <aside class="tr-leaderboard" aria-label="Classement du jour">
        <h2 class="tr-leaderboard-title">
          <Trophy :size="14" /> Aujourd'hui
        </h2>
        <ol v-if="leaderboard.length" class="tr-leaderboard-list">
          <li
            v-for="entry in leaderboard"
            :key="entry.rank"
            class="tr-leaderboard-row"
            :class="{
              'tr-rank-1': entry.rank === 1,
              'tr-rank-2': entry.rank === 2,
              'tr-rank-3': entry.rank === 3,
            }"
          >
            <span class="tr-leaderboard-rank">{{ entry.rank }}</span>
            <span class="tr-leaderboard-name">{{ entry.name }}</span>
            <span class="tr-leaderboard-score">{{ entry.bestScore }}</span>
          </li>
        </ol>
        <p v-else class="tr-leaderboard-empty">Personne n'a encore joue aujourd'hui. Sois le premier !</p>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.tr-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-canvas);
}

.tr-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 22px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-sidebar);
}

.tr-back {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 6px;
  border: none; background: transparent; color: var(--text-secondary);
  cursor: pointer; transition: background .12s;
}
.tr-back:hover { background: var(--bg-hover); color: var(--text-primary); }

.tr-title {
  flex: 1;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.tr-timer {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 999px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}
.tr-timer--danger {
  background: rgba(var(--color-danger-rgb), .12);
  border-color: rgba(var(--color-danger-rgb), .3);
  color: var(--color-danger);
  animation: tr-pulse 1s ease-in-out infinite;
}
@keyframes tr-pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.05); }
}

.tr-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 20px;
  padding: 24px;
  overflow: auto;
}

/* ── Zone de jeu ─────────────────────────────────────────────────────── */
.tr-game, .tr-done {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
}

.tr-progress-bar {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}
.tr-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 80ms linear;
}

.tr-phrase {
  font-family: ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 22px;
  line-height: 1.7;
  letter-spacing: .2px;
  color: var(--text-muted);
  margin: 0;
  white-space: pre-wrap;
  word-break: normal;
  user-select: none;
}

.tr-char { transition: color .08s, background .08s; }
.tr-char--ok { color: var(--text-primary); }
.tr-char--ko {
  color: var(--color-danger);
  background: rgba(var(--color-danger-rgb), .15);
  border-radius: 2px;
}

.tr-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
}

.tr-input {
  width: 100%;
  padding: 14px 16px;
  font-family: ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
  font-size: 18px;
  background: var(--bg-elevated);
  border: 2px solid var(--border);
  border-radius: 10px;
  color: var(--text-primary);
  outline: none;
  transition: border-color .12s;
}
.tr-input:focus { border-color: var(--accent); }

.tr-live-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding-top: 6px;
  border-top: 1px dashed var(--border);
}
.tr-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.tr-stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; }
.tr-stat-value { font-size: 18px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }

.tr-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
}

/* ── Ecran de fin ────────────────────────────────────────────────────── */
.tr-done {
  align-items: center;
  justify-content: center;
  gap: 24px;
}
.tr-done-score {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.tr-done-score-value {
  font-size: 72px;
  font-weight: 800;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.tr-done-score-label {
  font-size: 14px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}
.tr-done-stats {
  display: flex;
  gap: 22px;
  font-size: 14px;
  color: var(--text-secondary);
}
.tr-done-stats > div {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tr-done-stats strong { color: var(--text-primary); font-size: 16px; }

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
  transition: filter .12s;
}
.tr-btn-primary:hover { filter: brightness(1.1); }

/* ── Leaderboard lateral ─────────────────────────────────────────────── */
.tr-leaderboard {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: auto;
}

.tr-leaderboard-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-secondary);
  margin: 0;
}

.tr-leaderboard-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tr-leaderboard-row {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}
.tr-leaderboard-row:hover { background: var(--bg-hover); color: var(--text-primary); }

.tr-leaderboard-rank {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
  text-align: center;
}
.tr-leaderboard-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tr-leaderboard-score {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.tr-rank-1 .tr-leaderboard-rank { color: #eab308; }
.tr-rank-2 .tr-leaderboard-rank { color: #94a3b8; }
.tr-rank-3 .tr-leaderboard-rank { color: #c2884d; }

.tr-leaderboard-empty {
  margin: 0;
  padding: 14px 10px;
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
}

/* ── Responsive ──────────────────────────────────────────────────────── */
@media (max-width: 720px) {
  .tr-main {
    grid-template-columns: 1fr;
  }
  .tr-leaderboard { order: 2; }
  .tr-phrase { font-size: 18px; }
  .tr-input { font-size: 16px; }
}
</style>
