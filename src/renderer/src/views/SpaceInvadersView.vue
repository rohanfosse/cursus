/**
 * SpaceInvadersView — refonte arcade v2.294.
 *
 * Features arcade :
 *   1. Countdown 3-2-1 avant chaque partie
 *   2. Pause / Resume (Espace ou P pendant le jeu)
 *   3. Power-ups droppes par les aliens (~12 % de chance) :
 *      - Triple shot : 3 balles paralleles pendant 8 s
 *      - Rapid fire : cooldown / 2 pendant 8 s
 *      - Shield : absorbe 1 hit
 *      - Extra life : +1 vie (cap a 5)
 *   4. Bunkers destructibles : 4 boucliers en bas, perdent des chunks
 *   5. UFO bonus qui passe en haut occasionnellement (50/100/200 pts random)
 *   6. Sound effects synthetises (laser, explosion, UFO, power-up)
 *   7. Particle effects sur explosions d'aliens
 */
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Play, RotateCw, Sparkles, Heart, Pause, Volume2, VolumeX, Shield as ShieldIcon, Zap, Crosshair } from 'lucide-vue-next'
import { useArcadeGame } from '@/composables/useArcadeGame'
import { useAppStore } from '@/stores/app'
import GameSidebar from '@/components/games/GameSidebar.vue'
import { GAMES } from '@/games/registry'
import {
  isArcadeSoundEnabled, setArcadeSoundEnabled, unlockArcadeSound,
  playLaserTone, playExplosionTone, playPowerUpTone,
  playGameOverTone, playCountdownTone, playPauseTone, playEatTone,
} from '@/utils/arcadeSounds'

const gameMeta = GAMES.find(g => g.id === 'space_invaders')

const router = useRouter()
const appStore = useAppStore()
const game = useArcadeGame('space_invaders')

// ── Config ─────────────────────────────────────────────────────────────
const W = 600
const H = 560
const PLAYER_W = 40
const PLAYER_H = 20
const PLAYER_Y = H - 40
const PLAYER_SPEED = 5
const BULLET_SPEED = 8
const BULLET_COOLDOWN = 280
const RAPID_FIRE_COOLDOWN = 140
const ALIEN_ROWS = 4
const ALIEN_COLS = 8
const ALIEN_W = 38
const ALIEN_H = 26
const ALIEN_GAP_X = 48
const ALIEN_GAP_Y = 36
const ALIEN_BULLET_SPEED = 4
const ALIEN_BULLET_CHANCE = 0.003
const INITIAL_LIVES = 3
const MAX_LIVES = 5
const POWERUP_DROP_CHANCE = 0.12
const POWERUP_FALL_SPEED = 2
const POWERUP_SIZE = 22
const POWERUP_DURATION_MS = 8_000
const UFO_INTERVAL_MS = 12_000
const UFO_SPEED = 2.4
const UFO_W = 44
const UFO_H = 18
const UFO_Y = 22
const BUNKER_COUNT = 4
const BUNKER_BLOCK = 8
const BUNKER_COLS = 6
const BUNKER_ROWS = 3
const BUNKER_Y = H - 110

// ── Types ──────────────────────────────────────────────────────────────
interface Alien { x: number; y: number; row: number; alive: boolean }
interface Bullet { x: number; y: number; vy: number }
type PowerKind = 'triple' | 'rapid' | 'shield' | 'life'
interface PowerUp { x: number; y: number; kind: PowerKind }
interface ActiveBuff { triple: number; rapid: number }  // timestamps d'expiration
interface Ufo { x: number; vx: number; points: number; alive: boolean }
interface BunkerBlock { x: number; y: number; alive: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; decay: number; color: string; size: number }

