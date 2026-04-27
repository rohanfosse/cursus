/**
 * Setup global pour les tests frontend (jsdom).
 *
 * Mocke `canvas-confetti` pour eviter les UnhandledExceptions :
 * la lib appelle `ctx.clearRect()` sur un canvas qui est null dans jsdom
 * (jsdom n'implemente pas le 2D canvas context). Le mock retourne une no-op
 * qui resout immediatement, donc `celebrate.ts` continue sans erreur ni effet
 * visible — exactement ce qu'on veut en test.
 */
import { vi } from 'vitest'

vi.mock('canvas-confetti', () => ({
  default: () => Promise.resolve(),
}))
