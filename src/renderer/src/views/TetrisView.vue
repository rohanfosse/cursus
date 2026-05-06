/**
 * TetrisView — mini-jeu Tetris moderne (v2.296).
 *
 * Features modernes :
 *   1. SRS rotations + wall kicks (incl. T-spin detection 3-corner)
 *   2. 7-bag randomizer + queue de 5 pieces visibles (panneau "Next")
 *   3. Hold piece (Shift / C) avec swap unique par drop
 *   4. Ghost piece (silhouette de l atterrissage)
 *   5. Hard drop (Espace) + soft drop (Bas) avec scoring distinct
 *   6. Lock delay 500 ms avec reset sur mouvement / rotation (15 max — anti-stall)
 *   7. Scoring Guideline complet : combos, back-to-back, T-spins
 *   8. Levels 1..20 avec gravity exponentielle
 *   9. Line clear avec flash + particles + screen shake sur Tetris
 *  10. Sons synthetises (lock, rotate, hold, line clear, tetris, t-spin, level-up)
 *
 * Controles :
 *   ←/→  ou Q/D : deplacer
 *   ↓    ou S   : soft drop
 *   Espace      : hard drop
 *   ↑/X/W/Z     : rotation horaire
 *   Ctrl/Y      : rotation anti-horaire
 *   Shift/C     : hold
 *   P / Esc     : pause
 */
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Play, RotateCw, Pause, Volume2, VolumeX, Sparkles, Flame } from 'lucide-vue-next'
import { useArcadeGame } from '@/composables/useArcadeGame'
import { useAppStore } from '@/stores/app'
import GameSidebar from '@/components/games/GameSidebar.vue'
import { GAMES } from '@/games/registry'
import {
  BOARD_W, BOARD_H, BOARD_BUFFER,
  emptyBoard, spawnPiece, isValidPosition, tryMove, tryRotate, ghostPiece,
  lockPiece, clearLines, detectTSpin, computeScore, gravityMs, levelFromLines,
  hardDropDistance, isTopOut, refillQueue, keyToAction, pieceCells,
  type Piece, type PieceKind, type Board, type TSpinType, type TetrisAction,
} from '@/games/tetrisEngine'
import {
  isArcadeSoundEnabled, setArcadeSoundEnabled, unlockArcadeSound,
  playGameOverTone, playCountdownTone, playPauseTone,
  playLockTone, playHardDropTone, playRotateTone, playHoldTone,
  playLineClearTone, playTSpinTone, playLevelUpTone,
} from '@/utils/arcadeSounds'

const gameMeta = GAMES.find(g => g.id === 'tetris')

const router = useRouter()
const appStore = useAppStore()
const game = useArcadeGame('tetris')

const CELL = 30                       // taille d'une cellule en px
const BOARD_PIXEL_W = BOARD_W * CELL  // 300
const BOARD_PIXEL_H = BOARD_H * CELL  // 600

// ── Etat du jeu ────────────────────────────────────────────────────────────
const board = ref<Board>(emptyBoard())
const current = ref<Piece | null>(null)
const queue = ref<PieceKind[]>([])
const hold = ref<PieceKind | null>(null)
const canHold = ref(true)
const linesCleared = ref(0)
const level = ref(1)
const combo = ref(-1)
const backToBack = ref(false)
const lastClearLabel = ref<string | null>(null)
const labelFlashKey = ref(0)

const gameOver = ref(false)
const isPaused = ref(false)
const countdownValue = ref(-1)
const soundEnabled = ref(isArcadeSoundEnabled())

// Lock delay : la piece ne se vrouille qu'apres 500 ms en contact, mais
// chaque mouvement / rotation reset le timer (max 15 resets pour eviter
// le stall infini classique en Tetris moderne).
const LOCK_DELAY_MS = 500
const LOCK_RESET_MAX = 15
const lockTimer = ref<number | null>(null)
const lockResetCount = ref(0)
const isLocking = ref(false)

const tickCount = ref(0)
let gravityInterval: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setTimeout> | null = null
let lastKickIndex = -1     // -1 = derniere action n'etait pas une rotation
let softDropDistance = 0   // pour scoring du soft drop

// Particles + flash + shake (game feel)
interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number
  decay: number
  color: string
  size: number
}
const particles = ref<Particle[]>([])
const flashIntensity = ref(0)
const shakeIntensity = ref(0)  // px de decalage aleatoire pendant N frames
const clearingRows = ref<number[]>([])  // rangees en cours d'animation de clear
const clearAnimStart = ref(0)
const CLEAR_ANIM_MS = 220

const canvasRef = ref<HTMLCanvasElement | null>(null)
const animationFrameId = ref<number | null>(null)