// ── Etat ───────────────────────────────────────────────────────────────
const playerX = ref(W / 2 - PLAYER_W / 2)
const aliens = ref<Alien[]>([])
const bullets = ref<Bullet[]>([])
const alienBullets = ref<Bullet[]>([])
const powerups = ref<PowerUp[]>([])
const buffs = ref<ActiveBuff>({ triple: 0, rapid: 0 })
const hasShield = ref(false)
const ufo = ref<Ufo | null>(null)
const bunkers = ref<BunkerBlock[]>([])
const particles = ref<Particle[]>([])
const wave = ref(1)
const lives = ref(INITIAL_LIVES)
const alienDir = ref<1 | -1>(1)
const alienSpeed = ref(0.8)
const gameOverReason = ref<string | null>(null)
const isPaused = ref(false)
const countdownValue = ref(-1)
const soundEnabled = ref(isArcadeSoundEnabled())

let lastShotAt = 0
let lastUfoAt = 0
let rafId: number | null = null
let countdownTimer: ReturnType<typeof setTimeout> | null = null
const keys = new Set<string>()
const canvasRef = ref<HTMLCanvasElement | null>(null)

const cooldownNow = computed(() =>
  Date.now() < buffs.value.rapid ? RAPID_FIRE_COOLDOWN : BULLET_COOLDOWN,
)
const tripleActive = computed(() => Date.now() < buffs.value.triple)
const rapidActive = computed(() => Date.now() < buffs.value.rapid)

// ── Init ───────────────────────────────────────────────────────────────
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

function buildBunkers() {
  const list: BunkerBlock[] = []
  const totalSpan = W - 80
  const sectionW = totalSpan / BUNKER_COUNT
  for (let b = 0; b < BUNKER_COUNT; b++) {
    const baseX = 40 + b * sectionW + (sectionW - BUNKER_COLS * BUNKER_BLOCK) / 2
    for (let r = 0; r < BUNKER_ROWS; r++) {
      for (let c = 0; c < BUNKER_COLS; c++) {
        // Crénelage : on retire le coin centre-haut pour le look "bunker".
        if (r === 0 && c >= 2 && c < BUNKER_COLS - 2) continue
        list.push({ x: baseX + c * BUNKER_BLOCK, y: BUNKER_Y + r * BUNKER_BLOCK, alive: true })
      }
    }
  }
  bunkers.value = list
}

function startGame() {
  wave.value = 1
  lives.value = INITIAL_LIVES
  playerX.value = W / 2 - PLAYER_W / 2
  gameOverReason.value = null
  buffs.value = { triple: 0, rapid: 0 }
  hasShield.value = false
  ufo.value = null
  powerups.value = []
  particles.value = []
  isPaused.value = false
  spawnWave(1)
  buildBunkers()
  lastUfoAt = Date.now()
  startCountdown()
}

// ── Countdown ──────────────────────────────────────────────────────────
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

// ── Pause ──────────────────────────────────────────────────────────────
function togglePause() {
  if (game.state.value !== 'playing') return
  isPaused.value = !isPaused.value
  if (soundEnabled.value) playPauseTone()
}

function toggleSound() {
  soundEnabled.value = !soundEnabled.value
  setArcadeSoundEnabled(soundEnabled.value)
  if (soundEnabled.value) {
    unlockArcadeSound()
    playEatTone()
  }
}

