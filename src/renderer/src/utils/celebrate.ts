/**
 * Micro-animation de celebration (confetti) au moment d'un depot a l'heure.
 *
 * Respecte prefers-reduced-motion : pas d'animation si l'utilisateur a
 * desactive les animations au niveau systeme.
 *
 * Import dynamique : 40 KB de canvas-confetti ne sont charges qu'a la
 * premiere celebration — zero impact sur startup bundle.
 */

export async function celebrate(options?: { origin?: { x?: number; y?: number } }): Promise<void> {
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  try {
    const { default: confetti } = await import('canvas-confetti')
    const origin = {
      x: options?.origin?.x ?? 0.5,
      y: options?.origin?.y ?? 0.6,
    }
    confetti({
      particleCount: 60,
      spread: 55,
      startVelocity: 35,
      gravity: 1.1,
      scalar: .8,
      ticks: 120,
      origin,
      colors: ['#4dd0e1', '#2ECC71', '#9B87F5', '#F39C12'],
      disableForReducedMotion: true,
    })
  } catch {
    // canvas-confetti absent ou erreur : silencieux, c'est cosmetique
  }
}