// ── Couleurs SRS standard ──────────────────────────────────────────────────
const PIECE_COLORS: Record<PieceKind, { core: string; light: string; shadow: string }> = {
  I: { core: '#22d3ee', light: '#67e8f9', shadow: '#0e7490' },  // Cyan
  O: { core: '#facc15', light: '#fde047', shadow: '#a16207' },  // Jaune
  T: { core: '#a855f7', light: '#c084fc', shadow: '#6b21a8' },  // Violet
  S: { core: '#22c55e', light: '#4ade80', shadow: '#15803d' },  // Vert
  Z: { core: '#ef4444', light: '#f87171', shadow: '#b91c1c' },  // Rouge
  J: { core: '#3b82f6', light: '#60a5fa', shadow: '#1d4ed8' },  // Bleu
  L: { core: '#f97316', light: '#fb923c', shadow: '#c2410c' },  // Orange
}

// ── Reset / Init ───────────────────────────────────────────────────────────
function initGame() {
  board.value = emptyBoard()
  queue.value = refillQueue([], 7, Math.random)
  current.value = null
  hold.value = null
  canHold.value = true
  linesCleared.value = 0
  level.value = 1
  combo.value = -1
  backToBack.value = false
  lastClearLabel.value = null
  particles.value = []
  flashIntensity.value = 0
  shakeIntensity.value = 0
  clearingRows.value = []
  gameOver.value = false
  isPaused.value = false
  tickCount.value = 0
  lastKickIndex = -1
  softDropDistance = 0
  cancelLockTimer()
}

function spawnNext(): boolean {
  // Pop de la queue + refill si besoin
  let q = queue.value
  if (q.length < 5) q = refillQueue(q, 7, Math.random)
  const kind = q[0]
  queue.value = q.slice(1)
  const piece = spawnPiece(kind)

  // Top-out check : si la piece spawne deja en collision → game over
  if (!isValidPosition(board.value, piece)) {
    current.value = piece
    triggerGameOver()
    return false
  }
  current.value = piece
  canHold.value = true
  lastKickIndex = -1
  cancelLockTimer()
  return true
}

// ── Countdown ──────────────────────────────────────────────────────────────
function startGame() {
  initGame()
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
      game.startRun()
      spawnNext()
      startGravity()
      startRenderLoop()
    } else {
      tickCountdown()
    }
  }, 700)
}

function cancelCountdown() {
  if (countdownTimer) { clearTimeout(countdownTimer); countdownTimer = null }
  countdownValue.value = -1
}

// ── Gravity loop ───────────────────────────────────────────────────────────
function startGravity() {
  stopGravity()
  gravityInterval = setInterval(() => {
    if (game.state.value !== 'playing' || isPaused.value || clearingRows.value.length > 0) return
    softGravityStep()
  }, gravityMs(level.value))
}

function stopGravity() {
  if (gravityInterval) { clearInterval(gravityInterval); gravityInterval = null }
}

/** Tick de gravite : descend la piece de 1, ou demarre/maintient le lock timer. */
function softGravityStep() {
  if (!current.value) return
  const moved = tryMove(board.value, current.value, 0, 1)
  if (moved) {
    current.value = moved
    isLocking.value = false
    cancelLockTimer()
  } else {
    // En contact avec une surface — armer le lock timer
    armLockTimer()
  }
  game.tick()
  tickCount.value++
}

// ── Lock delay ─────────────────────────────────────────────────────────────
function armLockTimer() {
  if (lockTimer.value != null) return  // deja arme
  isLocking.value = true
  lockTimer.value = window.setTimeout(() => {
    lockTimer.value = null
    lockCurrentPiece()
  }, LOCK_DELAY_MS)
}

function cancelLockTimer() {
  if (lockTimer.value != null) {
    clearTimeout(lockTimer.value)
    lockTimer.value = null
  }
  isLocking.value = false
}

/** Reset le lock timer si on a encore du budget de resets (anti-stall). */
function bumpLockTimer() {
  if (lockTimer.value == null) return
  if (lockResetCount.value >= LOCK_RESET_MAX) return
  clearTimeout(lockTimer.value)
  lockResetCount.value++
  lockTimer.value = window.setTimeout(() => {
    lockTimer.value = null
    lockCurrentPiece()
  }, LOCK_DELAY_MS)
}

