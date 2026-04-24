/**
 * GameCard — tuile d'un jeu sur le hub /jeux. Affiche l'identite du jeu
 * + podium du jour (top 3) + CTA. Click propage via router-link englobant.
 */
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Trophy, Play, Sparkles } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAppStore } from '@/stores/app'
import type { Game } from '@/games/registry'

interface LbRow {
  rank: number
  userType: 'student' | 'teacher'
  name: string
  bestScore: number
  /** TypeRace uniquement — autres jeux n exposent pas ce champ. */
  bestWpm?: number
}

interface Props { game: Game }
const props = defineProps<Props>()

const router = useRouter()
const appStore = useAppStore()
const { api } = useApi()

const top = ref<LbRow[]>([])
const myBest = ref(0)
const myPlays = ref(0)
const loading = ref(false)

// Fetcher generique : TypeRace a son endpoint dedie, tous les autres jeux
// passent par /api/games/:gameId (v2.172+). Les trois jeux actuels (typerace,
// snake, space_invaders) remplissent leur leaderboard des qu une partie est
// enregistree — donc la carte reflete la DB.
async function refresh() {
  loading.value = true
  try {
    if (props.game.id === 'typerace') {
      const [lb, stats] = await Promise.all([
        api<LbRow[]>(() => window.api.typeRaceLeaderboard('day'), { silent: true }),
        api<{ week: { bestScore: number }; allTime: { plays: number } }>(
          () => window.api.typeRaceMyStats(),
          { silent: true },
        ),
      ])
      if (lb) top.value = lb.slice(0, 3)
      if (stats) {
        myBest.value = stats.week.bestScore ?? 0
        myPlays.value = stats.allTime?.plays ?? 0
      }
    } else {
      const [lb, stats] = await Promise.all([
        api<LbRow[]>(() => window.api.gameLeaderboard(props.game.id, 'day'), { silent: true }),
        api<{ week: { bestScore: number }; allTime: { plays: number } }>(
          () => window.api.gameMyStats(props.game.id),
          { silent: true },
        ),
      ])
      if (lb) top.value = lb.slice(0, 3)
      if (stats) {
        myBest.value = stats.week.bestScore ?? 0
        myPlays.value = stats.allTime?.plays ?? 0
      }
    }
  } finally {
    loading.value = false
  }
}

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  refresh()
  timer = setInterval(refresh, 60_000)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

const topScore = computed(() => top.value[0]?.bestScore ?? 0)
const myName = computed(() => appStore.currentUser?.name)

function play() { router.push(props.game.route) }
</script>

<template>
  <article class="game-card" :style="{ '--accent': game.accent }" @click="play">
    <header class="gc-head">
      <span class="gc-icon" aria-hidden="true">
        <component :is="game.icon" :size="20" />
      </span>
      <div class="gc-title-wrap">
        <h3 class="gc-title">{{ game.label }}</h3>
        <p class="gc-tagline">{{ game.tagline }}</p>
      </div>
      <span v-if="game.badge === 'new'" class="gc-badge gc-badge--new">
        <Sparkles :size="10" />
        Nouveau
      </span>
      <span v-else-if="game.badge === 'beta'" class="gc-badge gc-badge--beta">
        Beta
      </span>
    </header>

    <div class="gc-body">
      <!-- Podium du jour -->
      <div class="gc-podium">
        <div class="gc-podium-header">
          <Trophy :size="11" />
          <span>Aujourd'hui</span>
        </div>
        <ol v-if="top.length" class="gc-podium-list">
          <li
            v-for="e in top"
            :key="e.rank"
            class="gc-row"
            :class="{
              'gc-row--gold':   e.rank === 1,
              'gc-row--silver': e.rank === 2,
              'gc-row--bronze': e.rank === 3,
              'gc-row--me':     e.name === myName,
            }"
          >
            <span class="gc-rank">{{ e.rank }}</span>
            <span class="gc-name">{{ e.name }}</span>
            <span class="gc-bar" aria-hidden="true">
              <span class="gc-bar-fill" :style="{ width: `${topScore ? (e.bestScore / topScore) * 100 : 0}%` }" />
            </span>
            <span class="gc-score">{{ e.bestScore }}</span>
          </li>
        </ol>
        <p v-else class="gc-empty">Sois le premier a jouer aujourd'hui.</p>
      </div>

      <!-- Footer : mon best + plays + CTA -->
      <div class="gc-footer">
        <div v-if="myBest > 0 || myPlays > 0" class="gc-mybest">
          <span class="gc-mybest-label">
            Ton best semaine
            <span v-if="myPlays > 0" class="gc-mybest-plays">· {{ myPlays }} partie{{ myPlays > 1 ? 's' : '' }}</span>
          </span>
          <span class="gc-mybest-value">{{ myBest }} pts</span>
        </div>
        <button class="gc-cta" :aria-label="`Jouer a ${game.label}`" @click.stop="play">
          <Play :size="13" />
          Jouer
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.game-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 18px;
  cursor: pointer;
  overflow: hidden;
  transition: transform .15s, box-shadow .15s, border-color .15s;
}