// ── Boucle principale ──────────────────────────────────────────────────
function startLoop() {
  stopLoop()
  const loop = () => {
    if (game.state.value !== 'playing') return
    if (!isPaused.value) update()
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

  // Joueur
  if (keys.has('arrowleft') || keys.has('q') || keys.has('a')) {
    playerX.value = Math.max(0, playerX.value - PLAYER_SPEED)
  }
  if (keys.has('arrowright') || keys.has('d')) {
    playerX.value = Math.min(W - PLAYER_W, playerX.value + PLAYER_SPEED)
  }

  // Tir joueur (single ou triple selon power-up)
  if ((keys.has(' ') || keys.has('space')) && Date.now() - lastShotAt > cooldownNow.value) {
    lastShotAt = Date.now()
    const cx = playerX.value + PLAYER_W / 2
    if (tripleActive.value) {
      bullets.value.push(
        { x: cx,        y: PLAYER_Y, vy: -BULLET_SPEED },
        { x: cx - 14,   y: PLAYER_Y + 4, vy: -BULLET_SPEED },
        { x: cx + 14,   y: PLAYER_Y + 4, vy: -BULLET_SPEED },
      )
    } else {
      bullets.value.push({ x: cx, y: PLAYER_Y, vy: -BULLET_SPEED })
    }
    if (soundEnabled.value) playLaserTone()
  }

  // Bullets joueur
  bullets.value = bullets.value.map((b) => ({ ...b, y: b.y + b.vy })).filter((b) => b.y > -10)

  // Aliens
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

  // Tirs aliens
  for (const a of aliens.value) {
    if (!a.alive) continue
    if (Math.random() < ALIEN_BULLET_CHANCE) {
      alienBullets.value.push({ x: a.x + ALIEN_W / 2, y: a.y + ALIEN_H, vy: ALIEN_BULLET_SPEED })
    }
  }
  alienBullets.value = alienBullets.value.map((b) => ({ ...b, y: b.y + b.vy })).filter((b) => b.y < H + 10)

  // UFO bonus : spawn occasionnel
  if (!ufo.value && Date.now() - lastUfoAt > UFO_INTERVAL_MS && Math.random() < 0.4) {
    const fromLeft = Math.random() < 0.5
    const points = [50, 100, 200][Math.floor(Math.random() * 3)]
    ufo.value = {
      x: fromLeft ? -UFO_W : W,
      vx: fromLeft ? UFO_SPEED : -UFO_SPEED,
      points,
      alive: true,
    }
    lastUfoAt = Date.now()
    if (soundEnabled.value) playEatTone()  // tone d'apparition discret
  }
  if (ufo.value) {
    ufo.value.x += ufo.value.vx
    if (ufo.value.x < -UFO_W - 10 || ufo.value.x > W + 10) ufo.value = null
  }

  // Power-ups qui tombent
  powerups.value = powerups.value.map((p) => ({ ...p, y: p.y + POWERUP_FALL_SPEED })).filter((p) => p.y < H)
  // Pickup au contact joueur
  for (let i = powerups.value.length - 1; i >= 0; i--) {
    const p = powerups.value[i]
    if (p.x + POWERUP_SIZE >= playerX.value
      && p.x <= playerX.value + PLAYER_W
      && p.y + POWERUP_SIZE >= PLAYER_Y) {
      applyPowerUp(p.kind)
      powerups.value.splice(i, 1)
    }
  }

  // Collisions bullets joueur <-> aliens
  const remainingBullets: Bullet[] = []
  for (const b of bullets.value) {
    let hit = false
    // UFO en priorite (passe au-dessus des aliens)
    if (ufo.value
      && b.x >= ufo.value.x && b.x <= ufo.value.x + UFO_W
      && b.y >= UFO_Y && b.y <= UFO_Y + UFO_H) {
      const ufoPoints = ufo.value.points * (1 + (wave.value - 1) * 0.2)
      game.addScore(Math.round(ufoPoints))
      spawnExplosion(ufo.value.x + UFO_W / 2, UFO_Y + UFO_H / 2, '#facc15', 30)
      if (soundEnabled.value) playPowerUpTone()
      ufo.value = null
      hit = true
    }
    // Aliens
    if (!hit) {
      for (const a of aliens.value) {
        if (!a.alive) continue
        if (b.x >= a.x && b.x <= a.x + ALIEN_W && b.y >= a.y && b.y <= a.y + ALIEN_H) {
          a.alive = false
          const points = alienPoints(a.row) * (1 + (wave.value - 1) * 0.2)
          game.addScore(Math.round(points))
          spawnExplosion(a.x + ALIEN_W / 2, a.y + ALIEN_H / 2, alienColor(a.row), 14)
          if (soundEnabled.value) playExplosionTone()
          // Drop power-up ?
          if (Math.random() < POWERUP_DROP_CHANCE) {
            const kind = randomPowerKind()
            powerups.value.push({ x: a.x + ALIEN_W / 2 - POWERUP_SIZE / 2, y: a.y + ALIEN_H, kind })
          }
          hit = true
          break
        }
      }
    }
    // Bunkers (cassent les bullets aussi quand le joueur tire à travers)
    if (!hit) {
      for (let i = bunkers.value.length - 1; i >= 0; i--) {
        const blk = bunkers.value[i]
        if (!blk.alive) continue
        if (b.x >= blk.x && b.x < blk.x + BUNKER_BLOCK && b.y >= blk.y && b.y < blk.y + BUNKER_BLOCK) {
          blk.alive = false
          spawnExplosion(blk.x + BUNKER_BLOCK / 2, blk.y + BUNKER_BLOCK / 2, '#34d399', 4)
          hit = true
          break
        }
      }
    }
    if (!hit) remainingBullets.push(b)
  }
  bullets.value = remainingBullets

  // Tirs aliens <-> joueur + bunkers
  const remainingAlienBullets: Bullet[] = []
  for (const b of alienBullets.value) {
    let consumed = false
    // Bunker absorbe
    for (let i = bunkers.value.length - 1; i >= 0; i--) {
      const blk = bunkers.value[i]
      if (!blk.alive) continue
      if (b.x >= blk.x && b.x < blk.x + BUNKER_BLOCK && b.y >= blk.y && b.y < blk.y + BUNKER_BLOCK) {
        blk.alive = false
        spawnExplosion(blk.x + BUNKER_BLOCK / 2, blk.y + BUNKER_BLOCK / 2, '#34d399', 4)
        consumed = true
        break
      }
    }
    if (consumed) continue
    // Player
    const hitsPlayer =
      b.x >= playerX.value && b.x <= playerX.value + PLAYER_W &&
      b.y >= PLAYER_Y && b.y <= PLAYER_Y + PLAYER_H
    if (hitsPlayer) {
      if (hasShield.value) {
        hasShield.value = false
        spawnExplosion(playerX.value + PLAYER_W / 2, PLAYER_Y, '#22d3ee', 20)
        if (soundEnabled.value) playEatTone()
      } else {
        lives.value -= 1
        spawnExplosion(playerX.value + PLAYER_W / 2, PLAYER_Y, '#f87171', 22)
        if (soundEnabled.value) playExplosionTone()
        if (lives.value <= 0) return gameOver('Eliminated')
      }
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
    // Bunkers rebuild tous les 3 vagues (peuvent etre completement detruits sinon)
    if (wave.value % 3 === 1) buildBunkers()
  }

  // Particles
  updateParticles()
}

function alienPoints(row: number): number {
  if (row === 0) return 40
  if (row === 1) return 20
  return 10
}
function alienColor(row: number): string {
  return row === 0 ? '#ef4444' : row === 1 ? '#f59e0b' : '#22c55e'
}

function randomPowerKind(): PowerKind {
  const r = Math.random()
  if (r < 0.30) return 'triple'
  if (r < 0.60) return 'rapid'
  if (r < 0.85) return 'shield'
  return 'life'
}

function applyPowerUp(kind: PowerKind) {
  if (soundEnabled.value) playPowerUpTone()
  if (kind === 'triple') {
    buffs.value.triple = Date.now() + POWERUP_DURATION_MS
  } else if (kind === 'rapid') {
    buffs.value.rapid = Date.now() + POWERUP_DURATION_MS
  } else if (kind === 'shield') {
    hasShield.value = true
  } else if (kind === 'life') {
    lives.value = Math.min(MAX_LIVES, lives.value + 1)
  }
}

function spawnExplosion(cx: number, cy: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4
    const speed = 1 + Math.random() * 3
    particles.value.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.04 + Math.random() * 0.02,
      color,
      size: 1.5 + Math.random() * 2.5,
    })
  }
}

