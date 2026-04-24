/**
 * SpaceInvadersView — mini-jeu Space Invaders simplifie. Vague d'aliens
 * qui avancent, joueur en bas qui tire. Quand la vague est eliminee une
 * nouvelle arrive plus rapide. Game over si un alien touche le sol ou le
 * joueur perd ses 3 vies.
 *
 * Score :
 *   - petit alien (rang bas)   : 10 pts
 *   - moyen alien (rang milieu) : 20 pts
 *   - gros alien (rang haut)   : 40 pts
 *   - multiplicateur x1 + 0.2 par vague
 *
 * Controles : fleches gauche/droite + espace pour tirer. Esc : quitter.
 */
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Play, RotateCw, Sparkles, Heart } from 'lucide-vue-next'
import { useArcadeGame } from '@/composables/useArcadeGame'
import { useAppStore } from '@/stores/app'
import GameSidebar from '@/components/games/GameSidebar.vue'
import { GAMES } from '@/games/registry'

const gameMeta = GAMES.find(g => g.id === 'space_invaders')

const router = useRouter()
const appStore = useAppStore()
const game = useArcadeGame('space_invaders')

// ── Config ────────────────────────────────────────────────────────────────
const W = 600
const H = 560
const PLAYER_W = 40
const PLAYER_H = 20
const PLAYER_Y = H - 40
const PLAYER_SPEED = 5
const BULLET_SPEED = 8
const BULLET_COOLDOWN = 280
const ALIEN_ROWS = 4
const ALIEN_COLS = 8
const ALIEN_W = 38
const ALIEN_H = 26
const ALIEN_GAP_X = 48
const ALIEN_GAP_Y = 36
const ALIEN_BULLET_SPEED = 4
const ALIEN_BULLET_CHANCE = 0.003 // par frame par alien
const INITIAL_LIVES = 3

// ── Etat jeu ──────────────────────────────────────────────────────────────
interface Alien { x: number; y: number; row: number; alive: boolean }
interface Bullet { x: number; y: number; vy: number }

const playerX = ref(W / 2 - PLAYER_W / 2)
const aliens = ref<Alien[]>([])
const bullets = ref<Bullet[]>([])
const alienBullets = ref<Bullet[]>([])
const wave = ref(1)
const lives = ref(INITIAL_LIVES)
const alienDir = ref<1 | -1>(1)
const alienSpeed = ref(0.8)
const gameOverReason = ref<string | null>(null)

let lastShotAt = 0
let rafId: number | null = null
const keys = new Set<string>()
const canvasRef = ref<HTMLCanvasElement | null>(null)

// ── Init wave ─────────────────────────────────────────────────────────────
function spawnWave(n: number) {
  const newAliens: Alien[] = []
  const totalW = ALIEN_COLS * ALIEN_GAP_X
  const offsetX = (W - totalW) / 2
  for (let r = 0; r < ALIEN_ROWS; r++) {
    for (let c = 0; c < ALIEN_COLS; c++) {
      newAliens.push({
        x: offsetX + c * ALIEN_GAP_X,
        y: 50 + r * ALIEN_GAP_Y,
        row: r,
        alive: true,
      })
    }
  }
  aliens.value = newAliens
  alienDir.value = 1
  alienSpeed.value = 0.8 + (n - 1) * 0.35
  bullets.value = []
  alienBullets.value = []
}

function startGame() {
  wave.value = 1
  lives.value = INITIAL_LIVES
  playerX.value = W / 2 - PLAYER_W / 2
  gameOverReason.value = null
  spawnWave(1)
  game.startRun()
  startLoop()
}

// ── Boucle principale (RAF) ──────────────────────────────────────────────
function startLoop() {
  stopLoop()
  const loop = () => {
    if (game.state.value !== 'playing') return
    update()
    render()
    rafId = requestAnimationFrame(loop)
  }
  rafId = requestAnimationFrame(loop)
}

function stopLoop() {
  if (rafId != null) { cancelAnimationFrame(rafId); rafId = null }
}

