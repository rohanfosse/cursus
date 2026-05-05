/**
 * SnakeView — mini-jeu Snake (refonte v2.293).
 *
 * Features arcade :
 *   1. Countdown 3-2-1 avant chaque partie
 *   2. Pause / Resume (Espace ou P)
 *   3. Power-ups : pomme doree (×3), pomme bleue (slow-mo)
 *   4. Combo multiplier : 3 pommes < 4s = ×2 puis ×3 sur les suivantes
 *   5. Sound effects synthetises (togglable, partage avec Space Invaders)
 *   6. Particle effects sur consommation + flash power-up
 *
 * Controles : fleches OU ZQSD/WASD + Espace pour demarrer/pause + Esc quitter.
 */
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Play, RotateCw, Sparkles, Pause, Volume2, VolumeX, Flame } from 'lucide-vue-next'
import { useArcadeGame } from '@/composables/useArcadeGame'
import { useAppStore } from '@/stores/app'
import GameSidebar from '@/components/games/GameSidebar.vue'
import { GAMES } from '@/games/registry'
import {
  DEFAULT_SNAKE_CONFIG,
  initialSnake,
  canTurn,
  computeNextTick,
  placeFood as engineSpawnFood,
  keyToDir,
  stepOnce,
  rollFoodKind,
  computeFoodScore,
  nextCombo,
  type Cell,
  type Dir,
  type FoodKind,
  type PowerFood,
} from '@/games/snakeEngine'
import {
  isArcadeSoundEnabled, setArcadeSoundEnabled, unlockArcadeSound,
  playEatTone, playPowerUpTone, playSlowMoTone, playGameOverTone,
  playCountdownTone, playPauseTone, playComboTone,
} from '@/utils/arcadeSounds'

const gameMeta = GAMES.find(g => g.id === 'snake')

const router = useRouter()
const appStore = useAppStore()
const game = useArcadeGame('snake')

const cfg = DEFAULT_SNAKE_CONFIG
const GRID_W = cfg.width
const GRID_H = cfg.height
const CELL   = 28

// ── Etat du jeu ─────────────────────────────────────────────────────────
const snake     = ref<Cell[]>([])
const direction = ref<Dir>('right')
const queuedDir = ref<Dir | null>(null)
const food      = ref<PowerFood>({ x: 10, y: 7, kind: 'normal', expiresAtTick: null })
const gameOverReason = ref<string | null>(null)
const isPaused  = ref(false)
const countdownValue = ref(0)  // 3 -> 2 -> 1 -> 0 (GO) -> -1 (off)
const soundEnabled = ref(isArcadeSoundEnabled())

// Combo state
const comboMultiplier = ref(1)
let lastEatAtMs = 0

// Slow-mo
const slowMoUntilTick = ref(0)
const isSlowMo = computed(() => slowMoUntilTick.value > tickCount.value)

// Tick global counter
const tickCount = ref(0)
let tickInterval: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setTimeout> | null = null
let currentTickMs = cfg.tickInitial
let foodEaten = 0

// Particles : effets visuels temporaires (consommation, power-up). Liste de
// particules animees rendues dans le canvas chaque frame.
interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number  // 0..1 ratio restant
  decay: number // life decrement par frame
  color: string
  size: number
}
const particles = ref<Particle[]>([])

// Flash de power-up (dore ou slow). 0..1, fade out sur le canvas.
const flashIntensity = ref(0)
let flashKind: FoodKind = 'normal'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const comboFlashKey = ref(0)

// ── Reset / Init ───────────────────────────────────────────────────────
function initSnake() {
  snake.value = initialSnake(GRID_W, GRID_H)
  direction.value = 'right'
  queuedDir.value = null
  foodEaten = 0
  currentTickMs = cfg.tickInitial
  tickCount.value = 0
  comboMultiplier.value = 1
  lastEatAtMs = 0
  slowMoUntilTick.value = 0
  particles.value = []
  flashIntensity.value = 0
  food.value = spawnFood()
  gameOverReason.value = null
  isPaused.value = false
}

