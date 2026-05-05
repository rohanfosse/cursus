/**
 * snakeEngine — logique pure du mini-jeu Snake, sans etat Vue ni dependance
 * DOM. Toutes les fonctions sont deterministes (l alea est injecte via un
 * generateur fourni par l appelant), ce qui rend le moteur entierement
 * testable en isolation.
 *
 * Le composant SnakeView pilote les refs Vue + le rendu canvas et consomme
 * ces fonctions pour avancer d un tick.
 */

export type Dir = 'up' | 'down' | 'left' | 'right'

export interface Cell { x: number; y: number }

/** Type de pomme (v2.293) — power-ups qui apparaissent occasionnellement. */
export type FoodKind = 'normal' | 'golden' | 'slow'

export interface PowerFood extends Cell {
  kind: FoodKind
  /**
   * Tick (compteur global) auquel la pomme expire si pas mangee. null = persiste
   * indefiniment (cas des pommes normales). Permet d'eviter qu'une pomme dorée
   * non mangee reste a perpetuite et finisse par scolaire le score.
   */
  expiresAtTick: number | null
}

/** Effets actifs (v2.293) : slow-mo qui ralentit le tick pendant N ticks. */
export interface SnakeEffects {
  /** Tick global a partir duquel le slow-mo expire. 0 = pas de slow-mo. */
  slowMoUntilTick: number
  /** Multiplicateur de score combo (v2.293) : 1, 2 ou 3. Reset si > windowMs. */
  comboMultiplier: number
  /** Timestamp ms du dernier food mange — pour fenetre de combo. */
  lastEatAtMs: number
}

export interface SnakeConfig {
  width:       number
  height:      number
  tickInitial: number
  tickMin:     number
  tickStep:    number
  /** Accelere tous les N pommes. */
  foodPerStep: number
  /** v2.293 : probabilite [0..1] qu'une pomme spawne en power-up. */
  powerUpChance: number
  /** v2.293 : multiplicateur de score pour pomme doree. */
  goldenMultiplier: number
  /** v2.293 : duree (en ticks) de l'effet slow-mo apres une pomme bleue. */
  slowMoDurationTicks: number
  /** v2.293 : facteur de ralentissement du slow-mo (1.6 = 60 % plus lent). */
  slowMoFactor: number
  /** v2.293 : duree (en ticks) avant expiration d'un power-up non mange. */
  powerUpLifeTicks: number
  /** v2.293 : fenetre (ms) entre deux pommes pour conserver le combo. */
  comboWindowMs: number
  /** v2.293 : combo max possible (palier max). */
  comboMax: number
}

export const DEFAULT_SNAKE_CONFIG: SnakeConfig = {
  width:       20,
  height:      15,
  tickInitial: 140,
  tickMin:     60,
  tickStep:    8,
  foodPerStep: 5,
  powerUpChance: 0.18,
  goldenMultiplier: 3,
  slowMoDurationTicks: 40,
  slowMoFactor: 1.6,
  powerUpLifeTicks: 70,
  comboWindowMs: 4000,
  comboMax: 3,
}

/** Directions opposees — empeche le 180 instantane. */
const OPPOSITE: Record<Dir, Dir> = {
  up:    'down',
  down:  'up',
  left:  'right',
  right: 'left',
}

