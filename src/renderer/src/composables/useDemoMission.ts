/**
 * useDemoMission - mission tracker du mode demo.
 *
 * Resout le "cold start problem" : un visiteur arrive sur le dashboard et
 * ne sait pas par ou commencer. La mission lui donne 5 actions concretes
 * a explorer ; chaque visite de route coche une etape ; le DemoBanner
 * affiche `X/5 decouvertes`.
 *
 * Detection automatique par route (pas de hooks explicites a poser dans
 * 20 composants) : router.afterEach observe la route active, mappe vers
 * une action, persiste dans `cc_demo_mission` localStorage.
 *
 * Etat partage via une Pinia-like ref module-level pour que toutes les
 * instances du composable (DemoBanner + autres) voient la meme valeur
 * et reagissent au meme moment (sinon Map separes par composant).
 */
import { computed, ref, watch } from 'vue'
import type { Router } from 'vue-router'
import { useAppStore } from '@/stores/app'

const STORAGE_KEY = 'cc_demo_mission'

export interface DemoMissionAction {
  id: string
  label: string
  hint: string
  done: boolean
}

// ── Catalogue des 5 actions, dans l'ordre logique d'exploration ────────
// Chaque action a un `routeMatcher` qui declenche la completion. Un seul
// passage suffit (idempotent : reset uniquement via window.__demoMissionReset
// pour les tests, sinon la cle persiste 24h comme la session demo).
const ACTIONS_CATALOG: ReadonlyArray<{
  id: string
  label: string
  hint: string
  routeMatcher: (path: string) => boolean
}> = [
  {
    id: 'dashboard',
    label: 'Voir mon tableau de bord',
    hint: 'Le hub avec tes promos, devoirs et messages epingles.',
    routeMatcher: (p) => p === '/dashboard' || p === '/',
  },
  {
    id: 'messages',
    label: 'Ouvrir la messagerie',
    hint: 'Canaux par cours, mentions et fichiers partages.',
    routeMatcher: (p) => p.startsWith('/messages'),
  },
  {
    id: 'lumen',
    label: 'Lire un cours dans Lumen',
    hint: 'Tes repos GitHub rendus comme un manuel : markdown, code, KaTeX.',
    routeMatcher: (p) => p.startsWith('/lumen'),
  },
  {
    id: 'devoirs',
    label: 'Voir tes devoirs',
    hint: 'Echeances, depots et notation par grilles A-D.',
    routeMatcher: (p) => p.startsWith('/devoirs') || p.startsWith('/travaux'),
  },
  {
    id: 'live_or_booking',
    label: 'Rejoindre un Live ou un RDV',
    hint: 'Quiz Spark en direct ou prise de rendez-vous tuteur.',
    routeMatcher: (p) => p.startsWith('/live') || p.startsWith('/booking') || p.startsWith('/agenda'),
  },
]

// ── Etat module-level (singleton partage entre tous les composables) ──
function loadInitial(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (Array.isArray(arr)) return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch { /* corrompu : reset */ }
  return new Set()
}

const completedIds = ref<Set<string>>(loadInitial())

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completedIds.value]))
  } catch { /* quota / privacy mode : on ignore, la mission ne persistera pas */ }
}

// Helper exposable globalement pour les tests + le panneau "reset" eventuel
;(window as Window & { __demoMissionReset?: () => void }).__demoMissionReset = () => {
  completedIds.value = new Set()
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

// ── Hook router : detecte l'action a chaque navigation ────────────────
let routerWired = false
export function wireDemoMissionRouter(router: Router): void {
  if (routerWired) return
  routerWired = true
  router.afterEach((to) => {
    // Pas en mode demo : on ne tracke rien (evite de polluer cc_demo_mission
    // pour les vrais utilisateurs).
    const appStore = useAppStore()
    if (!appStore.currentUser?.demo) return
    const path = to.path || '/'
    for (const action of ACTIONS_CATALOG) {
      if (action.routeMatcher(path) && !completedIds.value.has(action.id)) {
        completedIds.value = new Set([...completedIds.value, action.id])
        persist()
      }
    }
  })
}

// ── API publique du composable ──────────────────────────────────────────
export function useDemoMission() {
  const appStore = useAppStore()

  const isActive = computed(() => appStore.currentUser?.demo === true)

  const actions = computed<DemoMissionAction[]>(() =>
    ACTIONS_CATALOG.map(a => ({
      id: a.id,
      label: a.label,
      hint: a.hint,
      done: completedIds.value.has(a.id),
    })),
  )

  const completedCount = computed(() => actions.value.filter(a => a.done).length)
  const totalCount     = computed(() => actions.value.length)
  const allDone        = computed(() => completedCount.value === totalCount.value)
  const progress       = computed(() =>
    totalCount.value === 0 ? 0 : Math.round((completedCount.value / totalCount.value) * 100),
  )

  /** Marque une action comme effectuee. Idempotent. */
  function markAction(id: string): void {
    if (!isActive.value) return
    if (completedIds.value.has(id)) return
    if (!ACTIONS_CATALOG.find(a => a.id === id)) return
    completedIds.value = new Set([...completedIds.value, id])
    persist()
  }

  return {
    isActive,
    actions,
    completedCount,
    totalCount,
    allDone,
    progress,
    markAction,
  }
}

// Export la liste des IDs valides pour les tests / wiring externe
export const DEMO_MISSION_ACTION_IDS = ACTIONS_CATALOG.map(a => a.id)

// Pour eviter les warnings unused : watch demarre quand le module est
// importe et ne fait rien si pas en demo.
const _wakeWatch = ref(0)
watch(_wakeWatch, () => { /* placeholder pour activer le module */ })