function spawnFood(): PowerFood {
  const cell = engineSpawnFood(snake.value, GRID_W, GRID_H, Math.random, [])
  const kind = rollFoodKind(cfg, Math.random)
  return {
    x: cell.x,
    y: cell.y,
    kind,
    expiresAtTick: kind === 'normal' ? null : tickCount.value + cfg.powerUpLifeTicks,
  }
}

// ── Countdown ──────────────────────────────────────────────────────────
function startGame() {
  initSnake()
  startCountdown()
  nextTick(() => canvasRef.value?.focus())
}

function startCountdown() {
  cancelCountdown()
  countdownValue.value = 3
  if (soundEnabled.value) playCountdownTone(3)
  tickCountdown()
}

function tickCountdown() {
  countdownTimer = setTimeout(() => {
    countdownValue.value--
    if (soundEnabled.value && countdownValue.value >= 0) playCountdownTone(countdownValue.value)
    if (countdownValue.value < 0) {
      countdownTimer = null
      // Lance la partie
      game.startRun()
      startLoop()
    } else {
      tickCountdown()
    }
  }, 700)
}

function cancelCountdown() {
  if (countdownTimer) { clearTimeout(countdownTimer); countdownTimer = null }
  countdownValue.value = -1
}

// ── Boucle de jeu ──────────────────────────────────────────────────────
function effectiveTickMs(): number {
  return isSlowMo.value ? Math.round(currentTickMs * cfg.slowMoFactor) : currentTickMs
}

function startLoop() {
  stopLoop()
  tickInterval = setInterval(doTick, effectiveTickMs())
}

function stopLoop() {
  if (tickInterval) { clearInterval(tickInterval); tickInterval = null }
}

function doTick() {
  if (game.state.value !== 'playing' || isPaused.value) return
  game.tick()
  tickCount.value++

  if (queuedDir.value) {
    direction.value = queuedDir.value
    queuedDir.value = null
  }

  // Power-up expire si trop longtemps non mange — respawn une normale
  if (food.value.expiresAtTick != null && tickCount.value >= food.value.expiresAtTick) {
    food.value = spawnFood()
  }

  const outcome = stepOnce(snake.value, direction.value, food.value, cfg)
  if (outcome.kind === 'wall') return gameOver('Mur')
  if (outcome.kind === 'self') return gameOver('Toi-meme')

  snake.value = outcome.body
  if (outcome.ateFood) onEat()
  game.addScore(1)

  // Particles tick
  updateParticles()
  if (flashIntensity.value > 0) flashIntensity.value = Math.max(0, flashIntensity.value - 0.06)

  render()
}

function onEat() {
  const now = Date.now()
  comboMultiplier.value = nextCombo(comboMultiplier.value, lastEatAtMs, now, cfg)
  lastEatAtMs = now
  foodEaten++

  const kind = food.value.kind
  const points = computeFoodScore(kind, comboMultiplier.value, cfg)
  game.addScore(points)

  // Sons + effets visuels
  spawnEatParticles(food.value.x, food.value.y, kind)
  if (kind === 'golden') {
    if (soundEnabled.value) playPowerUpTone()
    flashIntensity.value = 1
    flashKind = 'golden'
  } else if (kind === 'slow') {
    if (soundEnabled.value) playSlowMoTone()
    flashIntensity.value = 1
    flashKind = 'slow'
    slowMoUntilTick.value = tickCount.value + cfg.slowMoDurationTicks
  } else {
    if (soundEnabled.value) playEatTone()
  }

  if (comboMultiplier.value >= 2) {
    comboFlashKey.value = Date.now()
    if (soundEnabled.value) playComboTone(comboMultiplier.value)
  }

  food.value = spawnFood()

  // Acceleration tous les N normales (les power-ups ne comptent pas pour
  // la difficulte — sinon le slow-mo serait contre-productif).
  if (kind === 'normal') {
    const nextMs = computeNextTick(currentTickMs, foodEaten, cfg)
    if (nextMs !== currentTickMs) {
      currentTickMs = nextMs
      startLoop()
    }
  }
}

