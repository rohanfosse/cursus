/**
 * useBentoPrefs — Composable de préférences du bento étudiant.
 * Gère l'ordre et la visibilité des widgets, persistés en localStorage.
 */
import { ref, computed, watch } from 'vue'
import { STORAGE_KEYS } from '@/constants'
import { STUDENT_WIDGETS, type WidgetDef } from '@/components/dashboard/student-widgets/registry'

interface BentoPrefs {
  order: string[]
  hidden: string[]
}

function defaultPrefs(): BentoPrefs {
  return {
    order: STUDENT_WIDGETS.filter(w => w.defaultEnabled).map(w => w.id),
    hidden: STUDENT_WIDGETS.filter(w => !w.defaultEnabled).map(w => w.id),
  }
}

function loadPrefs(): BentoPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BENTO_PREFS)
    if (raw) {
      const parsed = JSON.parse(raw) as BentoPrefs
      // Ensure all known widget ids are accounted for
      const knownIds = new Set(STUDENT_WIDGETS.map(w => w.id))
      parsed.order = parsed.order.filter(id => knownIds.has(id))
      parsed.hidden = parsed.hidden.filter(id => knownIds.has(id))
      // Add any new widgets not yet in prefs
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
    const hiddenIdx = prefs.value.hidden.indexOf(id)
    if (hiddenIdx >= 0) {
      // Show: remove from hidden, add to end of order
      prefs.value.hidden.splice(hiddenIdx, 1)
      if (!prefs.value.order.includes(id)) {
        prefs.value.order.push(id)
      }
    } else {
      // Hide: add to hidden, remove from order
      prefs.value.hidden.push(id)
      const orderIdx = prefs.value.order.indexOf(id)
      if (orderIdx >= 0) prefs.value.order.splice(orderIdx, 1)
    }
  }

  function moveWidget(id: string, direction: 'up' | 'down') {
    const idx = prefs.value.order.indexOf(id)
    if (idx < 0) return
    const target = direction === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= prefs.value.order.length) return
    const arr = [...prefs.value.order]
    ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
    prefs.value.order = arr
  }

  function resetDefaults() {
    prefs.value = defaultPrefs()
  }

  return {
    visibleWidgets,
    allWidgets,
    isVisible,
    toggleWidget,
    moveWidget,
    resetDefaults,
    prefs,
  }
}