.game-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at top right, color-mix(in srgb, var(--accent, #3b82f6), transparent 85%), transparent 60%);
  pointer-events: none;
  transition: opacity .2s;
}

.game-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent, #3b82f6), transparent 60%);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .15), 0 2px 6px color-mix(in srgb, var(--accent, #3b82f6), transparent 80%);
}

.gc-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
  position: relative;
  z-index: 1;
}

.gc-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent, #3b82f6), transparent 85%);
  color: var(--accent, #3b82f6);
  flex-shrink: 0;
}

.gc-title-wrap { flex: 1; min-width: 0; }
.gc-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 2px;
  letter-spacing: -.2px;
}
.gc-tagline {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.4;
}

.gc-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .3px;
  text-transform: uppercase;
  flex-shrink: 0;
}
.gc-badge--new {
  background: linear-gradient(135deg, #eab308, #f59e0b);
  color: #1a1a1a;
}
.gc-badge--beta {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-muted);
}

.gc-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
  z-index: 1;
}

/* Podium */
.gc-podium {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gc-podium-header {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .5px;
  text-transform: uppercase;
  color: var(--text-muted);
}

.gc-podium-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.gc-row {
  display: grid;
  grid-template-columns: 18px 1fr 60px auto;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}
.gc-row--me {
  background: color-mix(in srgb, var(--accent, #3b82f6), transparent 85%);
  color: var(--accent, #3b82f6);
  font-weight: 700;
}

.gc-rank {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--text-muted);
}
.gc-row--gold   .gc-rank { color: #eab308; }
.gc-row--silver .gc-rank { color: #94a3b8; }
.gc-row--bronze .gc-rank { color: #c2884d; }

.gc-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gc-bar {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}
.gc-bar-fill {
  display: block;
  height: 100%;
  background: var(--accent, #3b82f6);
  border-radius: 2px;
  transition: width .3s ease;
}
.gc-row--gold   .gc-bar-fill { background: #eab308; }
.gc-row--silver .gc-bar-fill { background: #94a3b8; }
.gc-row--bronze .gc-bar-fill { background: #c2884d; }

.gc-score {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: var(--text-primary);
  text-align: right;
  min-width: 28px;
}

.gc-empty {
  margin: 0;
  padding: 10px 4px;
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
}

/* Footer */
.gc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}

.gc-mybest { display: flex; flex-direction: column; line-height: 1.1; }
.gc-mybest-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
  font-weight: 700;
}
.gc-mybest-plays { text-transform: none; letter-spacing: 0; font-weight: 600; margin-left: 3px; }
.gc-mybest-value {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 14px;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.gc-cta {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 16px;
  margin-left: auto;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--accent, #3b82f6), color-mix(in srgb, var(--accent, #3b82f6), white 20%));
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .3px;
  cursor: pointer;
  transition: transform .12s, filter .12s, box-shadow .12s;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--accent, #3b82f6), transparent 75%);
  flex-shrink: 0;
}
.gc-cta:hover {
  transform: translateY(-1px);
  filter: brightness(1.08);
}
.gc-cta:active {
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .game-card, .gc-bar-fill, .gc-cta { transition: none !important; }
}
</style>