function gameOver(reason: string) {
  gameOverReason.value = reason
  stopLoop()
  if (soundEnabled.value) playGameOverTone()
  game.endRun({ foodEaten, finalLength: snake.value.length, bestCombo: comboMultiplier.value })
}

// ── Pause ──────────────────────────────────────────────────────────────
function togglePause() {
  if (game.state.value !== 'playing') return
  isPaused.value = !isPaused.value
  if (soundEnabled.value) playPauseTone()
  if (isPaused.value) stopLoop()
  else startLoop()
}

// ── Sound toggle ───────────────────────────────────────────────────────
function toggleSound() {
  soundEnabled.value = !soundEnabled.value
  setArcadeSoundEnabled(soundEnabled.value)
  if (soundEnabled.value) {
    unlockArcadeSound()
    playEatTone()
  }
}

// ── Particles ──────────────────────────────────────────────────────────
function spawnEatParticles(gx: number, gy: number, kind: FoodKind) {
  const cx = gx * CELL + CELL / 2
  const cy = gy * CELL + CELL / 2
  const count = kind === 'normal' ? 8 : 18
  const baseColor = kind === 'golden' ? 'rgba(250, 204, 21,' :
                    kind === 'slow'   ? 'rgba(96, 165, 250,' :
                                        'rgba(239, 68, 68,'
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
    const speed = 1.5 + Math.random() * 2
    particles.value.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.04 + Math.random() * 0.03,
      color: baseColor,
      size: 2 + Math.random() * 2,
    })
  }
}

function updateParticles() {
  if (particles.value.length === 0) return
  particles.value = particles.value
    .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - p.decay }))
    .filter((p) => p.life > 0)
}