// ── Verrouillage de la piece + clear ───────────────────────────────────────
function lockCurrentPiece() {
  if (!current.value || gameOver.value) return
  const locked = current.value
  const tspinType: TSpinType = detectTSpin(board.value, locked, lastKickIndex)
  let newBoard = lockPiece(board.value, locked)

  // Verifier top-out apres lock (piece entierement dans le buffer)
  if (isTopOut(newBoard, locked)) {
    board.value = newBoard
    triggerGameOver()
    return
  }

  // Bonus soft drop : 1 pt par cellule descendue manuellement
  if (softDropDistance > 0) {
    game.addScore(softDropDistance)
    softDropDistance = 0
  }

  // Detection des lignes a effacer
  const result = clearLines(newBoard)
  if (result.cleared > 0) {
    // Joue l'animation de clear avant d'appliquer le nouveau plateau
    clearingRows.value = result.lineYs
    clearAnimStart.value = performance.now()
    if (soundEnabled.value) playLineClearTone(result.cleared)
    if (tspinType !== 'none' && soundEnabled.value) playTSpinTone()
    if (result.cleared >= 4) {
      shakeIntensity.value = 14
      flashIntensity.value = 1
    } else {
      shakeIntensity.value = 4
      flashIntensity.value = 0.4
    }

    // Particles sur les lignes effacees
    for (const y of result.lineYs) {
      for (let x = 0; x < BOARD_W; x++) {
        spawnLineParticles(x, y, board.value[y][x])
      }
    }

    // Score
    const scoreCtx = { level: level.value, combo: combo.value, backToBack: backToBack.value }
    const scored = computeScore(result.cleared, tspinType, scoreCtx)
    game.addScore(scored.points)
    combo.value = scored.newCombo
    backToBack.value = scored.newBackToBack
    if (scored.label) {
      lastClearLabel.value = scored.label
      labelFlashKey.value = Date.now()
    }

    // Level-up ?
    const totalLines = linesCleared.value + result.cleared
    const newLevel = levelFromLines(totalLines)
    if (newLevel > level.value) {
      level.value = newLevel
      if (soundEnabled.value) playLevelUpTone()
      restartGravityForLevel()
    }
    linesCleared.value = totalLines

    // Apres le delai de l'animation, applique le board sans les lignes
    setTimeout(() => {
      board.value = result.board
      clearingRows.value = []
      lockResetCount.value = 0
      if (soundEnabled.value) playLockTone()
      spawnNext()
    }, CLEAR_ANIM_MS)
  } else {
    // Pas de clear : on reset le combo et on enchaine
    board.value = newBoard
    combo.value = -1
    lockResetCount.value = 0
    if (soundEnabled.value) playLockTone()
    spawnNext()
  }
}

function restartGravityForLevel() {
  stopGravity()
  gravityInterval = setInterval(() => {
    if (game.state.value !== 'playing' || isPaused.value || clearingRows.value.length > 0) return
    softGravityStep()
  }, gravityMs(level.value))
}

function triggerGameOver() {
  gameOver.value = true
  stopGravity()
  cancelLockTimer()
  if (soundEnabled.value) playGameOverTone()
  game.endRun({
    linesCleared: linesCleared.value,
    finalLevel:   level.value,
    bestCombo:    Math.max(0, combo.value),
  })
}

// ── Actions ────────────────────────────────────────────────────────────────
function doAction(action: TetrisAction) {
  if (game.state.value !== 'playing' || gameOver.value) return
  if (action === 'pause') { togglePause(); return }
  if (isPaused.value || clearingRows.value.length > 0) return
  if (!current.value) return

  if (action === 'left' || action === 'right') {
    const dx = action === 'left' ? -1 : 1
    const moved = tryMove(board.value, current.value, dx, 0)
    if (moved) {
      current.value = moved
      lastKickIndex = -1
      bumpLockTimer()
    }
    return
  }

  if (action === 'softDrop') {
    const moved = tryMove(board.value, current.value, 0, 1)
    if (moved) {
      current.value = moved
      softDropDistance++
      lastKickIndex = -1
      cancelLockTimer()
    } else {
      armLockTimer()
    }
    return
  }

  if (action === 'hardDrop') {
    const dist = hardDropDistance(board.value, current.value)
    if (dist > 0) current.value = { ...current.value, y: current.value.y + dist }
    game.addScore(dist * 2)  // hard drop = 2 pts par cellule
    if (soundEnabled.value) playHardDropTone()
    shakeIntensity.value = Math.max(shakeIntensity.value, 3)
    cancelLockTimer()
    lockCurrentPiece()
    return
  }

  if (action === 'rotateCw' || action === 'rotateCcw') {
    const dir = action === 'rotateCw' ? 1 : -1
    const result = tryRotate(board.value, current.value, dir as 1 | -1)
    if (result) {
      current.value = result.piece
      lastKickIndex = result.kick
      if (soundEnabled.value) playRotateTone()
      bumpLockTimer()
    }
    return
  }

  if (action === 'hold') {
    if (!canHold.value) return
    const swap = hold.value
    hold.value = current.value.kind
    canHold.value = false
    cancelLockTimer()
    if (swap) {
      current.value = spawnPiece(swap)
      if (!isValidPosition(board.value, current.value)) {
        triggerGameOver()
        return
      }
    } else {
      spawnNext()
    }
    if (soundEnabled.value) playHoldTone()
    return
  }
}