function updateParticles() {
  if (particles.value.length === 0) return
  particles.value = particles.value
    .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.05, life: p.life - p.decay }))
    .filter((p) => p.life > 0)
}

function gameOver(reason: string) {
  gameOverReason.value = reason
  stopLoop()
  if (soundEnabled.value) playGameOverTone()
  game.endRun({ wave: wave.value, livesLeft: lives.value })
}

// ── Rendu ──────────────────────────────────────────────────────────────
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
    const x = ((i * 127) % W)
    const y = ((i * 311) % H)
    ctx.fillRect(x, y, 1, 1)
  }

  // UFO
  if (ufo.value) {
    ctx.fillStyle = '#facc15'
    ctx.beginPath()
    ctx.ellipse(ufo.value.x + UFO_W / 2, UFO_Y + UFO_H / 2, UFO_W / 2, UFO_H / 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fef3c7'
    ctx.beginPath()
    ctx.ellipse(ufo.value.x + UFO_W / 2, UFO_Y + UFO_H / 2 - 2, UFO_W / 4, UFO_H / 3, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Aliens
  for (const a of aliens.value) {
    if (!a.alive) continue
    ctx.fillStyle = alienColor(a.row)
    ctx.fillRect(a.x + 6, a.y + 6, ALIEN_W - 12, ALIEN_H - 10)
    ctx.fillRect(a.x, a.y + 10, 6, 8)
    ctx.fillRect(a.x + ALIEN_W - 6, a.y + 10, 6, 8)
    ctx.fillStyle = '#0a0e1a'
    ctx.fillRect(a.x + 12, a.y + 12, 4, 4)
    ctx.fillRect(a.x + ALIEN_W - 16, a.y + 12, 4, 4)
  }

  // Bunkers (chaque block individuel)
  ctx.fillStyle = '#34d399'
  for (const blk of bunkers.value) {
    if (!blk.alive) continue
    ctx.fillRect(blk.x, blk.y, BUNKER_BLOCK, BUNKER_BLOCK)
  }

  // Power-ups qui tombent
  for (const p of powerups.value) {
    drawPowerUp(ctx, p)
  }

  // Particles
  particles.value.forEach((p) => {
    const m = p.color.match(/^#([0-9a-f]{6})$/i)
    if (m) {
      const r = parseInt(m[1].slice(0,2), 16)
      const g = parseInt(m[1].slice(2,4), 16)
      const bb = parseInt(m[1].slice(4,6), 16)
      ctx.fillStyle = `rgba(${r},${g},${bb},${p.life})`
    } else {
      ctx.fillStyle = p.color
    }
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
    ctx.fill()
  })

  // Joueur (triangle vaisseau + shield si actif)
  ctx.fillStyle = '#22d3ee'
  ctx.beginPath()
  ctx.moveTo(playerX.value + PLAYER_W / 2, PLAYER_Y)
  ctx.lineTo(playerX.value, PLAYER_Y + PLAYER_H)
  ctx.lineTo(playerX.value + PLAYER_W, PLAYER_Y + PLAYER_H)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#67e8f9'
  ctx.fillRect(playerX.value + PLAYER_W / 2 - 2, PLAYER_Y - 4, 4, 6)

  // Shield bubble
  if (hasShield.value) {
    ctx.strokeStyle = 'rgba(96, 165, 250, .85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(playerX.value + PLAYER_W / 2, PLAYER_Y + PLAYER_H / 2, PLAYER_W / 2 + 10, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Bullets joueur (triple shot teint different si actif)
  ctx.fillStyle = tripleActive.value ? '#a78bfa' : '#fde047'
  for (const b of bullets.value) ctx.fillRect(b.x - 1, b.y, 3, 10)

  // Bullets aliens
  ctx.fillStyle = '#f87171'
  for (const b of alienBullets.value) ctx.fillRect(b.x - 1, b.y, 3, 10)
}

function drawPowerUp(ctx: CanvasRenderingContext2D, p: PowerUp) {
  const colors: Record<PowerKind, string> = {
    triple: '#a78bfa',
    rapid:  '#f59e0b',
    shield: '#60a5fa',
    life:   '#22c55e',
  }
  const labels: Record<PowerKind, string> = { triple: '3x', rapid: '⚡', shield: '◎', life: '+1' }
  // Tile carre arrondi pulsant
  const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.06
  const size = POWERUP_SIZE * pulse
  ctx.fillStyle = colors[p.kind]
  const x = p.x - (size - POWERUP_SIZE) / 2
  const y = p.y - (size - POWERUP_SIZE) / 2
  ctx.beginPath()
  ctx.roundRect(x, y, size, size, 4)
  ctx.fill()
  ctx.fillStyle = '#0a0e1a'
  ctx.font = 'bold 11px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(labels[p.kind], p.x + POWERUP_SIZE / 2, p.y + POWERUP_SIZE / 2 + 1)
}

// ── Input ──────────────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') { router.push('/jeux'); return }
  if (e.key === ' ' || e.code === 'Space') {
    if (game.state.value !== 'playing' && countdownValue.value < 0) {
      e.preventDefault()
      startGame()
      return
    }
    e.preventDefault()
    keys.add(' ')
  }
  if (e.key.toLowerCase() === 'p' && game.state.value === 'playing') {
    e.preventDefault()
    togglePause()
    return
  }
  keys.add(e.key.toLowerCase())
}

function onKeyup(e: KeyboardEvent) {
  keys.delete(e.key.toLowerCase())
  if (e.key === ' ' || e.code === 'Space') keys.delete(' ')
}

// ── Lifecycle ──────────────────────────────────────────────────────────
onMounted(async () => {
  unlockArcadeSound()
  await game.refreshLeaderboard()
  await game.refreshMyStats()
  spawnWave(1)
  buildBunkers()
  render()
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('keyup', onKeyup)
})

onBeforeUnmount(() => {
  stopLoop()
  cancelCountdown()
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('keyup', onKeyup)
})

watch(isPaused, (p) => { if (p && soundEnabled.value) keys.clear() })

// ── Derivees ───────────────────────────────────────────────────────────
const allTimeBest = computed(() => game.myStats.value?.allTime.bestScore ?? 0)
const isPersonalBest = computed(() =>
  game.state.value === 'done' && game.lastResult.value != null && game.lastResult.value.score > allTimeBest.value,
)
const currentRank = computed(() => {
  if (!appStore.currentUser) return null
  return game.leaderboard.value.find((e) => e.name === appStore.currentUser?.name)?.rank ?? null
})

const buffTimers = computed(() => {
  const now = Date.now()
  return {
    triple: tripleActive.value ? Math.max(0, Math.ceil((buffs.value.triple - now) / 1000)) : 0,
    rapid:  rapidActive.value  ? Math.max(0, Math.ceil((buffs.value.rapid  - now) / 1000)) : 0,
  }
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

      <button
        class="si-icon-btn"
        :class="{ 'is-off': !soundEnabled }"
        :title="soundEnabled ? 'Couper le son' : 'Activer le son'"
        @click="toggleSound"
      >
        <component :is="soundEnabled ? Volume2 : VolumeX" :size="16" />
      </button>

      <!-- Buffs actifs (timer) -->
      <div v-if="tripleActive || rapidActive || hasShield" class="si-buffs">
        <span v-if="tripleActive" class="si-buff" :style="{ '--c': '#a78bfa' }" :title="`Triple shot ${buffTimers.triple}s`">
          <Crosshair :size="11" /> {{ buffTimers.triple }}
        </span>
        <span v-if="rapidActive" class="si-buff" :style="{ '--c': '#f59e0b' }" :title="`Rapid fire ${buffTimers.rapid}s`">
          <Zap :size="11" /> {{ buffTimers.rapid }}
        </span>
        <span v-if="hasShield" class="si-buff" :style="{ '--c': '#60a5fa' }" title="Shield actif (1 hit)">
          <ShieldIcon :size="11" />
        </span>
      </div>

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

          <div v-if="game.state.value === 'idle' && countdownValue < 0" class="si-overlay">
            <h2>Space Invaders</h2>
            <p>Detruis les vagues. Choppe les power-ups <Crosshair :size="11" /> <Zap :size="11" /> <ShieldIcon :size="11" /> qui tombent.</p>
            <p class="si-hint-keys">
              <kbd>←</kbd><kbd>→</kbd> ou <kbd>QD</kbd> · <kbd>Espace</kbd> tirer/demarrer · <kbd>P</kbd> pause
            </p>
            <button class="si-btn-primary" @click="startGame">
              <Play :size="16" /> Jouer <kbd>Espace</kbd>
            </button>
          </div>

          <div v-if="countdownValue >= 0" class="si-overlay si-overlay--countdown">
            <div :key="countdownValue" class="si-countdown">
              {{ countdownValue > 0 ? countdownValue : 'GO !' }}
            </div>
          </div>

          <div v-if="isPaused" class="si-overlay si-overlay--pause">
            <Pause :size="42" />
            <h2>En pause</h2>
            <p><kbd>P</kbd> ou <kbd>Espace</kbd> pour reprendre</p>
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
          <kbd>←</kbd><kbd>→</kbd> deplacer · <kbd>Espace</kbd> tirer · <kbd>P</kbd> pause · <kbd>Esc</kbd> quitter
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
  flex-wrap: wrap;
}
.si-icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: var(--radius-sm);
  border: none; background: transparent; color: var(--text-secondary);
  cursor: pointer; transition: background .12s, color .12s;
}
.si-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.si-icon-btn.is-off { color: var(--text-muted); }

.si-brand { font-size: 13px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; }
.si-spacer { flex: 1; }

.si-buffs {
  display: inline-flex; align-items: center; gap: 6px;
}
.si-buff {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 999px;
  background: color-mix(in srgb, var(--c) 20%, transparent);
  color: var(--c);
  font-size: 11px; font-weight: 800;
  font-variant-numeric: tabular-nums;
  border: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
}

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
  border-radius: var(--radius);
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
.si-hint-keys { font-size: 11px; opacity: .65; }

.si-overlay--countdown {
  background: rgba(5, 8, 21, .55);
  pointer-events: none;
}
.si-countdown {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: clamp(120px, 18vw, 200px);
  font-weight: 900;
  color: #22d3ee;
  letter-spacing: -8px;
  line-height: 1;
  text-shadow: 0 0 60px rgba(34, 211, 238, .55);
  animation: si-countdown-pop .6s cubic-bezier(.34, 1.56, .64, 1);
}
@keyframes si-countdown-pop {
  0%   { opacity: 0; transform: scale(.4); }
  50%  { opacity: 1; transform: scale(1.18); }
  100% { opacity: 1; transform: scale(1); }
}

.si-overlay--pause svg { color: #22d3ee; }

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
.si-over-meta { display: flex; gap: 10px; font-size: 12px; color: rgba(255,255,255,.6); flex-wrap: wrap; justify-content: center; }

.si-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 22px;
  background: #22d3ee; color: #0a0e1a;
  border: none; border-radius: var(--radius);
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
.si-help kbd, .si-overlay kbd {
  display: inline-block; padding: 1px 6px; margin: 0 1px;
  border: 1px solid var(--border); border-bottom-width: 2px;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono, monospace);
  font-size: 10px; color: var(--text-secondary);
  background: var(--bg-elevated);
}
.si-overlay kbd {
  background: rgba(255,255,255,.12);
  border-color: rgba(255,255,255,.18);
  color: rgba(255,255,255,.85);
}

.si-sidebar { align-self: stretch; }

@media (max-width: 900px) {
  .si-main { grid-template-columns: 1fr; }
  .si-sidebar { max-height: 260px; }
}

@media (prefers-reduced-motion: reduce) {
  .si-countdown { animation: none !important; }
}
</style>