// ── Rendu canvas ───────────────────────────────────────────────────────
function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#0a0e1a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Flash de power-up : voile semi-transparent qui fade.
  if (flashIntensity.value > 0) {
    const overlayColor = flashKind === 'golden'
      ? `rgba(250, 204, 21, ${flashIntensity.value * 0.18})`
      : `rgba(96, 165, 250, ${flashIntensity.value * 0.20})`
    ctx.fillStyle = overlayColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  // Grille subtile
  ctx.strokeStyle = isSlowMo.value
    ? 'rgba(96, 165, 250, 0.12)'
    : 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 1
  for (let i = 1; i < GRID_W; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, GRID_H * CELL); ctx.stroke()
  }
  for (let j = 1; j < GRID_H; j++) {
    ctx.beginPath(); ctx.moveTo(0, j * CELL); ctx.lineTo(GRID_W * CELL, j * CELL); ctx.stroke()
  }

  // Food (visuels distincts par kind)
  drawFood(ctx, food.value)

  // Particles
  particles.value.forEach((p) => {
    ctx.fillStyle = `${p.color}${p.life})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
    ctx.fill()
  })

  // Serpent (gradient tete -> queue, glow leger en slow-mo)
  snake.value.forEach((c, i) => {
    const progress = i / Math.max(1, snake.value.length)
    const hue = 200 - progress * 40
    const saturation = isSlowMo.value ? 90 : 60
    const lightness = isSlowMo.value ? 70 : 55 - progress * 15
    ctx.fillStyle = i === 0 ? `hsl(${hue}, 80%, 65%)` : `hsl(${hue}, ${saturation}%, ${lightness}%)`
    const pad = i === 0 ? 2 : 3
    ctx.fillRect(c.x * CELL + pad, c.y * CELL + pad, CELL - pad * 2, CELL - pad * 2)
    if (i === 0) {
      // Yeux selon direction
      ctx.fillStyle = '#0a0e1a'
      const eyeOffset = 6
      const cx = c.x * CELL + CELL / 2
      const cy = c.y * CELL + CELL / 2
      let ex1 = cx, ey1 = cy, ex2 = cx, ey2 = cy
      if (direction.value === 'right')      { ex1 += eyeOffset; ex2 = ex1; ey1 -= eyeOffset; ey2 += eyeOffset }
      else if (direction.value === 'left')  { ex1 -= eyeOffset; ex2 = ex1; ey1 -= eyeOffset; ey2 += eyeOffset }
      else if (direction.value === 'up')    { ey1 -= eyeOffset; ey2 = ey1; ex1 -= eyeOffset; ex2 += eyeOffset }
      else                                  { ey1 += eyeOffset; ey2 = ey1; ex1 -= eyeOffset; ex2 += eyeOffset }
      ctx.beginPath(); ctx.arc(ex1, ey1, 2, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(ex2, ey2, 2, 0, Math.PI * 2); ctx.fill()
    }
  })
}

function drawFood(ctx: CanvasRenderingContext2D, f: PowerFood) {
  const fx = f.x * CELL + CELL / 2
  const fy = f.y * CELL + CELL / 2

  // Pulse pour les power-ups (timing base sur tickCount)
  const pulseAmplitude = f.kind === 'normal' ? 0 : 0.15
  const pulse = 1 + Math.sin(tickCount.value * 0.4) * pulseAmplitude

  // Couleur selon kind
  const colors = {
    normal: { core: '#ef4444', glow: '239,68,68'   },
    golden: { core: '#facc15', glow: '250,204,21'  },
    slow:   { core: '#60a5fa', glow: '96,165,250'  },
  }[f.kind]

  // Halo
  const gradient = ctx.createRadialGradient(fx, fy, 2, fx, fy, CELL * 0.85 * pulse)
  gradient.addColorStop(0, colors.core)
  gradient.addColorStop(0.5, `rgba(${colors.glow}, 0.35)`)
  gradient.addColorStop(1, `rgba(${colors.glow}, 0)`)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(fx, fy, CELL * 0.85 * pulse, 0, Math.PI * 2)
  ctx.fill()

  // Core
  ctx.fillStyle = colors.core
  ctx.beginPath()
  ctx.arc(fx, fy, CELL * 0.35 * pulse, 0, Math.PI * 2)
  ctx.fill()

  // Marqueur visuel pour distinguer les types (etoile sur golden, ondes sur slow)
  if (f.kind === 'golden') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    drawStar(ctx, fx, fy, 5, CELL * 0.18, CELL * 0.08)
  } else if (f.kind === 'slow') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.lineWidth = 1.5
    for (let r = 0.4; r > 0.15; r -= 0.12) {
      ctx.beginPath()
      ctx.arc(fx, fy, CELL * r, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  spikes: number, outerR: number, innerR: number,
) {
  let rot = (Math.PI / 2) * 3
  const step = Math.PI / spikes
  ctx.beginPath()
  ctx.moveTo(cx, cy - outerR)
  for (let i = 0; i < spikes; i++) {
    let x = cx + Math.cos(rot) * outerR
    let y = cy + Math.sin(rot) * outerR
    ctx.lineTo(x, y); rot += step
    x = cx + Math.cos(rot) * innerR
    y = cy + Math.sin(rot) * innerR
    ctx.lineTo(x, y); rot += step
  }
  ctx.lineTo(cx, cy - outerR)
  ctx.closePath()
  ctx.fill()
}

// ── Input ──────────────────────────────────────────────────────────────
function queueDir(dir: Dir) {
  if (!canTurn(direction.value, dir)) return
  queuedDir.value = dir
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { router.push('/jeux'); return }
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault()
    if (game.state.value === 'playing') togglePause()
    else startGame()
    return
  }
  if (e.key.toLowerCase() === 'p' && game.state.value === 'playing') {
    e.preventDefault()
    togglePause()
    return
  }
  if (game.state.value !== 'playing' || isPaused.value || countdownValue.value >= 0) return
  const dir = keyToDir(e.key)
  if (dir) { e.preventDefault(); queueDir(dir) }
}

// ── Lifecycle ──────────────────────────────────────────────────────────
onMounted(async () => {
  unlockArcadeSound()
  await game.refreshLeaderboard()
  await game.refreshMyStats()
  initSnake()
  render()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  stopLoop()
  cancelCountdown()
  window.removeEventListener('keydown', onKeydown)
})

watch(isSlowMo, () => {
  // Quand le slow-mo se termine, on remet la vitesse normale.
  if (game.state.value === 'playing' && !isPaused.value) startLoop()
})

// ── Derivees ───────────────────────────────────────────────────────────
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
  <div class="snake-layout" tabindex="-1">
    <header class="s-header">
      <button class="s-icon-btn" aria-label="Retour aux jeux" @click="router.push('/jeux')">
        <ArrowLeft :size="18" />
      </button>
      <span class="s-brand">Snake</span>
      <span class="s-spacer" />
      <button
        class="s-icon-btn"
        :class="{ 'is-off': !soundEnabled }"
        :title="soundEnabled ? 'Couper le son' : 'Activer le son'"
        :aria-label="soundEnabled ? 'Couper le son' : 'Activer le son'"
        @click="toggleSound"
      >
        <component :is="soundEnabled ? Volume2 : VolumeX" :size="16" />
      </button>
      <div v-if="comboMultiplier > 1 && game.state.value === 'playing'"
           :key="comboFlashKey" class="s-combo-chip">
        <Flame :size="11" />
        <strong>×{{ comboMultiplier }}</strong>
      </div>
      <div class="s-score-chip">
        <span class="s-score-label">Score</span>
        <span class="s-score-value">{{ game.score.value }}</span>
      </div>
    </header>

    <main class="s-main">
      <section class="s-stage">
        <div class="s-canvas-wrap">
          <canvas
            ref="canvasRef"
            :width="GRID_W * CELL"
            :height="GRID_H * CELL"
            class="s-canvas"
            tabindex="0"
            aria-label="Grille de jeu Snake"
          />

          <!-- Idle overlay -->
          <div v-if="game.state.value === 'idle' && countdownValue < 0" class="s-overlay">
            <h2>Snake</h2>
            <p>
              Mange les pommes <span class="s-legend s-legend--apple">●</span>
              Doree <span class="s-legend s-legend--gold">★</span> = ×{{ cfg.goldenMultiplier }}
              · Bleue <span class="s-legend s-legend--slow">◎</span> = slow-mo
            </p>
            <p class="s-hint-keys">
              <kbd>↑↓←→</kbd> ou <kbd>ZQSD</kbd> · <kbd>Espace</kbd> demarrer/pause · <kbd>P</kbd> pause
            </p>
            <button class="s-btn-primary" @click="startGame">
              <Play :size="16" /> Jouer <kbd>Espace</kbd>
            </button>
          </div>

          <!-- Countdown overlay -->
          <div v-if="countdownValue >= 0" class="s-overlay s-overlay--countdown">
            <div :key="countdownValue" class="s-countdown">
              {{ countdownValue > 0 ? countdownValue : 'GO !' }}
            </div>
          </div>

          <!-- Pause overlay -->
          <div v-if="isPaused" class="s-overlay s-overlay--pause">
            <Pause :size="42" />
            <h2>En pause</h2>
            <p><kbd>Espace</kbd> ou <kbd>P</kbd> pour reprendre</p>
          </div>

          <!-- Game over overlay -->
          <div v-if="game.state.value === 'done' && game.lastResult.value" class="s-overlay s-overlay--done">
            <div v-if="isPersonalBest" class="s-pb">
              <Sparkles :size="14" /> Record personnel
            </div>
            <h2 class="s-over-title">Game over</h2>
            <p class="s-over-reason">Contact : {{ gameOverReason }}</p>
            <div class="s-over-score">
              {{ game.lastResult.value.score }} <span>pts</span>
            </div>
            <div class="s-over-meta">
              <span>{{ snake.length }} cellules</span>
              <span>{{ foodEaten }} pommes</span>
              <span v-if="currentRank">· #{{ currentRank }} du jour</span>
            </div>
            <button class="s-btn-primary" @click="startGame">
              <RotateCw :size="16" /> Rejouer <kbd>Espace</kbd>
            </button>
          </div>

          <!-- Combo flash floating -->
          <Transition name="s-combo-flash">
            <div
              v-if="comboMultiplier > 1 && game.state.value === 'playing'"
              :key="`flash-${comboFlashKey}`"
              class="s-combo-flash"
            >
              ×{{ comboMultiplier }}
            </div>
          </Transition>
        </div>

        <p class="s-help">
          <kbd>↑↓←→</kbd> / <kbd>ZQSD</kbd> · <kbd>Espace</kbd> demarrer/pause · <kbd>P</kbd> pause · <kbd>Esc</kbd> quitter
        </p>
      </section>

      <GameSidebar
        :leaderboard="game.leaderboard.value"
        :my-stats="game.myStats.value"
        :scope="game.scope.value"
        :current-user-name="appStore.currentUser?.name ?? null"
        :accent="gameMeta?.accent"
        class="s-sidebar"
        @change-scope="(s) => game.setScope(s)"
      />
    </main>
  </div>
</template>

<style scoped>
.snake-layout {
  display: flex; flex-direction: column;
  height: 100%; overflow: hidden;
  background: radial-gradient(ellipse at top, rgba(59, 130, 246, .1), transparent 60%), var(--bg-canvas);
  outline: none;
}

.s-header {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 20px; height: 56px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.s-icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: var(--radius-sm);
  border: none; background: transparent; color: var(--text-secondary);
  cursor: pointer; transition: background .12s, color .12s;
}
.s-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.s-icon-btn.is-off { color: var(--text-muted); }

.s-brand { font-size: 13px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; color: var(--text-primary); }
.s-spacer { flex: 1; }

.s-combo-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(var(--color-warning-rgb), .14);
  color: var(--color-warning);
  font-variant-numeric: tabular-nums;
  font-size: 12px; font-weight: 800;
  animation: s-combo-pop .35s ease;
}
@keyframes s-combo-pop {
  0%   { transform: scale(.5); opacity: 0; }
  60%  { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); }
}

.s-score-chip {
  display: inline-flex; align-items: baseline; gap: 6px;
  padding: 4px 14px; border-radius: 999px;
  background: var(--accent-subtle); color: var(--accent);
  font-variant-numeric: tabular-nums;
}
.s-score-label { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; font-weight: 700; }
.s-score-value { font-family: var(--font-mono, ui-monospace, monospace); font-size: 16px; font-weight: 800; }

.s-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 20px;
  padding: 20px 24px 24px;
  min-height: 0;
  overflow: hidden;
}

.s-stage {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 14px;
}

.s-canvas-wrap {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,.25);
}
.s-canvas {
  display: block;
  outline: none;
  max-width: 100%;
  height: auto;
}

/* Overlays */
.s-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(10, 14, 26, .85);
  backdrop-filter: blur(4px);
  color: #fff;
  text-align: center;
  padding: 20px;
}
.s-overlay h2 {
  font-size: 32px; font-weight: 800; margin: 0;
  font-family: var(--font-mono, ui-monospace, monospace);
  letter-spacing: -.5px;
}
.s-overlay p { margin: 0; color: rgba(255,255,255,.7); font-size: 13px; }
.s-hint-keys { font-size: 11px; opacity: .65; }

.s-overlay--countdown {
  background: rgba(10, 14, 26, .55);
  pointer-events: none;
}
.s-countdown {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: clamp(120px, 18vw, 200px);
  font-weight: 900;
  color: var(--accent-light, var(--accent));
  letter-spacing: -8px;
  line-height: 1;
  text-shadow: 0 0 60px rgba(var(--accent-rgb), .55);
  animation: s-countdown-pop .6s cubic-bezier(.34, 1.56, .64, 1);
}
@keyframes s-countdown-pop {
  0%   { opacity: 0; transform: scale(.4); }
  50%  { opacity: 1; transform: scale(1.18); }
  100% { opacity: 1; transform: scale(1); }
}

.s-overlay--pause svg { color: var(--accent-light, var(--accent)); }

.s-legend {
  display: inline-block;
  font-weight: 800;
  margin: 0 2px;
}
.s-legend--apple { color: #ef4444; }
.s-legend--gold  { color: #facc15; }
.s-legend--slow  { color: #60a5fa; }

.s-pb {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 12px; border-radius: 999px;
  background: linear-gradient(90deg, #eab308, #f59e0b);
  color: #1a1a1a; font-size: 11px; font-weight: 800;
  text-transform: uppercase; letter-spacing: .3px;
}
.s-over-title { color: var(--color-danger) !important; }
.s-over-reason { font-style: italic; }
.s-over-score {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 56px;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: -2px;
  line-height: 1;
  margin: 4px 0;
}
.s-over-score span { font-size: 14px; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase; margin-left: 4px; }
.s-over-meta {
  display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;
  font-size: 12px; color: rgba(255,255,255,.6);
}

.s-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 22px;
  background: var(--accent); color: #fff;
  border: none; border-radius: var(--radius);
  font-size: 14px; font-weight: 700; font-family: var(--font);
  cursor: pointer; transition: filter .12s, transform .06s;
  margin-top: 6px;
}
.s-btn-primary:hover { filter: brightness(1.1); }
.s-btn-primary:active { transform: translateY(1px); }
.s-btn-primary kbd {
  background: rgba(255,255,255,.18);
  border: 1px solid rgba(255,255,255,.2);
  color: #fff;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-family: var(--font-mono, monospace);
}

.s-help {
  font-size: 11px; color: var(--text-muted); text-align: center; margin: 0;
}
.s-help kbd, .s-overlay kbd {
  display: inline-block;
  padding: 1px 6px;
  margin: 0 1px;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  color: var(--text-secondary);
  background: var(--bg-elevated);
}
.s-overlay kbd {
  background: rgba(255,255,255,.12);
  border-color: rgba(255,255,255,.18);
  color: rgba(255,255,255,.85);
}

/* Combo flash flottant : grand chiffre qui pop en haut du canvas */
.s-combo-flash {
  position: absolute;
  top: 16px; left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 48px;
  font-weight: 900;
  color: var(--color-warning);
  text-shadow: 0 4px 24px rgba(var(--color-warning-rgb), .55);
  pointer-events: none;
  letter-spacing: -2px;
}
.s-combo-flash-enter-active {
  animation: s-combo-flash-in .55s cubic-bezier(.34, 1.56, .64, 1);
}
@keyframes s-combo-flash-in {
  0%   { opacity: 0; transform: translateX(-50%) scale(.4); }
  50%  { opacity: 1; transform: translateX(-50%) scale(1.25); }
  100% { opacity: 1; transform: translateX(-50%) scale(1); }
}

.s-sidebar {
  align-self: stretch;
}

@media (max-width: 900px) {
  .s-main { grid-template-columns: 1fr; }
  .s-sidebar { max-height: 260px; }
}

@media (prefers-reduced-motion: reduce) {
  .s-countdown, .s-combo-chip, .s-combo-flash { animation: none !important; }
}
</style>