function update() {
  game.tick()

  // Deplacement joueur
  if (keys.has('arrowleft') || keys.has('q') || keys.has('a')) {
    playerX.value = Math.max(0, playerX.value - PLAYER_SPEED)
  }
  if (keys.has('arrowright') || keys.has('d')) {
    playerX.value = Math.min(W - PLAYER_W, playerX.value + PLAYER_SPEED)
  }

  // Tir joueur
  if ((keys.has(' ') || keys.has('space')) && Date.now() - lastShotAt > BULLET_COOLDOWN) {
    lastShotAt = Date.now()
    bullets.value.push({ x: playerX.value + PLAYER_W / 2, y: PLAYER_Y, vy: -BULLET_SPEED })
  }

  // Deplacement bullets joueur
  bullets.value = bullets.value
    .map((b) => ({ ...b, y: b.y + b.vy }))
    .filter((b) => b.y > -10)

  // Deplacement aliens
  let hitEdge = false
  for (const a of aliens.value) {
    if (!a.alive) continue
    a.x += alienSpeed.value * alienDir.value
    if (a.x <= 0 || a.x + ALIEN_W >= W) hitEdge = true
  }
  if (hitEdge) {
    alienDir.value = (alienDir.value * -1) as 1 | -1
    for (const a of aliens.value) if (a.alive) a.y += 16
  }

  // Tirs aliens random
  for (const a of aliens.value) {
    if (!a.alive) continue
    if (Math.random() < ALIEN_BULLET_CHANCE) {
      alienBullets.value.push({ x: a.x + ALIEN_W / 2, y: a.y + ALIEN_H, vy: ALIEN_BULLET_SPEED })
    }
  }
  alienBullets.value = alienBullets.value
    .map((b) => ({ ...b, y: b.y + b.vy }))
    .filter((b) => b.y < H + 10)

  // Collisions bullets joueur <-> aliens
  const remainingBullets: Bullet[] = []
  for (const b of bullets.value) {
    let hit = false
    for (const a of aliens.value) {
      if (!a.alive) continue
      if (b.x >= a.x && b.x <= a.x + ALIEN_W && b.y >= a.y && b.y <= a.y + ALIEN_H) {
        a.alive = false
        const points = alienPoints(a.row) * (1 + (wave.value - 1) * 0.2)
        game.addScore(Math.round(points))
        hit = true
        break
      }
    }
    if (!hit) remainingBullets.push(b)
  }
  bullets.value = remainingBullets

  // Collisions tirs aliens <-> joueur
  const remainingAlienBullets: Bullet[] = []
  for (const b of alienBullets.value) {
    const hitsPlayer =
      b.x >= playerX.value && b.x <= playerX.value + PLAYER_W &&
      b.y >= PLAYER_Y && b.y <= PLAYER_Y + PLAYER_H
    if (hitsPlayer) {
      lives.value -= 1
      if (lives.value <= 0) return gameOver('Eliminated')
    } else {
      remainingAlienBullets.push(b)
    }
  }
  alienBullets.value = remainingAlienBullets

  // Aliens atteignent le sol ?
  for (const a of aliens.value) {
    if (a.alive && a.y + ALIEN_H >= PLAYER_Y) {
      return gameOver('Invasion')
    }
  }

  // Vague nettoyee → vague suivante
  if (aliens.value.every((a) => !a.alive)) {
    wave.value += 1
    spawnWave(wave.value)
  }
}

function alienPoints(row: number): number {
  // Rangs du haut valent plus (tradition Space Invaders : UFO en haut = bonus)
  if (row === 0) return 40
  if (row === 1) return 20
  return 10
}

function gameOver(reason: string) {
  gameOverReason.value = reason
  stopLoop()
  game.endRun({ wave: wave.value, livesLeft: lives.value })
}

// ── Rendu ─────────────────────────────────────────────────────────────────
function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Fond etoile
  ctx.fillStyle = '#050815'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  for (let i = 0; i < 40; i++) {
    // Stars deterministes par seed simple
    const x = ((i * 127) % W)
    const y = ((i * 311) % H)
    ctx.fillRect(x, y, 1, 1)
  }

  // Aliens
  for (const a of aliens.value) {
    if (!a.alive) continue
    ctx.fillStyle = a.row === 0 ? '#ef4444' : a.row === 1 ? '#f59e0b' : '#22c55e'
    // Corps
    ctx.fillRect(a.x + 6, a.y + 6, ALIEN_W - 12, ALIEN_H - 10)
    // Bras
    ctx.fillRect(a.x, a.y + 10, 6, 8)
    ctx.fillRect(a.x + ALIEN_W - 6, a.y + 10, 6, 8)
    // Yeux (noirs)
    ctx.fillStyle = '#0a0e1a'
    ctx.fillRect(a.x + 12, a.y + 12, 4, 4)
    ctx.fillRect(a.x + ALIEN_W - 16, a.y + 12, 4, 4)
  }

  // Joueur (triangle vaisseau)
  ctx.fillStyle = '#22d3ee'
  ctx.beginPath()
  ctx.moveTo(playerX.value + PLAYER_W / 2, PLAYER_Y)
  ctx.lineTo(playerX.value, PLAYER_Y + PLAYER_H)
  ctx.lineTo(playerX.value + PLAYER_W, PLAYER_Y + PLAYER_H)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#67e8f9'
  ctx.fillRect(playerX.value + PLAYER_W / 2 - 2, PLAYER_Y - 4, 4, 6)

  // Bullets joueur
  ctx.fillStyle = '#fde047'
  for (const b of bullets.value) ctx.fillRect(b.x - 1, b.y, 3, 10)

  // Bullets aliens
  ctx.fillStyle = '#f87171'
  for (const b of alienBullets.value) ctx.fillRect(b.x - 1, b.y, 3, 10)
}

