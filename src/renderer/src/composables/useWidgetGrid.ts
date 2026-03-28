/**
 * useWidgetGrid — logique de grille responsive pour le systeme de widgets.
 * Utilise ResizeObserver pour detecter la largeur du conteneur
 * et clamp les tailles de widgets qui depassent le nombre de colonnes.
 */
import { ref, computed, onMounted, onBeforeUnmount, type Ref } from 'vue'
import type { WidgetSize } from '@/types/widgets'
import { sizeToGridSpan } from '@/types/widgets'

/** Breakpoints bases sur la largeur du conteneur (pas du viewport). */
const BREAKPOINTS = {
  desktop: 1024, // >= 1024px : 4 colonnes
  tablet: 600,   // >= 600px  : 2 colonnes
                  // < 600px   : 1 colonne
} as const

export function useWidgetGrid(containerRef: Ref<HTMLElement | null>) {
  const columns = ref(4)
  let observer: ResizeObserver | null = null

  function updateColumns(width: number) {
    if (width >= BREAKPOINTS.desktop) columns.value = 4
    else if (width >= BREAKPOINTS.tablet) columns.value = 2
    else columns.value = 1
  }

  onMounted(() => {
    if (!containerRef.value) return
    observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) updateColumns(entry.contentRect.width)
    })
    observer.observe(containerRef.value)
    // Initial measurement
    updateColumns(containerRef.value.offsetWidth)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
  })

  /** Clamp une taille de widget pour qu'elle ne depasse pas le nombre de colonnes actuel. */
  function clampSize(size: WidgetSize): WidgetSize {
    const { colSpan } = sizeToGridSpan(size)
    if (colSpan <= columns.value) return size
    // Reduire : 4x1 → 2x1 si 2 cols, → 1x1 si 1 col
    if (columns.value === 2) {
      if (size === '4x1') return '2x1'
      return size // 2x1, 2x2, 1x1 OK pour 2 cols
    }
    // 1 colonne : tout devient 1x1
    return '1x1'
  }

  /** Classe CSS pour la grille selon le nombre de colonnes. */
  const gridClass = computed(() => {
    if (columns.value === 4) return 'wg-grid--4col'
    if (columns.value === 2) return 'wg-grid--2col'
    return 'wg-grid--1col'
  })

  /** Style CSS Grid pour le conteneur. */
  const gridStyle = computed(() => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${columns.value}, 1fr)`,
    gridAutoRows: 'minmax(140px, auto)',
    gridAutoFlow: 'dense',
    gap: '12px',
  }))

  return { columns, clampSize, gridClass, gridStyle }
}
