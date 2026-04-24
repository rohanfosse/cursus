/**
 * WidgetTypeRace — carte Dashboard du mini-jeu typing speed (v2.171 redesign).
 *
 * Design : barres horizontales proportionnelles au top 1 pour lire les
 * ecarts d'un coup d'oeil, highlight "Toi" sur la row de l'utilisateur,
 * sparkline mini de ses 30 derniers WPM, CTA gradient. Plus invitant
 * que la version v2.170 "liste chipie".
 */
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { Keyboard, Play, Trophy, Sparkles } from 'lucide-vue-next'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import { useApi } from '@/composables/useApi'
import { useAppStore } from '@/stores/app'
import SparklineWpm from '@/components/typerace/SparklineWpm.vue'

interface LbRow { rank: number; userId: number; name: string; bestScore: number; bestWpm: number }

const router = useRouter()
const appStore = useAppStore()
const { api } = useApi()

const top       = ref<LbRow[]>([])
const mySamples = ref<number[]>([])
const myBest    = ref({ week: 0, allTime: 0, todayPlays: 0 })

async function refresh() {
  const [lb, stats] = await Promise.all([
    api<LbRow[]>(() => window.api.typeRaceLeaderboard('day'), { silent: true }),
    api<{
      allTime: { plays: number; bestScore: number }
      today:   { plays: number }
      week:    { bestScore: number }
      history: Array<{ wpm: number }>
    }>(() => window.api.typeRaceMyStats(), { silent: true }),
  ])
  if (lb)    top.value = lb.slice(0, 3)
  if (stats) {
    myBest.value = {
      week:       stats.week.bestScore ?? 0,
      allTime:    stats.allTime.bestScore ?? 0,
      todayPlays: stats.today.plays ?? 0,
    }
    // Derniers WPM en ordre chrono (history retourne DESC → on inverse)
    mySamples.value = [...stats.history].reverse().map((h) => h.wpm).slice(-30)
  }
}

function play() { router.push('/typerace') }

const myName = computed(() => appStore.currentUser?.name)
const topScore = computed(() => top.value[0]?.bestScore ?? 0)
const noGamesToday = computed(() => top.value.length === 0)

let refreshTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  refresh()
  refreshTimer = setInterval(refresh, 60_000)
})
onBeforeUnmount(() => { if (refreshTimer) clearInterval(refreshTimer) })
</script>

<template>
  <UiWidgetCard :icon="Keyboard" label="TypeRace">
    <div class="wt-body">
      <!-- ── Top 3 avec barres proportionnelles ── -->
      <div class="wt-top">
        <div class="wt-top-header">
          <Trophy :size="11" />
          <span>Aujourd'hui</span>
          <span v-if="myBest.todayPlays" class="wt-plays">
            {{ myBest.todayPlays }} partie{{ myBest.todayPlays > 1 ? 's' : '' }}
          </span>
        </div>

        <ol v-if="!noGamesToday" class="wt-top-list">
          <li
            v-for="e in top"
            :key="e.rank"
            class="wt-row"
            :class="{
              'wt-row--gold':   e.rank === 1,
              'wt-row--silver': e.rank === 2,
              'wt-row--bronze': e.rank === 3,
              'wt-row--me':     e.name === myName,
            }"
          >
            <span class="wt-rank">{{ e.rank }}</span>
            <span class="wt-name">{{ e.name }}</span>
            <span class="wt-bar" aria-hidden="true">
              <span class="wt-bar-fill" :style="{ width: `${(e.bestScore / topScore) * 100}%` }" />
            </span>
            <span class="wt-score">{{ e.bestScore }}</span>
          </li>
        </ol>

        <p v-else class="wt-empty">
          <Sparkles :size="14" />
          <span>Personne n'a encore joue. <strong>Sois le premier !</strong></span>
        </p>
      </div>

      <!-- ── Footer : progression perso + CTA ── -->
      <div class="wt-footer">
        <div class="wt-perso">
          <SparklineWpm
            v-if="mySamples.length > 1"
            :samples="mySamples"
            :width="86"
            :height="26"
            :y-min="30"
            :stroke="1.8"
          />
          <div class="wt-perso-text">
            <span class="wt-perso-label">{{ myBest.week ? 'Ton best' : 'Pas encore joue' }}</span>
            <span v-if="myBest.week" class="wt-perso-value">{{ myBest.week }} pts</span>
          </div>
        </div>

        <button class="wt-cta" :aria-label="'Jouer a TypeRace'" @click="play">
          <Play :size="13" />
          <span>Jouer</span>
        </button>
      </div>
    </div>
  </UiWidgetCard>
</template>

<style scoped>
.wt-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  height: 100%;
  padding: 2px 0;
}

.wt-top {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}

.wt-top-header {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
}
.wt-plays {
  margin-left: auto;
  font-size: 10px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--accent-subtle);
  color: var(--accent);
}

.wt-top-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.wt-row {
  display: grid;
  grid-template-columns: 16px 1fr 48px auto;
  align-items: center;
  gap: 7px;
  padding: 3px 4px;
  border-radius: 5px;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  transition: background .12s;
}
.wt-row--me {
  background: var(--accent-subtle);
  color: var(--accent);
  font-weight: 700;
}

.wt-rank {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--text-muted);
}
.wt-row--gold   .wt-rank { color: #eab308; }
.wt-row--silver .wt-rank { color: #94a3b8; }
.wt-row--bronze .wt-rank { color: #c2884d; }

.wt-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: inherit;
}

.wt-bar {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
  display: block;
}
.wt-bar-fill {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width .4s ease;
}
.wt-row--gold   .wt-bar-fill { background: #eab308; }
.wt-row--silver .wt-bar-fill { background: #94a3b8; }
.wt-row--bronze .wt-bar-fill { background: #c2884d; }

.wt-score {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  min-width: 26px;
  text-align: right;
  color: var(--text-primary);
}

.wt-empty {
  flex: 1;
  margin: 0;
  padding: 10px 4px;
  font-size: var(--text-xs);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
}
.wt-empty strong { color: var(--accent); }

/* ── Footer ──────────────────────────────────────────────────────── */
.wt-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--border);
}

.wt-perso {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.wt-perso :deep(.spark) { flex-shrink: 0; }

.wt-perso-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}
.wt-perso-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
  font-weight: 700;
}
.wt-perso-value {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 13px;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.wt-cta {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent), white 20%));
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .3px;
  font-family: var(--font);
  cursor: pointer;
  transition: transform .12s, filter .12s, box-shadow .12s;
  box-shadow: 0 2px 6px rgba(var(--accent-rgb), .25);
  flex-shrink: 0;
}
.wt-cta:hover {
  transform: translateY(-1px);
  filter: brightness(1.08);
  box-shadow: 0 4px 10px rgba(var(--accent-rgb), .35);
}
.wt-cta:active {
  transform: translateY(0);
}
</style>