// ── Input ─────────────────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { router.push('/jeux'); return }
  if ((e.key === ' ' || e.code === 'Space') && game.state.value !== 'playing') {
    e.preventDefault()
    startGame()
    return
  }
  keys.add(e.key.toLowerCase())
  if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); keys.add(' ') }
}

function onKeyup(e: KeyboardEvent) {
  keys.delete(e.key.toLowerCase())
  if (e.key === ' ' || e.code === 'Space') keys.delete(' ')
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(async () => {
  await game.refreshLeaderboard()
  await game.refreshMyStats()
  spawnWave(1)
  render()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('keyup', onKeyup)
})

onBeforeUnmount(() => {
  stopLoop()
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('keyup', onKeyup)
})

const allTimeBest = computed(() => game.myStats.value?.allTime.bestScore ?? 0)
const isPersonalBest = computed(() =>
  game.state.value === 'done' && game.lastResult.value != null && game.lastResult.value.score > allTimeBest.value,
)
const currentRank = computed(() => {
  if (!appStore.currentUser) return null
  return game.leaderboard.value.find((e) => e.name === appStore.currentUser?.name)?.rank ?? null
})
</script>

<template>
  <div class="si-layout">
    <header class="si-header">
      <button class="si-icon-btn" aria-label="Retour aux jeux" @click="router.push('/jeux')">
        <ArrowLeft :size="18" />
      </button>
      <span class="si-brand">Space Invaders</span>
      <span class="si-spacer" />
      <div class="si-hud">
        <div class="si-hud-item">
          <span class="si-hud-label">Vague</span>
          <span class="si-hud-value">{{ wave }}</span>
        </div>
        <div class="si-hud-item">
          <span class="si-hud-label">Vies</span>
          <span class="si-hud-lives">
            <Heart v-for="n in lives" :key="n" :size="12" fill="#ef4444" color="#ef4444" />
          </span>
        </div>
        <div class="si-hud-item si-hud-score">
          <span class="si-hud-label">Score</span>
          <span class="si-hud-value">{{ game.score.value }}</span>
        </div>
      </div>
    </header>

    <main class="si-main">
      <section class="si-stage">
        <div class="si-canvas-wrap">
          <canvas ref="canvasRef" :width="W" :height="H" class="si-canvas" />

          <div v-if="game.state.value === 'idle'" class="si-overlay">
            <h2>Space Invaders</h2>
            <p>Fleches pour bouger. Espace pour tirer. Survis.</p>
            <button class="si-btn-primary" @click="startGame">
              <Play :size="16" /> Jouer <kbd>Espace</kbd>
            </button>
          </div>

          <div v-if="game.state.value === 'done' && game.lastResult.value" class="si-overlay si-overlay--done">
            <div v-if="isPersonalBest" class="si-pb">
              <Sparkles :size="14" /> Record personnel
            </div>
            <h2 class="si-over-title">{{ gameOverReason === 'Invasion' ? 'Invasion' : 'Game over' }}</h2>
            <div class="si-over-score">
              {{ game.lastResult.value.score }} <span>pts</span>
            </div>
            <div class="si-over-meta">
              <span>Vague {{ wave }}</span>
              <span v-if="currentRank">· #{{ currentRank }} du jour</span>
            </div>
            <button class="si-btn-primary" @click="startGame">
              <RotateCw :size="16" /> Rejouer <kbd>Espace</kbd>
            </button>
          </div>
        </div>

        <p class="si-help">
          <kbd>←</kbd><kbd>→</kbd> deplacer · <kbd>Espace</kbd> tirer · <kbd>Esc</kbd> quitter
        </p>
      </section>

      <GameSidebar
        :leaderboard="game.leaderboard.value"
        :my-stats="game.myStats.value"
        :scope="game.scope.value"
        :current-user-name="appStore.currentUser?.name ?? null"
        :accent="gameMeta?.accent"
        class="si-sidebar"
        @change-scope="(s) => game.setScope(s)"
      />
    </main>
  </div>
</template>

<style scoped>
.si-layout {
  display: flex; flex-direction: column;
  height: 100%; overflow: hidden;
  background: radial-gradient(ellipse at top, rgba(34, 211, 238, .1), transparent 60%), #05060a;
  color: var(--text-primary);
}

.si-header {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 20px; height: 56px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.si-icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 6px;
  border: none; background: transparent; color: var(--text-secondary);
  cursor: pointer;
}
.si-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.si-brand { font-size: 13px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; }
.si-spacer { flex: 1; }

.si-hud {
  display: inline-flex; align-items: center; gap: 14px;
  padding: 5px 14px; border-radius: 999px;
  background: var(--bg-sidebar); border: 1px solid var(--border);
}
.si-hud-item { display: flex; flex-direction: column; align-items: center; line-height: 1.1; }
.si-hud-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--text-muted); }
.si-hud-value { font-family: var(--font-mono, ui-monospace, monospace); font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; }
.si-hud-score .si-hud-value { color: #22d3ee; }
.si-hud-lives { display: inline-flex; gap: 2px; height: 18px; align-items: center; }

.si-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 20px;
  padding: 20px 24px;
  min-height: 0;
  overflow: hidden;
}

