/**
 * Hungarian / Kuhn-Munkres algorithm — affectation optimale dans un graphe biparti.
 *
 * Probleme : etant donne une matrice de couts NxM (workers x tasks),
 * trouver l'affectation 1-pour-1 qui minimise la somme des couts.
 *
 * Complexite : O(n^3) — pour n=30 etudiants -> ~30µs, n=100 -> ~1ms.
 *
 * Reference : implementation O(n^3) inspiree de Jonker-Volgenant simplifiee
 * (sans support des matrices rectangulaires natives — on padd avec des
 * couts infinis).
 *
 * Cas d'usage Cursus :
 *  - Affectation binomes etudiant <-> projet (preference, niveau, contrainte)
 *  - Affectation jury <-> creneau soutenance
 *  - Repartition tutorat entreprise <-> etudiant
 *
 * Pour les TRINOMES : encoder chaque triplet possible comme "task" virtuel
 * avec cout = somme des couts unitaires + penalty si conflit. Ou utiliser
 * un solveur ILP/CP-SAT pour le 3-dimensional matching exact.
 */

export interface AssignmentResult {
  /** assignment[i] = j signifie worker i -> task j (-1 si non affecte) */
  assignment: number[]
  /** Cout total de l'affectation optimale */
  totalCost: number
}

/**
 * Resout le probleme d'affectation par minimisation. La matrice doit etre
 * carree (workers x tasks de meme taille). Pour rectangulaire, padder avec
 * une grosse constante avant l'appel.
 *
 * @param costMatrix - cout[i][j] = cout d'affecter worker i a task j
 * @returns assignment[] et totalCost
 */
export function hungarian(costMatrix: number[][]): AssignmentResult {
  const n = costMatrix.length
  if (n === 0) return { assignment: [], totalCost: 0 }
  if (costMatrix.some(row => row.length !== n)) {
    throw new Error('hungarian: la matrice doit etre carree')
  }

  // Copie defensive de la matrice (l'algorithme la modifie en place)
  const cost = costMatrix.map(row => [...row])

  // Etape 1 : reduction par lignes — soustraire le min de chaque ligne
  for (let i = 0; i < n; i++) {
    const min = Math.min(...cost[i])
    if (min !== 0) {
      for (let j = 0; j < n; j++) cost[i][j] -= min
    }
  }

  // Etape 2 : reduction par colonnes
  for (let j = 0; j < n; j++) {
    let min = cost[0][j]
    for (let i = 1; i < n; i++) if (cost[i][j] < min) min = cost[i][j]
    if (min !== 0) {
      for (let i = 0; i < n; i++) cost[i][j] -= min
    }
  }

  // Etape 3 : couvrir les zeros avec un nombre minimal de lignes / colonnes,
  // iterer jusqu'a obtenir n lignes-couvertures (== solution optimale).
  const ROW_COVERED = new Uint8Array(n)
  const COL_COVERED = new Uint8Array(n)
  // marks[i][j] : 1 = "starred" (zero choisi), 2 = "primed" (zero candidat)
  const marks: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

  // Helper : trouve un zero non couvert. Retourne [i, j] ou null.
  function findUncoveredZero(): [number, number] | null {
    for (let i = 0; i < n; i++) {
      if (ROW_COVERED[i]) continue
      for (let j = 0; j < n; j++) {
        if (!COL_COVERED[j] && cost[i][j] === 0) return [i, j]
      }
    }
    return null
  }

  function findStarInRow(i: number): number {
    for (let j = 0; j < n; j++) if (marks[i][j] === 1) return j
    return -1
  }
  function findStarInCol(j: number): number {
    for (let i = 0; i < n; i++) if (marks[i][j] === 1) return i
    return -1
  }
  function findPrimeInRow(i: number): number {
    for (let j = 0; j < n; j++) if (marks[i][j] === 2) return j
    return -1
  }

  // Step 1 (Munkres) : star les premiers zeros disponibles (1 par ligne+col)
  const colHasStar = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (cost[i][j] === 0 && !colHasStar[j]) {
        marks[i][j] = 1
        colHasStar[j] = 1
        break
      }
    }
  }

  // Boucle principale : converge en O(n^3)
  let safetyIter = 0
  const SAFETY_MAX = 5 * n * n + 1000

  function step3CoverColumns(): 'done' | 'continue' {
    let covered = 0
    for (let j = 0; j < n; j++) {
      let starred = false
      for (let i = 0; i < n; i++) if (marks[i][j] === 1) { starred = true; break }
      if (starred) { COL_COVERED[j] = 1; covered++ }
    }
    return covered >= n ? 'done' : 'continue'
  }

  function step6AdjustMatrix() {
    // Trouve la plus petite valeur non couverte
    let min = Infinity
    for (let i = 0; i < n; i++) {
      if (ROW_COVERED[i]) continue
      for (let j = 0; j < n; j++) {
        if (!COL_COVERED[j] && cost[i][j] < min) min = cost[i][j]
      }
    }
    // Ajoute min aux lignes couvertes, soustrait des colonnes non couvertes
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (ROW_COVERED[i])  cost[i][j] += min
        if (!COL_COVERED[j]) cost[i][j] -= min
      }
    }
  }

  function step5BuildAlternatingPath(startI: number, startJ: number) {
    // Sequence : prime(i,j) -> star(i',j) -> prime(i',j') -> ... jusqu'a un
    // prime sans star dans sa colonne. Inverse les marques dans la sequence.
    const path: Array<[number, number]> = [[startI, startJ]]
    while (true) {
      const last = path[path.length - 1]
      const starRow = findStarInCol(last[1])
      if (starRow === -1) break
      path.push([starRow, last[1]])
      const primeCol = findPrimeInRow(starRow)
      path.push([starRow, primeCol])
    }
    // Toggle: prime -> star, star -> nothing
    for (const [i, j] of path) {
      if (marks[i][j] === 1) marks[i][j] = 0
      else if (marks[i][j] === 2) marks[i][j] = 1
    }
    // Reset toutes les primes restantes + uncover all
    for (let i = 0; i < n; i++) {
      ROW_COVERED[i] = 0
      COL_COVERED[i] = 0
      for (let j = 0; j < n; j++) if (marks[i][j] === 2) marks[i][j] = 0
    }
  }

  // Etat initial : couvre les colonnes des zeros stars
  if (step3CoverColumns() === 'done') {
    // Solution deja optimale au step initial
  } else {
    while (safetyIter++ < SAFETY_MAX) {
      const z = findUncoveredZero()
      if (!z) {
        step6AdjustMatrix()
        continue
      }
      const [i, j] = z
      marks[i][j] = 2 // prime

      const starJ = findStarInRow(i)
      if (starJ !== -1) {
        // Cover la ligne i, uncover la colonne starJ, reboucle
        ROW_COVERED[i] = 1
        COL_COVERED[starJ] = 0
      } else {
        // Pas de star dans la ligne -> alternating path
        step5BuildAlternatingPath(i, j)
        if (step3CoverColumns() === 'done') break
      }
    }
  }

  // Extraction du resultat
  const assignment = new Array(n).fill(-1)
  let totalCost = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (marks[i][j] === 1) {
        assignment[i] = j
        totalCost += costMatrix[i][j]
        break
      }
    }
  }

  return { assignment, totalCost }
}

