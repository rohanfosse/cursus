/**
 * arcadeSounds — sons synthetises pour les mini-jeux (Snake, Space Invaders…).
 *
 * Web Audio API pure, zero asset, zero latence reseau. Tons calibres bas
 * pour rester discrets (pas de gain saturant). Toggle persiste partage
 * pour tous les jeux : si l'utilisateur coupe le son dans Snake, Space
 * Invaders demarre muet aussi (et inversement).
 *
 * Pattern reutilise depuis typeRaceSounds — meme philosophie, jeu specifique.
 */

const SOUND_KEY = 'arcade:sound'

let ctx: AudioContext | null = null
let unlocked = false

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    ctx = new Ctx()
    return ctx
  } catch {
    return null
  }
}

export function unlockArcadeSound(): void {
  if (unlocked) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => { /* ignore */ })
  unlocked = true
}

export function isArcadeSoundEnabled(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== '0' } catch { return true }
}

export function setArcadeSoundEnabled(enabled: boolean): void {
  try { localStorage.setItem(SOUND_KEY, enabled ? '1' : '0') } catch { /* noop */ }
}

interface ToneOptions {
  freq: number
  durationMs?: number
  gain?: number
  type?: OscillatorType
  /** Frequence de fin (slide). Utile pour les sons "swoosh" de power-ups. */
  freqEnd?: number
}

function playTone(opts: ToneOptions): void {
  if (!isArcadeSoundEnabled()) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => { /* noop */ })
  try {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = opts.type ?? 'sine'
    const duration = (opts.durationMs ?? 60) / 1000
    osc.frequency.setValueAtTime(opts.freq, c.currentTime)
    if (opts.freqEnd != null) {
      osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, c.currentTime + duration)
    }
    const peak = opts.gain ?? 0.05
    gain.gain.setValueAtTime(0, c.currentTime)
    gain.gain.linearRampToValueAtTime(peak, c.currentTime + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration)
    osc.connect(gain).connect(c.destination)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + duration + 0.02)
  } catch { /* ignore */ }
}

/** Crunch sur pomme normale (Snake, Space Invaders pickup). */
export function playEatTone(): void {
  playTone({ freq: 660, durationMs: 90, gain: 0.05, freqEnd: 880, type: 'square' })
}

/** Power-up dore : son plus haut, ascendant, plus marque. */
export function playPowerUpTone(): void {
  if (!isArcadeSoundEnabled()) return
  const notes = [880, 1108, 1396]
  notes.forEach((freq, i) => {
    setTimeout(() => playTone({ freq, durationMs: 100, gain: 0.06, type: 'sine' }), i * 70)
  })
}

/** Slow-mo : son grave descendant. */
export function playSlowMoTone(): void {
  playTone({ freq: 600, durationMs: 350, gain: 0.06, freqEnd: 200, type: 'sine' })
}

/** Game over : descente grave brutale. */
export function playGameOverTone(): void {
  playTone({ freq: 220, durationMs: 500, gain: 0.08, freqEnd: 60, type: 'sawtooth' })
}

/** Tick countdown 3-2-1 (3->1 montant, 0 = GO! plus aigu). */
export function playCountdownTone(value: number): void {
  if (value === 0) {
    playTone({ freq: 880, durationMs: 200, gain: 0.07 })
  } else {
    playTone({ freq: 440 + (3 - value) * 60, durationMs: 80, gain: 0.05 })
  }
}

/** Pause / Resume : double bip neutre. */
export function playPauseTone(): void {
  playTone({ freq: 500, durationMs: 50, gain: 0.04 })
  setTimeout(() => playTone({ freq: 700, durationMs: 50, gain: 0.04 }), 60)
}

/** Combo flash : trio rapide ascendant. */
export function playComboTone(multiplier: number): void {
  if (!isArcadeSoundEnabled()) return
  const baseFreq = 700 + Math.min(multiplier * 50, 400)
  ;[baseFreq, baseFreq * 1.25, baseFreq * 1.5].forEach((freq, i) => {
    setTimeout(() => playTone({ freq, durationMs: 60, gain: 0.05 }), i * 50)
  })
}

/** Tir laser pour Space Invaders. */
export function playLaserTone(): void {
  playTone({ freq: 1200, durationMs: 80, gain: 0.04, freqEnd: 400, type: 'square' })
}

/** Explosion d'alien pour Space Invaders. */
export function playExplosionTone(): void {
  playTone({ freq: 200, durationMs: 200, gain: 0.07, freqEnd: 50, type: 'sawtooth' })
}

/** Lock d'une piece Tetris : clic mat tres court. */
export function playLockTone(): void {
  playTone({ freq: 220, durationMs: 50, gain: 0.04, type: 'square' })
}

/** Hard drop Tetris : "thud" descendant. */
export function playHardDropTone(): void {
  playTone({ freq: 380, durationMs: 90, gain: 0.06, freqEnd: 110, type: 'square' })
}

/** Rotation Tetris : tick discret. */
export function playRotateTone(): void {
  playTone({ freq: 1100, durationMs: 35, gain: 0.025, type: 'sine' })
}

/** Hold Tetris : double bip ascendant rapide. */
export function playHoldTone(): void {
  playTone({ freq: 600, durationMs: 50, gain: 0.04, type: 'sine' })
  setTimeout(() => playTone({ freq: 900, durationMs: 50, gain: 0.04, type: 'sine' }), 40)
}

/** Line clear Tetris : son qui depend du nombre de lignes. 4 = Tetris officiel. */
export function playLineClearTone(lines: number): void {
  if (!isArcadeSoundEnabled()) return
  if (lines >= 4) {
    // Tetris : arpege brillant ascendant
    ;[660, 880, 1100, 1320, 1760].forEach((freq, i) => {
      setTimeout(() => playTone({ freq, durationMs: 90, gain: 0.06, type: 'sine' }), i * 55)
    })
  } else {
    const base = 600 + lines * 120
    ;[base, base * 1.25].forEach((freq, i) => {
      setTimeout(() => playTone({ freq, durationMs: 70, gain: 0.05, type: 'sine' }), i * 60)
    })
  }
}

/** T-spin reussi : son magique court. */
export function playTSpinTone(): void {
  if (!isArcadeSoundEnabled()) return
  ;[988, 1318, 1760].forEach((freq, i) => {
    setTimeout(() => playTone({ freq, durationMs: 80, gain: 0.05, type: 'triangle' }), i * 45)
  })
}

/** Level up : trio brillant. */
export function playLevelUpTone(): void {
  if (!isArcadeSoundEnabled()) return
  ;[523, 659, 784, 1047].forEach((freq, i) => {
    setTimeout(() => playTone({ freq, durationMs: 110, gain: 0.06, type: 'sine' }), i * 70)
  })
}
