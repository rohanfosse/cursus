/**
 * Sound effects pour TypeRace (v2.292).
 *
 * Web Audio API minimaliste : un AudioContext partage, jouant des oscillateurs
 * tres courts pour eviter la fatigue auditive. Les tons sont calibres bas et
 * doux — l'objectif est un feedback discret, pas une notification.
 *
 * Pas de fichiers audio externes : tout est synthetise. Aucune latence reseau,
 * zero asset a charger, et c'est totalement togglable a chaud.
 *
 * Toggle persiste dans localStorage `typerace:sound`.
 */

const SOUND_KEY = 'typerace:sound'

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

/**
 * Browsers bloquent l'audio tant qu'aucune interaction utilisateur n'a eu lieu.
 * Cette fonction "unlock" le context apres un click/keypress.
 */
export function unlockSound(): void {
  if (unlocked) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') {
    c.resume().catch(() => { /* ignore */ })
  }
  unlocked = true
}

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== '0'
  } catch {
    return true
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? '1' : '0')
  } catch { /* noop */ }
}

interface ToneOptions {
  freq: number
  durationMs?: number
  gain?: number
  type?: OscillatorType
}

function playTone(opts: ToneOptions): void {
  if (!isSoundEnabled()) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') {
    c.resume().catch(() => { /* noop */ })
  }
  try {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = opts.type ?? 'sine'
    osc.frequency.value = opts.freq
    const duration = (opts.durationMs ?? 50) / 1000
    const peak = opts.gain ?? 0.04
    // Enveloppe ADR rapide pour eviter le click discret en bord de buffer.
    gain.gain.setValueAtTime(0, c.currentTime)
    gain.gain.linearRampToValueAtTime(peak, c.currentTime + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration)
    osc.connect(gain).connect(c.destination)
    osc.start(c.currentTime)
    osc.stop(c.currentTime + duration + 0.02)
  } catch {
    // Audio context cassee : silencieux, c'est cosmetique
  }
}

/** Bip discret sur frappe correcte. ~880 Hz, 35 ms, gain bas. */
export function playKeyTone(): void {
  playTone({ freq: 880, durationMs: 30, gain: 0.025 })
}

/** Plonk grave sur erreur. 220 Hz triangle, plus marque. */
export function playErrorTone(): void {
  playTone({ freq: 220, durationMs: 80, gain: 0.06, type: 'triangle' })
}

/** Trio ascendant sur palier de streak (5/10/25/50/100/200). */
export function playStreakTone(milestone: number): void {
  if (!isSoundEnabled()) return
  const c = getCtx()
  if (!c) return
  // Frequence proportionnelle au palier — plus haut = plus aigu = plus reward.
  const baseFreq = 660 + Math.min(milestone * 4, 800)
  const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5]
  notes.forEach((freq, i) => {
    setTimeout(() => playTone({ freq, durationMs: 70, gain: 0.05 }), i * 60)
  })
}

/** Fanfare victoire pour PB / fin de partie. Acord majeur ascendant. */
export function playVictoryTone(): void {
  if (!isSoundEnabled()) return
  const c = getCtx()
  if (!c) return
  const notes = [523.25, 659.25, 783.99, 1046.5] // C E G C (octave)
  notes.forEach((freq, i) => {
    setTimeout(() => playTone({ freq, durationMs: 180, gain: 0.06 }), i * 90)
  })
}

/** Tick de countdown 3-2-1 (pulse court). */
export function playCountdownTick(value: number): void {
  // Le "GO" (value === 0) sonne plus haut/long.
  if (value === 0) {
    playTone({ freq: 880, durationMs: 200, gain: 0.07 })
  } else {
    playTone({ freq: 440 + (3 - value) * 60, durationMs: 80, gain: 0.05 })
  }
}
