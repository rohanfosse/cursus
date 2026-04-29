/**
 * useBentoPrefs - Composable de preferences du bento etudiant.
 * Gere l'ordre, la visibilite et les tailles des widgets, persistes en localStorage.
 */
import { ref, computed, watch } from 'vue'
import { STORAGE_KEYS } from '@/constants'
import { STUDENT_WIDGETS } from '@/components/dashboard/student-widgets/registry'
import type { WidgetDef, WidgetSize } from '@/types/widgets'

interface BentoPrefs {
  order: string[]
  hidden: string[]
  sizes: Record<string, WidgetSize>
  preset?: string | null
}

function defaultPrefs(): BentoPrefs {
  return {
    order: STUDENT_WIDGETS.filter(w => w.defaultEnabled).map(w => w.id),
    hidden: STUDENT_WIDGETS.filter(w => !w.defaultEnabled).map(w => w.id),
    sizes: {},
    preset: null,
  }
}

// Preset demo etudiant : selection minimaliste pour laisser respirer le
// dashboard. 5 widgets seulement, choisis pour donner les essentiels en
// 1 coup d'oeil :
//   - echeances : ce qui me concerne maintenant (deadlines)
//   - live      : session Live en cours (eye-catcher)
//   - messages  : DMs + mentions
//   - countdown : urgence visuelle (TP AVL dans 3j)
//   - promoActivity : presence des camarades
//
// L'utilisateur decouvre l'app sans etre noye. Une indication subtile
// "+ Ajouter un widget" dans la grille (cf. StudentBento.vue) lui montre
// qu'il peut enrichir : weekplanner, project, rendus, livrables, lumen,
// pomodoro, bookmarks, grades, etc. (~25 widgets disponibles dans
// STUDENT_WIDGETS).
const DEMO_STUDENT_ORDER = [
  'echeances',     // 3 devoirs avec deadlines (2x2)
  'live',          // session Live "Quiz Algo" en cours (2x1)
  'messages',      // DMs + mentions (2x1)
  'countdown',     // TP AVL dans 3j (1x1)
  'promoActivity', // presence simulee (4x1)
]

export function demoStudentPrefs(): BentoPrefs {
  const allIds = STUDENT_WIDGETS.map(w => w.id)
  return {
    order: DEMO_STUDENT_ORDER.filter(id => allIds.includes(id)),
    hidden: allIds.filter(id => !DEMO_STUDENT_ORDER.includes(id)),
    sizes: {
      echeances: '2x2',
      live: '2x1',
      messages: '2x1',
      countdown: '1x1',
      promoActivity: '4x1',
    },
    preset: 'demo',
  }
}

function loadPrefs(): BentoPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BENTO_PREFS)
    if (raw) {
      const parsed = JSON.parse(raw) as BentoPrefs
      const knownIds = new Set(STUDENT_WIDGETS.map(w => w.id))
      parsed.order = parsed.order.filter(id => knownIds.has(id))
      parsed.hidden = parsed.hidden.filter(id => knownIds.has(id))
      // Migration : ajouter sizes si absent (anciennes prefs)
      if (!parsed.sizes) parsed.sizes = {}
      if (parsed.preset === undefined) parsed.preset = null
      // Ajouter les nouveaux widgets non encore dans les prefs
      for (const w of STUDENT_WIDGETS) {
        if (!parsed.order.includes(w.id) && !parsed.hidden.includes(w.id)) {
          if (w.defaultEnabled) parsed.order.push(w.id)
          else parsed.hidden.push(w.id)
        }
      }
      return parsed
    }
  } catch { /* ignore */ }
  return defaultPrefs()
}

function savePrefs(prefs: BentoPrefs) {
  localStorage.setItem(STORAGE_KEYS.BENTO_PREFS, JSON.stringify(prefs))
}

export function useBentoPrefs() {
  const prefs = ref<BentoPrefs>(loadPrefs())

  watch(prefs, (v) => savePrefs(v), { deep: true })

  const allWidgets = computed<WidgetDef[]>(() => {
    const map = new Map(STUDENT_WIDGETS.map(w => [w.id, w]))
    const ordered: WidgetDef[] = []
    for (const id of prefs.value.order) {
      const w = map.get(id)
      if (w) ordered.push(w)
    }
    for (const id of prefs.value.hidden) {
      const w = map.get(id)
      if (w) ordered.push(w)
    }
    return ordered
  })

  const visibleWidgets = computed<WidgetDef[]>(() => {
    const hiddenSet = new Set(prefs.value.hidden)
    const map = new Map(STUDENT_WIDGETS.map(w => [w.id, w]))
    return prefs.value.order
      .filter(id => !hiddenSet.has(id))
      .map(id => map.get(id)!)
      .filter(Boolean)
  })

  function isVisible(id: string): boolean {
    return !prefs.value.hidden.includes(id)
  }

  function toggleWidget(id: string) {
    const isHidden = prefs.value.hidden.includes(id)
    if (isHidden) {
      prefs.value = {
        ...prefs.value,
        order: prefs.value.order.includes(id) ? [...prefs.value.order] : [...prefs.value.order, id],
        hidden: prefs.value.hidden.filter(h => h !== id),
      }
    } else {
      prefs.value = {
        ...prefs.value,
        order: prefs.value.order.filter(o => o !== id),
        hidden: [...prefs.value.hidden, id],
      }
    }
  }

  function reorderWidgets(newOrder: WidgetDef[]) {
    const newIds = new Set(newOrder.map(w => w.id))
    const preserved = prefs.value.order.filter(id => !newIds.has(id) && !prefs.value.hidden.includes(id))
    const reordered = newOrder.filter(w => !prefs.value.hidden.includes(w.id)).map(w => w.id)
    prefs.value = {
      ...prefs.value,
      order: [...preserved, ...reordered],
    }
  }

  function getWidgetSize(id: string): WidgetSize {
    if (prefs.value.sizes[id]) return prefs.value.sizes[id]
    const w = STUDENT_WIDGETS.find(w => w.id === id)
    return w?.defaultSize ?? '1x1'
  }

  function setWidgetSize(id: string, size: WidgetSize) {
    prefs.value = {
      ...prefs.value,
      sizes: { ...prefs.value.sizes, [id]: size },
      preset: null, // resize manuel = plus de preset
    }
  }

  function applyPreset(preset: BentoPrefs) {
    prefs.value = { ...preset }
  }

  function resetDefaults() {
    prefs.value = defaultPrefs()
  }

  function applyDemoPreset() {
    prefs.value = demoStudentPrefs()
  }

  return {
    visibleWidgets,
    allWidgets,
    isVisible,
    toggleWidget,
    reorderWidgets,
    getWidgetSize,
    setWidgetSize,
    applyPreset,
    applyDemoPreset,
    resetDefaults,
    prefs,
  }
}
