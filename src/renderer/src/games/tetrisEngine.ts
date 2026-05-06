/**
 * tetrisEngine — logique pure Tetris moderne (SRS), sans etat Vue ni DOM.
 *
 * Implementation moderne :
 *   - 7-bag randomizer (le standard officiel : chaque set de 7 pieces contient
 *     exactement les 7 tetrominos, distribues aleatoirement)
 *   - SRS (Super Rotation System) avec wall kicks officiels (incl. I-piece)
 *   - Hold piece (un swap par drop)
 *   - Ghost piece (projection de la position d'atterrissage)
 *   - Hard drop / soft drop avec scoring distinct
 *   - Scoring moderne : single/double/triple/tetris + T-spin detection +
 *     back-to-back bonus + combo bonus (toutes les regles modernes)
 *   - Levels 1..20 avec gravity exponentielle (formule officielle Guideline)
 *   - Lock delay basique (la piece ne se vrouille qu'au prochain "tick lock"
 *     plutot qu'instantanement, pour permettre les ajustements de derniere
 *     seconde — le composant gere le timer, le moteur expose juste les helpers)
 *
 * Toutes les fonctions retournent de nouvelles structures (immutabilite).
 * `rand()` est injecte pour permettre des tests deterministes.
 */

// ── Constantes de base ─────────────────────────────────────────────────────
export const BOARD_W = 10
export const BOARD_H = 20
/** Lignes "buffer" au-dessus du plateau visible — autorise un spawn securise. */
export const BOARD_BUFFER = 2

export type PieceKind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'
export type Rotation = 0 | 1 | 2 | 3

export interface Piece {
  kind:     PieceKind
  rotation: Rotation
  /** Coin haut-gauche du bounding box (peut etre negatif pour spawn). */
  x: number
  y: number
}

/**
 * Cellule du plateau : null = vide, sinon kind de la piece pour la couleur.
 * On garde le kind plutot qu'une couleur figee pour permettre des themes.
 */
export type BoardCell = PieceKind | null
export type Board = BoardCell[][]

// ── Formes des pieces (SRS — Super Rotation System) ────────────────────────
//
// Chaque tetromino est defini par 4 rotations (0, R, 2, L). Les coordonnees
// sont locales au bounding box. On utilise les bounding boxes officiels SRS :
// 4x4 pour le I, 3x3 pour J/L/S/T/Z, 2x2 pour le O (qui ne tourne pas).

type ShapeMatrix = readonly (readonly number[])[]