// ── Pause ──────────────────────────────────────────────────────────────────
function togglePause() {
  if (game.state.value !== 'playing') return
  isPaused.value = !isPaused.value
  if (soundEnabled.value) playPauseTone()
}

// ── Sound toggle ───────────────────────────────────────────────────────────
function toggleSound() {
  soundEnabled.value = !soundEnabled.value
  setArcadeSoundEnabled(soundEnabled.value)
  if (soundEnabled.value) {
    unlockArcadeSound()
    playRotateTone()
  }
}

// ── Particles ──────────────────────────────────────────────────────────────
function spawnLineParticles(x: number, y: number, kind: PieceKind | null) {
  const colors = kind ? PIECE_COLORS[kind] : PIECE_COLORS.I
  const cx = x * CELL + CELL / 2
  // Adjust pour le buffer : les y >= BUFFER sont visibles a y - BUFFER
  const cy = (y - BOARD_BUFFER) * CELL + CELL / 2
  const rgb = hexToRgb(colors.core)
  for (let i = 0; i < 4; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = 1 + Math.random() * 3
    particles.value.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 1,
      decay: 0.025 + Math.random() * 0.025,
      color: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b},`,
      size: 2 + Math.random() * 3,
    })
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function updateParticles() {
  if (particles.value.length === 0) return
  particles.value = particles.value
    .map(p => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      vy: p.vy + 0.18,  // gravite
      life: p.life - p.decay,
    }))
    .filter(p => p.life > 0)
}

// ── Render loop (60 fps) ───────────────────────────────────────────────────
function startRenderLoop() {
  if (animationFrameId.value != null) return
  const tick = () => {
    render()
    if (flashIntensity.value > 0) flashIntensity.value = Math.max(0, flashIntensity.value - 0.04)
    if (shakeIntensity.value > 0) shakeIntensity.value = Math.max(0, shakeIntensity.value - 0.8)
    updateParticles()
    animationFrameId.value = requestAnimationFrame(tick)
  }
  animationFrameId.value = requestAnimationFrame(tick)
}

function stopRenderLoop() {
  if (animationFrameId.value != null) {
    cancelAnimationFrame(animationFrameId.value)
    animationFrameId.value = null
  }
}

// ── Rendu canvas ───────────────────────────────────────────────────────────
function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Screen shake
  const shakeX = shakeIntensity.value > 0 ? (Math.random() - 0.5) * shakeIntensity.value : 0
  const shakeY = shakeIntensity.value > 0 ? (Math.random() - 0.5) * shakeIntensity.value : 0

  ctx.save()
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Fond avec gradient subtil
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height)
  bgGrad.addColorStop(0, '#0f172a')
  bgGrad.addColorStop(1, '#020617')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.translate(shakeX, shakeY)

  // Flash plein-cadre
  if (flashIntensity.value > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flashIntensity.value * 0.18})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  // Grille subtile
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 1
  for (let x = 1; x < BOARD_W; x++) {
    ctx.beginPath()
    ctx.moveTo(x * CELL + 0.5, 0)
    ctx.lineTo(x * CELL + 0.5, BOARD_PIXEL_H)
    ctx.stroke()
  }
  for (let y = 1; y < BOARD_H; y++) {
    ctx.beginPath()
    ctx.moveTo(0, y * CELL + 0.5)
    ctx.lineTo(BOARD_PIXEL_W, y * CELL + 0.5)
    ctx.stroke()
  }

  // Plateau (ne dessiner que la zone visible : y >= BOARD_BUFFER)
  for (let y = BOARD_BUFFER; y < board.value.length; y++) {
    const visualY = y - BOARD_BUFFER
    const isClearing = clearingRows.value.includes(y)
    if (isClearing) {
      const elapsed = performance.now() - clearAnimStart.value
      const t = Math.min(1, elapsed / CLEAR_ANIM_MS)
      // Animation : flash blanc qui retrecit horizontalement
      const widthRatio = 1 - t
      const offsetX = (BOARD_PIXEL_W * (1 - widthRatio)) / 2
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * (1 - t)})`
      ctx.fillRect(offsetX, visualY * CELL, BOARD_PIXEL_W * widthRatio, CELL)
      continue
    }
    for (let x = 0; x < BOARD_W; x++) {
      const cell = board.value[y][x]
      if (cell) drawBlock(ctx, x, visualY, cell, 1)
    }
  }

  // Ghost piece + piece courante (skip pendant l'animation de clear)
  if (current.value && clearingRows.value.length === 0) {
    const ghost = ghostPiece(board.value, current.value)
    for (const c of pieceCells(ghost)) {
      const visualY = c.y - BOARD_BUFFER
      if (visualY >= 0) drawGhostBlock(ctx, c.x, visualY, current.value.kind)
    }
    for (const c of pieceCells(current.value)) {
      const visualY = c.y - BOARD_BUFFER
      if (visualY >= 0) {
        drawBlock(
          ctx, c.x, visualY, current.value.kind,
          isLocking.value ? 0.65 + Math.sin(performance.now() / 100) * 0.2 : 1,
        )
      }
    }
  }

  // Particles
  for (const p of particles.value) {
    ctx.fillStyle = `${p.color}${p.life})`
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, kind: PieceKind,
  alpha: number,
) {
  const colors = PIECE_COLORS[kind]
  const px = x * CELL
  const py = y * CELL

  ctx.globalAlpha = alpha
  // Fond avec gradient
  const grad = ctx.createLinearGradient(px, py, px, py + CELL)
  grad.addColorStop(0, colors.light)
  grad.addColorStop(1, colors.core)
  ctx.fillStyle = grad
  ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2)

  // Reflet sup/gauche
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
  ctx.fillRect(px + 1, py + 1, CELL - 2, 3)
  ctx.fillRect(px + 1, py + 1, 3, CELL - 2)

  // Ombre inf/droite
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
  ctx.fillRect(px + 1, py + CELL - 4, CELL - 2, 3)
  ctx.fillRect(px + CELL - 4, py + 1, 3, CELL - 2)

  // Bordure
  ctx.strokeStyle = colors.shadow
  ctx.lineWidth = 1
  ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1)
  ctx.globalAlpha = 1
}