/** Corps initial : 3 cellules horizontales au centre de la grille. */
export function initialSnake(w: number, h: number): Cell[] {
  const cx = Math.floor(w / 2)
  const cy = Math.floor(h / 2)
  return [
    { x: cx,     y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ]
}

/** Empeche le demi-tour instantane : retourne null si la direction est opposee. */
export function canTurn(from: Dir, to: Dir): boolean {
  return OPPOSITE[to] !== from
}

/** Cellule occupee par la tete apres un deplacement dans la direction donnee. */
export function nextCell(head: Cell, dir: Dir): Cell {
  switch (dir) {
    case 'up':    return { x: head.x,     y: head.y - 1 }
    case 'down':  return { x: head.x,     y: head.y + 1 }
    case 'left':  return { x: head.x - 1, y: head.y     }
    case 'right': return { x: head.x + 1, y: head.y     }
  }
}

export function isWallHit(cell: Cell, w: number, h: number): boolean {
  return cell.x < 0 || cell.x >= w || cell.y < 0 || cell.y >= h
}

export function isSelfHit(body: readonly Cell[], cell: Cell): boolean {
  return body.some(c => c.x === cell.x && c.y === cell.y)
}

/**
 * Avance le serpent d un pas. Retourne le nouveau corps : si la tete arrive
 * sur une pomme, la queue n est PAS retiree (croissance) ; sinon la queue
 * est retiree (translation pure).
 */
export function advance(body: readonly Cell[], next: Cell, ateFood: boolean): Cell[] {
  const grown = [next, ...body]
  if (!ateFood) grown.pop()
  return grown
}

/**
 * Calcule le prochain interval de tick. Accelere chaque fois que foodEaten
 * est un multiple non nul de foodPerStep, sans jamais descendre sous tickMin.
 */
export function computeNextTick(
  currentTickMs: number,
  foodEaten: number,
  cfg: Pick<SnakeConfig, 'tickMin' | 'tickStep' | 'foodPerStep'>,
): number {
  if (foodEaten <= 0 || foodEaten % cfg.foodPerStep !== 0) return currentTickMs
  return Math.max(cfg.tickMin, currentTickMs - cfg.tickStep)
}

/**
 * Tire une cellule libre (non occupee par le corps). `rand` doit retourner
 * un flottant dans [0, 1). L injection permet des tests deterministes.
 */
export function placeFood(
  body: readonly Cell[],
  w: number,
  h: number,
  rand: () => number = Math.random,
  exclude: readonly Cell[] = [],
): Cell {
  if (body.length === 0) return { x: Math.floor(rand() * w), y: Math.floor(rand() * h) }

  const occupied = new Set([...body, ...exclude].map(c => `${c.x},${c.y}`))
  if (occupied.size >= w * h) return body[0]

  for (let i = 0; i < 100; i++) {
    const x = Math.floor(rand() * w)
    const y = Math.floor(rand() * h)
    if (!occupied.has(`${x},${y}`)) return { x, y }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!occupied.has(`${x},${y}`)) return { x, y }
    }
  }
  return body[0]
}

/**
 * Decide si la pomme normale qui spawne doit etre "boostee" en power-up
 * (golden / slow). Renvoie le kind a creer en consequence.
 * v2.293.
 */
export function rollFoodKind(
  cfg: Pick<SnakeConfig, 'powerUpChance'>,
  rand: () => number = Math.random,
): FoodKind {
  if (rand() > cfg.powerUpChance) return 'normal'
  // Parmi les power-ups, 60 % golden, 40 % slow-mo (slow plus rare car plus utile).
  return rand() < 0.6 ? 'golden' : 'slow'
}

/**
 * Calcule le score gagne pour une pomme mangee, en tenant compte du type
 * de pomme (golden = ×N) et du combo multiplicateur courant.
 * v2.293.
 */
export function computeFoodScore(
  kind: FoodKind,
  comboMultiplier: number,
  cfg: Pick<SnakeConfig, 'goldenMultiplier'>,
): number {
  const base = kind === 'golden' ? 10 * cfg.goldenMultiplier : 10
  return base * Math.max(1, comboMultiplier)
}

/**
 * Met a jour le combo en fonction du temps ecoule depuis le dernier food
 * mange. Si la fenetre est respectee, +1 (cap a comboMax). Sinon reset a 1.
 * v2.293.
 */
export function nextCombo(
  prevCombo: number,
  prevEatMs: number,
  nowMs: number,
  cfg: Pick<SnakeConfig, 'comboWindowMs' | 'comboMax'>,
): number {
  if (prevEatMs === 0) return 1
  const dt = nowMs - prevEatMs
  if (dt <= cfg.comboWindowMs) {
    return Math.min(cfg.comboMax, prevCombo + 1)
  }
  return 1
}

/**
 * Mappe une touche clavier vers une direction. Supporte AZERTY (ZQSD) et
 * QWERTY (WASD). Retourne null pour toute autre touche.
 */
export function keyToDir(key: string): Dir | null {
  const k = key.toLowerCase()
  if (k === 'arrowup'    || k === 'z' || k === 'w')              return 'up'
  if (k === 'arrowdown'  || k === 's')                           return 'down'
  if (k === 'arrowleft'  || k === 'q' || k === 'a')              return 'left'
  if (k === 'arrowright' || k === 'd')                           return 'right'
  return null
}

export type TickOutcome =
  | { kind: 'wall' }
  | { kind: 'self' }
  | { kind: 'move'; body: Cell[]; ateFood: boolean }

/**
 * Calcule l issue d un tick a partir du corps courant et du prochain pas.
 * Ne place PAS la nouvelle pomme (l appelant le fait via placeFood) : on
 * garde la fonction pure et synchrone.
 */
export function stepOnce(
  body: readonly Cell[],
  dir: Dir,
  food: Cell,
  cfg: Pick<SnakeConfig, 'width' | 'height'>,
): TickOutcome {
  const head = body[0]
  const next = nextCell(head, dir)
  if (isWallHit(next, cfg.width, cfg.height)) return { kind: 'wall' }
  if (isSelfHit(body, next))                  return { kind: 'self' }
  const ateFood = next.x === food.x && next.y === food.y
  return { kind: 'move', body: advance(body, next, ateFood), ateFood }
}