.si-stage {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 12px;
}

.si-canvas-wrap {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(34, 211, 238, .2), 0 10px 40px rgba(0,0,0,.4);
}

.si-canvas { display: block; max-width: 100%; height: auto; }

.si-overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px;
  background: rgba(5, 8, 21, .88); backdrop-filter: blur(4px);
  color: #fff; text-align: center; padding: 20px;
}
.si-overlay h2 { font-size: 30px; font-weight: 800; margin: 0; font-family: var(--font-mono, monospace); letter-spacing: -.5px; }
.si-overlay p { margin: 0; color: rgba(255,255,255,.7); font-size: 13px; }

.si-pb {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 12px; border-radius: 999px;
  background: linear-gradient(90deg, #eab308, #f59e0b);
  color: #1a1a1a; font-size: 11px; font-weight: 800;
  text-transform: uppercase; letter-spacing: .3px;
}
.si-over-title { color: #f87171 !important; }
.si-over-score {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 56px; font-weight: 800;
  color: #22d3ee; letter-spacing: -2px; line-height: 1;
}
.si-over-score span { font-size: 14px; color: rgba(255,255,255,.5); letter-spacing: 1px; text-transform: uppercase; margin-left: 4px; }
.si-over-meta { display: flex; gap: 10px; font-size: 12px; color: rgba(255,255,255,.6); }

.si-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 22px;
  background: #22d3ee; color: #0a0e1a;
  border: none; border-radius: 10px;
  font-size: 14px; font-weight: 800; font-family: var(--font);
  cursor: pointer; transition: filter .12s, transform .06s;
  margin-top: 6px;
}
.si-btn-primary:hover { filter: brightness(1.1); }
.si-btn-primary:active { transform: translateY(1px); }
.si-btn-primary kbd {
  background: rgba(10, 14, 26, .2);
  border: 1px solid rgba(10, 14, 26, .3);
  color: inherit;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-family: var(--font-mono, monospace);
}

.si-help {
  font-size: 11px; color: var(--text-muted); text-align: center; margin: 0;
}
.si-help kbd {
  display: inline-block; padding: 1px 6px; margin: 0 1px;
  border: 1px solid var(--border); border-bottom-width: 2px;
  border-radius: 4px;
  font-family: var(--font-mono, monospace);
  font-size: 10px; color: var(--text-secondary);
  background: var(--bg-elevated);
}

/* Sidebar partage (leaderboard + stats + historique) — styles portes par GameSidebar.vue */
.si-sidebar { align-self: stretch; }

@media (max-width: 900px) {
  .si-main { grid-template-columns: 1fr; }
  .si-sidebar { max-height: 260px; }
}
</style>