function drawGhostBlock(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, kind: PieceKind,
) {
  const colors = PIECE_COLORS[kind]
  const px = x * CELL
  const py = y * CELL
  ctx.strokeStyle = colors.core
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.35
  ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4)
  ctx.globalAlpha = 1
}

// ── Mini-canvas pour Hold + Next ───────────────────────────────────────────
//
// Trace une piece centree dans un canvas aux dimensions fixes. Utilise par
// les panneaux Hold et Next.
function drawMiniPiece(canvas: HTMLCanvasElement | null, kind: PieceKind | null, faded = false) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!kind) return

  const cell = 16
  const piece = spawnPiece(kind)
  const cells = pieceCells(piece)
  const xs = cells.map(c => c.x)
  const ys = cells.map(c => c.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const w = (maxX - minX + 1) * cell
  const h = (maxY - minY + 1) * cell
  const offX = Math.round((canvas.width - w) / 2)
  const offY = Math.round((canvas.height - h) / 2)

  const colors = PIECE_COLORS[kind]
  ctx.globalAlpha = faded ? 0.4 : 1
  for (const c of cells) {
    const px = offX + (c.x - minX) * cell
    const py = offY + (c.y - minY) * cell
    const grad = ctx.createLinearGradient(px, py, px, py + cell)
    grad.addColorStop(0, colors.light)
    grad.addColorStop(1, colors.core)
    ctx.fillStyle = grad
    ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(px + 1, py + 1, cell - 2, 2)
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(px + 1, py + cell - 3, cell - 2, 2)
    ctx.strokeStyle = colors.shadow
    ctx.lineWidth = 1
    ctx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1)
  }
  ctx.globalAlpha = 1
}

// Refs des canvases mini : 1 hold + 5 next
const holdCanvasRef = ref<HTMLCanvasElement | null>(null)
const nextCanvasRefs = ref<HTMLCanvasElement[]>([])

watch([hold, canHold], () => {
  drawMiniPiece(holdCanvasRef.value, hold.value, !canHold.value)
})

watch(queue, (q) => {
  for (let i = 0; i < 5; i++) {
    drawMiniPiece(nextCanvasRefs.value[i] ?? null, q[i] ?? null)
  }
}, { deep: true, immediate: true })

