/**
 * useTeamMatcher — wrapper haut niveau autour de pairStudents() pour
 * suggerer des binomes/trinomes a partir d'une liste d'etudiants avec
 * des contraintes pratiques (genre, niveau, anciens binomes, exclusions).
 *
 * Pensé pour etre branche sur un bouton "Suggérer répartition" cote prof.
 */
import { computed, ref } from 'vue'
import { pairStudents } from '@/utils/optimization/hungarian'

export interface MatchableStudent {
  id: number
  name: string
  /** Genre (M/F/X) — utilise pour la mixite si demandee */
  gender?: 'M' | 'F' | 'X'
  /** Niveau / moyenne (sert a equilibrer les groupes) */
  level?: number
  /** IDs des anciens binomes (eviter de remettre les memes) */
  pastPartners?: number[]
}

export interface MatchOptions {
  /** Si true, penaliser les paires homogenes en niveau (force le mix fort/faible) */
  balanceLevels?: boolean
  /** Si true, penaliser les paires same-gender pour favoriser la mixite */
  preferMixedGender?: boolean
  /** Penaliser les anciennes paires */
  avoidPastPartners?: boolean
  /** Paires interdites (id, id) — cout +inf */
  forbidden?: Array<[number, number]>
}

/**
 * Composable reactif : recoit la liste des etudiants en ref + options,
 * retourne computed des paires suggerees + cout total.
 *
 * Usage cote composant prof :
 *   const students = ref<MatchableStudent[]>([...])
 *   const { pairs, isolated, totalCost, recompute } = useTeamMatcher(students, opts)
 *   <button @click="recompute">Suggérer</button>
 *   <ul><li v-for="p in pairs">{{ p[0].name }} + {{ p[1].name }}</li></ul>
 */
export function useTeamMatcher(
  studentsRef: { value: MatchableStudent[] },
  options: MatchOptions = {},
) {
  const lastResult = ref<{
    pairs: Array<[MatchableStudent, MatchableStudent]>
    isolated: MatchableStudent | null
    totalCost: number
  }>({ pairs: [], isolated: null, totalCost: 0 })

  function buildCostFn(opts: MatchOptions) {
    const forbidden = new Set(
      (opts.forbidden ?? []).flatMap(([a, b]) => [`${a}-${b}`, `${b}-${a}`]),
    )
    return (a: MatchableStudent, b: MatchableStudent): number => {
      // Paires interdites : cout prohibitif
      if (forbidden.has(`${a.id}-${b.id}`)) return 1e6

      let cost = 0

      // Penalite si meme niveau (favorise la mixite forte/faible)
      if (opts.balanceLevels && a.level !== undefined && b.level !== undefined) {
        const diff = Math.abs(a.level - b.level)
        // Plus le diff est petit, plus le cout est haut (favorise diff > 3 points)
        cost += Math.max(0, 5 - diff)
      }

      // Penalite si meme genre (favorise la mixite)
      if (opts.preferMixedGender && a.gender && b.gender) {
        if (a.gender === b.gender && a.gender !== 'X') cost += 3
      }

      // Penalite forte pour les anciennes paires (eviter la repetition)
      if (opts.avoidPastPartners) {
        if (a.pastPartners?.includes(b.id) || b.pastPartners?.includes(a.id)) {
          cost += 50
        }
      }

      return cost
    }
  }

  function recompute() {
    const students = studentsRef.value
    if (!students || students.length === 0) {
      lastResult.value = { pairs: [], isolated: null, totalCost: 0 }
      return
    }
    const costFn = buildCostFn(options)
    const r = pairStudents(students, costFn)
    lastResult.value = r
  }

  // Compute initial
  recompute()

  return {
    pairs:     computed(() => lastResult.value.pairs),
    isolated:  computed(() => lastResult.value.isolated),
    totalCost: computed(() => lastResult.value.totalCost),
    recompute,
  }
}
