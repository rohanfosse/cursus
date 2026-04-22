/**
 * useQuickReacts - reactions rapides personnalisables (4 favorites).
 *
 * Source unique pour :
 * - la pill d'actions au survol d'un message (QUICK_REACTS affiches)
 * - l'editeur dans Settings > Preferences
 *
 * State module-level pour une seule source reactive partagee entre toutes
 * les MessageActionPill. Persistance localStorage.
 */
import { ref, computed, readonly, type Ref } from 'vue'
import { safeGetJSON, safeSetJSON } from '@/utils/safeStorage'

// v2 : MAX 5 (etait 4 en v1), inspire Discord.
const STORAGE_KEY = 'cc_quick_reacts_v2'
const MAX_SLOTS = 5

export interface ReactOption {
  readonly type: string
  readonly emoji: string
  readonly label: string
}

/** Liste des reactions disponibles — un superset utile en contexte
 *  pedagogique. L'utilisateur en choisit 4. */
export const AVAILABLE_REACTS: readonly ReactOption[] = [
  { type: 'check',  emoji: '✅', label: 'Validé'     },
  { type: 'thumb',  emoji: '👍', label: 'D\'accord'   },
  { type: 'fire',   emoji: '🔥', label: 'Top'        },
  { type: 'heart',  emoji: '❤️', label: 'Cœur'       },
  { type: 'think',  emoji: '🤔', label: 'Réflexion'  },
  { type: 'eyes',   emoji: '👀', label: 'Vu'         },
  { type: 'laugh',  emoji: '😂', label: 'Rire'       },
  { type: 'clap',   emoji: '👏', label: 'Bravo'      },
  { type: 'party',  emoji: '🎉', label: 'Fête'       },
  { type: 'rocket', emoji: '🚀', label: 'Décollage'  },
  { type: 'hundred', emoji: '💯', label: 'Cent %'    },
  { type: 'brain',  emoji: '🧠', label: 'Cerveau'    },
  { type: 'book',   emoji: '📚', label: 'Livre'      },
  { type: 'bulb',   emoji: '💡', label: 'Idée'       },
  { type: 'wave',   emoji: '👋', label: 'Coucou'     },
  { type: 'cry',    emoji: '😢', label: 'Triste'     },
  { type: 'conf',   emoji: '😕', label: 'Perplexe'   },
  { type: 'alert',  emoji: '⚠️', label: 'Attention'  },
  { type: 'no',     emoji: '❌', label: 'Non'        },
  { type: 'up',     emoji: '⬆️', label: 'En haut'    },
]

/** Defaults : 5 reactions favorites les plus utiles en contexte pedago. */
const DEFAULT_TYPES: readonly string[] = ['check', 'thumb', 'fire', 'heart', 'eyes']

// Etat reactif module-level partage entre toutes les instances.
const quickReactTypes: Ref<string[]> = ref(loadFromStorage())

function loadFromStorage(): string[] {
  const saved = safeGetJSON<string[]>(STORAGE_KEY, [])
  const known = new Set(AVAILABLE_REACTS.map(r => r.type))
  const filtered = Array.isArray(saved) ? saved.filter(t => known.has(t)) : []
  return filtered.length === MAX_SLOTS ? filtered : [...DEFAULT_TYPES]
}

function persist() {
  safeSetJSON(STORAGE_KEY, quickReactTypes.value)
}

/** Remplace les 4 reactions rapides. Ignore si longueur != MAX_SLOTS. */
function setAll(types: readonly string[]): void {
  if (types.length !== MAX_SLOTS) return
  const known = new Set(AVAILABLE_REACTS.map(r => r.type))
  if (!types.every(t => known.has(t))) return
  quickReactTypes.value = [...types]
  persist()
}

/** Toggle un emoji : ajoute si absent et < 4, retire sinon (mais jamais < 1). */
function toggle(type: string): void {
  const list = quickReactTypes.value
  const idx = list.indexOf(type)
  if (idx >= 0) {
    if (list.length <= 1) return
    quickReactTypes.value = list.filter(t => t !== type)
  } else {
    if (list.length >= MAX_SLOTS) return
    quickReactTypes.value = [...list, type]
  }
  persist()
}

/** Remet les defauts (check / thumb / fire / heart). */
function reset(): void {
  quickReactTypes.value = [...DEFAULT_TYPES]
  persist()
}

export function useQuickReacts() {
  const quickReacts = computed<ReactOption[]>(() =>
    quickReactTypes.value
      .map(t => AVAILABLE_REACTS.find(r => r.type === t))
      .filter((r): r is ReactOption => !!r),
  )

  return {
    /** 4 reactions rapides dans l'ordre choisi (reactive). */
    quickReacts,
    /** Liste brute des types choisis (readonly). */
    quickReactTypes: readonly(quickReactTypes),
    /** Catalogue complet pour l'editeur. */
    AVAILABLE_REACTS,
    /** Nombre de slots (4). */
    MAX_SLOTS,
    setQuickReactTypes: setAll,
    toggleQuickReact:   toggle,
    resetQuickReacts:   reset,
  }
}

/** Map type → emoji pour le rendu des reactions existantes sur un message
 *  (les votes anciens peuvent etre sur n'importe quel emoji du catalogue). */
export function getAllReactTypes(): readonly ReactOption[] {
  return AVAILABLE_REACTS
}