// ── Input ──────────────────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && game.state.value !== 'playing') {
    router.push('/jeux')
    return
  }
  // Espace en idle/done = lance une partie
  if ((e.key === ' ' || e.code === 'Space') && game.state.value !== 'playing') {
    e.preventDefault()
    startGame()
    return
  }
  if (game.state.value !== 'playing') return
  if (countdownValue.value >= 0) return

  const action = keyToAction(e.key)
  if (action) {
    e.preventDefault()
    doAction(action)
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(async () => {
  unlockArcadeSound()
  await game.refreshLeaderboard()
  await game.refreshMyStats()
  initGame()
  startRenderLoop()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  stopGravity()
  cancelLockTimer()
  cancelCountdown()
  stopRenderLoop()
  window.removeEventListener('keydown', onKeydown)
})

// ── Derivees ───────────────────────────────────────────────────────────────
const allTimeBest = computed(() => game.myStats.value?.allTime.bestScore ?? 0)
const isPersonalBest = computed(() =>
  game.state.value === 'done' && game.lastResult.value != null && game.lastResult.value.score > allTimeBest.value,
)
const currentRank = computed(() => {
  if (!appStore.currentUser) return null
  return game.leaderboard.value.find(e => e.name === appStore.currentUser?.name)?.rank ?? null
})
const visibleNext = computed(() => queue.value.slice(0, 5))
</script>

<template>
  <div class="tetris-layout" tabindex="-1">
    <header class="t-header">
      <button class="t-icon-btn" aria-label="Retour aux jeux" @click="router.push('/jeux')">
        <ArrowLeft :size="18" />
      </button>
      <span class="t-brand">Tetris</span>
      <span class="t-spacer" />
      <button
        class="t-icon-btn"
        :class="{ 'is-off': !soundEnabled }"
        :title="soundEnabled ? 'Couper le son' : 'Activer le son'"
        :aria-label="soundEnabled ? 'Couper le son' : 'Activer le son'"
        @click="toggleSound"
      >
        <component :is="soundEnabled ? Volume2 : VolumeX" :size="16" />
      </button>
      <div v-if="combo > 0 && game.state.value === 'playing'" class="t-combo-chip">
        <Flame :size="11" />
        <strong>combo ×{{ combo + 1 }}</strong>
      </div>
      <div v-if="backToBack && game.state.value === 'playing'" class="t-b2b-chip">
        B2B
      </div>
      <div class="t-stat-chip">
        <span class="t-stat-label">Niv.</span>
        <span class="t-stat-value">{{ level }}</span>
      </div>
      <div class="t-stat-chip">
        <span class="t-stat-label">Lignes</span>
        <span class="t-stat-value">{{ linesCleared }}</span>
      </div>
      <div class="t-score-chip">
        <span class="t-score-label">Score</span>
        <span class="t-score-value">{{ game.score.value }}</span>
      </div>
    </header>

    <main class="t-main">
      <section class="t-stage">
        <!-- Panneau gauche : Hold -->
        <aside class="t-side-panel">
          <h3 class="t-panel-title">Hold</h3>
          <div class="t-piece-slot" :class="{ 'is-disabled': !canHold }">
            <canvas ref="holdCanvasRef" width="80" height="80" />
          </div>
          <p class="t-panel-hint">
            <kbd>Shift</kbd> ou <kbd>C</kbd>
          </p>
        </aside>

        <!-- Plateau central -->
        <div class="t-canvas-wrap">
          <canvas
            ref="canvasRef"
            :width="BOARD_PIXEL_W"
            :height="BOARD_PIXEL_H"
            class="t-canvas"
            tabindex="0"
            aria-label="Plateau Tetris 10 x 20"
          />

          <!-- Idle overlay -->
          <div v-if="game.state.value === 'idle' && countdownValue < 0" class="t-overlay">
            <h2>Tetris</h2>
            <p>Aligne 4 lignes d'un coup pour le <strong>Tetris</strong>.</p>
            <p class="t-hint-keys">
              <kbd>←→</kbd> deplacer · <kbd>↓</kbd> soft drop · <kbd>Espace</kbd> hard drop
            </p>
            <p class="t-hint-keys">
              <kbd>↑</kbd> tourner · <kbd>Shift</kbd> hold · <kbd>P</kbd> pause
            </p>
            <button class="t-btn-primary" @click="startGame">
              <Play :size="16" /> Jouer <kbd>Espace</kbd>
            </button>
          </div>

          <!-- Countdown -->
          <div v-if="countdownValue >= 0" class="t-overlay t-overlay--countdown">
            <div :key="countdownValue" class="t-countdown">
              {{ countdownValue > 0 ? countdownValue : 'GO !' }}
            </div>
          </div>

          <!-- Pause -->
          <div v-if="isPaused && game.state.value === 'playing'" class="t-overlay t-overlay--pause">
            <Pause :size="42" />
            <h2>En pause</h2>
            <p><kbd>P</kbd> ou <kbd>Esc</kbd> pour reprendre</p>
          </div>

          <!-- Game over -->
          <div v-if="game.state.value === 'done' && game.lastResult.value" class="t-overlay t-overlay--done">
            <div v-if="isPersonalBest" class="t-pb">
              <Sparkles :size="14" /> Record personnel
            </div>
            <h2 class="t-over-title">Game over</h2>
            <div class="t-over-score">
              {{ game.lastResult.value.score }} <span>pts</span>
            </div>
            <div class="t-over-meta">
              <span>{{ linesCleared }} lignes</span>
              <span>Niveau {{ level }}</span>
              <span v-if="currentRank">· #{{ currentRank }} du jour</span>
            </div>
            <button class="t-btn-primary" @click="startGame">
              <RotateCw :size="16" /> Rejouer <kbd>Espace</kbd>
            </button>
          </div>

          <!-- Label flash (Tetris ! T-Spin Double ! etc.) -->
          <Transition name="t-label-flash">
            <div
              v-if="lastClearLabel && game.state.value === 'playing'"
              :key="`label-${labelFlashKey}`"
              class="t-label-flash"
            >
              {{ lastClearLabel }} !
            </div>
          </Transition>
        </div>

        <!-- Panneau droit : Next queue -->
        <aside class="t-side-panel">
          <h3 class="t-panel-title">Next</h3>
          <div class="t-next-stack">
            <div v-for="(_, i) in visibleNext" :key="i" class="t-piece-slot t-piece-slot--small">
              <canvas
                :ref="(el) => { if (el) nextCanvasRefs[i] = el as HTMLCanvasElement }"
                width="68" height="50"
              />
            </div>
          </div>
        </aside>
      </section>

      <p class="t-help">
        <kbd>←→</kbd> · <kbd>↓</kbd> soft · <kbd>Espace</kbd> hard ·
        <kbd>↑</kbd> tourner · <kbd>Shift</kbd> hold · <kbd>P</kbd> pause · <kbd>Esc</kbd> quitter
      </p>

      <GameSidebar
        :leaderboard="game.leaderboard.value"
        :my-stats="game.myStats.value"
        :scope="game.scope.value"
        :current-user-name="appStore.currentUser?.name ?? null"
        :accent="gameMeta?.accent"
        class="t-sidebar"
        @change-scope="(s) => game.setScope(s)"
      />
    </main>
  </div>
</template>

<style scoped>
.tetris-layout {
  display: flex; flex-direction: column;
  height: 100%; overflow: hidden;
  background: radial-gradient(ellipse at top, rgba(168, 85, 247, .12), transparent 60%), var(--bg-canvas);
  outline: none;
}

.t-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 20px; height: 56px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.t-icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: var(--radius-sm);
  border: none; background: transparent; color: var(--text-secondary);
  cursor: pointer; transition: background .12s, color .12s;
}
.t-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.t-icon-btn.is-off { color: var(--text-muted); }