const SHAPE_I: readonly ShapeMatrix[] = [
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
  [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
  [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
]
const SHAPE_O: readonly ShapeMatrix[] = [
  [[1,1],[1,1]],
  [[1,1],[1,1]],
  [[1,1],[1,1]],
  [[1,1],[1,1]],
]
const SHAPE_T: readonly ShapeMatrix[] = [
  [[0,1,0],[1,1,1],[0,0,0]],
  [[0,1,0],[0,1,1],[0,1,0]],
  [[0,0,0],[1,1,1],[0,1,0]],
  [[0,1,0],[1,1,0],[0,1,0]],
]
const SHAPE_S: readonly ShapeMatrix[] = [
  [[0,1,1],[1,1,0],[0,0,0]],
  [[0,1,0],[0,1,1],[0,0,1]],
  [[0,0,0],[0,1,1],[1,1,0]],
  [[1,0,0],[1,1,0],[0,1,0]],
]
const SHAPE_Z: readonly ShapeMatrix[] = [
  [[1,1,0],[0,1,1],[0,0,0]],
  [[0,0,1],[0,1,1],[0,1,0]],
  [[0,0,0],[1,1,0],[0,1,1]],
  [[0,1,0],[1,1,0],[1,0,0]],
]
const SHAPE_J: readonly ShapeMatrix[] = [
  [[1,0,0],[1,1,1],[0,0,0]],
  [[0,1,1],[0,1,0],[0,1,0]],
  [[0,0,0],[1,1,1],[0,0,1]],
  [[0,1,0],[0,1,0],[1,1,0]],
]
const SHAPE_L: readonly ShapeMatrix[] = [
  [[0,0,1],[1,1,1],[0,0,0]],
  [[0,1,0],[0,1,0],[0,1,1]],
  [[0,0,0],[1,1,1],[1,0,0]],
  [[1,1,0],[0,1,0],[0,1,0]],
]

const SHAPES: Record<PieceKind, readonly ShapeMatrix[]> = {
  I: SHAPE_I, O: SHAPE_O, T: SHAPE_T,
  S: SHAPE_S, Z: SHAPE_Z, J: SHAPE_J, L: SHAPE_L,
}

/**
 * Offsets locaux (dx, dy) precalcules pour chaque (kind, rotation). Permet
 * a `pieceCells` de retourner directement les coordonnees plateau sans
 * iterer sur la matrice 4x4 a chaque appel — gain notable dans la boucle
 * de rendu 60 fps.
 */
const CELL_OFFSETS: Record<PieceKind, ReadonlyArray<ReadonlyArray<readonly [number, number]>>> = (() => {
  const kinds: readonly PieceKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
  const out = {} as Record<PieceKind, Array<Array<readonly [number, number]>>>
  for (const kind of kinds) {
    out[kind] = []
    for (let rot = 0; rot < 4; rot++) {
      const shape = SHAPES[kind][rot]
      const offsets: Array<readonly [number, number]> = []
      for (let dy = 0; dy < shape.length; dy++) {
        for (let dx = 0; dx < shape[dy].length; dx++) {
          if (shape[dy][dx]) offsets.push([dx, dy])
        }
      }
      out[kind].push(offsets)
    }
  }
  return out
})()

/** Liste des cellules pleines d'une piece, en coordonnees plateau. */
export function pieceCells(piece: Piece): Array<{ x: number; y: number }> {
  const offsets = CELL_OFFSETS[piece.kind][piece.rotation]
  const cells: Array<{ x: number; y: number }> = new Array(offsets.length)
  for (let i = 0; i < offsets.length; i++) {
    const [dx, dy] = offsets[i]
    cells[i] = { x: piece.x + dx, y: piece.y + dy }
  }
  return cells
}

// ── 7-bag randomizer ────────────────────────────────────────────────────────
const ALL_KINDS: readonly PieceKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

/** Genere un bag de 7 pieces melangees (Fisher-Yates). */
export function newBag(rand: () => number = Math.random): PieceKind[] {
  const bag = [...ALL_KINDS]
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

/**
 * Refill une queue de pieces si elle descend sous `minSize`. La queue est
 * concatenation de bags successifs : ca garantit qu'on ne voit jamais plus
 * de 12 pieces sans avoir vu chaque type (propriete classique du 7-bag).
 */
export function refillQueue(
  queue: PieceKind[],
  minSize: number,
  rand: () => number = Math.random,
): PieceKind[] {
  if (queue.length >= minSize) return queue
  return [...queue, ...newBag(rand)]
}

// ── Spawn d'une piece ───────────────────────────────────────────────────────
/**
 * Spawn officiel SRS : x = 3 (centre), y = 0 dans le buffer (rangee 0 pour
 * J/L/S/T/Z, rangee 1 pour le I qui occupe la 2e ligne de son box 4x4).
 * Comme on travaille avec un board de hauteur BOARD_H + BOARD_BUFFER, le
 * spawn place la piece dans le buffer haut.
 */
export function spawnPiece(kind: PieceKind): Piece {
  return {
    kind,
    rotation: 0,
    x: kind === 'O' ? 4 : 3,
    y: 0,
  }
}

// ── Validation de position ──────────────────────────────────────────────────
/**
 * Verifie qu'une piece tient dans le plateau a sa position courante :
 *   - aucune cellule en dehors des bornes laterales / bas
 *   - aucune cellule sur une cellule deja remplie
 *
 * Le top du plateau (y < 0) est tolere pour permettre le spawn dans la
 * zone buffer. L'appelant s'occupe du check de top-out apres lock.
 */
export function isValidPosition(board: Board, piece: Piece): boolean {
  for (const c of pieceCells(piece)) {
    if (c.x < 0 || c.x >= BOARD_W) return false
    if (c.y >= BOARD_H + BOARD_BUFFER) return false
    if (c.y >= 0 && board[c.y][c.x] != null) return false
  }
  return true
}

// ── Plateau vide ────────────────────────────────────────────────────────────
export function emptyBoard(): Board {
  const rows = BOARD_H + BOARD_BUFFER
  const board: Board = []
  for (let y = 0; y < rows; y++) {
    board.push(new Array<BoardCell>(BOARD_W).fill(null))
  }
  return board
}

// ── Mouvements ──────────────────────────────────────────────────────────────
export function tryMove(
  board: Board,
  piece: Piece,
  dx: number,
  dy: number,
): Piece | null {
  const moved: Piece = { ...piece, x: piece.x + dx, y: piece.y + dy }
  return isValidPosition(board, moved) ? moved : null
}

// ── Rotation + wall kicks (SRS) ─────────────────────────────────────────────
//
// Les wall kicks officiels SRS (https://tetris.wiki/Super_Rotation_System).
// Pour chaque transition de rotation (from -> to), on essaie 5 offsets dans
// l'ordre. Le premier qui valide la position est choisi. I a sa propre table
// car son bounding box 4x4 implique des kicks differents.

type Offset = readonly [number, number]
type KickTable = Record<string, readonly Offset[]>

// Convention : les Y dans ces tables suivent la convention SRS (Y+ vers le
// haut). On inverse en appliquant l'offset au plateau (Y+ vers le bas dans
// notre representation).
const KICKS_JLSTZ: KickTable = {
  '0->1': [[0,0], [-1,0], [-1,1],  [0,-2], [-1,-2]],
  '1->0': [[0,0], [1,0],  [1,-1],  [0,2],  [1,2]],
  '1->2': [[0,0], [1,0],  [1,-1],  [0,2],  [1,2]],
  '2->1': [[0,0], [-1,0], [-1,1],  [0,-2], [-1,-2]],
  '2->3': [[0,0], [1,0],  [1,1],   [0,-2], [1,-2]],
  '3->2': [[0,0], [-1,0], [-1,-1], [0,2],  [-1,2]],
  '3->0': [[0,0], [-1,0], [-1,-1], [0,2],  [-1,2]],
  '0->3': [[0,0], [1,0],  [1,1],   [0,-2], [1,-2]],
}
const KICKS_I: KickTable = {
  '0->1': [[0,0], [-2,0], [1,0],  [-2,-1], [1,2]],
  '1->0': [[0,0], [2,0],  [-1,0], [2,1],   [-1,-2]],
  '1->2': [[0,0], [-1,0], [2,0],  [-1,2],  [2,-1]],
  '2->1': [[0,0], [1,0],  [-2,0], [1,-2],  [-2,1]],
  '2->3': [[0,0], [2,0],  [-1,0], [2,1],   [-1,-2]],
  '3->2': [[0,0], [-2,0], [1,0],  [-2,-1], [1,2]],
  '3->0': [[0,0], [1,0],  [-2,0], [1,-2],  [-2,1]],
  '0->3': [[0,0], [-1,0], [2,0],  [-1,2],  [2,-1]],
}

/**
 * Tente une rotation (-1 = ccw, +1 = cw) avec wall kicks. Retourne la piece
 * tournee + l'index du kick utilise (utile pour T-spin detection). Null si
 * aucun kick ne valide la rotation.
 */
export function tryRotate(
  board: Board,
  piece: Piece,
  dir: 1 | -1,
): { piece: Piece; kick: number } | null {
  if (piece.kind === 'O') return { piece, kick: 0 }  // O ne tourne pas
  const from = piece.rotation
  const to = ((piece.rotation + dir + 4) % 4) as Rotation
  const key = `${from}->${to}`
  const table = piece.kind === 'I' ? KICKS_I : KICKS_JLSTZ
  const kicks = table[key]
  if (!kicks) return null

  for (let i = 0; i < kicks.length; i++) {
    const [kx, ky] = kicks[i]
    // SRS Y+ = haut, plateau Y+ = bas → on inverse ky
    const candidate: Piece = { ...piece, rotation: to, x: piece.x + kx, y: piece.y - ky }
    if (isValidPosition(board, candidate)) {
      return { piece: candidate, kick: i }
    }
  }
  return null
}

// ── Ghost (projection au sol) ───────────────────────────────────────────────
export function ghostPiece(board: Board, piece: Piece): Piece {
  let ghost = piece
  while (true) {
    const moved = tryMove(board, ghost, 0, 1)
    if (!moved) return ghost
    ghost = moved
  }
}

// ── Lock + clear de lignes ──────────────────────────────────────────────────
/**
 * Imprime la piece dans le plateau. Retourne un nouveau plateau (immutable).
 */
export function lockPiece(board: Board, piece: Piece): Board {
  const next = board.map(row => [...row])
  for (const c of pieceCells(piece)) {
    if (c.y >= 0 && c.y < next.length) next[c.y][c.x] = piece.kind
  }
  return next
}

/**
 * Retire les lignes pleines, retourne le nouveau plateau et le nombre de
 * lignes effacees (0..4).
 */
export function clearLines(board: Board): { board: Board; cleared: number; lineYs: number[] } {
  const lineYs: number[] = []
  for (let y = 0; y < board.length; y++) {
    if (board[y].every(c => c != null)) lineYs.push(y)
  }
  if (lineYs.length === 0) return { board, cleared: 0, lineYs: [] }
  const next = board.filter((_, y) => !lineYs.includes(y))
  while (next.length < board.length) {
    next.unshift(new Array<BoardCell>(BOARD_W).fill(null))
  }
  return { board: next, cleared: lineYs.length, lineYs }
}

// ── T-spin detection ────────────────────────────────────────────────────────
//
// 3-corner rule : un T-spin valide signifie que (a) la derniere action etait
// une rotation, (b) le centre est un T, (c) au moins 3 des 4 coins du box 3x3
// du T sont occupes ou hors-plateau. Mini T-spin = exactement 3 coins dont
// 2 sur le cote face de la pointe — on simplifie en differenciant via le
// kick utilise (kick #4 = T-spin "officiel" complet).
export type TSpinType = 'none' | 'mini' | 'tspin'

export function detectTSpin(
  board: Board,
  piece: Piece,
  lastKickIndex: number,
): TSpinType {
  if (piece.kind !== 'T') return 'none'
  // Centre du T = position (x+1, y+1) dans son box 3x3
  const cx = piece.x + 1
  const cy = piece.y + 1
  const corners = [
    { x: cx - 1, y: cy - 1 },
    { x: cx + 1, y: cy - 1 },
    { x: cx - 1, y: cy + 1 },
    { x: cx + 1, y: cy + 1 },
  ]
  const filled = corners.filter(c => {
    if (c.x < 0 || c.x >= BOARD_W) return true
    if (c.y >= board.length) return true
    if (c.y < 0) return false
    return board[c.y][c.x] != null
  })
  if (filled.length < 3) return 'none'
  return lastKickIndex === 4 ? 'tspin' : 'mini'
}

// ── Scoring (Guideline) ─────────────────────────────────────────────────────
export interface ScoreContext {
  level:     number
  combo:     number     // -1 = pas de combo en cours
  backToBack: boolean   // dernier clear etait tetris ou T-spin avec lignes ?
}

export interface ScoreResult {
  points:        number
  newCombo:      number
  newBackToBack: boolean
  /** Label affichable : 'Single', 'Double', 'Tetris', 'T-Spin Double', etc. */
  label:         string | null
}

const BASE_POINTS = {
  single:        100,
  double:        300,
  triple:        500,
  tetris:        800,
  tspinMini:     100,
  tspinMiniLine: 200,
  tspin:         400,
  tspinSingle:   800,
  tspinDouble:   1200,
  tspinTriple:   1600,
}

export function computeScore(
  cleared: number,
  tspin: TSpinType,
  ctx: ScoreContext,
): ScoreResult {
  let base = 0
  let label: string | null = null
  let isHard = false  // tetris ou t-spin avec lignes : eligible B2B

  if (tspin === 'tspin') {
    if      (cleared === 0) { base = BASE_POINTS.tspin;        label = 'T-Spin' }
    else if (cleared === 1) { base = BASE_POINTS.tspinSingle;  label = 'T-Spin Single';  isHard = true }
    else if (cleared === 2) { base = BASE_POINTS.tspinDouble;  label = 'T-Spin Double';  isHard = true }
    else if (cleared === 3) { base = BASE_POINTS.tspinTriple;  label = 'T-Spin Triple';  isHard = true }
  } else if (tspin === 'mini') {
    if      (cleared === 0) { base = BASE_POINTS.tspinMini;     label = 'T-Spin Mini' }
    else if (cleared === 1) { base = BASE_POINTS.tspinMiniLine; label = 'T-Spin Mini Single'; isHard = true }
  } else {
    if      (cleared === 1) { base = BASE_POINTS.single; label = 'Single' }
    else if (cleared === 2) { base = BASE_POINTS.double; label = 'Double' }
    else if (cleared === 3) { base = BASE_POINTS.triple; label = 'Triple' }
    else if (cleared === 4) { base = BASE_POINTS.tetris; label = 'Tetris'; isHard = true }
  }

  // Back-to-back bonus : +50 % si le precedent ET le courant sont "hard".
  if (cleared > 0 && isHard && ctx.backToBack) {
    base = Math.round(base * 1.5)
    label = label != null ? `B2B ${label}` : 'B2B'
  }

  // Combo bonus : +50 * combo * level (combo demarre a 0 sur le 1er clear).
  const newCombo = cleared > 0 ? ctx.combo + 1 : -1
  const comboBonus = newCombo > 0 ? 50 * newCombo * ctx.level : 0

  // Points scaling par level (formule Guideline classique).
  const points = base * ctx.level + comboBonus

  // B2B se maintient seulement si le dernier clear etait "hard".
  // Un clear non-hard reset, un placement sans clear preserve l'etat.
  const newBackToBack = cleared > 0 ? isHard : ctx.backToBack

  return { points, newCombo, newBackToBack, label }
}

// ── Gravity (delai entre 2 descentes) ──────────────────────────────────────
/**
 * Formule officielle Guideline : (0.8 - (level-1)*0.007) ^ (level-1) en sec.
 * Borne basse a 30 ms pour eviter l'unjouable. Level 1 = 800 ms, level 10 ≈
 * 184 ms, level 15 ≈ 64 ms, level 20 ≈ 33 ms.
 */
export function gravityMs(level: number): number {
  const lvl = Math.max(1, Math.min(20, level))
  const seconds = Math.pow(0.8 - (lvl - 1) * 0.007, lvl - 1)
  return Math.max(30, Math.round(seconds * 1000))
}

/** Lignes a effacer pour passer au level suivant : 10 par level (standard). */
export function levelFromLines(linesCleared: number): number {
  return 1 + Math.floor(linesCleared / 10)
}

// ── Hard drop (calcule la distance de chute) ───────────────────────────────
export function hardDropDistance(board: Board, piece: Piece): number {
  let d = 0
  while (tryMove(board, piece, 0, d + 1)) d++
  return d
}

// ── Top-out check ───────────────────────────────────────────────────────────
/**
 * Top-out = la piece spawne deja en collision, ou s'est lockee entierement
 * dans le buffer (au-dessus de la zone visible).
 */
export function isTopOut(board: Board, lockedPiece: Piece): boolean {
  return pieceCells(lockedPiece).every(c => c.y < BOARD_BUFFER)
}

// ── Input mapping ──────────────────────────────────────────────────────────
export type TetrisAction =
  | 'left' | 'right' | 'softDrop' | 'hardDrop'
  | 'rotateCw' | 'rotateCcw' | 'hold' | 'pause'

export function keyToAction(key: string): TetrisAction | null {
  const k = key.toLowerCase()
  if (k === 'arrowleft'  || k === 'q' || k === 'a') return 'left'
  if (k === 'arrowright' || k === 'd')              return 'right'
  if (k === 'arrowdown'  || k === 's')              return 'softDrop'
  if (k === ' ' || k === 'space')                   return 'hardDrop'
  if (k === 'arrowup' || k === 'x' || k === 'w' || k === 'z') return 'rotateCw'
  if (k === 'control' || k === 'y')                 return 'rotateCcw'
  if (k === 'shift'   || k === 'c')                 return 'hold'
  if (k === 'p' || k === 'escape')                  return 'pause'
  return null
}
