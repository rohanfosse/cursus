/**
 * GamesView — hub des mini-jeux Cursus.
 *
 * Grille de cartes alimentee par le registre `games/registry.ts`. Ajouter
 * un jeu au registre suffit a le faire apparaitre ici, sans toucher a la
 * vue. Accessible prof et etudiant, conditionne sur le module 'games'
 * (opt-in admin).
 */
<script setup lang="ts">
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import { Gamepad2 } from 'lucide-vue-next'
import { GAMES } from '@/games/registry'
import GameCard from '@/components/games/GameCard.vue'

interface Props { toggleSidebar?: () => void }
defineProps<Props>()
</script>

<template>
  <div class="games-layout">
    <UiPageHeader
      title="Jeux"
      subtitle="Mini-jeux Cursus avec leaderboard quotidien"
      :icon="Gamepad2"
      :toggle-sidebar="toggleSidebar"
    />

    <main class="games-body">
      <p class="games-intro">
        Tape le plus vite possible, bats tes collegues, fais partie du podium.
        Chaque jeu garde son classement a zero a minuit.
      </p>

      <section class="games-grid" :aria-label="`${GAMES.length} mini-jeux disponibles`">
        <GameCard v-for="game in GAMES" :key="game.id" :game="game" />
      </section>

      <footer class="games-footer">
        <p>
          D'autres jeux arrivent. Tu as une idee ?
          <a href="mailto:rohan.fosse@gmail.com?subject=Suggestion%20jeu%20Cursus" class="games-link">
            Envoie-la
          </a>.
        </p>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.games-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-canvas);
}

.games-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
}

.games-intro {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  max-width: 540px;
  line-height: 1.5;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
  align-items: stretch;
}

.games-footer {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px dashed var(--border);
  font-size: 12px;
  color: var(--text-muted);
}
.games-footer p { margin: 0; }
.games-link {
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
}
.games-link:hover { text-decoration: underline; }

@media (max-width: 640px) {
  .games-body { padding: 16px; }
  .games-grid { grid-template-columns: 1fr; }
}
</style>