.t-brand { font-size: 13px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase; color: var(--text-primary); }
.t-spacer { flex: 1; }

.t-stat-chip,
.t-score-chip,
.t-combo-chip,
.t-b2b-chip {
  display: inline-flex; align-items: baseline; gap: 6px;
  padding: 4px 12px; border-radius: 999px;
  font-variant-numeric: tabular-nums;
}
.t-stat-chip { background: var(--bg-elevated); color: var(--text-secondary); }
.t-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; font-weight: 700; }
.t-stat-value { font-family: var(--font-mono, ui-monospace, monospace); font-size: 14px; font-weight: 800; color: var(--text-primary); }

.t-score-chip { background: var(--accent-subtle); color: var(--accent); padding: 4px 14px; }
.t-score-label { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; font-weight: 700; }
.t-score-value { font-family: var(--font-mono, ui-monospace, monospace); font-size: 16px; font-weight: 800; }

.t-combo-chip {
  background: rgba(var(--color-warning-rgb), .14);
  color: var(--color-warning);
  font-size: 11px; font-weight: 800;
  align-items: center;
}
.t-b2b-chip {
  background: linear-gradient(90deg, #eab308, #f59e0b);
  color: #1a1a1a;
  font-size: 11px; font-weight: 900;
  letter-spacing: .8px;
  align-items: center;
}

.t-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 280px;
  grid-template-rows: 1fr auto;
  gap: 16px;
  padding: 20px 24px 24px;
  min-height: 0;
  overflow: hidden;
}

.t-stage {
  grid-column: 1;
  grid-row: 1 / span 2;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: center;
  gap: 18px;
  flex-wrap: nowrap;
  min-height: 0;
}

.t-side-panel {
  display: flex; flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100px;
  flex-shrink: 0;
}
.t-panel-title {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  margin: 0;
}
.t-panel-hint {
  font-size: 10px;
  color: var(--text-muted);
  margin: 0;
}
.t-panel-hint kbd {
  display: inline-block;
  padding: 0 4px;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono, monospace);
  font-size: 9px;
  color: var(--text-secondary);
  background: var(--bg-elevated);
}

.t-piece-slot {
  width: 84px; height: 84px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(15, 23, 42, .6);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: opacity .15s;
}
.t-piece-slot.is-disabled { opacity: 0.5; }
.t-piece-slot--small { width: 72px; height: 54px; }

