/**
 * SidebarGames — sidebar dediee a la section /jeux.
 *
 * Affiche :
 *   1. Liste des jeux disponibles (registre GAMES) avec icone et accent,
 *      surligne le jeu courant.
 *   2. Top 3 du jour du jeu courant (ou du premier si hub).
 *   3. Stats perso compactes (best all-time, parties totales).
 *   4. Raccourci vers le hub.
 *
 * Volontairement independante de GameSidebar.vue (qui est la sidebar IN-GAME,
 * affichant leaderboard full + historique). Ici c est la sidebar d app qui
 * remplace la liste des canaux quand l utilisateur est dans /jeux.
 */
<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Trophy, Home, Medal } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAppStore } from '@/stores/app'
import { GAMES } from '@/games/registry'
import type { ArcadeLeaderboardRow } from '@/composables/useArcadeGame'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const { api } = useApi()

const currentGameId = computed(() => {
  const name = route.name as string | undefined
  if (name === 'typerace' || name === 'snake' || name === 'space-invaders') {
    return name === 'space-invaders' ? 'space_invaders' : name
  }
  return null
})

const currentGame = computed(() => GAMES.find(g => g.id === currentGameId.value) ?? null)
const hubGame = computed(() => currentGame.value ?? GAMES[0])

const top3 = ref<ArcadeLeaderboardRow[]>([])
const myBest = ref(0)
const myPlays = ref(0)

async function refresh() {
  const g = hubGame.value
  if (!g) return
  const lb = g.id === 'typerace'
    ? await api<ArcadeLeaderboardRow[]>(() => window.api.typeRaceLeaderboard('day'), { silent: true })
    : await api<ArcadeLeaderboardRow[]>(() => window.api.gameLeaderboard(g.id, 'day'), { silent: true })
  if (lb) top3.value = lb.slice(0, 3)

  const stats = g.id === 'typerace'
    ? await api<{ allTime: { bestScore: number; plays: number } }>(() => window.api.typeRaceMyStats(), { silent: true })
    : await api<{ allTime: { bestScore: number; plays: number } }>(() => window.api.gameMyStats(g.id), { silent: true })
  if (stats?.allTime) {
    myBest.value = stats.allTime.bestScore ?? 0
    myPlays.value = stats.allTime.plays ?? 0
  }
}

let refreshTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  refresh()
  refreshTimer = setInterval(refresh, 30_000)
})
onBeforeUnmount(() => {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
})
watch(() => currentGameId.value, refresh)

function goTo(gameId: string) {
  const g = GAMES.find(x => x.id === gameId)
  if (g) router.push(g.route)
}
</script>

