/**
 * useWidgetGrid (v2) — logique de grille responsive pour le systeme de widgets.
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

export function useWidgetGrid(containerRef: Ref<HTMLElement | unknown>) {
  const columns = ref(4)
  let observer: ResizeObserver | null = null

  function updateColumns(width: number) {
    if (width >= BREAKPOINTS.desktop) columns.value = 4
    else if (width >= BREAKPOINTS.tablet) columns.value = 2
    else columns.value = 1
  }

  /**
   * Resout le DOM node a partir d'une ref qui peut etre :
   *  - directement un HTMLElement (ref="div")
   *  - une instance de composant Vue (ref="<VueDraggable>") qui expose
   *    le DOM via `$el`. Sans ce unwrap, ResizeObserver.observe() jette
   *    "Argument 1 does not implement interface Element".
   *  - un mock plain-object en environnement de test (jsdom-less) qui
   *    expose juste `offsetWidth`.
   *
   * Accepte tout objet "DOM-like" via duck-typing (`offsetWidth: number`).
   * En prod c'est toujours un vrai HTMLElement ; en test on tolere les
   * fixtures legeres pour ne pas avoir a creer un vrai DOM.
   */
  function resolveEl(): HTMLElement | null {
    const v = containerRef.value as unknown
    if (!v) return null
    // 1) Vrai HTMLElement (cas prod)
    if (typeof HTMLElement !== 'undefined' && v instanceof HTMLElement) return v
    // 2) Instance de composant Vue : unwrap via $el ou .el (un seul niveau)
    const candidate = (v as { $el?: unknown; el?: unknown }).$el ?? (v as { el?: unknown }).el
    if (candidate) {
      if (typeof HTMLElement !== 'undefined' && candidate instanceof HTMLElement) return candidate as HTMLElement
      // $el peut etre un fragment/comment node — fallback sur le node parent
      if (typeof (candidate as { offsetWidth?: unknown }).offsetWidth === 'number') return candidate as HTMLElement
    }
    // 3) Duck-typing : objet avec offsetWidth (cas tests / SSR)
    if (typeof (v as { offsetWidth?: unknown }).offsetWidth === 'number') return v as HTMLElement
    return null
  }

  onMounted(() => {
    const el = resolveEl()
    if (!el) return
    observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) updateColumns(entry.contentRect.width)
    })
    observer.observe(el)
    // Initial measurement
    updateColumns(el.offsetWidth)
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