.t-next-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.t-canvas-wrap {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,.35), 0 0 0 1px rgba(168, 85, 247, .15);
}
.t-canvas {
  display: block;
  outline: none;
}

.t-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(2, 6, 23, .85);
  backdrop-filter: blur(4px);
  color: #fff;
  text-align: center;
  padding: 20px;
}
.t-overlay h2 {
  font-size: 32px; font-weight: 800; margin: 0;
  font-family: var(--font-mono, ui-monospace, monospace);
  letter-spacing: -.5px;
}
.t-overlay p { margin: 0; color: rgba(255,255,255,.7); font-size: 12px; }
.t-overlay strong { color: #c084fc; }
.t-hint-keys { font-size: 11px; opacity: .7; }

.t-overlay--countdown { background: rgba(2, 6, 23, .55); pointer-events: none; }
.t-countdown {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: clamp(100px, 14vw, 180px);
  font-weight: 900;
  color: #c084fc;
  letter-spacing: -8px;
  line-height: 1;
  text-shadow: 0 0 60px rgba(168, 85, 247, .55);
  animation: t-countdown-pop .6s cubic-bezier(.34, 1.56, .64, 1);
}
@keyframes t-countdown-pop {
  0%   { opacity: 0; transform: scale(.4); }
  50%  { opacity: 1; transform: scale(1.18); }
  100% { opacity: 1; transform: scale(1); }
}

.t-overlay--pause svg { color: #c084fc; }

.t-pb {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 12px; border-radius: 999px;
  background: linear-gradient(90deg, #eab308, #f59e0b);
  color: #1a1a1a; font-size: 11px; font-weight: 800;
  text-transform: uppercase; letter-spacing: .3px;
}
.t-over-title { color: var(--color-danger) !important; }
.t-over-score {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 56px;
  font-weight: 800;
  color: #c084fc;
  letter-spacing: -2px;
  line-height: 1;
  margin: 4px 0;
}
.t-over-score span { font-size: 14px; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase; margin-left: 4px; }
.t-over-meta {
  display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;
  font-size: 12px; color: rgba(255,255,255,.6);
}

.t-btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 22px;
  background: linear-gradient(90deg, #a855f7, #6366f1);
  color: #fff;
  border: none; border-radius: var(--radius);
  font-size: 14px; font-weight: 700; font-family: var(--font);
  cursor: pointer; transition: filter .12s, transform .06s;
  margin-top: 6px;
}
.t-btn-primary:hover { filter: brightness(1.1); }
.t-btn-primary:active { transform: translateY(1px); }
.t-btn-primary kbd {
  background: rgba(255,255,255,.18);
  border: 1px solid rgba(255,255,255,.2);
  color: #fff;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-family: var(--font-mono, monospace);
}

.t-help {
  grid-column: 1;
  grid-row: 2;
  font-size: 11px; color: var(--text-muted); text-align: center; margin: 0;
}
.t-help kbd, .t-overlay kbd {
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
.t-overlay kbd {
  background: rgba(255,255,255,.12);
  border-color: rgba(255,255,255,.18);
  color: rgba(255,255,255,.85);
}

/* Label flash : "Tetris !", "T-Spin Double !", etc. */
.t-label-flash {
  position: absolute;
  top: 24px; left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 28px;
  font-weight: 900;
  color: #fde047;
  text-shadow: 0 4px 24px rgba(250, 204, 21, .6), 0 0 12px rgba(168, 85, 247, .5);
  pointer-events: none;
  letter-spacing: 1px;
  white-space: nowrap;
  text-transform: uppercase;
}
.t-label-flash-enter-active {
  animation: t-label-pop 1.5s ease-out forwards;
}
@keyframes t-label-pop {
  0%   { opacity: 0; transform: translateX(-50%) scale(.5); }
  20%  { opacity: 1; transform: translateX(-50%) scale(1.15); }
  40%  { opacity: 1; transform: translateX(-50%) scale(1); }
  100% { opacity: 0; transform: translateX(-50%) scale(1) translateY(-12px); }
}

.t-sidebar {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: stretch;
}

@media (max-width: 1080px) {
  .t-main { grid-template-columns: 1fr; }
  .t-stage { grid-row: 1; }
  .t-help { grid-row: 2; }
  .t-sidebar { grid-row: 3; grid-column: 1; max-height: 240px; }
}

@media (max-width: 720px) {
  .t-side-panel { width: 80px; }
  .t-piece-slot { width: 70px; height: 70px; }
  .t-piece-slot--small { width: 60px; height: 44px; }
  .t-stage { gap: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .t-countdown,
  .t-label-flash-enter-active { animation: none !important; }
}
</style>