/**
 * Helper : matche les etudiants en binomes en minimisant un cout de
 * compatibilite (couples eviter, ecart de niveau, anciens projets ensemble).
 *
 * @param students - liste des etudiants (taille paire ou impair = 1 isole)
 * @param costFn - cout(a, b) symmetrique entre 2 etudiants. Plus bas = mieux.
 * @returns liste de paires + eventuellement 1 etudiant isole
 */
export function pairStudents<T>(
  students: T[],
  costFn: (a: T, b: T) => number,
): { pairs: Array<[T, T]>; isolated: T | null; totalCost: number } {
  const n = students.length
  if (n === 0) return { pairs: [], isolated: null, totalCost: 0 }
  if (n === 1) return { pairs: [], isolated: students[0], totalCost: 0 }

  // Pour le pairing on resout un assignment particulier : la matrice est
  // symetrique avec cost(i,i) = +inf (pas d'auto-affectation). L'algo
  // hungarian va matcher chaque etudiant a un autre — on dedoublonnera
  // ensuite (chaque paire apparait 2 fois).
  const INF = 1e9
  const matrix: number[][] = []
  // Si nombre impair, on ajoute un "ghost" a cout 0 pour tous (= isole)
  const padded = n % 2 === 1 ? [...students, null as unknown as T] : students
  const m = padded.length
  for (let i = 0; i < m; i++) {
    const row: number[] = []
    for (let j = 0; j < m; j++) {
      if (i === j) row.push(INF)
      else if (padded[i] === null || padded[j] === null) row.push(0)
      else row.push(costFn(padded[i], padded[j]))
    }
    matrix.push(row)
  }
  const { assignment, totalCost } = hungarian(matrix)

  // Reconstruction des paires (chaque paire ressort 2 fois — on dedup)
  const seen = new Set<number>()
  const pairs: Array<[T, T]> = []
  let isolated: T | null = null
  for (let i = 0; i < m; i++) {
    if (seen.has(i)) continue
    const j = assignment[i]
    seen.add(i)
    seen.add(j)
    if (padded[i] === null) { isolated = padded[j]; continue }
    if (padded[j] === null) { isolated = padded[i]; continue }
    pairs.push([padded[i], padded[j]])
  }
  return { pairs, isolated, totalCost: totalCost - (n % 2 === 1 ? 0 : 0) }
}
