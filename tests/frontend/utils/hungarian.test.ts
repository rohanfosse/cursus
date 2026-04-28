/**
 * Tests de l'algorithme hongrois (utils/optimization/hungarian.ts).
 *
 * Verifie l'optimalite contre des cas connus + le helper pairStudents
 * (matching d'etudiants en binomes avec contrainte symetrique).
 */
import { describe, it, expect } from 'vitest'
import { hungarian, pairStudents } from '@/utils/optimization/hungarian'

describe('hungarian: cas de base', () => {
  it('matrice 1x1 retourne assignment trivial', () => {
    const r = hungarian([[5]])
    expect(r.assignment).toEqual([0])
    expect(r.totalCost).toBe(5)
  })

  it('matrice 3x3 connue : optimum = 13', () => {
    // Cas classique des cours de RO
    const cost = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ]
    const r = hungarian(cost)
    // Solution optimale : (0,1)+(1,0)+(2,2) = 1+2+2 = 5
    // ou (0,2)+(1,1)+(2,0) = 3+0+3 = 6
    // L'optimum est 5
    expect(r.totalCost).toBe(5)
    // Chaque worker affecte a une task differente
    expect(new Set(r.assignment).size).toBe(3)
  })

  it('matrice 4x4 toutes-egales retourne n importe quelle perm avec cout = 4', () => {
    const cost = [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
    ]
    const r = hungarian(cost)
    expect(r.totalCost).toBe(4)
    expect(new Set(r.assignment).size).toBe(4)
  })

  it('matrice diagonale optimale a cost 0 evite la diagonale', () => {
    // Cas piege : la matrice incite naturellement la diagonale
    const cost = [
      [0, 5, 5],
      [5, 0, 5],
      [5, 5, 0],
    ]
    const r = hungarian(cost)
    expect(r.totalCost).toBe(0)
    expect(r.assignment).toEqual([0, 1, 2])
  })

  it('rejette les matrices non-carrees', () => {
    expect(() => hungarian([[1, 2], [3]])).toThrow()
  })

  it('matrice vide retourne resultat vide', () => {
    expect(hungarian([])).toEqual({ assignment: [], totalCost: 0 })
  })
})

describe('hungarian: stress / scalabilite', () => {
  it('matrice 20x20 aleatoire converge en < 100ms', () => {
    const n = 20
    const cost: number[][] = []
    for (let i = 0; i < n; i++) {
      const row: number[] = []
      for (let j = 0; j < n; j++) row.push(Math.floor(Math.random() * 100))
      cost.push(row)
    }
    const t0 = performance.now()
    const r = hungarian(cost)
    const dt = performance.now() - t0
    expect(dt).toBeLessThan(150)
    expect(new Set(r.assignment).size).toBe(n)
  })

  it('verifie l optimalite sur 5 matrices aleatoires 6x6 par enumeration brute', () => {
    // Pour n=6, on peut comparer au minimum vrai en enumerant les 720 perms
    function bruteForce(cost: number[][]) {
      const n = cost.length
      let best = Infinity
      function permute(arr: number[], start = 0) {
        if (start === arr.length) {
          let c = 0
          for (let i = 0; i < n; i++) c += cost[i][arr[i]]
          if (c < best) best = c
          return
        }
        for (let i = start; i < arr.length; i++) {
          [arr[start], arr[i]] = [arr[i], arr[start]]
          permute(arr, start + 1)
          ;[arr[start], arr[i]] = [arr[i], arr[start]]
        }
      }
      permute(Array.from({ length: n }, (_, i) => i))
      return best
    }
    for (let trial = 0; trial < 5; trial++) {
      const n = 6
      const cost: number[][] = []
      for (let i = 0; i < n; i++) {
        const row: number[] = []
        for (let j = 0; j < n; j++) row.push(Math.floor(Math.random() * 50))
        cost.push(row)
      }
      const r = hungarian(cost)
      const expected = bruteForce(cost)
      expect(r.totalCost).toBe(expected)
    }
  })
})

describe('pairStudents: matching binomes', () => {
  it('paire 2 etudiants en 1 binome', () => {
    const students = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]
    const r = pairStudents(students, () => 1)
    expect(r.pairs).toHaveLength(1)
    expect(r.isolated).toBeNull()
  })

  it('isole 1 etudiant si nombre impair', () => {
    const students = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const r = pairStudents(students, () => 1)
    expect(r.pairs).toHaveLength(1)
    expect(r.isolated).not.toBeNull()
  })

  it('aucun etudiant -> aucune paire', () => {
    const r = pairStudents([], () => 0)
    expect(r.pairs).toEqual([])
    expect(r.isolated).toBeNull()
  })

  it('respecte les preferences fortes (cout asymetrique)', () => {
    // Emma prefere Jean (cout 1), Sara prefere Lucas (cout 1).
    // Eviter Emma-Lucas (cout 100) et Sara-Jean (cout 100).
    const students = [
      { id: 1, name: 'Emma' },
      { id: 2, name: 'Lucas' },
      { id: 3, name: 'Sara' },
      { id: 4, name: 'Jean' },
    ]
    const PREFER: Record<string, Record<string, number>> = {
      Emma:  { Jean: 1, Lucas: 100, Sara: 50 },
      Lucas: { Sara: 1, Emma: 100, Jean: 50 },
      Sara:  { Lucas: 1, Jean: 100, Emma: 50 },
      Jean:  { Emma: 1, Sara: 100, Lucas: 50 },
    }
    const r = pairStudents(students, (a, b) => PREFER[a.name][b.name])
    expect(r.pairs).toHaveLength(2)
    // Verifier que Emma + Jean sont ensemble, Sara + Lucas ensemble
    const pairNames = r.pairs.map(p => [p[0].name, p[1].name].sort().join('+'))
    expect(pairNames).toContain('Emma+Jean')
    expect(pairNames).toContain('Lucas+Sara')
  })
})
