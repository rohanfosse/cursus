/**
 * WidgetTypeRace — carte Dashboard du mini-jeu typing speed (v2.170).
 * Affiche : top 3 du jour + mon meilleur score de la semaine + CTA "Jouer".
 * Charge top3 + myStats a chaque mount, refetch toutes les 60s quand visible.
 */
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { Keyboard, Play, Trophy } from 'lucide-vue-next'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import { useApi } from '@/composables/useApi'

const router = useRouter()
const { api } = useApi()

const top3     = ref<Array<{ rank: number; name: string; bestScore: number; bestWpm: number }>>([])
const myBest   = ref<number>(0)
const loading  = ref(false)

async function refresh() {
  loading.value = true
  try {
    const [lb, stats] = await Promise.all([
      api<Array<{ rank: number; name: string; bestScore: number; bestWpm: number }>>(
        () => window.api.typeRaceLeaderboard('day'),
        { silent: true },
      ),
      api<{ week: { bestScore: number } }>(
        () => window.api.typeRaceMyStats(),
        { silent: true },
      ),
    ])
    if (lb) top3.value = lb.slice(0, 3)
    if (stats) myBest.value = stats.week.bestScore ?? 0
  } finally {
    loading.value = false
  }
}

function play() {
  router.push('/typerace')
}

let refreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  refresh()
  refreshTimer = setInterval(refresh, 60_000)
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <UiWidgetCard :icon="Keyboard" label="TypeRace">
    <div class="wt-body">
      <!-- ── Top 3 du jour ── -->
      <div class="wt-top" v-if="top3.length">
        <div class="wt-top-header">
          <Trophy :size="11" />
          <span>Aujourd'hui</span>
        </div>
        <ol class="wt-top-list">
          <li
            v-for="e in top3"
            :key="e.rank"
            class="wt-top-row"
            :class="{ 'wt-rank-1': e.rank === 1, 'wt-rank-2': e.rank === 2, 'wt-rank-3': e.rank === 3 }"
          >
            <span class="wt-rank">{{ e.rank }}</span>
            <span class="wt-name">{{ e.name }}</span>
            <span class="wt-score">{{ e.bestScore }}</span>
          </li>
        </ol>
      </div>

      <p v-else class="wt-empty">
        Personne n'a encore joue aujourd'hui. Sois le premier !
      </p>

      <!-- ── Footer : mon best + CTA ── -->
      <div class="wt-footer">
        <div class="wt-mybest" v-if="myBest > 0">
          <span class="wt-mybest-label">Ton best semaine</span>
          <span class="wt-mybest-value">{{ myBest }}</span>
        </div>
        <button class="wt-cta" @click="play" :aria-label="'Jouer a TypeRace'">
          <Play :size="12" />
          Jouer
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
  gap: 4px;
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-muted);
}

.wt-top-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wt-top-row {
  display: grid;
  grid-template-columns: 18px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 4px;
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.wt-rank {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--text-muted);
}
.wt-rank-1 .wt-rank { color: #eab308; }
.wt-rank-2 .wt-rank { color: #94a3b8; }
.wt-rank-3 .wt-rank { color: #c2884d; }

.wt-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.wt-score {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.wt-empty {
  flex: 1;
  margin: 0;
  padding: 10px 4px;
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wt-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px dashed var(--border);
}

.wt-mybest { display: flex; flex-direction: column; line-height: 1.1; }
.wt-mybest-label { font-size: 10px; color: var(--text-muted); }
.wt-mybest-value { font-size: 14px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }

.wt-cta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: none;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font);
  cursor: pointer;
  transition: filter .12s;
  margin-left: auto;
}
.wt-cta:hover { filter: brightness(1.1); }
</style>