<template>
  <div class="sbg">
    <!-- En-tete -->
    <div class="sbg-header">
      <div class="sbg-title-row">
        <span class="sbg-title">Arcade Cursus</span>
        <button class="sbg-hub-btn" title="Retour au hub" @click="router.push('/jeux')">
          <Home :size="12" />
        </button>
      </div>
      <p class="sbg-subtitle">
        {{ currentGame ? currentGame.label : 'Choisis ton jeu' }}
      </p>
    </div>

    <!-- Liste des jeux -->
    <section class="sbg-section">
      <header class="sbg-section-title">Jeux</header>
      <ul class="sbg-games">
        <li
          v-for="g in GAMES"
          :key="g.id"
          class="sbg-game"
          :class="{ 'sbg-game--active': g.id === currentGameId }"
          :style="{ '--g-accent': g.accent }"
          :title="g.tagline"
          @click="goTo(g.id)"
        >
          <span class="sbg-game-dot" />
          <component :is="g.icon" :size="14" class="sbg-game-icon" />
          <span class="sbg-game-label">{{ g.label }}</span>
          <span v-if="g.badge === 'new'" class="sbg-game-badge">new</span>
        </li>
      </ul>
    </section>

    <!-- Top 3 du jour -->
    <section v-if="top3.length" class="sbg-section">
      <header class="sbg-section-title">
        <Trophy :size="11" /> Top {{ hubGame?.label }} — jour
      </header>
      <ol class="sbg-top">
        <li
          v-for="e in top3"
          :key="`${e.userType}-${e.userId}`"
          class="sbg-top-row"
          :class="{ 'sbg-top-row--me': e.name === appStore.currentUser?.name }"
        >
          <span class="sbg-top-rank">
            <Medal v-if="e.rank <= 3" :size="10" />
            <template v-else>{{ e.rank }}</template>
          </span>
          <span class="sbg-top-name">{{ e.name }}</span>
          <span class="sbg-top-score">{{ e.bestScore }}</span>
        </li>
      </ol>
    </section>
    <p v-else class="sbg-empty">
      Pas encore de scores aujourd hui. <br>Sois le premier.
    </p>

    <!-- Mes stats -->
    <section class="sbg-section sbg-stats">
      <header class="sbg-section-title">Mes stats ({{ hubGame?.label }})</header>
      <div class="sbg-stats-row">
        <div class="sbg-stat">
          <span class="sbg-stat-label">Best</span>
          <span class="sbg-stat-value">{{ myBest }}</span>
        </div>
        <div class="sbg-stat">
          <span class="sbg-stat-label">Parties</span>
          <span class="sbg-stat-value">{{ myPlays }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sbg {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  min-height: 0;
  overflow: auto;
}

.sbg-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 4px 8px;
  border-bottom: 1px solid var(--border);
}
.sbg-title-row {
  display: flex; align-items: center; justify-content: space-between;
}
.sbg-title {
  font-family: var(--font);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .2px;
  color: var(--text-primary);
}
.sbg-hub-btn {
  background: transparent; border: none; color: var(--text-muted);
  padding: 3px; border-radius: 5px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.sbg-hub-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.sbg-subtitle {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}

.sbg-section { display: flex; flex-direction: column; gap: 5px; }
.sbg-section-title {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 800; letter-spacing: .5px;
  color: var(--text-secondary); text-transform: uppercase;
}

.sbg-games {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 3px;
}
.sbg-game {
  display: grid;
  grid-template-columns: 8px 16px 1fr auto;
  align-items: center;
  gap: 7px;
  padding: 5px 7px;
  border-radius: 7px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  transition: background .12s, color .12s;
}
.sbg-game:hover { background: var(--bg-hover); color: var(--text-primary); }
.sbg-game--active {
  background: color-mix(in srgb, var(--g-accent) 12%, transparent);
  color: var(--g-accent);
}
.sbg-game-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--g-accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--g-accent) 25%, transparent);
}
.sbg-game-icon { color: var(--g-accent); }
.sbg-game-label {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sbg-game-badge {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .3px;
  padding: 1px 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--g-accent) 18%, transparent);
  color: var(--g-accent);
  text-transform: uppercase;
}

.sbg-top {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 2px;
}
.sbg-top-row {
  display: grid; grid-template-columns: 18px 1fr auto;
  align-items: center; gap: 6px;
  padding: 3px 5px;
  border-radius: 5px;
  font-size: 11.5px; color: var(--text-secondary);
}
.sbg-top-row--me {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  font-weight: 700;
}
.sbg-top-rank { text-align: center; font-weight: 800; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.sbg-top-row--me .sbg-top-rank { color: var(--accent); }
.sbg-top-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sbg-top-score {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-weight: 800; font-variant-numeric: tabular-nums;
  font-size: 11.5px; color: var(--text-primary);
}

.sbg-empty {
  margin: 0; padding: 10px 8px;
  color: var(--text-muted);
  font-size: 11px; font-style: italic;
  text-align: center;
}

.sbg-stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.sbg-stat {
  display: flex; flex-direction: column; gap: 1px;
  padding: 5px 7px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  min-width: 0;
}
.sbg-stat-label {
  font-size: 9px; text-transform: uppercase; letter-spacing: .3px;
  color: var(--text-muted); font-weight: 700;
}
.sbg-stat-value {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 14px; font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
</style>
